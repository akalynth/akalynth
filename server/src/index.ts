import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { createHash, randomUUID } from 'node:crypto';

import type { ClientMessage, ServerMessage } from '../../shared/protocol.js';
import { ServerMessages, parseClientMessage } from '../../shared/protocol.js';
import type { Player, TutorialProgress } from '../../shared/types.js';
import {
  FIRST_ATTEMPT_STONE_ACTION,
  HEAT_CHANGED_ACTION,
  LEDGER_MARKED_ACTION,
  HEAT_PENALTY_APPLIED_ACTION,
  HEAT_TEM_ESCALATION_ACTION,
  LEDGER_HESITATION_ACTION,
  LEGEND_ATTEMPTED_ACTION,
  LEGEND_REFUSED_ACTION,
  LEGEND_SIGHTED_ACTION,
  RUMOR_SEEDED_ACTION,
} from '../../shared/types.js';
import { TileCode } from '../../shared/types.js';
import {
  DEATH_TEST_ENABLED,
  DEATH_RESPAWN_DELAY_MS,
  HEAT_DECAY_PER_MIN,
  HEAT_PENALTY_DURATION_MS,
  HEAT_PENALTY_THRESHOLD,
  HEAT_TEM_COOLDOWN_MS,
  HEAT_TEM_THRESHOLD,
  LAST_DAMAGE_WINDOW_MS,
  TICK_MS,
} from '../../shared/constants.js';
import type {
  MapName,
  PublicReceiptsActorMode,
  PublicRumor,
  Receipt,
  SessionMeResponse,
  WorldStateResult,
} from '../../shared/http.js';
import { handleHttp } from './api/http.js';

import { createAuditLogger } from './audit/logger.js';
import { createReceiptsReader } from './audit/reader.js';
import { publicActorForReceipt, toPublicReceipt } from './audit/public_receipts.js';
import { createAntiCheatRuntime, onChat, onMoveApplied, onMoveIntent } from './anticheat/detector.js';
import { applyThrottle, checkTemTimeout, handleTemResponse, issueTemChallenge, isThrottled } from './anticheat/tem.js';
import { loadSharedMap, createWorldState, toPublicPlayer } from './world/state.js';
import { indexFor, tryMove } from './world/movement.js';
import { applyDeath, applyRespawn } from './world/death.js';
import {
  addHeat,
  createHeatState,
  isPenaltyActive,
  shouldApplyPenalty,
  shouldTemEscalate,
  startPenalty,
} from './world/heat.js';
import type { HeatState } from './world/heat.js';
import {
  findRunestoneTable,
  isNearRunestoneTable,
  rollRunestoneFace,
  runestoneWhisper,
  checkTrinityOfShadow,
  RUNESTONE_COOLDOWN_MS,
  RUNESTONE_BROADCAST_RADIUS,
} from './world/runestone.js';
import type { Element } from '../../shared/types.js';
import {
  RUNESTONE_CAST_ACTION,
  RUNESTONE_RESULT_ACTION,
  RUNESTONE_DENIED_ACTION,
  TRINITY_OF_SHADOW_ACTION,
} from '../../shared/types.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const VERSION = '0.1.0';
const DEFAULT_GUEST_SESSION_TTL_MS = 10 * 60 * 1000;
const DEFAULT_GUEST_SESSION_CLEANUP_MS = 60 * 1000;
const MAX_GUEST_SESSIONS = 10_000;
const DEBUG_MODE = process.env.DEBUG === '1';
const REQUIRE_TLS = parseBoolEnv(process.env.REQUIRE_TLS, true);
const ALLOW_INSECURE_LOCAL = parseBoolEnv(process.env.ALLOW_INSECURE_LOCAL, false);
const PUBLIC_RECEIPTS_DELAY_MS = parseEnvMs(process.env.PUBLIC_RECEIPTS_DELAY_MS, 15 * 60 * 1000, 0);
const PUBLIC_RECEIPTS_DELAY_PROFILE = parsePublicReceiptsDelayProfile(process.env.PUBLIC_RECEIPTS_DELAY_PROFILE);
const PUBLIC_RECEIPTS_BUCKET_SIZE = parseEnvInt(process.env.PUBLIC_RECEIPTS_BUCKET_SIZE, 8, 1);
const PUBLIC_RECEIPTS_ACTOR_MODE = parsePublicReceiptsActorMode(process.env.PUBLIC_RECEIPTS_ACTOR_MODE);
const PUBLIC_RECEIPTS_HASH_SALT = process.env.PUBLIC_RECEIPTS_HASH_SALT || 'akalynth-public-receipts';
const PUBLIC_RECEIPTS_JITTER_MS = parseEnvIntClamped(process.env.PUBLIC_RECEIPTS_JITTER_MS, 120_000, 0, 900_000);
const PUBLIC_RECEIPTS_JITTER_SALT = process.env.PUBLIC_RECEIPTS_JITTER_SALT || PUBLIC_RECEIPTS_HASH_SALT;

function parseEnvMs(envValue: string | undefined, fallback: number, min: number): number {
  if (!envValue) return fallback;
  const parsed = parseInt(envValue, 10);
  if (Number.isFinite(parsed) && parsed >= min) return parsed;
  return fallback;
}

function parseEnvInt(envValue: string | undefined, fallback: number, min: number): number {
  if (!envValue) return fallback;
  const parsed = parseInt(envValue, 10);
  if (Number.isFinite(parsed) && parsed >= min) return parsed;
  return fallback;
}

function parseBoolEnv(envValue: string | undefined, fallback: boolean): boolean {
  if (envValue === undefined) return fallback;
  const normalized = envValue.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  return fallback;
}

function parseEnvIntClamped(envValue: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = parseEnvInt(envValue, fallback, min);
  return Math.min(parsed, max);
}

function parsePublicReceiptsActorMode(envValue: string | undefined): PublicReceiptsActorMode {
  return envValue === 'daily_hash' ? 'daily_hash' : 'anon';
}

type PublicReceiptsDelayProfile = 'default' | 'tibia';

function parsePublicReceiptsDelayProfile(envValue: string | undefined): PublicReceiptsDelayProfile {
  return envValue === 'tibia' ? 'tibia' : 'default';
}

const GUEST_SESSION_TTL_MS = parseEnvMs(process.env.GUEST_SESSION_TTL_MS, DEFAULT_GUEST_SESSION_TTL_MS, 1000);
const GUEST_SESSION_CLEANUP_MS = parseEnvMs(
  process.env.GUEST_SESSION_CLEANUP_MS,
  DEFAULT_GUEST_SESSION_CLEANUP_MS,
  100
);

type Queued = { msg: ClientMessage; receivedAt: number };

function isLoopbackAddress(value: string | null | undefined): boolean {
  if (!value) return false;
  if (value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1') return true;
  return false;
}

function forwardedHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim();
  return first || null;
}

function forwardedProto(req: IncomingMessage): string | null {
  const value = forwardedHeaderValue(req.headers['x-forwarded-proto']);
  return value ? value.toLowerCase() : null;
}

function forwardedFor(req: IncomingMessage): string | null {
  return forwardedHeaderValue(req.headers['x-forwarded-for']);
}

function resolveClientIp(req: IncomingMessage): string | null {
  const remote = req.socket.remoteAddress ?? null;
  if (remote && isLoopbackAddress(remote)) {
    const forwarded = forwardedFor(req);
    if (forwarded) return forwarded;
  }
  return remote;
}

