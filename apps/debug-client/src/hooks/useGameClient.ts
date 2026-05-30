import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ClientMessage,
  EnterWorldMessage,
  MoveIntentMessage,
  AttackIntentMessage,
  RunestoneCastMessage,
  TalkToNpcMessage,
  ChatMessage,
  GetChronicleMessage,
  ChronicleEvent,
} from '@shared/protocol';
import type { MapName } from '@shared/http';
import {
  DIRECTION_OFFSETS,
  WALKABLE_TILES,
  type Direction,
  type MapData,
  type PlayerPublic,
  type PlayLoopProgress,
} from '@shared/types';
import { getMap } from '../data/maps';
import type {
  ActionCooldown,
  ChatMessageEntry,
  ConnectionState,
  GameClientApi,
  GameClientState,
  FloatingText,
  InputDirection,
  MoveIntent,
  ToastNotice,
  DeathRecap,
  LostItemCount,
} from '../types';
import { loadConfig } from '../config';

const MOVE_REPEAT_MS = 130;
const MOVE_TOKENS_PER_SEC_MAX = 10;
const ATTACK_COOLDOWN_MS = 1200;
const RUNESTONE_TABLE_ID = 'rookguard_runestone_table_01';
const MAX_CHAT = 50;
const DEFAULT_RESPAWN_MS = 15_000;

function wsUrl(base: string): string {
  if (base.startsWith('ws://') || base.startsWith('wss://')) return base;
  return base.replace(/^http/, 'ws');
}

function httpUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`;
}

function initialState(mapName: MapName): GameClientState {
  return {
    world: { map: getMap(mapName), me: null, others: new Map() },
    conn: { phase: 'idle' },
    session: { guestToken: null, playerId: null, name: null, status: 'alive' },
    cooldowns: { attackEndsAt: 0 } as ActionCooldown,
    ui: { stage: 0 },
    chat: [],
    loop: null,
    toast: null,
    recapOpen: false,
    deathRecap: null,
    recapRequestedAt: null,
    recapPreferredGroupId: null,
    chronicleOpen: false,
    chronicle: null,
    combat: { targetId: null, fx: [] },
  };
}

function isWalkable(mapWidth: number, tiles: number[], x: number, y: number): boolean {
  if (x < 0 || y < 0) return false;
  const idx = y * mapWidth + x;
  const code = tiles[idx];
  return WALKABLE_TILES.has(code);
}

function selectAttackTarget(snapshot: GameClientState): PlayerPublic | null {
  const me = snapshot.world.me;
  if (!me) return null;

  if (snapshot.combat.targetId) {
    const explicit = snapshot.world.others.get(snapshot.combat.targetId) ?? null;
    if (explicit && explicit.status !== 'dead') return explicit;
  }

  let best: PlayerPublic | null = null;
  let bestDist = Infinity;
  for (const p of snapshot.world.others.values()) {
    if (p.status === 'dead') continue;
    const dist = Math.abs(p.x - me.x) + Math.abs(p.y - me.y);
    if (dist < bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  return best;
}

function parseTimestampMs(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findOldestTimestamp(events: ChronicleEvent[]): string | null {
  let oldest: ChronicleEvent | null = null;
  let oldestMs = Number.POSITIVE_INFINITY;
  for (const event of events) {
    const ms = parseTimestampMs(event.timestamp);
    if (!ms) continue;
    if (ms < oldestMs) {
      oldestMs = ms;
      oldest = event;
    }
  }
  return oldest?.timestamp ?? null;
}

function runestoneDenialText(reason: unknown): string {
  switch (reason) {
    case 'cooldown':
      return 'The runestone is cooling down';
    case 'not_near_table':
      return 'No runestone nearby';
    case 'not_authorized':
      return 'Ritual disabled on this server';
    case 'rate_limited':
      return 'Ritual rate limited';
    default:
      return 'Ritual refused';
  }
}

function getEventGroupId(event: ChronicleEvent): number | null {
  const ref = event.evidence_ref;
  return typeof ref?.chronicle_event_id === 'number' ? ref.chronicle_event_id : null;
}

function buildDeathRecap(
  events: ChronicleEvent[],
  targetMs?: number | null,
  preferredGroupId?: number | null
): DeathRecap | null {
  const deathEvents = events.filter((event) => event.kind === 'death');
  if (deathEvents.length === 0) return null;

  let deathEvent: ChronicleEvent | null = null;
  let selectedBy: 'group' | 'time' | 'latest' | null = null;
  if (preferredGroupId != null) {
    const inGroup = deathEvents.filter((event) => getEventGroupId(event) === preferredGroupId);
    if (inGroup.length > 0) {
      deathEvent = inGroup
        .slice()
        .sort((a, b) => parseTimestampMs(b.timestamp) - parseTimestampMs(a.timestamp))[0];
      if (deathEvent) selectedBy = 'group';
    }
  }

  if (!deathEvent && targetMs && targetMs > 0) {
    const windowStart = targetMs - 5000;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const event of deathEvents) {
      const ts = parseTimestampMs(event.timestamp);
      if (!ts) continue;
      if (ts < windowStart) continue;
      const score = Math.abs(ts - targetMs);
      if (score < bestScore) {
        bestScore = score;
        deathEvent = event;
        selectedBy = 'time';
      }
    }
  }

  if (!deathEvent) {
    deathEvent = deathEvents
      .slice()
      .sort((a, b) => parseTimestampMs(b.timestamp) - parseTimestampMs(a.timestamp))[0];
    if (deathEvent) selectedBy = 'latest';
  }
  if (!deathEvent) return null;

  const groupId = preferredGroupId ?? getEventGroupId(deathEvent);
  const counts = new Map<string, number>();

  for (const event of events) {
    if (event.kind !== 'item_lost') continue;
    const details = event.details as Record<string, unknown> | undefined;
    if (details?.reason !== 'death') continue;

    const matchesGroup = groupId !== null
      ? getEventGroupId(event) === groupId
      : event.timestamp === deathEvent.timestamp &&
        event.zone === deathEvent.zone &&
        event.x === deathEvent.x &&
        event.y === deathEvent.y;
    if (!matchesGroup) continue;

    const itemType = typeof details.item_type === 'string' ? details.item_type : 'item';
    counts.set(itemType, (counts.get(itemType) ?? 0) + 1);
  }

  const lost: LostItemCount[] = Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, qty]) => ({ kind, qty }));

  return { deathEvent, lost, selectedBy: selectedBy ?? 'latest' };
}

function isMapData(value: unknown): value is MapData {
  if (!value || typeof value !== 'object') return false;
  const map = value as Partial<MapData>;
  return (
    typeof map.name === 'string' &&
    typeof map.width === 'number' &&
    typeof map.height === 'number' &&
    Array.isArray(map.tiles) &&
    !!map.spawn &&
    typeof map.spawn.x === 'number' &&
    typeof map.spawn.y === 'number'
  );
}

function isLoop(value: unknown): value is PlayLoopProgress {
  if (!value || typeof value !== 'object') return false;
  const loop = value as Partial<PlayLoopProgress>;
  return (
    typeof loop.move === 'boolean' &&
    typeof loop.chat === 'boolean' &&
    typeof loop.tem === 'boolean' &&
    typeof loop.gate === 'boolean' &&
    typeof loop.complete === 'boolean' &&
    typeof loop.gateOpen === 'boolean' &&
    typeof loop.objective === 'string'
  );
}

export function useGameClient(mapName: MapName): [GameClientState, GameClientApi] {
  const config = useMemo(() => loadConfig(), []);
  const [state, setState] = useState(() => initialState(mapName));
  const stateRef = useRef<GameClientState>(state);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingMoves = useRef<MoveIntent[]>([]);
  const moveTimer = useRef<number | null>(null);
  const activeDirections = useRef<Set<InputDirection>>(new Set());
  const chatOpen = useRef(false);
  const nextMoveId = useRef(1);
  const moveTokens = useRef(MOVE_TOKENS_PER_SEC_MAX);
  const lastTokenRefillAt = useRef(performance.now());
  const diagFlip = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now();
      setState((s) => {
        if (s.combat.fx.length === 0) return s;
        const nextFx = s.combat.fx.filter((f) => now - f.at <= f.ttlMs);
        if (nextFx.length === s.combat.fx.length) return s;
        return { ...s, combat: { ...s.combat, fx: nextFx } };
      });
    }, 200);
    return () => window.clearInterval(t);
  }, []);

  const setStage = useCallback((stage: 0 | 1 | 2 | 3) => {
    setState((s) => ({ ...s, ui: { stage } }));
  }, []);

  const openChat = useCallback(() => {
    chatOpen.current = true;
  }, []);

  const closeChat = useCallback(() => {
    chatOpen.current = false;
  }, []);

  const clearMoveTimer = useCallback(() => {
    if (moveTimer.current) {
      window.clearInterval(moveTimer.current);
      moveTimer.current = null;
    }
  }, []);

  const resetForMap = useCallback(
    (s: GameClientState, map: MapName): GameClientState => {
      clearMoveTimer();
      activeDirections.current.clear();
      pendingMoves.current = [];
      moveTokens.current = MOVE_TOKENS_PER_SEC_MAX;
      lastTokenRefillAt.current = performance.now();
      diagFlip.current = false;
      return {
        ...s,
        conn: { phase: 'awaiting_world_state' },
        world: { map: getMap(map), me: null, others: new Map() },
        chat: [],
        loop: null,
        toast: null,
        recapOpen: false,
        deathRecap: null,
        recapRequestedAt: null,
        recapPreferredGroupId: null,
        chronicleOpen: false,
        chronicle: null,
        combat: { targetId: null, fx: [] },
      };
    },
    [clearMoveTimer]
  );

  const resetSessionState = useCallback(
    (map: MapName) => {
      setState((s) => resetForMap(s, map));
    },
    [resetForMap]
  );

  const addChatLine = (s: GameClientState, from: string, message: string): GameClientState => {
    const entry: ChatMessageEntry = {
      id: `${from}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      from,
      message,
      at: Date.now(),
    };
    return { ...s, chat: [...s.chat, entry].slice(-MAX_CHAT) };
  };

  const addFx = (s: GameClientState, fx: Omit<FloatingText, 'id'>): GameClientState => {
    const id = `${fx.x},${fx.y}-${fx.at}-${Math.random().toString(16).slice(2)}`;
    const now = Date.now();
    const next = [...s.combat.fx, { ...fx, id }].filter((f) => now - f.at <= f.ttlMs);
    return { ...s, combat: { ...s.combat, fx: next } };
  };

  const pushToast = (
    s: GameClientState,
    from: string,
    message: string,
    fxText?: string
  ): GameClientState => {
    let next = addChatLine(s, from, message);
    if (fxText && next.world.me) {
      next = addFx(next, {
        x: next.world.me.x,
        y: next.world.me.y,
        text: fxText,
        at: Date.now(),
        ttlMs: 700,
      });
    }
    return next;
  };

  const formatLostItems = (items: unknown): string => {
    if (items === undefined) return 'Lost: (unknown)';
    if (!Array.isArray(items)) return 'Lost: (unknown)';
    if (items.length === 0) return 'Lost: none';

    const parts: string[] = [];
    for (const entry of items) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;

      const kind =
        typeof record.kind === 'string' && record.kind.trim() ? record.kind : 'item';

      const qtyRaw = typeof record.qty === 'number' ? record.qty : 1;
      const qty = qtyRaw > 1 ? Math.floor(qtyRaw) : 1;

      const rarity =
        typeof record.rarity === 'string' && record.rarity.trim() ? record.rarity : '';

      let label = kind;
      if (rarity) label += ` (${rarity})`;
      if (qty > 1) label += ` x${qty}`;
      parts.push(label);
    }

    if (parts.length === 0) return 'Lost: (unknown)';
    return `Lost: ${parts.join(', ')}`;
  };

  const refillTokens = () => {
    const now = performance.now();
    const elapsed = now - lastTokenRefillAt.current;
    if (elapsed >= 1000) {
      const grants = Math.floor(elapsed / 1000) * MOVE_TOKENS_PER_SEC_MAX;
      moveTokens.current = Math.min(MOVE_TOKENS_PER_SEC_MAX, moveTokens.current + grants);
      lastTokenRefillAt.current = now;
    }
  };

  const canSendMove = () => {
    refillTokens();
    if (moveTokens.current <= 0) return false;
    moveTokens.current -= 1;
    return true;
  };

  const applyPrediction = useCallback(
    (dir: Direction) => {
      setState((s) => {
        if (!s.world.me) return s;
        const { map } = s.world;
        const delta = DIRECTION_OFFSETS[dir];
        const nx = s.world.me.x + delta.x;
        const ny = s.world.me.y + delta.y;
        if (!isWalkable(map.width, map.tiles, nx, ny)) return s;
        const me = { ...s.world.me, x: nx, y: ny } as PlayerPublic;
        return { ...s, world: { ...s.world, me } };
      });
    },
    []
  );

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(msg));
  }, []);

  const queueMove = useCallback(
    (dir: Direction) => {
      if (!canSendMove()) return false;
      const move: MoveIntent = { id: nextMoveId.current++, dir, issuedAt: Date.now() };
      pendingMoves.current.push(move);
      applyPrediction(dir);
      const payload: MoveIntentMessage = { type: 'move_intent', direction: dir };
      send(payload);
      return true;
    },
    [applyPrediction, send]
  );

  const translateInput = useCallback(
    (dir: InputDirection) => {
      const flip = diagFlip.current;
      let resolved: Direction;
      switch (dir) {
        case 'north_east':
          resolved = flip ? 'north' : 'east';
          break;
        case 'south_east':
          resolved = flip ? 'south' : 'east';
          break;
        case 'south_west':
          resolved = flip ? 'south' : 'west';
          break;
        case 'north_west':
          resolved = flip ? 'north' : 'west';
          break;
        default:
          resolved = dir;
      }
      diagFlip.current = !flip;
      queueMove(resolved);
    },
    [queueMove]
  );

  const startMoveRepeater = useCallback(() => {
    if (moveTimer.current || activeDirections.current.size === 0) return;
    moveTimer.current = window.setInterval(() => {
      for (const dir of activeDirections.current) {
        translateInput(dir);
      }
    }, MOVE_REPEAT_MS);
  }, [translateInput]);

  const stopMoveRepeater = useCallback(() => {
    clearMoveTimer();
    activeDirections.current.clear();
  }, [clearMoveTimer]);

  const sendMove = useCallback(
    (dir: InputDirection) => {
      activeDirections.current.add(dir);
      translateInput(dir);
      startMoveRepeater();
    },
    [startMoveRepeater, translateInput]
  );

  const releaseMove = useCallback(
    (dir: InputDirection) => {
      activeDirections.current.delete(dir);
      if (activeDirections.current.size === 0) {
        stopMoveRepeater();
      }
    },
    [stopMoveRepeater]
  );

  const stopMoves = useCallback(() => {
    stopMoveRepeater();
  }, [stopMoveRepeater]);

  const sendAttack = useCallback(() => {
    const snapshot = stateRef.current;
    const now = Date.now();
    if (now < snapshot.cooldowns.attackEndsAt) return;
    if (!snapshot.world.me) return;

    const target = selectAttackTarget(snapshot);
    if (!target) {
      setState((s) => pushToast(s, 'system', 'No targets nearby', 'NO TARGET'));
      return;
    }
    if (target.id === snapshot.world.me.id) return;

    setState((s) => ({
      ...s,
      cooldowns: { ...s.cooldowns, attackEndsAt: now + ATTACK_COOLDOWN_MS },
    }));
    const payload: AttackIntentMessage = { type: 'attack_intent', target_id: target.id };
    send(payload);

    if (navigator.vibrate) navigator.vibrate(30);
  }, [send]);

  const castRunestone = useCallback(() => {
    const payload: RunestoneCastMessage = {
      type: 'runestone_cast',
      table_id: RUNESTONE_TABLE_ID,
      guess: null,
    };
    send(payload);
  }, [send]);

  const talkToNpc = useCallback((npcId: string) => {
    const payload: TalkToNpcMessage = { type: 'talk_to_npc', npc_id: npcId };
    send(payload);
  }, [send]);

  const sendChat = useCallback(
    (message: string) => {
      if (!message.trim()) return;
      const payload: ChatMessage = { type: 'chat', message: message.slice(0, 240) };
      send(payload);
    },
    [send]
  );

  const sendChronicleRequest = useCallback(
    (limit = 50, before?: string | null) => {
      const payload: GetChronicleMessage = { type: 'get_chronicle', limit };
      if (before) payload.before = before;
      console.log(`[debug-client] request get_chronicle limit=${limit}${before ? ` before=${before}` : ''}`);
      send(payload);
    },
    [send]
  );

  const requestChronicle = useCallback(
    (limit = 10, openRecap = false) => {
      if (openRecap) {
        setState((s) => ({
          ...s,
          recapOpen: true,
          deathRecap: null,
          recapRequestedAt: Date.now(),
          recapPreferredGroupId: null,
          toast: null,
        }));
      }
      sendChronicleRequest(limit);
    },
    [sendChronicleRequest]
  );

  const openRecapFromChronicle = useCallback(
    (anchor: {
      timestamp: string;
      chronicle_event_id?: number | null;
      zone?: string | null;
      x?: number | null;
      y?: number | null;
    }) => {
      const targetMs = Date.parse(anchor.timestamp);
      const ms = Number.isFinite(targetMs) ? targetMs : Date.now();

      const snapshot = stateRef.current;
      const local = snapshot.chronicle?.events ?? [];
      const localRecap = local.length > 0
        ? buildDeathRecap(local, ms, anchor.chronicle_event_id ?? null)
        : null;

      setState((s) => ({
        ...s,
        recapOpen: true,
        recapRequestedAt: ms,
        recapPreferredGroupId: anchor.chronicle_event_id ?? null,
        toast: null,
        deathRecap: localRecap,
      }));

      if (!localRecap) sendChronicleRequest(50);
    },
    [sendChronicleRequest]
  );

  const openChronicle = useCallback(() => {
    setState((s) => ({
      ...s,
      chronicleOpen: true,
      chronicle: {
        events: [],
        hasMore: false,
        loading: true,
        before: null,
      },
    }));
    sendChronicleRequest(50);
  }, [sendChronicleRequest]);

  const closeChronicle = useCallback(() => {
    setState((s) => ({ ...s, chronicleOpen: false, chronicle: null }));
  }, []);

  const loadMoreChronicle = useCallback(() => {
    const snapshot = stateRef.current;
    if (!snapshot.chronicleOpen || !snapshot.chronicle) return;
    if (snapshot.chronicle.loading || !snapshot.chronicle.hasMore || !snapshot.chronicle.before) return;
    setState((s) => ({
      ...s,
      chronicle: s.chronicle ? { ...s.chronicle, loading: true } : s.chronicle,
    }));
    sendChronicleRequest(50, snapshot.chronicle.before);
  }, [sendChronicleRequest]);

  const closeRecap = useCallback(() => {
    setState((s) => ({
      ...s,
      recapOpen: false,
      deathRecap: null,
      recapRequestedAt: null,
      recapPreferredGroupId: null,
    }));
  }, []);

  const setTarget = useCallback((playerId: string | null) => {
    setState((s) => {
      if (!playerId) return { ...s, combat: { ...s.combat, targetId: null } };
      if (s.world.me && playerId === s.world.me.id) return s;
      return { ...s, combat: { ...s.combat, targetId: playerId } };
    });
  }, []);

  const attachHandlers = useCallback((ws: WebSocket) => {
    ws.addEventListener('message', (ev) => {
      try {
        const data = JSON.parse(ev.data as string);
        setState((s) => {
          const now = Date.now();
          const conn: ConnectionState = { ...s.conn, lastServerAt: now, phase: 'connected' };
          switch (data.type) {
            case 'welcome':
              return { ...s, conn };
            case 'login_ack':
              if (data.ok === false) {
                const reason = typeof data.reason === 'string' ? data.reason : 'login_failed';
                return {
                  ...s,
                  conn: { ...conn, phase: 'error', reason },
                  session: { ...s.session, guestToken: null, playerId: null, name: null },
                };
              }
              return {
                ...s,
                conn,
                session: {
                  guestToken: data.guest_token,
                  playerId: data.player_id,
                  name: data.name,
                  status: s.session.status,
                },
              };
            case 'world_state': {
              const nextMap = data.map as MapName | undefined;
              const runtimeMap = isMapData(data.map_data) ? data.map_data : null;
              const loop = isLoop(data.loop) ? data.loop : isLoop(data.player?.loop) ? data.player.loop : s.loop;
              const base = nextMap && nextMap !== s.world.map.name
                ? resetForMap(s, nextMap)
                : s;
              const others = new Map<string, PlayerPublic>();
              for (const p of data.nearby_players || []) others.set(p.id, p);
              return {
                ...base,
                conn,
                loop,
                world: { map: runtimeMap ?? base.world.map, me: data.player, others },
              };
            }
            case 'player_moved': {
              const { player_id, x, y } = data;
              if (s.world.me && player_id === s.world.me.id) {
                const me = { ...s.world.me, x, y } as PlayerPublic;
                pendingMoves.current = [];
                return { ...s, conn, world: { ...s.world, me } };
              }
              const others = new Map(s.world.others);
              const target = others.get(player_id);
              if (target) {
                others.set(player_id, { ...target, x, y });
                return { ...s, conn, world: { ...s.world, others } };
              }
              return { ...s, conn };
            }
            case 'player_joined': {
              const others = new Map(s.world.others);
              const p = data.player as PlayerPublic;
              if (s.world.me && p.id === s.world.me.id) return { ...s, conn };
              others.set(p.id, p);
              return { ...s, conn, world: { ...s.world, others } };
            }
            case 'player_left': {
              const others = new Map(s.world.others);
              others.delete(data.player_id);
              const nextTarget = s.combat.targetId === data.player_id ? null : s.combat.targetId;
              return { ...s, conn, world: { ...s.world, others }, combat: { ...s.combat, targetId: nextTarget } };
            }
            case 'move_result': {
              const nextMap = data.map as MapName | undefined;
              if (nextMap && nextMap !== s.world.map.name) {
                const base = resetForMap(s, nextMap);
                return { ...base, conn: { ...base.conn, lastServerAt: now } };
              }
              if (!s.world.me) return { ...s, conn };
              const me = { ...s.world.me, x: data.x, y: data.y } as PlayerPublic;
              const loop = isLoop(data.loop) ? data.loop : s.loop;
              pendingMoves.current = [];
              return { ...s, conn, loop, world: { ...s.world, me } };
            }
            case 'loop_update': {
              const loop = isLoop(data.loop) ? data.loop : s.loop;
              const next = loop && data.event
                ? pushToast(s, 'objective', loop.objective, String(data.event).includes('complete') ? 'DONE' : 'STEP')
                : s;
              return { ...next, conn, loop };
            }
            case 'chat_broadcast': {
              const entry: ChatMessageEntry = {
                id: `${data.player_id}-${Date.now()}`,
                from: data.name,
                message: data.message,
                at: Date.now(),
              };
              const nextChat = [...s.chat, entry].slice(-MAX_CHAT);
              return { ...s, conn, chat: nextChat };
            }
            case 'tem_challenge': {
              const line = typeof data.message === 'string'
                ? data.message
                : 'Tem challenge: respond in chat.';
              const next = addChatLine(s, 'tem', line);
              return { ...next, conn };
            }
            case 'error': {
              const code = typeof data.code === 'string' ? data.code : 'error';
              const message = typeof data.message === 'string' ? data.message : 'Unknown error';
              const next = pushToast(s, 'system', `${code}: ${message}`, 'ERROR');
              const cooldowns = { ...next.cooldowns, attackEndsAt: now };
              if (code === 'not_authenticated') {
                return {
                  ...next,
                  conn: { ...conn, phase: 'error', reason: message },
                  session: { ...s.session, guestToken: null, playerId: null, name: null },
                  cooldowns,
                };
              }
              return { ...next, conn, cooldowns };
            }

            case 'combat_resolved': {
              if (data.map !== s.world.map.name) return { ...s, conn };

              const defender = s.world.others.get(data.defender_id);
              const defenderName = defender?.name ?? data.defender_id;
              const isMeAttacker = s.world.me?.id === data.attacker_id;
              const isMeDefender = s.world.me?.id === data.defender_id;

              const text = isMeDefender ? 'You died' : 'KILL';
              const fx: Omit<FloatingText, 'id'> = { x: data.x, y: data.y, text, at: Date.now(), ttlMs: 900 };

              const line = isMeAttacker
                ? `Confirmed: you killed ${defenderName}`
                : isMeDefender
                  ? 'Confirmed: you were killed'
                  : `Combat: ${data.attacker_id} killed ${defenderName}`;

              let next = addFx(s, fx);
              next = addChatLine(next, 'combat', line);
              return { ...next, conn };
            }

            case 'combat_rejected': {
              const reason = typeof data.reason === 'string' ? data.reason : 'rejected';
              const next = pushToast(s, 'combat', `Rejected: ${reason}`, reason === 'cooldown' ? 'COOLDOWN' : 'REJECTED');
              const cooldownEndsAt =
                reason === 'cooldown'
                  ? Math.max(s.cooldowns.attackEndsAt, now + ATTACK_COOLDOWN_MS)
                  : now;
              return { ...next, conn, cooldowns: { ...next.cooldowns, attackEndsAt: cooldownEndsAt } };
            }

            case 'runestone_result': {
              const face = typeof data.face === 'string' ? data.face : 'unknown';
              const whisper = typeof data.whisper === 'string' ? data.whisper : 'The stone answers.';
              const casterName =
                data.caster && typeof data.caster === 'object' && typeof data.caster.name === 'string'
                  ? data.caster.name
                  : 'someone';
              const line = `${casterName} cast the runestone: ${face}. ${whisper}`;
              return pushToast(s, 'runestone', line, String(face).toUpperCase());
            }

            case 'runestone_denied': {
              const line = runestoneDenialText(data.reason);
              return pushToast(s, 'runestone', line, 'RITUAL');
            }

            case 'npc_dialogue': {
              const npcLabel = typeof data.npc_id === 'string'
                ? data.npc_id.replace(/_/g, ' ')
                : 'NPC';
              const line = typeof data.line === 'string' ? data.line : '...';
              return pushToast(s, 'npc', line, npcLabel.toUpperCase());
            }

            case 'npc_dialogue_error': {
              const msg = data.error === 'not_in_place'
                ? 'Not close enough to speak'
                : 'Unknown NPC';
              return pushToast(s, 'npc', msg, 'NPC');
            }

            case 'chronicle_snapshot': {
              const events = Array.isArray(data.events) ? data.events as ChronicleEvent[] : [];
              const hasMore = typeof data.has_more === 'boolean' ? data.has_more : false;
              console.log(`[debug-client] chronicle_snapshot events=${events.length} has_more=${hasMore}`);
              if (!s.recapOpen && !s.chronicleOpen) return { ...s, conn };

              let nextChronicle = s.chronicle;
              if (s.chronicleOpen) {
                const prevEvents = s.chronicle?.events ?? [];
                const shouldAppend = !!s.chronicle?.before && prevEvents.length > 0 && s.chronicle.loading;
                const merged = shouldAppend ? [...prevEvents, ...events] : events;
                nextChronicle = {
                  events: merged,
                  hasMore,
                  loading: false,
                  before: findOldestTimestamp(merged) ?? s.chronicle?.before ?? null,
                };
              }

              let recap = s.deathRecap;
              if (s.recapOpen) {
                recap = buildDeathRecap(events, s.recapRequestedAt, s.recapPreferredGroupId);
                if (import.meta.env?.DEV && recap?.deathEvent) {
                  console.log(
                    `[debug-client] recap selected ts=${recap.deathEvent.timestamp} gid=${getEventGroupId(recap.deathEvent)} lost=${recap.lost.length} picked=${recap.selectedBy ?? 'unknown'}`
                  );
                }
              }

              return {
                ...s,
                conn,
                ...(s.chronicleOpen ? { chronicle: nextChronicle } : {}),
                ...(s.recapOpen ? { deathRecap: recap } : {}),
              };
            }

            case 'death_notice': {
              const nextMap = data.map as MapName | undefined;
              if (nextMap && nextMap !== s.world.map.name) {
                const base = resetForMap(s, nextMap);
                return { ...base, conn: { ...base.conn, lastServerAt: now } };
              }
              if (!s.world.me) return { ...s, conn };
              const respawnMs =
                typeof data.respawn_in_ms === 'number' &&
                Number.isFinite(data.respawn_in_ms) &&
                data.respawn_in_ms >= 0
                  ? data.respawn_in_ms
                  : DEFAULT_RESPAWN_MS;
              const me = { ...s.world.me, status: 'dead', dead_until_ms: Date.now() + respawnMs };
              const hasLostItems = Object.prototype.hasOwnProperty.call(data, 'lost_items');
              const detail = hasLostItems ? formatLostItems((data as { lost_items?: unknown }).lost_items) : undefined;
              const toast: ToastNotice = {
                id: `death-${now}`,
                title: 'You died',
                ...(detail ? { detail } : {}),
                at: now,
                expiresAt: now + 5000,
              };
              return { ...s, conn, world: { ...s.world, me }, toast };
            }
            default:
              return { ...s, conn };
          }
        });
      } catch (err) {
        console.error('ws message parse error', err);
      }
    });

    ws.addEventListener('close', () => {
      clearMoveTimer();
      setState((s) => ({ ...s, conn: { phase: 'disconnected', reason: 'socket_closed' } }));
    });

    ws.addEventListener('error', () => {
      setState((s) => ({ ...s, conn: { phase: 'error', reason: 'socket_error' } }));
    });
  }, []);

  const hydrateToken = useCallback(async () => {
    const url = httpUrl(config.httpBase, '/v1/session/guest');
    const resp = await fetch(url, { method: 'POST' });
    if (!resp.ok) throw new Error('Failed to mint guest session');
    const body = await resp.json();
    return body.guest_token as string;
  }, [config.httpBase]);

  const hydrateWorld = useCallback(
    async (token: string, map: MapName) => {
      const url = httpUrl(config.httpBase, `/v1/world/${map}/state`);
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setState((s) => {
        const status = data.me?.status || s.session.status;
        const runtimeMap = isMapData(data.map_data) ? data.map_data : s.world.map;
        const loop = isLoop(data.loop) ? data.loop : isLoop(data.me?.loop) ? data.me.loop : s.loop;
        return {
          ...s,
          loop,
          world: { ...s.world, map: runtimeMap },
          session: { ...s.session, status },
        };
      });
    },
    [config.httpBase]
  );

  const boot = useCallback(
    async (map: MapName = mapName) => {
      try {
        resetSessionState(map);
        setState((s) => ({ ...s, conn: { phase: 'connecting' } }));
        const token = await hydrateToken();
        await hydrateWorld(token, map);
        setState((s) => ({
          ...s,
          session: { ...s.session, guestToken: token },
        }));
        const ws = new WebSocket(wsUrl(config.wsBase));
        wsRef.current = ws;
        attachHandlers(ws);
        ws.addEventListener('open', () => {
          const connectMsg: ClientMessage = { type: 'connect' };
          const loginMsg: ClientMessage = { type: 'login', guest_token: token };
          const enterMsg: EnterWorldMessage = { type: 'enter_world' };
          ws.send(JSON.stringify(connectMsg));
          ws.send(JSON.stringify(loginMsg));
          ws.send(JSON.stringify(enterMsg));
          setState((s) => ({ ...s, conn: { ...s.conn, phase: 'awaiting_world_state' } }));
        });
      } catch (err) {
        console.error(err);
        setState((s) => ({ ...s, conn: { phase: 'error', reason: (err as Error).message } }));
      }
    },
    [attachHandlers, config.wsBase, hydrateToken, hydrateWorld, mapName, resetSessionState]
  );

  const toggleMap = useCallback(
    (newMap: MapName) => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      resetSessionState(newMap);
      boot(newMap);
    },
    [boot, resetSessionState]
  );

  useEffect(() => {
    resetSessionState(mapName);
    boot(mapName);
    return () => {
      clearMoveTimer();
      wsRef.current?.close();
    };
  }, [boot, mapName, resetSessionState]);

  const api: GameClientApi = {
    sendMove,
    releaseMove,
    stopMoves,
    sendAttack,
    castRunestone,
    talkToNpc,
    sendChat,
    requestChronicle,
    openChronicle,
    closeChronicle,
    loadMoreChronicle,
    openRecapFromChronicle,
    closeRecap,
    setTarget,
    setStage,
    toggleMap,
    openChat,
    closeChat,
  };

  return [state, api];
}
