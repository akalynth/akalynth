import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ClientMessage,
  EnterWorldMessage,
  MoveIntentMessage,
  AttackIntentMessage,
  RunestoneCastMessage,
  TalkToNpcMessage,
  DeclareVocationMessage,
  UseSkillMessage,
  PickupItemMessage,
  StartWorkContractMessage,
  WorkTickMessage,
  ChatMessage,
  GetChronicleMessage,
  ChronicleEvent,
  PropertyPublic,
  GatherIntentMessage,
  DeliverIntentMessage,
  RefineIntentMessage,
  GatherNodePublic,
  GatherStationPublic,
  TemResponseMessage,
  TemWitnessResponseMessage,
  WitnessResponse,
  DropItemMessage,
  SetProtectedSlotMessage,
  InspectPlayerMessage,
  InspectWalletMessage,
  PayTitheMessage,
  GetPropertyLedgerMessage,
  OpenHouseAuctionMessage,
  PlaceHouseBidMessage,
  CancelHouseAuctionMessage,
} from '@shared/protocol';
import type { BuilderPreviewWorldFork } from '@shared/builderDraft';
import type { AccountCharacterCreateRequest, AccountCharacterPlayResponse, MapName } from '@shared/http';
import { normalizeMapName } from '@shared/http';
import { loadIdentity, saveIdentity, clearIdentity, hasValidToken } from '../identity';
import {
  DIRECTION_OFFSETS,
  WALKABLE_TILES,
  type Direction,
  type MapData,
  type PlayerPublic,
  type PlayLoopProgress,
  type SovereignVocation,
} from '@shared/types';
import { getMap } from '../data/maps';
import { deliverStatusLine } from '../data/gatherLabels';
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
  CharacterCreateInput,
  CharacterCatalog,
  AccountCharacter,
  CharacterWorldOption,
  CharacterOutfitOption,
  CreateResult,
  AccountSessionStatus,
} from '../types';
import { loadConfig } from '../config';

const MOVE_REPEAT_MS = 130;
const MOVE_TOKENS_PER_SEC_MAX = 10;
const ATTACK_COOLDOWN_MS = 1200;
const RUNESTONE_TABLE_ID = 'rookguard_runestone_table_01';
const MAX_CHAT = 50;
const DEFAULT_RESPAWN_MS = 15_000;
const CSRF_COOKIE = 'akalynth_csrf';
const ACCOUNT_REQUIRED_MESSAGE = 'Sign in to an account before creating a character.';
const ACCOUNT_EXPIRED_MESSAGE = 'Account session expired. Sign in again before creating a character.';
const ACCOUNT_CSRF_REQUIRED_MESSAGE = 'Account session needs a CSRF token. Sign in again before creating or selecting a character.';
const ACCOUNT_UNVERIFIED_MESSAGE = 'Verify email before creating a character. Existing characters can still be selected.';
const ACCOUNT_SERVICE_UNAVAILABLE_MESSAGE = 'Account service unavailable. Try again soon.';
const CHARACTER_OPTIONS_UNAVAILABLE_MESSAGE = 'Character setup offline. Try again soon.';
const ACCOUNT_CHARACTER_WORLD_IDS = new Set(['rookguard', 'high_city']);
const ACCOUNT_CHARACTER_OUTFIT_IDS = new Set([
  'male_wanderer',
  'male_guard',
  'male_mage',
  'female_wanderer',
  'female_guard',
  'female_mage',
]);
const ROUTE_ACTION_SKILL_IDS = new Set([
  'activity:fishing:rookguard',
  'route:survey:forgehold',
  'route:survey:moonspire',
  'route:safety:forgehold',
  'route:safety:moonspire',
  'route:evidence:milepost',
  'route:evidence:caravan',
  'route:evidence:ravine',
  'route:quest:shipment',
  'route:economy:forgehold',
  'route:economy:settle',
  'route:economy:payout',
  'route:craft:soulsteel',
  'route:craft:ashglass',
  'route:craft:refine',
  'route:craft:mint',
  'route:gate:heartforge',
  'route:gate:moonspire',
  'route:dream:traverse',
  'route:dream:arrive',
  'route:dream:interpret',
  'route:dream:fragment',
]);

function wsUrl(base: string): string {
  if (base.startsWith('ws://') || base.startsWith('wss://')) return base;
  return base.replace(/^http/, 'ws');
}

function readCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const parts = document.cookie ? document.cookie.split(';') : [];
  for (const part of parts) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName !== name) continue;
    return decodeURIComponent((rest.join('=') || '').trim());
  }
  return '';
}

function httpUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`;
}

function accountCharacterErrorMessage(status: number, body: unknown, fallback: string): string {
  const error = (body as Record<string, unknown> | null)?.error;
  const message = (body as Record<string, unknown> | null)?.message;
  if (status === 401) return ACCOUNT_REQUIRED_MESSAGE;
  if (status === 403 && error === 'email_unverified') return ACCOUNT_UNVERIFIED_MESSAGE;
  if (status === 403 && error === 'csrf_failed') return ACCOUNT_CSRF_REQUIRED_MESSAGE;
  if (status === 403) return ACCOUNT_EXPIRED_MESSAGE;
  if (status === 404 && (error === 'character_not_found' || error === 'not_found')) {
    return 'That character is not available on the signed-in account.';
  }
  if (status === 400 && error === 'invalid_input') {
    return 'Choose a valid name, world, sex, and outfit.';
  }
  if (status === 409 && error === 'name_taken') {
    return 'That character name is already taken.';
  }
  if (typeof message === 'string' && message) return message;
  return fallback;
}

function isBrowserNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|load failed|networkerror|network request failed/i.test(message);
}

function accountServiceErrorMessage(error: unknown, fallback: string): string {
  return isBrowserNetworkError(error) ? ACCOUNT_SERVICE_UNAVAILABLE_MESSAGE : fallback;
}

function characterOptionsErrorMessage(error: unknown): string {
  if (isBrowserNetworkError(error)) return CHARACTER_OPTIONS_UNAVAILABLE_MESSAGE;
  return (error as Error).message || 'Could not load character options';
}

function initialState(mapName: MapName): GameClientState {
  return {
    world: { map: getMap(mapName), me: null, others: new Map(), builderPreview: null },
    conn: { phase: 'idle' },
    session: { guestToken: null, playerId: null, name: null, status: 'alive', token: null, authenticated: false },
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
    groundItems: new Map(),
    workContract: null,
    inventory: [],
    houseStorage: [],
    guildTreasury: null,
    guildContributions: null,
    gold: 0,
    properties: new Map(),
    gather: { nodes: new Map(), stations: new Map(), activeNodeId: null, activeRefineStationId: null, progressPct: 0, held: null, tendingTokens: 0, keystoneTokens: 0, status: null },
    propertyLedger: null,
    auctionStates: new Map(),
    temChallenge: null,
    temWitnessRequest: null,
    inspectedPlayer: null,
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

function isCharacterCatalogWorld(value: unknown): value is CharacterWorldOption {
  const worldId = (value as Record<string, unknown>)?.world_id;
  return (
    !!value &&
    typeof value === 'object' &&
    typeof worldId === 'string' &&
    ACCOUNT_CHARACTER_WORLD_IDS.has(worldId) &&
    typeof (value as Record<string, unknown>).name === 'string'
  );
}

function isCharacterCatalogOutfit(value: unknown): value is CharacterOutfitOption {
  const sex = (value as Record<string, unknown>).sex;
  const outfitId = (value as Record<string, unknown>)?.outfit_id;
  return (
    !!value &&
    typeof value === 'object' &&
    typeof outfitId === 'string' &&
    ACCOUNT_CHARACTER_OUTFIT_IDS.has(outfitId) &&
    (sex === 'male' || sex === 'female') &&
    (typeof (value as Record<string, unknown>).name === 'string')
  );
}

function isAccountCharacter(value: unknown): value is AccountCharacter {
  const worldId = (value as Record<string, unknown>)?.world_id;
  const sex = (value as Record<string, unknown>).sex;
  const outfitId = (value as Record<string, unknown>)?.outfit_id;
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).character_id === 'string' &&
    typeof (value as Record<string, unknown>).name === 'string' &&
    typeof worldId === 'string' &&
    ACCOUNT_CHARACTER_WORLD_IDS.has(worldId) &&
    (sex === 'male' || sex === 'female') &&
    typeof outfitId === 'string' &&
    ACCOUNT_CHARACTER_OUTFIT_IDS.has(outfitId)
  );
}

function isAccountCharacterPlayResponse(value: unknown): value is AccountCharacterPlayResponse {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).ok === true &&
    isAccountCharacter((value as Record<string, unknown>).character) &&
    typeof (value as Record<string, unknown>).token === 'string' &&
    typeof (value as Record<string, unknown>).expires_at === 'number'
  );
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

type RequiredAccountSession =
  | { ok: true; account: AccountSessionStatus }
  | { ok: false; error: string };

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

function isBuilderPreviewWorldFork(value: unknown): value is BuilderPreviewWorldFork {
  if (!value || typeof value !== 'object') return false;
  const fork = value as Partial<BuilderPreviewWorldFork>;
  return (
    fork.preview_only === true &&
    typeof fork.namespace === 'string' &&
    typeof fork.map_name === 'string' &&
    Array.isArray(fork.rooms) &&
    Array.isArray(fork.objects)
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
  const [characterCatalog, setCharacterCatalog] = useState<CharacterCatalog>({
    worlds: [],
    outfits: [],
    loading: false,
    loaded: false,
    error: null,
  });
  const [accountSession, setAccountSession] = useState<AccountSessionStatus>({
    checking: false,
    checked: false,
    authenticated: false,
    csrfReady: false,
    emailVerified: false,
    message: ACCOUNT_REQUIRED_MESSAGE,
  });
  const [accountCharacters, setAccountCharacters] = useState<AccountCharacter[]>([]);

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
        world: { map: getMap(map), me: null, others: new Map(), builderPreview: null },
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
        groundItems: new Map(),
        workContract: null,
        inventory: [],
        houseStorage: [],
        guildTreasury: null,
        guildContributions: null,
        gold: 0,
        properties: new Map(),
        gather: { ...s.gather, nodes: new Map(), stations: new Map(), activeNodeId: null, activeRefineStationId: null, progressPct: 0 },
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

  const declareVocation = useCallback((vocation: SovereignVocation) => {
    const payload: DeclareVocationMessage = { type: 'declare_vocation', vocation };
    send(payload);
  }, [send]);

  const useSkill = useCallback((skillId: string, targetId?: string) => {
    const payload: UseSkillMessage = targetId
      ? { type: 'use_skill', skill_id: skillId, target_id: targetId }
      : { type: 'use_skill', skill_id: skillId };
    send(payload);
  }, [send]);

  const pickupItem = useCallback((itemId: string) => {
    const payload: PickupItemMessage = { type: 'pickup_item', item_id: itemId };
    send(payload);
  }, [send]);

  // Chill-Zone Gather v0 (Step 2): client sends intent only; server owns the outcome.
  const sendGather = useCallback((nodeId: string) => {
    const payload: GatherIntentMessage = { type: 'gather_intent', node_id: nodeId };
    send(payload);
  }, [send]);

  const sendDeliver = useCallback((stationId: string) => {
    const payload: DeliverIntentMessage = { type: 'deliver_intent', station_id: stationId };
    send(payload);
  }, [send]);

  const sendRefine = useCallback((stationId: string) => {
    const payload: RefineIntentMessage = { type: 'refine_intent', station_id: stationId };
    send(payload);
  }, [send]);

  const respondTemChallenge = useCallback((challengeId: string, response: string) => {
    const payload: TemResponseMessage = { type: 'tem_response', response };
    send(payload);
    setState((s) => ({ ...s, temChallenge: null }));
    console.log(`[debug-client] tem_response sent challenge_id=${challengeId}`);
  }, [send]);

  const dismissTemChallenge = useCallback(() => {
    setState((s) => ({ ...s, temChallenge: null }));
  }, []);

  const respondTemWitness = useCallback((requestId: string, response: WitnessResponse) => {
    const payload: TemWitnessResponseMessage = { type: 'tem_witness_response', request_id: requestId, response };
    send(payload);
    setState((s) => ({ ...s, temWitnessRequest: null }));
    console.log(`[debug-client] tem_witness_response sent request_id=${requestId} response=${response}`);
  }, [send]);

  const dismissTemWitness = useCallback(() => {
    setState((s) => ({ ...s, temWitnessRequest: null }));
  }, []);

  const dropItem = useCallback((itemId: string) => {
    const payload: DropItemMessage = { type: 'drop_item', item_id: itemId };
    send(payload);
  }, [send]);

  const setProtectedSlot = useCallback((itemId: string) => {
    const payload: SetProtectedSlotMessage = { type: 'set_protected_slot', item_id: itemId };
    send(payload);
  }, [send]);

  const inspectPlayer = useCallback((playerId: string) => {
    const payload: InspectPlayerMessage = { type: 'inspect_player', target_player_id: playerId };
    send(payload);
  }, [send]);

  const dismissInspect = useCallback(() => {
    setState((s) => ({ ...s, inspectedPlayer: null }));
  }, []);

  const inspectWallet = useCallback(() => {
    const payload: InspectWalletMessage = { type: 'inspect_wallet' };
    send(payload);
  }, [send]);

  const payTithe = useCallback((amount: number) => {
    const payload: PayTitheMessage = { type: 'pay_tithe', amount };
    send(payload);
  }, [send]);

  const getPropertyLedger = useCallback((propertyId: string) => {
    const payload: GetPropertyLedgerMessage = { type: 'get_property_ledger', property_id: propertyId };
    send(payload);
  }, [send]);

  const openHouseAuction = useCallback((propertyId: string, minBid: number, minIncrement: number, durationSeconds: number) => {
    const payload: OpenHouseAuctionMessage = { type: 'open_house_auction', property_id: propertyId, min_bid: minBid, min_increment_gold: minIncrement, duration_s: durationSeconds };
    send(payload);
  }, [send]);

  const placeHouseBid = useCallback((propertyId: string, amount: number) => {
    const payload: PlaceHouseBidMessage = { type: 'place_house_bid', property_id: propertyId, amount };
    send(payload);
  }, [send]);

  const cancelHouseAuction = useCallback((propertyId: string) => {
    const payload: CancelHouseAuctionMessage = { type: 'cancel_house_auction', property_id: propertyId };
    send(payload);
  }, [send]);

  const dismissPropertyLedger = useCallback(() => {
    setState((s) => ({ ...s, propertyLedger: null }));
  }, []);

  const startWork = useCallback(() => {
    const payload: StartWorkContractMessage = { type: 'start_work_contract', contract_type: 'temple_sweep' };
    send(payload);
  }, [send]);

  const buyHouse = useCallback((propertyId: string) => {
    send({ type: 'buy_house', property_id: propertyId });
  }, [send]);

  const listHouse = useCallback((propertyId: string, price: number) => {
    send({ type: 'list_house', property_id: propertyId, price });
  }, [send]);

  const unlistHouse = useCallback((propertyId: string) => {
    send({ type: 'unlist_house', property_id: propertyId });
  }, [send]);

  const tickWork = useCallback(() => {
    setState(s => {
      if (!s.workContract) return s;
      const payload: WorkTickMessage = { type: 'work_tick', contract_id: s.workContract.contract_id };
      send(payload);
      return s;
    });
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
        // Identity v0.1 (#148): persist the (possibly rotated) signed token the
        // server returns on a successful token login, so it survives reloads.
        if (
          data.type === 'login_ack' &&
          data.ok !== false &&
          typeof data.token === 'string' &&
          data.token.length > 0
        ) {
          const expiresAt =
            typeof data.expires_at === 'number' ? data.expires_at : loadIdentity()?.expiresAt ?? Date.now();
          saveIdentity({ playerId: data.player_id, name: data.name, token: data.token, expiresAt });
        }
        // Auto-request wallet on every world_state so gold is always current.
        if (data.type === 'world_state') {
          ws.send(JSON.stringify({ type: 'inspect_wallet' }));
        }
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
                  session: { ...s.session, guestToken: null, playerId: null, name: null, token: null, authenticated: false },
                };
              }
              return {
                ...s,
                conn,
                session: {
                  guestToken: data.guest_token || null,
                  playerId: data.player_id,
                  name: data.name,
                  status: s.session.status,
                  token: typeof data.token === 'string' && data.token.length > 0 ? data.token : null,
                  authenticated: typeof data.token === 'string' && data.token.length > 0,
                },
              };
            case 'world_state': {
              const nextMap = typeof data.map === 'string' ? normalizeMapName(data.map) : null;
              const runtimeMap = isMapData(data.map_data) ? data.map_data : null;
              const loop = isLoop(data.loop) ? data.loop : isLoop(data.player?.loop) ? data.player.loop : s.loop;
              const base = nextMap && nextMap !== s.world.map.name
                ? resetForMap(s, nextMap)
                : s;
              const others = new Map<string, PlayerPublic>();
              for (const p of data.nearby_players || []) others.set(p.id, p);

              // Detect HP loss on self (same map only) → damage feedback
              const prevHp = s.world.me?.hp;
              const newHp = (data.player as PlayerPublic | undefined)?.hp;
              const sameMap = !nextMap || nextMap === s.world.map.name;
              const builderPreview = isBuilderPreviewWorldFork(data.builder_preview)
                ? data.builder_preview
                : null;
              let next: GameClientState = {
                ...base,
                conn,
                loop,
                world: {
                  map: runtimeMap ?? base.world.map,
                  me: data.player,
                  others,
                  builderPreview,
                },
              };
              if (
                sameMap &&
                typeof prevHp === 'number' &&
                typeof newHp === 'number' &&
                newHp < prevHp &&
                data.player
              ) {
                const dmg = prevHp - newHp;
                next = addFx(next, {
                  x: data.player.x,
                  y: data.player.y,
                  text: `-${dmg}`,
                  at: Date.now(),
                  ttlMs: 900,
                });
                next = pushToast(next, 'combat', `Took ${dmg} damage — ${newHp} HP left`, 'HIT');
              }
              return next;
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
              const nextMap = typeof data.map === 'string' ? normalizeMapName(data.map) : null;
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
              const message = typeof data.message === 'string' ? data.message : 'Tem challenge';
              const challenge_id = typeof data.challenge_id === 'string' ? data.challenge_id : '';
              const timeoutSeconds = typeof data.timeout_seconds === 'number' ? data.timeout_seconds : 12;
              const next = addChatLine(s, 'tem', `Tem challenge: ${message}`);
              return { ...next, conn, temChallenge: { challenge_id, message, timeoutSeconds, receivedAt: now } };
            }

            case 'tem_witness_request': {
              const request_id = typeof data.request_id === 'string' ? data.request_id : '';
              const prompt = typeof data.prompt === 'string' ? data.prompt : 'Witness request';
              const target_actor = typeof data.target_actor === 'string' ? data.target_actor : '';
              const kind = typeof data.kind === 'string' ? data.kind : 'heat_penalty';
              return { ...s, conn, temWitnessRequest: { request_id, prompt, target_actor, kind } };
            }

            case 'player_inspect': {
              const player_id = typeof data.player_id === 'string' ? data.player_id : '';
              const name = typeof data.name === 'string' ? data.name : '';
              const vocation = typeof data.vocation === 'string' ? data.vocation : null;
              const display_vocation = typeof data.display_vocation === 'string' ? data.display_vocation : null;
              const badges = Array.isArray(data.badges) ? (data.badges as string[]) : [];
              const mark = typeof data.mark === 'string' ? data.mark : null;
              return { ...s, conn, inspectedPlayer: { player_id, name, vocation, display_vocation, badges, mark } };
            }

            case 'tithe_result': {
              if (data.success === true && typeof data.new_balance === 'number') {
                const next = pushToast(s, 'system', `Tithe paid — balance: ${data.new_balance}g`, 'Tithe');
                return { ...next, conn, gold: data.new_balance };
              }
              const titheErr = data.error === 'insufficient_gold' ? 'Not enough gold.' : 'Tithe failed.';
              return { ...pushToast(s, 'system', titheErr, 'Tithe'), conn };
            }

            case 'drop_item_result': {
              if (data.ok !== true) {
                const dropReason = typeof data.reason === 'string' ? data.reason : 'unknown';
                return { ...pushToast(s, 'system', `Drop failed: ${dropReason}`, 'Item'), conn };
              }
              return { ...s, conn };
            }

            case 'protected_slot_set': {
              return { ...pushToast(s, 'system', 'Item protected.', 'Item'), conn };
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
              const eventMap = typeof data.map === 'string' ? normalizeMapName(data.map) : null;
              if (eventMap !== s.world.map.name) return { ...s, conn };

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

            case 'skill_result': {
              const skillId = typeof data.skill_id === 'string' ? data.skill_id : '';
              const success = data.success === true;
              const payload = data.payload as Record<string, unknown> | undefined;
              if (skillId.startsWith('item:use:')) {
                const effect = typeof payload?.effect === 'string' ? payload.effect : 'Used.';
                const line = success ? effect : 'Cannot use that item here.';
                return pushToast(s, 'npc', line, 'USE');
              }
              if (skillId === 'guild:contribute' && success) {
                // Capture the shared treasury total + personal contribution count so the HUD can
                // surface the collective goal and the player's progress toward the next rank.
                const total = typeof payload?.guild_treasury_total === 'number' ? payload.guild_treasury_total : s.guildTreasury;
                const count = typeof payload?.contribution_count === 'number' ? payload.contribution_count : s.guildContributions;
                const rank = typeof payload?.rank === 'string' ? payload.rank : null;
                const line = `Tended the guild${rank ? ` — ${rank}` : ''}${total !== null ? ` · treasury ${total}` : ''}`;
                return pushToast({ ...s, guildTreasury: total, guildContributions: count }, 'npc', line, 'GUILD');
              }
              if (skillId.startsWith('shop:')) {
                const itemType = payload?.item_type;
                const label = typeof itemType === 'string'
                  ? itemType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  : skillId.slice(5).replace(/_/g, ' ');
                const errorHint = payload?.error;
                const line = success
                  ? `Purchased: ${label}`
                  : errorHint === 'insufficient_gold'
                    ? 'Not enough gold'
                    : data.reason === 'invalid_target'
                      ? 'Must be in the guild hall'
                    : 'Purchase failed';
                return pushToast(s, 'npc', line, 'SHOP');
              }
              if (skillId === 'social:gift:gold') {
                const targetName = typeof payload?.target_name === 'string' ? payload.target_name : 'target';
                const amount = typeof payload?.amount_gold === 'number' ? payload.amount_gold : 1;
                const errorHint = payload?.error;
                const line = success
                  ? `Gifted ${amount}g to ${targetName}`
                  : errorHint === 'insufficient_gold'
                    ? 'Not enough gold to gift'
                    : 'Gift failed';
                return pushToast(s, 'npc', line, 'GIFT');
              }
              if (skillId === 'activity:fishing:rookguard') {
                const line = success
                  ? typeof payload?.line === 'string'
                    ? payload.line
                    : 'The old canal accepts the cast without promising a catch.'
                  : data.reason === 'invalid_target'
                    ? 'Stand beside the old canal fishing post to cast.'
                    : `The canal is unavailable: ${String(data.reason ?? 'rejected')}`;
                return pushToast(s, 'objective', line, success ? 'CANAL' : 'NOT HERE');
              }
              if (ROUTE_ACTION_SKILL_IDS.has(skillId)) {
                const title = typeof payload?.title === 'string' ? payload.title : 'Route';
                const next = typeof payload?.next_objective === 'string' ? payload.next_objective : 'Route action recorded.';
                const marker = typeof payload?.quality === 'string'
                  ? ` [${payload.quality}]`
                  : typeof payload?.gate_state === 'string'
                    ? ` [${payload.gate_state}]`
                    : typeof payload?.route_state === 'string'
                      ? ` [${payload.route_state}]`
                    : '';
                const reason = typeof data.reason === 'string' ? data.reason : 'rejected';
                const line = success ? `${title}${marker}: ${next}` : `Route action unavailable: ${reason}`;
                return pushToast(s, 'objective', line, 'ROUTE');
              }
              return { ...s, conn };
            }

            case 'world_item_added': {
              if (typeof data.item_id !== 'string') return { ...s, conn };
              const nextItems = new Map(s.groundItems);
              nextItems.set(data.item_id, {
                item_id: data.item_id,
                item_type: typeof data.item_type === 'string' ? data.item_type : 'item',
                x: typeof data.x === 'number' ? data.x : 0,
                y: typeof data.y === 'number' ? data.y : 0,
              });
              return { ...s, conn, groundItems: nextItems };
            }

            case 'world_item_removed': {
              if (typeof data.item_id !== 'string') return { ...s, conn };
              const nextItems = new Map(s.groundItems);
              nextItems.delete(data.item_id);
              return { ...s, conn, groundItems: nextItems };
            }

            case 'work_contract_started': {
              const contract_id = typeof data.contract_id === 'string' ? data.contract_id : '';
              const payout_gold = typeof data.payout_gold === 'number' ? data.payout_gold : 0;
              const ticks_required = typeof data.ticks_required === 'number' ? data.ticks_required : 0;
              const min_duration_ms = typeof data.min_duration_ms === 'number' ? data.min_duration_ms : 0;
              return {
                ...s, conn,
                workContract: { contract_id, payout_gold, ticks_observed: 0, ticks_required, remaining_ms: min_duration_ms },
              };
            }

            case 'work_progress': {
              if (!s.workContract) return { ...s, conn };
              const ticks_observed = typeof data.ticks_observed === 'number' ? data.ticks_observed : s.workContract.ticks_observed;
              const ticks_required = typeof data.ticks_required === 'number' ? data.ticks_required : s.workContract.ticks_required;
              const remaining_ms = typeof data.remaining_ms === 'number' ? data.remaining_ms : s.workContract.remaining_ms;
              return { ...s, conn, workContract: { ...s.workContract, ticks_observed, ticks_required, remaining_ms } };
            }

            case 'work_contract_result': {
              const success = data.success === true;
              const goldEarned = typeof data.credited_gold === 'number' ? data.credited_gold : 0;
              const errMsg = typeof data.error === 'string' ? data.error.replace(/_/g, ' ') : null;
              const line = success ? `Sweep done — ${goldEarned} gold earned` : `Sweep failed: ${errMsg ?? 'unknown'}`;
              const next = pushToast(s, 'npc', line, 'SWEEP');
              return { ...next, workContract: null };
            }

            case 'inventory_snapshot': {
              const items = Array.isArray(data.items)
                ? (data.items as { item_id: string; item_type: string; slot?: string | null }[])
                    .filter(i => typeof i.item_id === 'string' && typeof i.item_type === 'string')
                : [];
              // Houses v1.2: server includes house storage when inside a house; keep prior list otherwise.
              const houseStorage = Array.isArray(data.houseStorage)
                ? (data.houseStorage as { item_id: string; item_type: string }[])
                    .filter(i => typeof i.item_id === 'string' && typeof i.item_type === 'string')
                : s.houseStorage;
              return { ...s, conn, inventory: items, houseStorage };
            }

            case 'wallet_snapshot': {
              const gold = typeof data.gold === 'number' ? data.gold : s.gold;
              return { ...s, conn, gold };
            }

            // Property Ownership v0
            case 'property_snapshot': {
              const list = Array.isArray(data.properties) ? (data.properties as PropertyPublic[]) : [];
              const properties = new Map<string, PropertyPublic>();
              for (const p of list) properties.set(p.property_id, p);
              return { ...s, conn, properties };
            }

            case 'property_state': {
              const p = data.property as PropertyPublic | undefined;
              if (!p || typeof p.property_id !== 'string') return { ...s, conn };
              const properties = new Map(s.properties);
              properties.set(p.property_id, p);
              return { ...s, conn, properties };
            }

            case 'house_sold': {
              const buyer = typeof data.buyer_name === 'string' ? data.buyer_name : 'someone';
              const plot = typeof data.plot_id === 'string' ? data.plot_id : '';
              const price = typeof data.price === 'number' ? data.price : 0;
              return pushToast({ ...s, conn }, 'system', `${plot} sold to ${buyer} for ${price}g`, 'SOLD');
            }

            case 'property_result': {
              if (data.success === true) return { ...s, conn };
              const reason = typeof data.reason === 'string' ? data.reason : 'denied';
              return pushToast({ ...s, conn }, 'system', `House action failed: ${reason}`, 'DENIED');
            }

            case 'property_ledger': {
              const property_id = typeof data.property_id === 'string' ? data.property_id : '';
              const owner_history = Array.isArray(data.owner_history) ? data.owner_history : [];
              const sale_count = typeof data.sale_count === 'number' ? data.sale_count : 0;
              return { ...s, conn, propertyLedger: { property_id, owner_history, sale_count } };
            }

            case 'property_auction_state': {
              const property_id = typeof data.property_id === 'string' ? data.property_id : '';
              const kind = typeof data.kind === 'string' ? data.kind : 'primary';
              const current_high = typeof data.current_high === 'number' ? data.current_high : null;
              const high_bidder_name = typeof data.high_bidder_name === 'string' ? data.high_bidder_name : null;
              const min_next = typeof data.min_next === 'number' ? data.min_next : 1;
              const scheduled_close = typeof data.scheduled_close === 'number' ? data.scheduled_close : null;
              const auctionStates = new Map(s.auctionStates);
              auctionStates.set(property_id, { property_id, kind, current_high, high_bidder_name, min_next, scheduled_close });
              return { ...s, conn, auctionStates };
            }

            case 'house_auction_settled': {
              const property_id = typeof data.property_id === 'string' ? data.property_id : '';
              const winner = data.winner_name ?? null;
              const sellerName = data.seller_name ?? null;
              const settlePrice = typeof data.price === 'number' ? data.price : 0;
              const auctionStates = new Map(s.auctionStates);
              auctionStates.delete(property_id);
              const label = winner
                ? `Auction settled: ${data.plot_id ?? property_id} → ${winner} for ${settlePrice}g`
                : `Auction closed (${data.plot_id ?? property_id}) — no bids`;
              const next = winner && sellerName
                ? addChatLine(s, 'system', label)
                : s;
              return { ...pushToast(next, 'system', label, 'AUCTION'), conn, auctionStates };
            }

            case 'pickup_item_result': {
              if (data.ok !== true) return { ...s, conn };
              return pushToast(s, 'npc', 'Item picked up', 'LOOT');
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
              const nextMap = typeof data.map === 'string' ? normalizeMapName(data.map) : null;
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
              const me = { ...s.world.me, status: 'dead' as const, dead_until_ms: Date.now() + respawnMs };
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
            // Chill-Zone Gather v0 (Step 2)
            case 'gather_snapshot': {
              const nodes = new Map<string, GatherNodePublic>();
              for (const n of (data.nodes ?? []) as GatherNodePublic[]) nodes.set(n.node_id, n);
              const stations = new Map<string, GatherStationPublic>();
              for (const st of (data.stations ?? []) as GatherStationPublic[]) stations.set(st.station_id, st);
              return { ...s, conn, gather: { ...s.gather, nodes, stations } };
            }

            case 'gather_node_update': {
              const node = data.node as GatherNodePublic | undefined;
              if (!node || typeof node.node_id !== 'string') return { ...s, conn };
              const nodes = new Map(s.gather.nodes);
              nodes.set(node.node_id, node);
              return { ...s, conn, gather: { ...s.gather, nodes } };
            }

            case 'gather_result': {
              if (data.ok === true) {
                const nodeId = typeof data.node_id === 'string' ? data.node_id : null;
                return { ...s, conn, gather: { ...s.gather, activeNodeId: nodeId, progressPct: 0, status: 'Gathering…' } };
              }
              const reason = typeof data.reason === 'string' ? data.reason : 'rejected';
              return { ...s, conn, gather: { ...s.gather, status: `Gather rejected: ${reason}` } };
            }

            case 'gather_progress': {
              if (data.node_id !== s.gather.activeNodeId) return { ...s, conn };
              const pct = typeof data.progress_pct === 'number' ? data.progress_pct : s.gather.progressPct;
              return { ...s, conn, gather: { ...s.gather, progressPct: pct } };
            }

            case 'gather_completed': {
              const itemType = typeof data.item_type === 'string' ? data.item_type : 'item';
              return {
                ...s,
                conn,
                gather: { ...s.gather, activeNodeId: null, progressPct: 0, held: { item_type: itemType }, status: `Gathered ${itemType}` },
              };
            }

            case 'deliver_result': {
              // Status line is display-only from server fields (gatherLabels.deliverStatusLine).
              if (data.ok === true) {
                const itemType = typeof data.item_type === 'string' ? data.item_type : 'item';
                const reward = typeof data.reward === 'string' ? data.reward : null;
                const refined = data.refined === true;
                const priorKeystone = s.gather.keystoneTokens;
                return {
                  ...s,
                  conn,
                  gather: {
                    ...s.gather,
                    held: null,
                    tendingTokens: s.gather.tendingTokens + (reward && !refined ? 1 : 0),
                    keystoneTokens: s.gather.keystoneTokens + (reward && refined ? 1 : 0),
                    status: deliverStatusLine({
                      ok: true,
                      item_type: itemType,
                      reward,
                      refined,
                      priorKeystoneTokens: priorKeystone,
                    }),
                  },
                };
              }
              const reason = typeof data.reason === 'string' ? data.reason : 'rejected';
              return {
                ...s,
                conn,
                gather: {
                  ...s.gather,
                  status: deliverStatusLine({ ok: false, reason }),
                },
              };
            }

            // Chill-Zone Refine (Step 3): mirror the gather result/progress/completed trio.
            case 'refine_result': {
              if (data.ok === true) {
                const stationId = typeof data.station_id === 'string' ? data.station_id : null;
                return { ...s, conn, gather: { ...s.gather, activeRefineStationId: stationId, progressPct: 0, status: 'Refining…' } };
              }
              const reason = typeof data.reason === 'string' ? data.reason : 'rejected';
              return { ...s, conn, gather: { ...s.gather, status: `Refine rejected: ${reason}` } };
            }

            case 'refine_progress': {
              if (data.station_id !== s.gather.activeRefineStationId) return { ...s, conn };
              const pct = typeof data.progress_pct === 'number' ? data.progress_pct : s.gather.progressPct;
              return { ...s, conn, gather: { ...s.gather, progressPct: pct } };
            }

            case 'refine_completed': {
              const itemType = typeof data.item_type === 'string' ? data.item_type : 'item';
              return {
                ...s,
                conn,
                gather: { ...s.gather, activeRefineStationId: null, progressPct: 0, held: { item_type: itemType }, status: `Refined → ${itemType}` },
              };
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

  const loadCharacterCatalog = useCallback(async (): Promise<CharacterCatalog> => {
    setCharacterCatalog((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const worldsUrl = httpUrl(config.httpBase, '/v1/worlds');
      const outfitsUrl = httpUrl(config.httpBase, '/v1/outfits');
      const [worldsResp, outfitsResp] = await Promise.all([
        fetch(worldsUrl, { credentials: 'include' }),
        fetch(outfitsUrl, { credentials: 'include' }),
      ]);

      const worldsBody = await worldsResp.json().catch(() => ({}));
      const outfitsBody = await outfitsResp.json().catch(() => ({}));
      if (!worldsResp.ok || !outfitsResp.ok) {
        const bodyError = typeof worldsBody?.error === 'string'
          ? worldsBody.error
          : typeof outfitsBody?.error === 'string'
            ? outfitsBody.error
            : 'Could not load character setup options';
        throw new Error(bodyError);
      }

      const worlds = Array.isArray(worldsBody?.worlds) ? worldsBody.worlds.filter(isCharacterCatalogWorld) : [];
      const outfits = Array.isArray(outfitsBody?.outfits)
        ? outfitsBody.outfits.filter(isCharacterCatalogOutfit)
        : [];
      const next: CharacterCatalog = {
        worlds,
        outfits,
        loading: false,
        loaded: true,
        error: null,
      };
      setCharacterCatalog(next);
      return next;
    } catch (err) {
      const next: CharacterCatalog = {
        worlds: [],
        outfits: [],
        loading: false,
        loaded: false,
        error: characterOptionsErrorMessage(err),
      };
      setCharacterCatalog(next);
      return next;
    }
  }, [config.httpBase]);

  const refreshAccountSession = useCallback(async (): Promise<AccountSessionStatus> => {
    const csrf = readCookie(CSRF_COOKIE);
    if (!csrf) {
      const next: AccountSessionStatus = {
        checking: false,
        checked: true,
        authenticated: false,
        csrfReady: false,
        emailVerified: false,
        message: ACCOUNT_REQUIRED_MESSAGE,
      };
      setAccountSession(next);
      return next;
    }

    setAccountSession((prev) => ({ ...prev, checking: true, message: null }));
    try {
      const resp = await fetch(httpUrl(config.httpBase, '/v1/accounts/me'), {
        method: 'GET',
        credentials: 'include',
      });
      const body = await resp.json().catch(() => null);
      const ok = resp.ok && body?.ok !== false && !!body?.account;
      const next: AccountSessionStatus = {
        checking: false,
        checked: true,
        authenticated: ok,
        csrfReady: ok && !!csrf,
        emailVerified: ok ? body.account.email_verified === true : false,
        message: ok ? null : ACCOUNT_EXPIRED_MESSAGE,
      };
      setAccountSession(next);
      if (!ok) setAccountCharacters([]);
      return next;
    } catch (err) {
      const next: AccountSessionStatus = {
        checking: false,
        checked: true,
        authenticated: false,
        csrfReady: false,
        emailVerified: false,
        message: accountServiceErrorMessage(err, 'Could not confirm account session'),
      };
      setAccountSession(next);
      setAccountCharacters([]);
      return next;
    }
  }, [config.httpBase]);

  const requireAccountSession = useCallback(
    async ({ allowUnverified = false }: { allowUnverified?: boolean } = {}): Promise<RequiredAccountSession> => {
      const account = accountSession.authenticated ? accountSession : await refreshAccountSession();
      if (!account.authenticated) {
        return { ok: false, error: account.message ?? ACCOUNT_REQUIRED_MESSAGE };
      }
      if (!account.csrfReady) {
        return { ok: false, error: ACCOUNT_CSRF_REQUIRED_MESSAGE };
      }
      if (!allowUnverified && !account.emailVerified) {
        return { ok: false, error: ACCOUNT_UNVERIFIED_MESSAGE };
      }
      return { ok: true, account };
    },
    [accountSession, refreshAccountSession]
  );

  const loadAccountCharacters = useCallback(async (): Promise<AccountCharacter[]> => {
    const account = await requireAccountSession({ allowUnverified: true });
    if (!account.ok) {
      setAccountCharacters([]);
      return [];
    }

    try {
      const resp = await fetch(httpUrl(config.httpBase, '/v1/characters'), {
        method: 'GET',
        credentials: 'include',
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body || body.ok === false) {
        if (resp.status === 401) {
          setAccountCharacters([]);
          return [];
        }
        throw new Error(
          (body && typeof body.message === 'string' && body.message) ||
            (body && typeof body.error === 'string' && body.error) ||
            'Could not load account characters'
        );
      }
      const characters = Array.isArray(body.characters)
        ? body.characters.filter(isAccountCharacter)
        : [];
      setAccountCharacters(characters);
      return characters;
    } catch {
      setAccountCharacters([]);
      return [];
    }
  }, [config.httpBase, requireAccountSession]);

  const boot = useCallback(
    async (map: MapName = mapName) => {
      try {
        resetSessionState(map);
        setState((s) => ({ ...s, conn: { phase: 'connecting' } }));

        // Identity v0.1 (#148): prefer a stored signed token (a created
        // character); otherwise fall back to a guest session. The server treats
        // the token login as authoritative (token > guest_token).
        const identity = loadIdentity();
        let loginMsg: ClientMessage;
        if (hasValidToken(identity) && identity) {
          setState((s) => ({
            ...s,
            session: {
              ...s.session,
              token: identity.token,
              playerId: identity.playerId,
              name: identity.name,
              authenticated: true,
            },
          }));
          loginMsg = { type: 'login', token: identity.token };
        } else {
          const guest = await hydrateToken();
          await hydrateWorld(guest, map);
          setState((s) => ({
            ...s,
            session: { ...s.session, guestToken: guest, authenticated: false },
          }));
          loginMsg = { type: 'login', guest_token: guest };
        }

        const ws = new WebSocket(wsUrl(config.wsBase));
        wsRef.current = ws;
        attachHandlers(ws);
        ws.addEventListener('open', () => {
          const connectMsg: ClientMessage = { type: 'connect' };
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

  // Account-character entry: create through POST /v1/characters, persist the
  // returned play token, then reconnect as that character. Returns an error
  // string for the UI on failure (name taken / invalid / rate limited).
  const createCharacter = useCallback(
    async ({ name, world_id, sex, outfit_id }: CharacterCreateInput): Promise<CreateResult> => {
      const trimmed = name.trim();
      if (!trimmed) return { ok: false, error: 'Name is required' };
      if (!world_id || !outfit_id || (sex !== 'male' && sex !== 'female')) {
        return { ok: false, error: 'Name, world, sex, and outfit are required' };
      }

      const account = await requireAccountSession();
      if (!account.ok) return account;

      const catalog = characterCatalog.loaded ? characterCatalog : await loadCharacterCatalog();
      const outfits = catalog.outfits.filter((entry) => entry.sex === sex);
      if (outfits.length === 0) {
        return { ok: false, error: 'No outfits available for this sex' };
      }
      if (!outfits.some((entry) => entry.outfit_id === outfit_id)) {
        return { ok: false, error: 'Selected outfit does not match selected sex' };
      }

      try {
        const csrf = readCookie(CSRF_COOKIE);
        const headers: Record<string, string> = {
          'content-type': 'application/json',
        };
        if (csrf) headers['x-csrf-token'] = csrf;

        const url = httpUrl(config.httpBase, '/v1/characters');
        const resp = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            name: trimmed,
            world_id,
            sex,
            outfit_id,
          } satisfies AccountCharacterCreateRequest),
        });
        const body = await resp.json().catch(() => null);
        if (!resp.ok || !body || body.ok === false) {
          return {
            ok: false,
            error: accountCharacterErrorMessage(resp.status, body, 'Could not create character'),
          };
        }
        if (!isAccountCharacterPlayResponse(body)) {
          return { ok: false, error: 'Server returned an invalid character response' };
        }
        saveIdentity({
          playerId: body.character.character_id,
          name: body.character.name,
          token: body.token,
          expiresAt: body.expires_at,
        });
        void loadAccountCharacters();
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        await boot(mapName);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: accountServiceErrorMessage(err, 'Could not create character') };
      }
    },
    [boot, characterCatalog, loadAccountCharacters, loadCharacterCatalog, mapName, requireAccountSession]
  );

  const selectCharacter = useCallback(
    async (characterId: string): Promise<CreateResult> => {
      if (!characterId) return { ok: false, error: 'Select an existing character first' };
      const account = await requireAccountSession({ allowUnverified: true });
      if (!account.ok) return account;
      try {
        const csrf = readCookie(CSRF_COOKIE);
        const headers: Record<string, string> = {
          'content-type': 'application/json',
        };
        if (csrf) headers['x-csrf-token'] = csrf;

        const resp = await fetch(httpUrl(config.httpBase, '/v1/characters/select'), {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ character_id: characterId }),
        });
        const body = await resp.json().catch(() => null);
        if (!resp.ok || !body || body.ok === false) {
          return {
            ok: false,
            error: accountCharacterErrorMessage(resp.status, body, 'Could not select character'),
          };
        }
        if (!isAccountCharacterPlayResponse(body)) {
          return { ok: false, error: 'Server returned an invalid character response' };
        }
        saveIdentity({
          playerId: body.character.character_id,
          name: body.character.name,
          token: body.token,
          expiresAt: body.expires_at,
        });
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        await boot(mapName);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: accountServiceErrorMessage(err, 'Could not select character') };
      }
    },
    [boot, config.httpBase, mapName, requireAccountSession]
  );

  // Clear the stored character token and fall back to a guest session.
  const signOut = useCallback(() => {
    clearIdentity();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    resetSessionState(mapName);
    boot(mapName);
  }, [boot, mapName, resetSessionState]);

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

  // Log out and sign back in with a fresh session (character-select flow).
  const relog = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    resetSessionState(mapName);
    boot(mapName);
  }, [boot, mapName, resetSessionState]);

  useEffect(() => {
    resetSessionState(mapName);
    boot(mapName);
    return () => {
      clearMoveTimer();
      wsRef.current?.close();
    };
  }, [boot, mapName, resetSessionState]);

  useEffect(() => {
    void loadCharacterCatalog();
  }, [loadCharacterCatalog]);

  useEffect(() => {
    void refreshAccountSession();
  }, [refreshAccountSession]);

  useEffect(() => {
    if (!accountSession.authenticated) {
      setAccountCharacters([]);
      return;
    }
    void loadAccountCharacters();
  }, [accountSession.authenticated, loadAccountCharacters]);

  const api: GameClientApi = {
    sendMove,
    releaseMove,
    stopMoves,
    sendAttack,
    castRunestone,
    talkToNpc,
    declareVocation,
    useSkill,
    pickupItem,
    startWork,
    tickWork,
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
    relog,
    createCharacter,
    selectCharacter,
    signOut,
    characterCatalog,
    accountCharacters,
    accountSession,
    refreshAccountSession,
    loadAccountCharacters,
    openChat,
    closeChat,
    buyHouse,
    listHouse,
    unlistHouse,
    sendGather,
    sendDeliver,
    sendRefine,
    respondTemChallenge,
    dismissTemChallenge,
    respondTemWitness,
    dismissTemWitness,
    dropItem,
    setProtectedSlot,
    inspectPlayer,
    dismissInspect,
    inspectWallet,
    payTithe,
    getPropertyLedger,
    openHouseAuction,
    placeHouseBid,
    cancelHouseAuction,
    dismissPropertyLedger,
  };

  return [state, api];
}