function tlsGate(req: IncomingMessage): { ok: boolean; reason?: string } {
  if (!REQUIRE_TLS) return { ok: true };

  const proto = forwardedProto(req);
  if (proto) {
    return proto === 'https' ? { ok: true } : { ok: false, reason: 'tls_required' };
  }

  const socket = req.socket as { encrypted?: boolean };
  if (socket.encrypted) return { ok: true };

  if (ALLOW_INSECURE_LOCAL) {
    const clientIp = resolveClientIp(req);
    if (isLoopbackAddress(clientIp)) return { ok: true };
  }

  return { ok: false, reason: 'tls_required' };
}

function rejectInsecureHttp(res: ServerResponse) {
  res.statusCode = 403;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'tls_required' }));
}

function rejectInsecureUpgrade(socket: Duplex) {
  try {
    const body = 'TLS required';
    socket.write(
      `HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(
        body
      )}\r\n\r\n${body}`
    );
  } catch {
    // ignore
  }
  socket.destroy();
}

type Session = {
  connId: string;
  ws: WebSocket;
  queue: Queued[];
  player: Player | null;
  guestToken: string | null;
  inWorld: boolean;
  currentMap: 'Rookguard' | 'Azura';
  tutorial: TutorialProgress;
  anti: ReturnType<typeof createAntiCheatRuntime>;
  heat: HeatState;
  lastMoveAppliedAt: number | null;
  lastChatAcceptedAt: number | null;
  respawnTimer: NodeJS.Timeout | null;
  ledgerHesitationArmed: boolean;
  ledgerHesitationDeathTs: string | null;
  lastDamage?: { at_ms: number; source_type: 'player' | 'tile' | 'status' | 'unknown'; source_id: string | null };
  // Runestone state
  lastRunestoneCastAtMs: number | null;
  lastRunestoneFaces: Element[];
  runestoneCooldownWindowStartMs: number | null;
  runestoneCooldownCount: number;
};

const sessions = new Map<string, Session>();
const audit = createAuditLogger();
const receiptsReader = createReceiptsReader('audit');
const legendFirsts = new Set<string>();
const legendSightedByPlayer = new Set<string>();
const legendAttemptCountByPlayer = new Map<string, number>();
const PUBLIC_RECEIPTS_ALLOW = new Set<string>([
  'death_in_rookguard',
  'death_in_azura',
  'first_death_in_azura',
  'first_unknown_cause_death',
  'first_death_after_gate_unlock',
  RUMOR_SEEDED_ACTION,
  LEGEND_REFUSED_ACTION,
  FIRST_ATTEMPT_STONE_ACTION,
  TRINITY_OF_SHADOW_ACTION,
]);
// Runestone trinity tracking (per player, per process lifetime)
const trinityEmitted = new Set<string>();
const PUBLIC_RUMORS_ALLOW = new Set<string>([RUMOR_SEEDED_ACTION]);
type LedgerHesitationState = {
  death_ts: string;
  map: MapName;
  applied: boolean;
};
const ledgerHesitationByPlayer = new Map<string, LedgerHesitationState>();
const RUMOR_NOTHING_FINISHES_ID = 'nothing_finishes';
const RUMOR_NOTHING_FINISHES_TEXT = "There's a place in Rookguard where nothing finishes.";
const RUMOR_NOTHING_FINISHES_MAP: MapName = 'Rookguard';
let rumorSeeded = false;
const LEGEND_STONE_ID = 'stone_cannot_obtain';
const LEGEND_STONE_MAP: MapName = 'Rookguard';
const LEGEND_STONE_LANDMARK = 'legend_stone';
const LEGEND_STONE_HESITATION_MS = 500;
const RUNESTONE_COOLDOWN_HEAT_WINDOW_MS = 10_000;
const RUMOR_STONE_REFUSES_ID = 'stone_refuses';
const RUMOR_STONE_REFUSES_TEXT = 'Somewhere in Rookguard, the world refuses to finish what you start.';
const RUMOR_STONE_REFUSES_MAP: MapName = 'Rookguard';
let stoneRumorSeeded = false;
const PUBLIC_RECEIPTS_ACTION_DELAYS_TIBIA: Record<string, number> = {
  death_in_rookguard: 10 * 60 * 1000,
  death_in_azura: 15 * 60 * 1000,
  first_death_in_azura: 30 * 60 * 1000,
  first_unknown_cause_death: 45 * 60 * 1000,
  first_death_after_gate_unlock: 60 * 60 * 1000,
  [RUMOR_SEEDED_ACTION]: 2 * 60 * 1000,
  [LEGEND_REFUSED_ACTION]: 60 * 60 * 1000,
  [FIRST_ATTEMPT_STONE_ACTION]: 60 * 60 * 1000,
};

function publicReceiptDelayForAction(action: string): number {
  if (PUBLIC_RECEIPTS_DELAY_PROFILE === 'tibia') {
    return PUBLIC_RECEIPTS_ACTION_DELAYS_TIBIA[action] ?? PUBLIC_RECEIPTS_DELAY_MS;
  }
  return PUBLIC_RECEIPTS_DELAY_MS;
}

function ledgerHesitationDelayMs(playerId: string, deathTs: string): number {
  const hex = createHash('sha256').update(`${playerId}:${deathTs}`).digest('hex');
  const prefix = hex.slice(0, 8);
  const parsed = parseInt(prefix, 16);
  if (!Number.isFinite(parsed)) return 300;
  return (parsed % 400) + 300;
}

function recordLedgerDeath(playerId: string, map: MapName, deathTs: string) {
  if (map === 'Rookguard') return;
  ledgerHesitationByPlayer.set(playerId, { death_ts: deathTs, map, applied: false });
}

function armLedgerHesitationIfNeeded(s: Session) {
  if (!s.player) return;
  if (s.currentMap !== 'Azura') return;
  const state = ledgerHesitationByPlayer.get(s.player.id);
  if (!state || state.applied) return;
  s.ledgerHesitationDeathTs = state.death_ts;
  s.ledgerHesitationArmed = true;
}

function applyLedgerHesitationIfArmed(s: Session): LedgerHesitationState | null {
  if (!s.player) return null;
  if (!s.ledgerHesitationArmed || !s.ledgerHesitationDeathTs) return null;
  const state = ledgerHesitationByPlayer.get(s.player.id);
  if (!state || state.applied || state.death_ts !== s.ledgerHesitationDeathTs) {
    s.ledgerHesitationArmed = false;
    s.ledgerHesitationDeathTs = null;
    return null;
  }
  state.applied = true;
  s.ledgerHesitationArmed = false;
  s.ledgerHesitationDeathTs = null;
  return state;
}

function seedRumorIfNeeded(playerId: string) {
  if (rumorSeeded) return;
  rumorSeeded = true;
  audit.write({
    player_id: playerId,
    action: RUMOR_SEEDED_ACTION,
    inputs: {
      rumor_id: RUMOR_NOTHING_FINISHES_ID,
      text: RUMOR_NOTHING_FINISHES_TEXT,
      map: RUMOR_NOTHING_FINISHES_MAP,
    },
    result: 'ok',
  });
}

function seedStoneRumorIfNeeded(playerId: string) {
  if (stoneRumorSeeded) return;
  stoneRumorSeeded = true;
  audit.write({
    player_id: playerId,
    action: RUMOR_SEEDED_ACTION,
    inputs: {
      rumor_id: RUMOR_STONE_REFUSES_ID,
      text: RUMOR_STONE_REFUSES_TEXT,
      map: RUMOR_STONE_REFUSES_MAP,
    },
    result: 'ok',
  });
}

