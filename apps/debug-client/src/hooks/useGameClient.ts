import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ClientMessage,
  EnterWorldMessage,
  MoveIntentMessage,
  AttackIntentMessage,
  ChatMessage,
} from '@shared/protocol';
import type { MapName } from '@shared/http';
import {
  DIRECTION_OFFSETS,
  WALKABLE_TILES,
  type Direction,
  type PlayerPublic,
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
} from '../types';
import { loadConfig } from '../config';

const MOVE_REPEAT_MS = 130;
const MOVE_TOKENS_PER_SEC_MAX = 10;
const ATTACK_COOLDOWN_MS = 1200;
const MAX_CHAT = 50;

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

  const sendChat = useCallback(
    (message: string) => {
      if (!message.trim()) return;
      const payload: ChatMessage = { type: 'chat', message: message.slice(0, 240) };
      send(payload);
    },
    [send]
  );

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
              const base = nextMap && nextMap !== s.world.map.name
                ? resetForMap(s, nextMap)
                : s;
              const others = new Map<string, PlayerPublic>();
              for (const p of data.nearby_players || []) others.set(p.id, p);
              return {
                ...base,
                conn,
                world: { ...base.world, me: data.player, others },
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
              pendingMoves.current = [];
              return { ...s, conn, world: { ...s.world, me } };
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

            case 'death_notice': {
              const nextMap = data.map as MapName | undefined;
              if (nextMap && nextMap !== s.world.map.name) {
                const base = resetForMap(s, nextMap);
                return { ...base, conn: { ...base.conn, lastServerAt: now } };
              }
              if (!s.world.me) return { ...s, conn };
              const me = { ...s.world.me, status: 'dead', dead_until_ms: Date.now() + data.respawn_in_ms };
              return { ...s, conn, world: { ...s.world, me } };
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
        return {
          ...s,
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
    sendChat,
    setTarget,
    setStage,
    toggleMap,
    openChat,
    closeChat,
  };

  return [state, api];
}