function applyHeatChange(
  s: Session,
  now: number,
  delta: number,
  reason: string,
  extra?: { window_ms?: number }
) {
  if (!s.player || delta === 0) return;
  const out = addHeat(s.heat, now, delta, reason, HEAT_DECAY_PER_MIN);
  s.heat = out.state;
  const inputs: Record<string, unknown> = {
    prev_score: out.prevScore,
    new_score: out.newScore,
    delta,
    reason,
    decay_applied: out.decayApplied,
  };
  if (extra?.window_ms) inputs.window_ms = extra.window_ms;
  audit.write({
    player_id: s.player.id,
    action: HEAT_CHANGED_ACTION,
    inputs,
    result: 'ok',
  });
  maybeEscalateHeat(s, now, reason);
}

function maybeEscalateHeat(s: Session, now: number, reason: string) {
  if (!s.player) return;
  if (!s.anti.state.temChallengeActive && shouldTemEscalate(s.heat, now, HEAT_TEM_THRESHOLD, HEAT_TEM_COOLDOWN_MS)) {
    const out = issueTemChallenge(s.anti.state, now);
    if (out.outcome === 'issued') {
      send(s.ws, { type: 'tem_challenge', ...out.challenge });
      audit.write({
        player_id: s.player.id,
        action: 'tem_challenge_issued',
        inputs: { trigger: 'heat', score: s.heat.score, reason },
        result: 'challenge_sent',
      });
      audit.write({
        player_id: s.player.id,
        action: HEAT_TEM_ESCALATION_ACTION,
        inputs: { score: s.heat.score, reason, cooldown_ms: HEAT_TEM_COOLDOWN_MS },
        result: 'requested',
      });
      s.heat.last_tem_trigger_ms = now;
    }
  }

  if (shouldApplyPenalty(s.heat, now, HEAT_PENALTY_THRESHOLD)) {
    s.heat = startPenalty(s.heat, now, HEAT_PENALTY_DURATION_MS);
    audit.write({
      player_id: s.player.id,
      action: HEAT_PENALTY_APPLIED_ACTION,
      inputs: { score: s.heat.score, penalty_type: 'move_throttle', duration_ms: HEAT_PENALTY_DURATION_MS },
      result: 'applied',
    });
    audit.write({
      player_id: s.player.id,
      action: LEDGER_MARKED_ACTION,
      inputs: {
        mark: 'watched',
        duration_ms: HEAT_PENALTY_DURATION_MS,
        cause: 'heat_penalty',
        reason,
      },
      result: 'ok',
    });
  }
}

type LandmarkBox = { x: number; y: number; width: number; height: number };

function asLandmarkBox(value: unknown): LandmarkBox | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const x = typeof obj.x === 'number' ? obj.x : null;
  const y = typeof obj.y === 'number' ? obj.y : null;
  const width = typeof obj.width === 'number' ? obj.width : null;
  const height = typeof obj.height === 'number' ? obj.height : null;
  if (x === null || y === null || width === null || height === null) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function landmarkContains(pos: { x: number; y: number }, landmark: LandmarkBox): boolean {
  return (
    pos.x >= landmark.x &&
    pos.y >= landmark.y &&
    pos.x < landmark.x + landmark.width &&
    pos.y < landmark.y + landmark.height
  );
}

function legendStoneLandmark(map: { landmarks?: unknown }): LandmarkBox | null {
  const landmarks = map.landmarks;
  if (!landmarks || typeof landmarks !== 'object') return null;
  const stone = (landmarks as Record<string, unknown>)[LEGEND_STONE_LANDMARK];
  return asLandmarkBox(stone);
}

function toPublicRumor(receipt: Receipt): PublicRumor | null {
  const inputs = receipt.inputs as Record<string, unknown>;
  const rumor_id = typeof inputs.rumor_id === 'string' ? inputs.rumor_id : null;
  const text = typeof inputs.text === 'string' ? inputs.text : null;
  const map = inputs.map;
  if (!rumor_id || !text) return null;
  if (map !== 'Rookguard' && map !== 'Azura') return null;
  return {
    rumor_id,
    text,
    map,
    actor: publicActorForReceipt(receipt, PUBLIC_RECEIPTS_ACTOR_MODE, PUBLIC_RECEIPTS_HASH_SALT),
    timestamp: receipt.timestamp,
  };
}

type GuestSession = {
  player_id: string;
  name: string;
  minted_at_ms: number;
  expires_at_ms: number;
  consumed: boolean;
};
const guestSessions = new Map<string, GuestSession>(); // key = guest_token
type SessionMeResult = SessionMeResponse | { error: string; status: number };

const worlds = {
  Rookguard: createWorldState(loadSharedMap('rookguard.json')),
  Azura: createWorldState(loadSharedMap('azura.json')),
} as const;

function pruneExpiredGuestSessions(now: number) {
  for (const [token, sess] of guestSessions) {
    if (sess.expires_at_ms <= now) {
      guestSessions.delete(token);
    }
  }
}

function resolveSessionMe(guest_token: string, expiredReason: string): SessionMeResult {
  const now = Date.now();
  const minted = guestSessions.get(guest_token);
  if (!minted) return { error: 'not_authenticated', status: 401 };

  if (minted.expires_at_ms <= now) {
    guestSessions.delete(guest_token);
    audit.write({
      player_id: minted.player_id,
      action: 'session_guest_expired',
      inputs: { reason: expiredReason },
      result: 'not_authenticated',
    });
    return { error: 'token_expired', status: 401 };
  }

  const ttl_ms_remaining = Math.max(0, minted.expires_at_ms - now);
  return {
    ok: true as const,
    player_id: minted.player_id,
    guest_token,
    name: minted.name,
    minted_at_ms: minted.minted_at_ms,
    expires_at_ms: minted.expires_at_ms,
    ttl_ms_remaining,
  };
}

// HTTP control plane
const httpServer = http.createServer((req, res) => {
  const gate = tlsGate(req);
  if (!gate.ok) {
    rejectInsecureHttp(res);
    return;
  }
  const handled = handleHttp(req, res, {
    getVersion: () => VERSION,
    getTickMs: () => TICK_MS,
    listMaps: () =>
      (Object.keys(worlds) as MapName[]).map((name) => ({
        name,
        width: worlds[name].map.width,
        height: worlds[name].map.height,
      })),
    getMap: (name: MapName) => {
      const w = worlds[name];
      if (!w) return null;
      return {
        name,
        width: w.map.width,
        height: w.map.height,
        spawn: w.map.spawn,
        landmarks: w.map.landmarks,
      };
    },
    queryReceipts: (params) => receiptsReader.query(params),
    queryPublicReceipts: (params) => {
      const now = Date.now();
      const raw = receiptsReader.queryPublic(params, now, PUBLIC_RECEIPTS_ALLOW, {
        delayForAction: publicReceiptDelayForAction,
        jitterMaxMs: PUBLIC_RECEIPTS_JITTER_MS,
        jitterSalt: PUBLIC_RECEIPTS_JITTER_SALT,
      });
      return {
        mode: 'strict',
        receipts: raw.receipts.map((receipt) =>
          toPublicReceipt(receipt, {
            actorMode: PUBLIC_RECEIPTS_ACTOR_MODE,
            bucketSize: PUBLIC_RECEIPTS_BUCKET_SIZE,
            hashSalt: PUBLIC_RECEIPTS_HASH_SALT,
          })
        ),
        total: raw.total,
        has_more: raw.has_more,
      };
    },
    queryPublicReceiptsRaw: (params) => {
      if (!DEBUG_MODE) return { error: 'forbidden', status: 403 };
      const now = Date.now();
      return receiptsReader.queryPublic(params, now, PUBLIC_RECEIPTS_ALLOW, {
        delayForAction: publicReceiptDelayForAction,
        jitterMaxMs: PUBLIC_RECEIPTS_JITTER_MS,
        jitterSalt: PUBLIC_RECEIPTS_JITTER_SALT,
      });
    },
    queryPublicRumors: (params) => {
      const now = Date.now();
      const raw = receiptsReader.queryPublic(params, now, PUBLIC_RUMORS_ALLOW, {
        delayForAction: publicReceiptDelayForAction,
        jitterMaxMs: PUBLIC_RECEIPTS_JITTER_MS,
        jitterSalt: PUBLIC_RECEIPTS_JITTER_SALT,
      });
      const rumors = raw.receipts
        .map((receipt) => toPublicRumor(receipt))
        .filter((rumor): rumor is PublicRumor => Boolean(rumor));
      return {
        rumors,
        total: raw.total,
        has_more: raw.has_more,
      };
    },
    mintGuestSession: () => {
      const now = Date.now();
      pruneExpiredGuestSessions(now);

      if (guestSessions.size >= MAX_GUEST_SESSIONS) {
        return { error: 'guest_session_capacity', status: 429 };
      }

      const player_id = `p_${randomUUID()}`;
      const guest_token = `gt_${randomUUID()}`;
      const name = `Guest_${player_id.slice(-4)}`;
      const expires_at_ms = now + GUEST_SESSION_TTL_MS;
      guestSessions.set(guest_token, { player_id, name, minted_at_ms: now, expires_at_ms, consumed: false });
      audit.write({
        player_id,
        action: 'session_guest_minted',
        inputs: {},
        result: 'ok',
      });
      return { player_id, guest_token, name };
    },
    getSessionMe: (guest_token: string) => resolveSessionMe(guest_token, 'expired_on_me'),
    getWorldPlayers: (map: MapName, query) => {
      const w = worlds[map];
      if (!w) return { error: 'unknown_map', status: 404 };

      let players = Array.from(w.players.values()).map((p) => toPublicPlayer(p));
      if (query.limit) {
        const cap = Math.max(1, Math.min(query.limit, 500));
        players = players.slice(0, cap);
      }

      return { players };
    },
    getWorldState: (map: MapName, guest_token: string | null): WorldStateResult => {
      const w = worlds[map];
      if (!w) return { error: 'unknown_map', status: 404 };

      const now = Date.now();
      const me = guest_token ? resolveSessionMe(guest_token, 'expired_on_world_state') : null;
      if (me && 'error' in me) return me;

      let me_status: Player['status'] | undefined;
      let me_dead_until_ms: number | null | undefined;
      let me_dead_ttl_ms: number | null | undefined;

      if (me && me.ok) {
        const player = w.players.get(me.player_id);
        if (player) {
          me_status = player.status;
          me_dead_until_ms = player.dead_until_ms ?? null;
          if (player.status === 'dead' && player.dead_until_ms) {
            me_dead_ttl_ms = Math.max(0, player.dead_until_ms - now);
          } else {
            me_dead_ttl_ms = null;
          }
        }
      }

      const base = {
        ok: true as const,
        version: VERSION,
        tick_ms: TICK_MS,
        updated_at_ms: now,
        map: {
          name: map,
          width: w.map.width,
          height: w.map.height,
          spawn: w.map.spawn,
        },
        player_count: w.players.size,
      };

      if (me && me.ok) {
        return {
          ...base,
          me: {
            ...me,
            status: me_status,
            dead_until_ms: me_dead_until_ms,
            dead_ttl_ms: me_dead_ttl_ms,
          },
        };
      }
      return base;
    },
  });

  if (!handled) {
    res.statusCode = 404;
    res.end('not found');
  }
});

// WebSocket data plane (attached to same port)
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  const gate = tlsGate(req);
  if (!gate.ok) {
    rejectInsecureUpgrade(socket);
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

function worldFor(s: Session) {
  return worlds[s.currentMap];
}

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function broadcastToMap(map: 'Rookguard' | 'Azura', message: ServerMessage, excludeConnId?: string) {
  const data = JSON.stringify(message);
  for (const [connId, s] of sessions) {
    if (excludeConnId && connId === excludeConnId) continue;
    if (!s.inWorld) continue;
    if (s.currentMap !== map) continue;
    if (s.ws.readyState === WebSocket.OPEN) s.ws.send(data);
  }
}

function applyRespawnNow(s: Session, now: number) {
  if (!s.player) return;
  const w = worldFor(s);
  const spawn = w.map.spawn;
  const result = applyRespawn({
    now,
    player_id: s.player.id,
    map: s.currentMap,
    spawn,
    current_status: s.player.status,
    current_dead_until_ms: s.player.dead_until_ms ?? null,
    audit,
    setAlive: (pos) => {
      s.player!.status = 'alive';
      s.player!.dead_until_ms = null;
      s.player!.x = pos.x;
      s.player!.y = pos.y;
    },
  });

  if (!result.changed) return;

  armLedgerHesitationIfNeeded(s);

  w.players.set(s.player.id, s.player);
  const nearby = Array.from(w.players.values())
    .filter((p) => p.id !== s.player!.id)
    .map((p) => toPublicPlayer(p));
  send(s.ws, ServerMessages.worldState(toPublicPlayer(s.player!, true), nearby));
  s.respawnTimer = null;
}

function scheduleRespawnIfNeeded(s: Session, now: number) {
  if (!s.player) return;
  if (s.player.status !== 'dead') return;
  if (s.player.dead_until_ms === null || s.player.dead_until_ms === undefined) return;

  const remaining = s.player.dead_until_ms - now;
  if (remaining <= 0) {
    applyRespawnNow(s, now);
    return;
  }

  if (s.respawnTimer) {
    clearTimeout(s.respawnTimer);
    s.respawnTimer = null;
  }

  s.respawnTimer = setTimeout(() => {
    applyRespawnNow(s, Date.now());
  }, remaining);
}

function kick(s: Session, reason: string) {
  audit.write({
    player_id: s.player?.id ?? s.connId,
    action: 'kick',
    inputs: { reason },
    result: 'kicked',
  });
  send(s.ws, ServerMessages.error('kicked', reason));
  try {
    s.ws.close();
  } catch {
    // ignore
  }
}

function requireAuth(s: Session): boolean {
  if (!s.player) {
    send(s.ws, ServerMessages.error('not_authenticated', 'Login required'));
    return false;
  }
  return true;
}

function requireWorld(s: Session): boolean {
  if (!requireAuth(s)) return false;
  if (!s.inWorld) {
    send(s.ws, ServerMessages.error('not_in_world', 'Enter world first'));
    return false;
  }
  return true;
}

wss.on('connection', (ws) => {
  const connId = randomUUID();
  const now = Date.now();
  const s: Session = {
    connId,
    ws,
    queue: [],
    player: null,
    guestToken: null,
    inWorld: false,
    currentMap: 'Rookguard',
    tutorial: { move: false, chat: false, tem: false, gate: false, complete: false },
    anti: createAntiCheatRuntime(now),
    heat: createHeatState(now),
    lastMoveAppliedAt: null,
    lastChatAcceptedAt: null,
    respawnTimer: null,
    ledgerHesitationArmed: false,
    ledgerHesitationDeathTs: null,
    lastRunestoneCastAtMs: null,
    lastRunestoneFaces: [],
    runestoneCooldownWindowStartMs: null,
    runestoneCooldownCount: 0,
  };

  sessions.set(connId, s);
  audit.write({ player_id: connId, action: 'connect', inputs: {}, result: 'connected' });
  send(ws, ServerMessages.welcome(VERSION));

  ws.on('message', (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      send(ws, ServerMessages.error('invalid_message', 'Invalid JSON'));
      audit.write({ player_id: s.player?.id ?? connId, action: 'invalid_message', inputs: {}, result: 'bad_json' });
      return;
    }

    const msg = parseClientMessage(parsed);
    if (!msg) {
      send(ws, ServerMessages.error('invalid_message', 'Unknown or malformed message'));
      audit.write({
        player_id: s.player?.id ?? connId,
        action: 'invalid_message',
        inputs: { raw: parsed },
        result: 'unparseable',
      });
      return;
    }

    s.queue.push({ msg, receivedAt: Date.now() });
  });

  ws.on('close', () => {
    if (s.respawnTimer) {
      clearTimeout(s.respawnTimer);
      s.respawnTimer = null;
    }
    sessions.delete(connId);
    if (s.player && s.inWorld) {
      const w = worldFor(s);
      w.players.delete(s.player.id);
      broadcastToMap(s.currentMap, ServerMessages.playerLeft(s.player.id), connId);
      audit.write({ player_id: s.player.id, action: 'disconnect', inputs: {}, result: 'left_world' });
    } else {
      audit.write({ player_id: connId, action: 'disconnect', inputs: {}, result: 'disconnected' });
    }
  });

  ws.on('error', (err) => {
    audit.write({
      player_id: s.player?.id ?? connId,
      action: 'ws_error',
      inputs: { message: err.message },
      result: 'error',
    });
  });
});

function processSessionQueue(s: Session, now: number) {
  if (s.player && s.player.status === 'dead') {
    if (s.player.dead_until_ms !== null && s.player.dead_until_ms !== undefined && now >= s.player.dead_until_ms) {
      applyRespawnNow(s, now);
    } else if (!s.respawnTimer) {
      scheduleRespawnIfNeeded(s, now);
    }
  }

  // Tem timeout enforcement
  const timeoutOutcome = checkTemTimeout(s.anti.state, now);
  if (timeoutOutcome.outcome === 'failed') {
    applyThrottle(s.anti.state, now);
    audit.write({
      player_id: s.player?.id ?? s.connId,
      action: 'tem_challenge_failed',
      inputs: { reason: timeoutOutcome.reason },
      result: 'throttled',
    });
  }

  // process up to N messages per tick to bound work
  let processed = 0;
  while (s.queue.length && processed < 25) {
    processed++;
    const { msg, receivedAt } = s.queue.shift()!;
    const msgNow = Date.now();

    switch (msg.type) {
      case 'connect': {
        // idempotent
        audit.write({ player_id: s.player?.id ?? s.connId, action: 'connect', inputs: {}, result: 'ok' });
        send(s.ws, ServerMessages.welcome(VERSION));
        break;
      }

      case 'login': {
        let player_id: string;
        let guest_token: string;
        let name: string;

        // HTTP-first: token provided
        if (msg.guest_token) {
          const minted = guestSessions.get(msg.guest_token);

          if (!minted) {
            send(s.ws, ServerMessages.error('not_authenticated', 'Invalid guest token'));
            audit.write({
              player_id: s.connId,
              action: 'login',
              inputs: { guest_token_provided: true },
              result: 'invalid_token',
            });
            break;
          }

          if (minted.expires_at_ms <= msgNow) {
            guestSessions.delete(msg.guest_token);
            send(s.ws, ServerMessages.error('not_authenticated', 'Guest token expired'));
            audit.write({
              player_id: minted.player_id,
              action: 'session_guest_expired',
              inputs: { reason: 'expired_on_login' },
              result: 'not_authenticated',
            });
            break;
          }

          if (minted.consumed) {
            send(s.ws, ServerMessages.error('not_authenticated', 'Guest token already used'));
            audit.write({
              player_id: minted.player_id,
              action: 'login',
              inputs: { guest_token_provided: true, reason: 'consumed' },
              result: 'invalid_token',
            });
            break;
          }

          // bind session
          player_id = minted.player_id;
          guest_token = msg.guest_token;
          name = minted.name;

          // mark consumed but keep for control-plane introspection
          minted.consumed = true;

          audit.write({
            player_id,
            action: 'login',
            inputs: { source: 'http_mint' },
            result: 'ok',
          });
        } else {
          // Legacy WS mint
          player_id = s.player?.id ?? `p_${randomUUID()}`;
          guest_token = `gt_${randomUUID()}`;
          name = `Guest_${player_id.slice(-4)}`;

          audit.write({
            player_id,
            action: 'login',
            inputs: { source: 'ws_mint' },
            result: 'ok',
          });
        }

        s.guestToken = guest_token;
        s.currentMap = 'Rookguard';
        s.tutorial = { move: false, chat: false, tem: false, gate: false, complete: false };
        s.ledgerHesitationArmed = false;
        s.ledgerHesitationDeathTs = null;
        s.player = {
          id: player_id,
          name,
          x: worlds.Rookguard.map.spawn.x,
          y: worlds.Rookguard.map.spawn.y,
          state: 'authenticated',
          status: 'alive',
          dead_until_ms: null,
          reputation: 0,
        };

        send(s.ws, ServerMessages.loginAck(player_id, guest_token, name));
        break;
      }

      case 'enter_world': {
        if (!requireAuth(s)) break;
        if (s.inWorld) break;

        if (s.currentMap === 'Azura' && !s.tutorial.complete) {
          send(s.ws, ServerMessages.error('not_in_world', 'Complete Rookguard training first'));
          audit.write({
            player_id: s.player!.id,
            action: 'enter_world',
            inputs: { map: 'Azura' },
            result: 'blocked_tutorial_incomplete',
          });
          break;
        }

        s.inWorld = true;
        s.player!.state = 'in_world';
        seedRumorIfNeeded(s.player!.id);

        const w = worldFor(s);
        w.players.set(s.player!.id, s.player!);

        const nearby = Array.from(w.players.values())
          .filter((p) => p.id !== s.player!.id)
          .map((p) => toPublicPlayer(p));

        audit.write({ player_id: s.player!.id, action: 'enter_world', inputs: {}, result: 'ok' });

        send(s.ws, ServerMessages.worldState(toPublicPlayer(s.player!, true), nearby));
        broadcastToMap(s.currentMap, ServerMessages.playerJoined(toPublicPlayer(s.player!)), s.connId);
        break;
      }

      case 'tem_response': {
        if (!requireAuth(s)) break;
        const out = handleTemResponse(s.anti.state, msg.response);
        if (out.outcome === 'passed') {
          audit.write({ player_id: s.player!.id, action: 'tem_challenge_passed', inputs: {}, result: 'passed' });
          if (s.currentMap === 'Rookguard' && !s.tutorial.tem) {
            s.tutorial.tem = true;
            audit.write({
              player_id: s.player!.id,
              action: 'tutorial_step_complete',
              inputs: { step: 'tem' },
              result: 'ok',
            });
          }
        } else if (out.outcome === 'failed') {
          applyThrottle(s.anti.state, now);
          audit.write({
            player_id: s.player!.id,
            action: 'tem_challenge_failed',
            inputs: { reason: out.reason },
            result: 'throttled',
          });
        }
        break;
      }

      case 'chat': {
        if (!requireWorld(s)) break;

        // Tem challenge response via chat, per docs
        if (s.anti.state.temChallengeActive) {
          const out = handleTemResponse(s.anti.state, msg.message);
          if (out.outcome === 'passed') {
            audit.write({
              player_id: s.player!.id,
              action: 'tem_challenge_passed',
              inputs: { via: 'chat' },
              result: 'passed',
            });
            if (s.currentMap === 'Rookguard' && !s.tutorial.tem) {
              s.tutorial.tem = true;
              audit.write({
                player_id: s.player!.id,
                action: 'tutorial_step_complete',
                inputs: { step: 'tem', via: 'chat' },
                result: 'ok',
              });
            }
            break;
          }
          if (out.outcome === 'failed') {
            applyThrottle(s.anti.state, now);
            audit.write({
              player_id: s.player!.id,
              action: 'tem_challenge_failed',
              inputs: { via: 'chat', reason: out.reason },
              result: 'throttled',
            });
            break;
          }
        }

        if (isThrottled(s.anti.state, msgNow)) {
          const last = s.lastChatAcceptedAt ?? 0;
          if (msgNow - last < 10_000) {
            send(s.ws, ServerMessages.error('rate_limited', 'Chat throttled'));
            audit.write({
              player_id: s.player!.id,
              action: 'chat',
              inputs: { message: msg.message },
              result: 'rate_limited',
            });
            break;
          }
        }

        s.lastChatAcceptedAt = msgNow;
        const act = onChat(s.anti, msgNow);
        if (act.action !== 'none' && act.signal.type === 'chat_spam') {
          applyHeatChange(s, msgNow, 10, 'chat_spam');
        }
        if (act.action === 'throttle') {
          applyThrottle(s.anti.state, msgNow);
          audit.write({
            player_id: s.player!.id,
            action: 'throttle',
            inputs: { trigger: act.signal.type, details: act.signal.details },
            result: 'applied',
          });
        }
        if (act.action === 'kick') {
          audit.write({
            player_id: s.player!.id,
            action: 'kick',
            inputs: { trigger: act.signal.type, reason: act.reason },
            result: 'kicked',
          });
          kick(s, act.reason);
          break;
        }

        if (s.currentMap === 'Rookguard' && !s.tutorial.chat && msg.message.trim().length > 0) {
          s.tutorial.chat = true;
          audit.write({
            player_id: s.player!.id,
            action: 'tutorial_step_complete',
            inputs: { step: 'chat' },
            result: 'ok',
          });
        }

        audit.write({ player_id: s.player!.id, action: 'chat', inputs: { message: msg.message }, result: 'ok' });
        broadcastToMap(s.currentMap, ServerMessages.chatBroadcast(s.player!.id, s.player!.name, msg.message));
        break;
      }

      case 'kill_self': {
        if (!DEATH_TEST_ENABLED || !DEBUG_MODE) {
          send(s.ws, ServerMessages.error('invalid_message', 'Test death disabled'));
          audit.write({
            player_id: s.player?.id ?? s.connId,
            action: 'invalid_message',
            inputs: { type: 'kill_self' },
            result: 'test_death_disabled',
          });
          break;
        }

        if (!requireWorld(s)) break;

        if (s.player!.status === 'dead') {
          send(s.ws, ServerMessages.error('rate_limited', 'Player already dead'));
          break;
        }

        const w = worldFor(s);
        audit.write({
          player_id: s.player!.id,
          action: 'kill_self',
          inputs: { map: s.currentMap },
          result: 'requested',
        });

        s.lastDamage = { at_ms: msgNow, source_type: 'status', source_id: 'test' };

        if (s.respawnTimer) {
          clearTimeout(s.respawnTimer);
          s.respawnTimer = null;
        }

        const deathResult = applyDeath({
          now: msgNow,
          player_id: s.player!.id,
          map: s.currentMap,
          position: { x: s.player!.x, y: s.player!.y },
          cause: 'unknown',
          killer_id: null,
          respawn_delay_ms: DEATH_RESPAWN_DELAY_MS,
          current_status: s.player!.status,
          current_dead_until_ms: s.player!.dead_until_ms,
          lastDamage: s.lastDamage,
          gateUnlocked: s.tutorial.complete,
          emitFirstOf: (info) => {
            if (info.map === 'Azura' && !legendFirsts.has('first_death_in_azura')) {
              legendFirsts.add('first_death_in_azura');
              audit.write({
                player_id: s.player!.id,
                action: 'first_death_in_azura',
                inputs: { map: info.map, position: info.position, cause: info.cause },
                result: 'ok',
              });
            }

            if (info.source_type === 'unknown' || info.cause === 'unknown') {
              if (!legendFirsts.has('first_unknown_cause_death')) {
                legendFirsts.add('first_unknown_cause_death');
                audit.write({
                  player_id: s.player!.id,
                  action: 'first_unknown_cause_death',
                  inputs: { map: info.map, position: info.position, cause: info.cause },
                  result: 'ok',
                });
              }
            }

            if (info.gateUnlocked && !legendFirsts.has('first_death_after_gate_unlock')) {
              legendFirsts.add('first_death_after_gate_unlock');
              audit.write({
                player_id: s.player!.id,
                action: 'first_death_after_gate_unlock',
                inputs: { map: info.map, position: info.position },
                result: 'ok',
              });
            }
          },
          audit,
          setDead: (dead_until_ms) => {
            if (!s.player) return;
            s.player.status = 'dead';
            s.player.dead_until_ms = dead_until_ms;
          },
          adjustReputation: (delta) => {
            if (!s.player) return;
            s.player.reputation = (s.player.reputation ?? 0) + delta;
          },
        });

        if (deathResult.changed) {
          const deathTs = new Date().toISOString();
          recordLedgerDeath(s.player!.id, s.currentMap, deathTs);
          s.ledgerHesitationArmed = false;
          s.ledgerHesitationDeathTs = null;
        }

        scheduleRespawnIfNeeded(s, msgNow);

        send(
          s.ws,
          ServerMessages.deathNotice(
            deathResult.respawn_in_ms,
            s.currentMap,
            w.map.spawn,
            deathResult.changed ? 'test' : 'already_dead'
          )
        );
        break;
      }

      case 'move_intent': {
        if (!requireWorld(s)) break;

        if (s.player!.status === 'dead') {
          audit.write({
            player_id: s.player!.id,
            action: 'move_intent',
            inputs: { direction: msg.direction, from: { x: s.player!.x, y: s.player!.y, map: s.currentMap } },
            result: 'rejected',
          });
          audit.write({
            player_id: s.player!.id,
            action: 'move_result',
            inputs: { to: { x: s.player!.x, y: s.player!.y, map: s.currentMap }, ok: false, reason: 'dead' },
            result: 'rejected',
          });
          send(s.ws, ServerMessages.moveResult(false, s.player!.x, s.player!.y, 'dead'));
          break;
        }

        const before = { x: s.player!.x, y: s.player!.y, map: s.currentMap };

        if (s.currentMap === 'Azura') {
          const hesitation = applyLedgerHesitationIfArmed(s);
          if (hesitation) {
            const delayMs = ledgerHesitationDelayMs(s.player!.id, hesitation.death_ts);
            audit.write({
              player_id: s.player!.id,
              action: LEDGER_HESITATION_ACTION,
              inputs: { map: 'Azura', death_ts: hesitation.death_ts, delay_ms: delayMs, type: 'movement_block' },
              result: 'applied',
            });
            audit.write({
              player_id: s.player!.id,
              action: 'move_intent',
              inputs: { direction: msg.direction, from: before },
              result: 'rejected',
            });
            audit.write({
              player_id: s.player!.id,
              action: 'move_result',
              inputs: { to: { x: before.x, y: before.y, map: s.currentMap }, ok: false, reason: 'tile_blocked' },
              result: 'rejected',
            });
            send(s.ws, ServerMessages.moveResult(false, before.x, before.y, 'tile_blocked'));
            break;
          }
        }

        if (isPenaltyActive(s.heat, msgNow)) {
          audit.write({
            player_id: s.player!.id,
            action: 'move_intent',
            inputs: { direction: msg.direction, from: before },
            result: 'rejected',
          });
          audit.write({
            player_id: s.player!.id,
            action: 'move_result',
            inputs: { to: { x: before.x, y: before.y, map: s.currentMap }, ok: false, reason: 'rate_limited' },
            result: 'rejected',
          });
          send(s.ws, ServerMessages.moveResult(false, before.x, before.y, 'rate_limited'));
          break;
        }

        // If Tem is active (including tutorial demo), movement is blocked until response.
        if (s.anti.state.temChallengeActive) {
          send(s.ws, ServerMessages.moveResult(false, s.player!.x, s.player!.y, 'rate_limited'));
          break;
        }

        const act = onMoveIntent(s.anti, msgNow);
        if (act.action === 'request_tem') {
          const out = issueTemChallenge(s.anti.state, msgNow);
          if (out.outcome === 'issued') {
            send(s.ws, { type: 'tem_challenge', ...out.challenge });
            audit.write({
              player_id: s.player!.id,
              action: 'tem_challenge_issued',
              inputs: { trigger: act.signal.type, details: act.signal.details },
              result: 'challenge_sent',
            });
          }
          // During challenge, ignore movement.
          send(s.ws, ServerMessages.moveResult(false, s.player!.x, s.player!.y, 'rate_limited'));
          break;
        }

        if (isThrottled(s.anti.state, msgNow)) {
          const last = s.lastMoveAppliedAt ?? 0;
          if (msgNow - last < 200) {
            send(s.ws, ServerMessages.moveResult(false, s.player!.x, s.player!.y, 'rate_limited'));
            audit.write({
              player_id: s.player!.id,
              action: 'move_intent',
              inputs: { direction: msg.direction },
              result: 'rate_limited',
            });
            break;
          }
        }

        const w = worldFor(s);
        const res = tryMove(w.map, s.player!, msg.direction);
        s.lastMoveAppliedAt = msgNow;

        if (res.ok) {
          const cadenceAct = onMoveApplied(s.anti, receivedAt);
          if (cadenceAct.action === 'request_tem') {
            audit.write({
              player_id: s.player!.id,
              action: 'cadence_suspected',
              inputs: cadenceAct.signal.details,
              result: 'suspected',
            });
            const out = issueTemChallenge(s.anti.state, msgNow);
            if (out.outcome === 'issued') {
              send(s.ws, { type: 'tem_challenge', ...out.challenge });
              audit.write({
                player_id: s.player!.id,
                action: 'tem_challenge_issued',
                inputs: { trigger: cadenceAct.signal.type, details: cadenceAct.signal.details },
                result: 'challenge_sent',
              });
            }
            applyHeatChange(s, msgNow, 25, 'perfect_cadence');
          }
        }

        audit.write({
          player_id: s.player!.id,
          action: 'move_intent',
          inputs: { direction: msg.direction, from: before },
          result: res.ok ? 'ok' : 'rejected',
        });

        let finalX = res.x;
        let finalY = res.y;
        let transferred = false;

        if (res.ok) {
          const stoneLandmark =
            s.currentMap === LEGEND_STONE_MAP ? legendStoneLandmark(w.map) : null;

          if (stoneLandmark && landmarkContains({ x: res.x, y: res.y }, stoneLandmark)) {
            const attempt_n = (legendAttemptCountByPlayer.get(s.player!.id) ?? 0) + 1;
            legendAttemptCountByPlayer.set(s.player!.id, attempt_n);

            if (!legendSightedByPlayer.has(s.player!.id)) {
              legendSightedByPlayer.add(s.player!.id);
              audit.write({
                player_id: s.player!.id,
                action: LEGEND_SIGHTED_ACTION,
                inputs: {
                  legend_id: LEGEND_STONE_ID,
                  map: LEGEND_STONE_MAP,
                  position: { x: res.x, y: res.y },
                  context_flags: [],
                },
                result: 'ok',
              });
            }

            audit.write({
              player_id: s.player!.id,
              action: LEGEND_ATTEMPTED_ACTION,
              inputs: {
                legend_id: LEGEND_STONE_ID,
                map: LEGEND_STONE_MAP,
                position: { x: res.x, y: res.y },
                approach_vector: msg.direction,
                attempt_n,
              },
              result: 'attempted',
            });

            if (attempt_n > 1) {
              applyHeatChange(s, msgNow, 5, 'legend_probe');
            }

            const spawn = w.map.spawn;
            audit.write({
              player_id: s.player!.id,
              action: LEGEND_REFUSED_ACTION,
              inputs: {
                legend_id: LEGEND_STONE_ID,
                reason: 'cannot_obtain',
                outcome: 'displace',
                to: { map: LEGEND_STONE_MAP, x: spawn.x, y: spawn.y },
                attempt_n,
              },
              result: 'refused',
            });

            audit.write({
              player_id: s.player!.id,
              action: LEDGER_HESITATION_ACTION,
              inputs: {
                legend_id: LEGEND_STONE_ID,
                duration_ms: LEGEND_STONE_HESITATION_MS,
                effect: 'world_refuses',
              },
              result: 'applied',
            });

            if (!legendFirsts.has(FIRST_ATTEMPT_STONE_ACTION)) {
              legendFirsts.add(FIRST_ATTEMPT_STONE_ACTION);
              audit.write({
                player_id: s.player!.id,
                action: FIRST_ATTEMPT_STONE_ACTION,
                inputs: { map: LEGEND_STONE_MAP },
                result: 'ok',
              });
              seedStoneRumorIfNeeded(s.player!.id);
            }

            s.player!.x = spawn.x;
            s.player!.y = spawn.y;
            finalX = spawn.x;
            finalY = spawn.y;
          }

          const tile = w.map.tiles[indexFor(w.map, { x: res.x, y: res.y })] ?? TileCode.Wall;

          if (s.currentMap === 'Rookguard') {
            if (tile === TileCode.TutorialMove && !s.tutorial.move) {
              s.tutorial.move = true;
              audit.write({
                player_id: s.player!.id,
                action: 'tutorial_step_complete',
                inputs: { step: 'move' },
                result: 'ok',
              });
            }

            if (tile === TileCode.TutorialTem && !s.tutorial.tem) {
              const out = issueTemChallenge(s.anti.state, now);
              if (out.outcome === 'issued') {
                send(s.ws, { type: 'tem_challenge', ...out.challenge });
                audit.write({
                  player_id: s.player!.id,
                  action: 'tem_challenge_issued',
                  inputs: { trigger: 'tutorial_tem_demo' },
                  result: 'challenge_sent',
                });
              }
            }

            if (tile === TileCode.GateToAzura && !s.tutorial.complete) {
              if (s.tutorial.move && s.tutorial.chat && s.tutorial.tem) {
                s.tutorial.gate = true;
                s.tutorial.complete = true;
                audit.write({
                  player_id: s.player!.id,
                  action: 'gate_unlock',
                  inputs: {},
                  result: 'ok',
                });
                audit.write({
                  player_id: s.player!.id,
                  action: 'tutorial_completed',
                  inputs: {},
                  result: 'ok',
                });

                // Transfer to Azura spawn immediately.
                worlds.Rookguard.players.delete(s.player!.id);
                broadcastToMap('Rookguard', ServerMessages.playerLeft(s.player!.id), s.connId);

                s.currentMap = 'Azura';
                s.player!.x = worlds.Azura.map.spawn.x;
                s.player!.y = worlds.Azura.map.spawn.y;
                worlds.Azura.players.set(s.player!.id, s.player!);
                armLedgerHesitationIfNeeded(s);

                const nearbyAzura = Array.from(worlds.Azura.players.values())
                  .filter((p) => p.id !== s.player!.id)
                  .map((p) => toPublicPlayer(p));

                send(s.ws, ServerMessages.worldState(toPublicPlayer(s.player!, true), nearbyAzura));
                broadcastToMap('Azura', ServerMessages.playerJoined(toPublicPlayer(s.player!)), s.connId);

                finalX = s.player!.x;
                finalY = s.player!.y;
                transferred = true;
              }
            }
          }
        }

        audit.write({
          player_id: s.player!.id,
          action: 'move_result',
          inputs: { to: { x: finalX, y: finalY, map: s.currentMap }, ok: res.ok, reason: res.reason },
          result: res.ok ? 'ok' : 'rejected',
        });

        send(s.ws, ServerMessages.moveResult(res.ok, finalX, finalY, res.reason));
        if (res.ok && !transferred) broadcastToMap(s.currentMap, ServerMessages.playerMoved(s.player!.id, finalX, finalY), s.connId);
        break;
      }

      case 'runestone_cast': {
        // DEBUG gate: if DEBUG!=1 -> deny not_authorized
        if (!DEBUG_MODE) {
          send(s.ws, ServerMessages.runestoneDenied('not_authorized'));
          audit.write({
            player_id: s.player?.id ?? s.connId,
            action: RUNESTONE_DENIED_ACTION,
            inputs: { table_id: msg.table_id, reason: 'not_authorized' },
            result: 'denied',
          });
          break;
        }

        // Require auth + in_world
        if (!requireWorld(s)) break;

        // Find the table
        const table = findRunestoneTable(msg.table_id);
        if (!table) {
          send(s.ws, ServerMessages.runestoneDenied('not_near_table'));
          audit.write({
            player_id: s.player!.id,
            action: RUNESTONE_DENIED_ACTION,
            inputs: { table_id: msg.table_id, reason: 'not_near_table' },
            result: 'denied',
          });
          break;
        }

        // Check map matches
        if (table.map !== s.currentMap) {
          send(s.ws, ServerMessages.runestoneDenied('not_near_table'));
          audit.write({
            player_id: s.player!.id,
            action: RUNESTONE_DENIED_ACTION,
            inputs: { table_id: msg.table_id, reason: 'not_near_table' },
            result: 'denied',
          });
          break;
        }

        // Proximity check: player must be within 1 tile of table
        if (!isNearRunestoneTable({ x: s.player!.x, y: s.player!.y }, { x: table.x, y: table.y }, 1)) {
          send(s.ws, ServerMessages.runestoneDenied('not_near_table'));
          audit.write({
            player_id: s.player!.id,
            action: RUNESTONE_DENIED_ACTION,
            inputs: { table_id: msg.table_id, reason: 'not_near_table' },
            result: 'denied',
          });
          break;
        }

        // Cooldown check: 2000ms between casts
        if (s.lastRunestoneCastAtMs !== null && msgNow - s.lastRunestoneCastAtMs < RUNESTONE_COOLDOWN_MS) {
          send(s.ws, ServerMessages.runestoneDenied('cooldown'));
          audit.write({
            player_id: s.player!.id,
            action: RUNESTONE_DENIED_ACTION,
            inputs: { table_id: msg.table_id, reason: 'cooldown' },
            result: 'denied',
          });
          if (
            s.runestoneCooldownWindowStartMs === null ||
            msgNow - s.runestoneCooldownWindowStartMs > RUNESTONE_COOLDOWN_HEAT_WINDOW_MS
          ) {
            s.runestoneCooldownWindowStartMs = msgNow;
            s.runestoneCooldownCount = 1;
          } else {
            s.runestoneCooldownCount += 1;
            if (s.runestoneCooldownCount > 1) {
              applyHeatChange(s, msgNow, 5, 'runestone_cooldown_spam', {
                window_ms: RUNESTONE_COOLDOWN_HEAT_WINDOW_MS,
              });
            }
          }
          break;
        }

        // Roll the face (server-authoritative)
        const face = rollRunestoneFace();
        const whisper = runestoneWhisper(face);
        s.lastRunestoneCastAtMs = msgNow;

        // Emit cast receipt
        audit.write({
          player_id: s.player!.id,
          action: RUNESTONE_CAST_ACTION,
          inputs: {
            table_id: msg.table_id,
            map: s.currentMap,
            position: { x: s.player!.x, y: s.player!.y },
            guess: msg.guess,
          },
          result: 'ok',
        });

        // Emit result receipt
        audit.write({
          player_id: s.player!.id,
          action: RUNESTONE_RESULT_ACTION,
          inputs: {
            table_id: msg.table_id,
            map: s.currentMap,
            position: { x: s.player!.x, y: s.player!.y },
            face,
          },
          result: 'ok',
        });

        // Check for Trinity of Shadow
        const trinity = checkTrinityOfShadow(s.lastRunestoneFaces, face, trinityEmitted, s.player!.id);
        s.lastRunestoneFaces = trinity.updatedFaces;

        if (trinity.isTrinity) {
          audit.write({
            player_id: s.player!.id,
            action: TRINITY_OF_SHADOW_ACTION,
            inputs: {
              table_id: msg.table_id,
              map: s.currentMap,
              position: { x: s.player!.x, y: s.player!.y },
            },
            result: 'ok',
          });
        }

        // Broadcast to players within RUNESTONE_BROADCAST_RADIUS tiles on same map
        const resultMsg = ServerMessages.runestoneResult(
          msg.table_id,
          { id: s.player!.id, name: s.player!.name },
          face,
          whisper
        );

        // Send to caster
        send(s.ws, resultMsg);

        // Broadcast to nearby players (within radius, on same map)
        for (const [otherConnId, other] of sessions) {
          if (otherConnId === s.connId) continue;
          if (!other.inWorld) continue;
          if (other.currentMap !== s.currentMap) continue;
          if (!other.player) continue;

          // Manhattan distance check for broadcast radius
          const dx = Math.abs(other.player.x - s.player!.x);
          const dy = Math.abs(other.player.y - s.player!.y);
          if (dx <= RUNESTONE_BROADCAST_RADIUS && dy <= RUNESTONE_BROADCAST_RADIUS) {
            send(other.ws, resultMsg);
          }
        }

        break;
      }
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const s of sessions.values()) processSessionQueue(s, now);
}, TICK_MS);

setInterval(() => pruneExpiredGuestSessions(Date.now()), GUEST_SESSION_CLEANUP_MS);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP+WS listening on :${PORT}`);
  console.log(`HTTP health: http://localhost:${PORT}/v1/health`);
  console.log(`WS: ws://localhost:${PORT}`);
});
