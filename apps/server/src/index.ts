import fs from 'node:fs';
import http from 'node:http';
import { blake3 } from '@noble/hashes/blake3';
import stringify from 'fast-json-stable-stringify';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { createHash, randomUUID } from 'node:crypto';

import type { ClientMessage, LostItemSummary, ServerMessage, PropertyPublic, PropertyOwnerHistoryEntry } from '../../../packages/shared/protocol.js';
import { PROTOCOL_VERSION, ServerMessages, parseClientMessage } from '../../../packages/shared/protocol.js';
import type { Player, TutorialProgress } from '../../../packages/shared/types.js';
import { loadBuildInfo } from './build-info.js';
import {
  PROPERTY_CREATED_ACTION,
  PROPERTY_LISTED_ACTION,
  PROPERTY_UNLISTED_ACTION,
  PROPERTY_PURCHASED_ACTION,
  PROPERTY_TRANSFERRED_ACTION,
  PROPERTY_AUCTION_OPENED_ACTION,
  PROPERTY_BID_ACTION,
  PROPERTY_BID_REFUNDED_ACTION,
  PROPERTY_AUCTION_CANCELLED_ACTION,
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
} from '../../../packages/shared/types.js';
import { TileCode } from '../../../packages/shared/types.js';
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
} from '../../../packages/shared/constants.js';
import type {
  MapName,
  PublicReceiptsActorMode,
  PublicRumor,
  Receipt,
  SessionMeResponse,
  WorldStateResult,
} from '../../../packages/shared/http.js';
import { handleHttp } from './api/http.js';
import { parseCorsOrigins, corsHeadersFor, type CorsPolicy } from './api/cors.js';
import { createEmailSender, buildAccountEmail } from './account/email.js';

import { createAuditLogger } from './audit/logger.js';
import {
  LifecycleVerifierError,
  verifyLifecycleReceiptFile,
} from './audit/lifecycleVerifier.js';
import { createReceiptsReader } from './audit/reader.js';
import path from 'node:path';
import {
  resolveChainPaths,
  logResolvedPaths,
  isProductionMode,
  validateKeyFile,
} from '../../../packages/shared/paths.js';
import { createPersistenceLayer, computeReceiptHash, generateItemId } from './persist/index.js';
import type { InventoryItemRow, PersistenceLayer, WorldObjectRow } from './persist/index.js';
import { AccountStore } from './account/store.js';
import { AccountService } from './account/service.js';
import { makeAccountRouter } from './account/router.js';
import { RateLimiter } from './account/rateLimit.js';
import { PrincipalStore } from './principal/store.js';
import { PrincipalService } from './principal/service.js';
import { makePrincipalRouter } from './principal/router.js';
import { hashPassword, verifyPassword } from './account/password.js';
import { CharacterStore } from './character/store.js';
import { CharacterService } from './character/service.js';
import { makeCharacterRouter } from './character/router.js';
import { accountCharacterLoginProjection } from './character/loginProjection.js';
import { makeWebEconomyRouter, type ShopItemConfig } from './economy/router.js';
import { publicActorForReceipt, toPublicReceipt } from './audit/public_receipts.js';
import {
  loadAuthKeyPair,
  signToken,
  verifyToken,
  generateNonce,
  getAuthKeyDomain,
} from '../../../packages/coordination-kernel/src/identity/index.js';
import { loadVerifyingKeyHex } from '../../../packages/coordination-kernel/src/receipt/key.js';
import { createAntiCheatRuntime, hydrateAntiCheatRuntime, onChat, onMoveApplied, onMoveIntent } from './anticheat/detector.js';
import { createAntiCheatPriorStore } from './anticheat/priors.js';
import { applyThrottle, checkTemTimeout, handleTemResponse, issueTemChallenge, isThrottled } from './anticheat/tem.js';
import { loadSharedMap, createWorldState, toPublicPlayer } from './world/state.js';
import { indexFor, tryMove } from './world/movement.js';
import {
  registerMapPlaces,
  onPlayerMoved,
  onPresenceTick,
  onPlayerDisconnect,
  resetSessionState,
  getCurrentPlace,
} from './world/presence.js';
import { getNpcDef, resolveDialogueTier, buildNpcDialogue } from './world/npcs.js';
import { applyDeath, applyRespawn } from './world/death.js';
import { handleAttackIntent, COMBAT_COOLDOWN_MS, type CombatContext, type WorldItem as CombatWorldItem } from './world/combat.js';
import { getLegendaryHeat, setLegendaryHeat } from './world/drop-policy.js';
import { rngCommitV1, rngRevealHex32 } from './world/rng.js';
import {
  addHeat,
  createHeatState,
  hydrateHeatState,
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
import {
  type WitnessConfig,
  type WitnessTriggerKind,
  type WitnessResponse,
  type QuorumResolution,
  createWitnessRequest,
  selectWitnesses,
  getWitnessRequest,
  isWitnessRequestExpired,
  isWitnessInRequest,
  hasWitnessResponded,
  getWitnessPromptText,
  cleanupExpiredRequests,
  isTargetOnCooldown,
  recordWitnessResponse,
  tryResolveQuorum,
  getUnresolvedExpiredRequests,
} from './world/witness.js';
import { handleUseSkill, type SkillContext } from './skills/index.js';
import { handleGetModReports, handleModResolve, type ModerationContext } from './moderation/index.js';
import type { Element } from '../../../packages/shared/types.js';
import {
  RUNESTONE_CAST_ACTION,
  RUNESTONE_RESULT_ACTION,
  RUNESTONE_DENIED_ACTION,
  TRINITY_OF_SHADOW_ACTION,
  WITNESS_REQUESTED_ACTION,
  WITNESS_RESPONSE_ACTION,
  WITNESS_QUORUM_RESOLVED_ACTION,
  SOVEREIGN_DECLARED_ACTION,
  SOVEREIGN_PRESENCE_ACTION,
  SOVEREIGN_MARKED_ACTION,
  CAPABILITY_GRANTED_ACTION,
} from '../../../packages/shared/types.js';
import { applyBadgeDerivedCaps, hasCap } from './world/caps.js';
import {
  spawnEcho,
  despawnEcho,
  getEchoForMap,
  hasActiveEcho,
  echoToPublicPlayer,
} from './world/echo.js';
import {
  initMobs,
  getMobsForMap,
  getMobById,
  hitMob,
  mobToPublicPlayer,
  tickMobRespawns,
  spawnMobLoot,
} from './world/mobs.js';
import { CAP_ECHO_SPAWN } from '../../../packages/shared/types.js';
import { getEvidence, type EvidenceContext, type EvidenceRequest } from './evidence/handler.js';
import { computePressureMetrics } from './metrics/pressure.js';
import type { ItemForDrop } from './world/drop-policy.js';
import { getIdentity } from './world/identity.js';
import { getGoldBalance, canAfford, withTreasuryLock, debitForAction } from './world/treasury.js';
import {
  ensurePropertiesSeeded,
  hydrateProperty,
  hydrateAuction,
  getProperty,
  getAllProperties,
  getMarketListings,
  getAuction,
  minNextBid,
  isValidPrice,
  makePropertyId,
  type PropertyProjection,
  type AuctionProjection,
} from './world/property.js';
import { settleDueAuctions, clampAuctionDurationS } from './world/auction-loop.js';
import { maybeSealOriginFromReceipt } from './world/origin.js';
import {
  startContract,
  recordTick,
  completeContract,
  failContract,
  getActiveContract,
} from './world/work_contracts.js';
import {
  WITNESS_MOTH_BLOOM_EVENT_ID,
  createWitnessMothBloomRuntime,
  handleWitnessMothBloomSkillIntent,
  hydrateWitnessMothBloomRuntime,
  startWitnessMothBloom,
  witnessMothBloomPublicState,
} from './world/world-events.js';
import {
  ROOKGUARD_CODEX_PROFESSIONS,
  buildOnwardRouteProgress,
  buildRookguardQuestProgress,
  getRookguardQuestInput,
  rookguardGateOpen,
  rookguardQuestObjective,
  type RookguardQuestInput,
} from './world/rookguardQuest.js';
import { getOnwardRouteReceiptProgress } from './world/onwardRoutes.js';
import { buildSimLifeSnapshot } from './simulation/simLifeSnapshot.js';
import { chronicleAppend } from './witness/chronicleAdapter.js';
import { verifyRulebookOrExit } from './rulebook/verifyRulebook.js';
import {
  VOCATION_DECLARED_ACTION,
  SOVEREIGN_PREFIX_GRANTED_ACTION,
  SOVEREIGN_PREFIX_REVOKED_ACTION,
  SOVEREIGN_VOCATIONS,
  VOCATION_LABEL,
  VOCATION_COSMETICS,
  WALLET_CREDIT_ACTION,
  WALLET_DEBIT_ACTION,
  MAX_GOLD_AMOUNT,
} from '../../../packages/shared/types.js';
import type { SovereignVocation, PrefixGrantSource, WalletCreditReason, WalletDebitReason } from '../../../packages/shared/types.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const VERSION = '0.1.0';
// Deploy provenance (#145): written at build time, served on /v1/health.
const BUILD_INFO = loadBuildInfo();
const AUTH_KEY_DERIVATION = `blake3(${getAuthKeyDomain()} || chronicle_seed)`;
const DEFAULT_GUEST_SESSION_TTL_MS = 10 * 60 * 1000;
const DEFAULT_GUEST_SESSION_CLEANUP_MS = 60 * 1000;
const MAX_GUEST_SESSIONS = 10_000;
const DEBUG_MODE = process.env.DEBUG === '1';

const SHOP_ITEMS: Record<string, ShopItemConfig> = {
  'pilgrim_mark': {
    item_type: 'pilgrim_mark',
    price: 10,
    name: 'Pilgrim Mark',
    tag: 'Cosmetic',
    description: 'A non-power mark for identity and memory. Bought with earned gold only.',
  },
  'healing_herb': {
    item_type: 'healing_herb',
    price: 5,
    name: 'Healing Herb',
    tag: 'Consumable',
    description: 'A server-authoritative in-game item. Bought with earned gold only.',
  },
};

// PvE player health (PvP combat remains the instant-kill weighted generator)
const PLAYER_MAX_HP = 10;
const HEALING_HERB_AMOUNT = 5;
const MOB_AGGRO_DAMAGE = 1;
const MOB_AGGRO_TICK_MS = 2000;
const AGGRESSIVE_MOB_TYPES = new Set(['city_rat']);
const ANTICHEAT_PRIORS_PATH = process.env.AKALYNTH_ANTICHEAT_PRIORS_PATH;
const DEV_MINT_ENABLED = parseBoolEnv(process.env.AKALYNTH_DEV_MINT, false);
const REQUIRE_TLS = parseBoolEnv(process.env.REQUIRE_TLS, true);
const ALLOW_INSECURE_LOCAL = parseBoolEnv(process.env.ALLOW_INSECURE_LOCAL, false);
// Account portal CORS (E5 companion): the static website is a separate origin
// from this API and uses cookie sessions (`credentials: 'include'`), so the API
// must reflect an explicit allowlisted Origin — never `*`. ACCOUNT_CORS_ORIGINS
// (comma-separated) overrides these production defaults; localhost dev origins
// are additionally allowed under DEBUG/insecure-local.
const DEFAULT_WEBSITE_ORIGINS = [
  'https://akalynth.com',
  'https://www.akalynth.com',
  'https://beta.akalynth.com',
  'https://sim.akalynth.com',
] as const;
const ACCOUNT_CORS_ORIGINS = parseCorsOrigins(process.env.ACCOUNT_CORS_ORIGINS, DEFAULT_WEBSITE_ORIGINS);
const CORS_POLICY: CorsPolicy = {
  allow: ACCOUNT_CORS_ORIGINS,
  allowLocalDev: DEBUG_MODE || ALLOW_INSECURE_LOCAL,
};
// Account email delivery (E3): provider-neutral. EMAIL_TRANSPORT=smtp sends via
// nodemailer with any provider's SMTP creds (or a self-hosted relay); the
// default 'console' just logs the link (dev). Verification/reset links point at
// the portal (PORTAL_BASE_URL). Recipient email is PII — never receipted.
const EMAIL_TRANSPORT: 'smtp' | 'console' = process.env.EMAIL_TRANSPORT === 'smtp' ? 'smtp' : 'console';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Akalynth <no-reply@akalynth.com>';
const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL || 'https://akalynth.com';
const PRINCIPAL_DOMAIN = process.env.AKALYNTH_PRINCIPAL_DOMAIN || 'akalynth.com';
const PRINCIPAL_TERMS_VERSION = process.env.AKALYNTH_PRINCIPAL_TERMS_VERSION || 'identity-seal-terms-v1';
const CSRF_COOKIE_DOMAIN = process.env.CSRF_COOKIE_DOMAIN || (REQUIRE_TLS && !ALLOW_INSECURE_LOCAL ? '.akalynth.com' : undefined);
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseEnvInt(process.env.SMTP_PORT, 587, 1);
const SMTP_SECURE = parseBoolEnv(process.env.SMTP_SECURE, SMTP_PORT === 465);
const SMTP_USER = process.env.SMTP_USER || undefined;
const SMTP_PASS = process.env.SMTP_PASS || undefined;
const TRUST_PROXY = parseBoolEnv(process.env.TRUST_PROXY, false);
const TRUST_PROXY_LOOPBACK_ONLY = parseBoolEnv(process.env.TRUST_PROXY_LOOPBACK_ONLY, true);
const TRUST_PROXY_ALLOWLIST = process.env.TRUST_PROXY_ALLOWLIST ?? '';
const PUBLIC_RECEIPTS_DELAY_MS = parseEnvMs(process.env.PUBLIC_RECEIPTS_DELAY_MS, 15 * 60 * 1000, 0);
const PUBLIC_RECEIPTS_DELAY_PROFILE = parsePublicReceiptsDelayProfile(process.env.PUBLIC_RECEIPTS_DELAY_PROFILE);
const PUBLIC_RECEIPTS_BUCKET_SIZE = parseEnvInt(process.env.PUBLIC_RECEIPTS_BUCKET_SIZE, 8, 1);
const PUBLIC_RECEIPTS_ACTOR_MODE = parsePublicReceiptsActorMode(process.env.PUBLIC_RECEIPTS_ACTOR_MODE);
const PUBLIC_RECEIPTS_HASH_SALT = process.env.PUBLIC_RECEIPTS_HASH_SALT || 'akalynth-public-receipts';
const PUBLIC_RECEIPTS_JITTER_MS = parseEnvIntClamped(process.env.PUBLIC_RECEIPTS_JITTER_MS, 120_000, 0, 900_000);
const PUBLIC_RECEIPTS_JITTER_SALT = process.env.PUBLIC_RECEIPTS_JITTER_SALT || PUBLIC_RECEIPTS_HASH_SALT;
const WITNESS_ENABLED = parseBoolEnv(process.env.WITNESS_ENABLED, DEBUG_MODE);
const WITNESS_RADIUS_TILES = parseEnvInt(process.env.WITNESS_RADIUS_TILES, 8, 1);
const WITNESS_COUNT = Math.max(1, Math.min(parseEnvInt(process.env.WITNESS_COUNT, 2, 1), 3));
const WITNESS_TTL_MS = parseEnvMs(process.env.WITNESS_TTL_MS, 12_000, 1000);
const WITNESS_COOLDOWN_MS = parseEnvMs(process.env.WITNESS_COOLDOWN_MS, 60_000, 1000);

const WITNESS_CONFIG: WitnessConfig = {
  enabled: WITNESS_ENABLED,
  radiusTiles: WITNESS_RADIUS_TILES,
  maxWitnesses: WITNESS_COUNT,
  requestTtlMs: WITNESS_TTL_MS,
  witnessCooldownMs: WITNESS_COOLDOWN_MS,
  targetCooldownMs: WITNESS_COOLDOWN_MS,
  heatNudgeEnabled: false,
  heatNudgeDelta: 0,
  idSalt: '',
};

// Sovereign presence (cosmetic only, no gameplay privileges)
const SOVEREIGN_ENABLED = parseBoolEnv(process.env.SOVEREIGN_ENABLED, DEBUG_MODE);
const SOVEREIGN_NAME = process.env.SOVEREIGN_NAME ?? 'Sovereign';
const SOVEREIGN_TITLE = process.env.SOVEREIGN_TITLE ?? 'Sovereign';
const SOVEREIGN_MARK = process.env.SOVEREIGN_MARK ?? 'visible_marked';
const SOVEREIGN_FORCE_NEXT_GUEST = parseBoolEnv(process.env.SOVEREIGN_FORCE_NEXT_GUEST, false);
const SOVEREIGN_ALLOW_NAME_MATCH = parseBoolEnv(process.env.SOVEREIGN_ALLOW_NAME_MATCH, false);

// Capability Binding v0 (enforcement gates)
const CAPS_ENABLED = parseBoolEnv(process.env.CAPS_ENABLED, false);
// #101: precommit-anchored RNG v2 for loot drops. DEFAULT OFF. When unset/false,
// combat RNG output AND the persisted receipt proof are byte-identical to #100.
const RNG_V2_ENABLED = parseBoolEnv(process.env.AKALYNTH_RNG_V2, false);
const CAPS_DEBUG_GRANT_SOVEREIGN = parseBoolEnv(process.env.CAPS_DEBUG_GRANT_SOVEREIGN, false) && DEBUG_MODE;

// Plan B: Per-IP Rate Limiting (Anti-Bot Hardening)
const IP_RATE_LIMIT_ENABLED = parseBoolEnv(process.env.IP_RATE_LIMIT_ENABLED, true);
const IP_CONNECTION_LIMIT = parseEnvInt(process.env.IP_CONNECTION_LIMIT, 5, 1);
const IP_CONNECTION_WINDOW_MS = parseEnvMs(process.env.IP_CONNECTION_WINDOW_MS, 10 * 60 * 1000, 1000);
const IP_MOVE_RATE_LIMIT = parseEnvInt(process.env.IP_MOVE_RATE_LIMIT, 5, 1); // moves per second
const IP_CHAT_RATE_LIMIT = parseEnvInt(process.env.IP_CHAT_RATE_LIMIT, 1, 1); // chats per second

// Runtime Witness Loop: periodic heartbeat for observability
const HEARTBEAT_INTERVAL_MS = parseEnvMs(process.env.AKALYNTH_HEARTBEAT_MS, 5 * 60 * 1000, 60_000); // default 5 min
const LIFECYCLE_VERIFY_ON_BOOT = parseBoolEnv(process.env.AKALYNTH_LIFECYCLE_VERIFY, true);
const BOOTSTRAP_MODE = parseBoolEnv(process.env.AKALYNTH_BOOTSTRAP, false);

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
  if (value === '::1') return true;
  if (value.startsWith('127.')) return true;
  if (value.startsWith('::ffff:127.')) return true;
  return false;
}

function parseAllowlist(value: string): Set<string> {
  return new Set(
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

const TRUST_PROXY_ALLOWLIST_SET = parseAllowlist(TRUST_PROXY_ALLOWLIST);

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

function isTrustedProxy(req: IncomingMessage): boolean {
  if (!TRUST_PROXY) return false;
  const remote = req.socket.remoteAddress ?? null;
  if (TRUST_PROXY_LOOPBACK_ONLY) {
    return isLoopbackAddress(remote);
  }
  if (TRUST_PROXY_ALLOWLIST_SET.size > 0) {
    return remote ? TRUST_PROXY_ALLOWLIST_SET.has(remote) : false;
  }
  return false;
}

function resolveClientIp(req: IncomingMessage): string | null {
  const remote = req.socket.remoteAddress ?? null;
  if (isTrustedProxy(req)) {
    return forwardedFor(req) ?? remote;
  }
  return remote;
}

function tlsGate(req: IncomingMessage): { ok: boolean; reason?: string } {
  if (!REQUIRE_TLS) return { ok: true };

  const socket = req.socket as { encrypted?: boolean };
  if (socket.encrypted) return { ok: true };

  if (isTrustedProxy(req)) {
    const proto = forwardedProto(req);
    if (proto === 'https') return { ok: true };
    return { ok: false, reason: 'tls_required' };
  }

  if (ALLOW_INSECURE_LOCAL) {
    const clientIp = resolveClientIp(req);
    if (isLoopbackAddress(clientIp)) return { ok: true };
  }

  return { ok: false, reason: 'tls_required' };
}

function rejectInsecureHttp(res: ServerResponse) {
  res.statusCode = 403;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
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

function redactedActorForPlayerId(playerId: string, timestamp: string): string {
  return publicActorForReceipt(
    {
      sequence: 0,
      timestamp,
      prev_hash: 'genesis',
      event_hash: '',
      signature: '',
      actor_id: playerId,
      action: '',
      inputs: {},
      result: '',
      inputs_hash: '',
      outputs_hash: '',
    },
    PUBLIC_RECEIPTS_ACTOR_MODE,
    PUBLIC_RECEIPTS_HASH_SALT
  );
}

/**
 * Runtime Witness Loop: Lifecycle verification
 * Runs verify:lifecycle tool and returns success/failure.
 * In production, failure exits with code 2 (operator/environmental error).
 */
function verifyLifecycle(phase: 'boot' | 'shutdown', fromSequence?: number): boolean {
  if (!LIFECYCLE_VERIFY_ON_BOOT) {
    console.log(`[lifecycle] Verification disabled (AKALYNTH_LIFECYCLE_VERIFY=0)`);
    return true;
  }

  try {
    const result = verifyLifecycleReceiptFile(chainPaths.receiptsPath, { fromSequence });
    if (result.violations.length > 0) {
      throw new LifecycleVerifierError(result.violations.join('; '));
    }
    console.log(`[lifecycle] Verification passed (${phase})`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[lifecycle] Verification FAILED (${phase}): ${message}`);

    if (isProductionMode()) {
      console.error('[lifecycle] FATAL: Lifecycle verification failed in production');
      process.exit(2); // Environmental/operator error
    }

    return false;
  }
}

/**
 * Compute a stable fingerprint of the receipts path for heartbeat observability.
 * Not cryptographically secure - just a stable identifier.
 */
function receiptsPathHash(receiptsPath: string): string {
  const hash = createHash('sha256').update(receiptsPath).digest('hex');
  return hash.slice(0, 16);
}

// ============================================================================
// Plan B: IP Rate Limiting Functions (Anti-Bot Hardening)
// ============================================================================

/**
 * Hash IP address for privacy (receipts contain hash, not raw IP)
 */
function hashIp(ip: string): string {
  const hash = createHash('sha256').update(ip + PUBLIC_RECEIPTS_HASH_SALT).digest('hex');
  return hash.slice(0, 16); // 64-bit hex
}

/**
 * Check if IP has exceeded connection limit.
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
function checkIpConnectionLimit(ip: string, now: number): { allowed: boolean; reason?: string } {
  if (!IP_RATE_LIMIT_ENABLED) return { allowed: true };
  if (!ip) return { allowed: true }; // Allow if IP unknown (shouldn't happen)

  const record = ipConnections.get(ip);

  // No record yet - allow and create
  if (!record) {
    ipConnections.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }

  // Check if window has expired
  if (now - record.windowStart > IP_CONNECTION_WINDOW_MS) {
    // Reset window
    ipConnections.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }

  // Within window - check limit
  if (record.count >= IP_CONNECTION_LIMIT) {
    return { allowed: false, reason: 'ip_connection_limit_exceeded' };
  }

  // Increment and allow
  record.count++;
  return { allowed: true };
}

/**
 * Decrement IP connection count when session closes
 */
function releaseIpConnection(ip: string | null): void {
  if (!ip || !IP_RATE_LIMIT_ENABLED) return;
  const record = ipConnections.get(ip);
  if (record && record.count > 0) {
    record.count--;
  }
}

/**
 * Check if IP has exceeded action rate limit (moves or chats).
 * Uses sliding window: keeps last N timestamps, rejects if N within 1 second.
 */
function checkIpActionLimit(
  ip: string,
  action: 'move' | 'chat',
  now: number
): { allowed: boolean; reason?: string } {
  if (!IP_RATE_LIMIT_ENABLED) return { allowed: true };
  if (!ip) return { allowed: true };

  const limit = action === 'move' ? IP_MOVE_RATE_LIMIT : IP_CHAT_RATE_LIMIT;
  const bucket = ipActionBuckets.get(ip) ?? { moves: [], chats: [] };

  if (!ipActionBuckets.has(ip)) {
    ipActionBuckets.set(ip, bucket);
  }

  const timestamps = action === 'move' ? bucket.moves : bucket.chats;

  // Remove timestamps older than 1 second
  const cutoff = now - 1000;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  // Check if at limit
  if (timestamps.length >= limit) {
    return { allowed: false, reason: `ip_${action}_rate_exceeded` };
  }

  // Add timestamp and allow
  timestamps.push(now);
  return { allowed: true };
}

function maybeRequestWitnesses(
  targetPlayerId: string,
  target: Player,
  triggerKind: WitnessTriggerKind,
  map: MapName,
  now: number
): void {
  if (!WITNESS_CONFIG.enabled) return;

  if (isTargetOnCooldown(targetPlayerId, now)) return;

  const candidates = selectWitnesses(
    target,
    map,
    Array.from(sessions.values()).map((s) => ({
      connId: s.connId,
      player: s.player,
      inWorld: s.inWorld,
      currentMap: s.currentMap,
    })),
    WITNESS_CONFIG,
    now
  );

  if (candidates.length === 0) return;

  const witnessIds = candidates.map((c) => c.playerId);
  const timestamp = new Date(now).toISOString();
  const targetActorRedacted = redactedActorForPlayerId(targetPlayerId, timestamp);
  const requestId = randomUUID();

  const request = createWitnessRequest(
    requestId,
    targetPlayerId,
    targetActorRedacted,
    triggerKind,
    map,
    witnessIds,
    WITNESS_CONFIG,
    now
  );

  const promptText = getWitnessPromptText(triggerKind);

  audit.write({
    player_id: targetPlayerId,
    action: WITNESS_REQUESTED_ACTION,
    inputs: {
      kind: triggerKind,
      map,
      target_actor: targetActorRedacted,
      witness_count: witnessIds.length,
      request_id: requestId,
      ttl_ms: WITNESS_CONFIG.requestTtlMs,
    },
    result: 'ok',
  });

  for (const candidate of candidates) {
    const session = sessions.get(candidate.sessionId);
    if (!session || !session.player) continue;

    send(
      session.ws,
      ServerMessages.temWitnessRequest(requestId, timestamp, map, targetActorRedacted, promptText, 'heat_penalty')
    );
  }
}

function emitQuorumResolutionReceipt(
  request: { id: string; targetPlayerId: string; targetActorRedacted: string; triggerKind: WitnessTriggerKind; map: 'Rookguard' | 'Azura'; expiresAtMs: number; createdAtMs: number },
  resolution: QuorumResolution
): void {
  audit.write({
    player_id: request.targetPlayerId,
    action: WITNESS_QUORUM_RESOLVED_ACTION,
    inputs: {
      request_id: request.id,
      kind: request.triggerKind,
      target_actor: request.targetActorRedacted,
      map: request.map,
      outcome: resolution.outcome,
      response_count: resolution.response_count,
      expected_count: resolution.expected_count,
      confirm_count: resolution.counts.confirm,
      deny_count: resolution.counts.deny,
      uncertain_count: resolution.counts.uncertain,
      triggered_by: resolution.triggered_by,
      ttl_ms: request.expiresAtMs - request.createdAtMs,
    },
    result: resolution.outcome,
  });
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
  // Session start time for chronicle disconnect events
  connectedAtMs: number;
  // Seal 3.1: RNG commit→reveal state
  rngRevealByDomain: Record<string, string>;
  rngCommitByDomain: Record<string, string>;
  // #101: chronicle ordering ref of the spawn rng_commit event, per domain, so
  // a v2 outcome receipt can point back at the precommit (commit < outcome).
  rngCommitRefByDomain: Record<string, { chronicle_seq: number; chronicle_hash: string }>;
  // Plan B: Client IP for rate limiting
  clientIp: string | null;
  // Plan B: Attack spam tracking (for heat escalation)
  attackFailures: number[]; // timestamps of failed attacks
  skillCooldowns: Map<string, number>;
  heraldMet: boolean;
  rookguardQuest: {
    trainingComplete: boolean;
    vocation: SovereignVocation | null;
  };
};

const sessions = new Map<string, Session>();

// ============================================================================
// Plan B: IP Rate Limiting State (Anti-Bot Hardening)
// ============================================================================

interface IpConnectionRecord {
  count: number;
  windowStart: number;
}

interface IpActionBucket {
  moves: number[]; // timestamps
  chats: number[]; // timestamps
}

// Track connection attempts per IP
const ipConnections = new Map<string, IpConnectionRecord>();

// Track action rates per IP (for multi-session abuse detection)
const ipActionBuckets = new Map<string, IpActionBucket>();

// ============================================================================
// Item System State (Phase 2) - Declared early for function access
// ============================================================================

// In-memory inventory: player_id -> Set<item_id>
const inventory: Map<string, Set<string>> = new Map();

// World items: zone -> item_id -> WorldItem
interface WorldItem {
  x: number;
  y: number;
  decayAt: string | null; // ISO8601 or null (no decay)
  itemType: string;
}
const worldItems: Map<string, Map<string, WorldItem>> = new Map();

const STARTER_KIT_SOURCE = 'rookguard_starter_kit_v1';
const STARTER_KIT_ITEMS = [
  {
    item_type: 'rookguard_training_blade',
    meta: { source: STARTER_KIT_SOURCE, equipment_slot: 'hand', grants_power: false },
  },
  {
    item_type: 'rookguard_threadbare_cloak',
    meta: { source: STARTER_KIT_SOURCE, equipment_slot: 'body', grants_power: false },
  },
  {
    item_type: 'rookguard_patience_charm',
    meta: { source: STARTER_KIT_SOURCE, equipment_slot: 'trinket', grants_power: false },
  },
] as const;

// Combat cooldown tracking (Phase 3)
const lastAttackAt = new Map<string, number>();

// ============================================================================
// Seal 1: Law Before Life — verify rulebook before any stateful init
// ============================================================================
const { rulebookRoot } = verifyRulebookOrExit();

// ============================================================================
// Plan B: PUBLIC_RECEIPTS_DELAY Safety Check (Anti-Bot Hardening)
// ============================================================================
if (!DEBUG_MODE && PUBLIC_RECEIPTS_DELAY_MS < 300000) {
  console.warn('');
  console.warn('╔══════════════════════════════════════════════════════════════╗');
  console.warn('║  WARNING: Public receipts delay is dangerously low           ║');
  console.warn('╠══════════════════════════════════════════════════════════════╣');
  console.warn(`║  Current delay: ${PUBLIC_RECEIPTS_DELAY_MS}ms (${Math.floor(PUBLIC_RECEIPTS_DELAY_MS / 1000)}s)`);
  console.warn('║  Recommended minimum: 300000ms (5 minutes)                   ║');
  console.warn('║                                                              ║');
  console.warn('║  This exposes real-time player actions to public feed.      ║');
  console.warn('║  Set PUBLIC_RECEIPTS_DELAY_MS=300000 or higher.             ║');
  console.warn('╚══════════════════════════════════════════════════════════════╝');
  console.warn('');
}

if (!DEBUG_MODE && PUBLIC_RECEIPTS_DELAY_MS === 0) {
  console.error('');
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error('║  FATAL: Public receipts delay cannot be zero in production   ║');
  console.error('╠══════════════════════════════════════════════════════════════╣');
  console.error('║  PUBLIC_RECEIPTS_DELAY_MS=0 leaks real-time intel.          ║');
  console.error('║                                                              ║');
  console.error('║  Set DEBUG=1 to bypass this check, or set a proper delay.   ║');
  console.error('║  Recommended: PUBLIC_RECEIPTS_DELAY_MS=900000 (15 minutes)  ║');
  console.error('╚══════════════════════════════════════════════════════════════╝');
  console.error('');
  process.exit(1);
}

// ============================================================================
// Seal 2: Chronicle witness helper — binds all events to law
// ============================================================================
type ChronicleEventType = 'spawn' | 'move' | 'chat' | 'death' | 'disconnect' | 'rng_commit' | 'rng_reveal';

// Per-actor chain state (tamper-evident within a server run)
const lastEventHashByActor = new Map<string, string>();

// Global chain state (Seal 2.3: whole-file tamper evidence)
let lastGlobalHash: string = 'genesis';

// Monotonic chronicle sequence (#101): a per-run ordinal stamped onto every
// chronicleEvent so commit/outcome/reveal can be ordered. Seeded from the
// existing log line count on boot so it survives restarts. NOTE: this is the
// chronicle ordering space; the audit-log `sequence` is a SEPARATE space — see
// docs/RNG_OUTCOME_VERIFICATION.md (#101) for the seq-space caveat.
let chronicleSeqCounter = 0;

// ============================================================================
// Seal 2.2/2.3: Restart continuity — rebuild chain heads from chronicle.log on boot
// ============================================================================
function rebuildChronicleHeadsFromLog(logPath: string): void {
  if (!fs.existsSync(logPath)) {
    console.log(`[chronicle] No log file at ${logPath}, starting with empty chain heads`);
    return;
  }

  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n').filter((l: string) => l.trim().length > 0);

  let ok = 0;
  let bad = 0;
  let globalBad = 0;

  // Seal 2.3: Walk global chain in strict order
  let expectedPrevGlobal = 'genesis';

  // Chronicle format: <prev_hash>|<event_hash>|<signature>|<json_payload>
  for (const line of lines) {
    try {
      const parts = line.split('|');
      if (parts.length < 4) {
        bad++;
        continue;
      }

      // JSON payload is the 4th field (index 3)
      const jsonPart = parts.slice(3).join('|'); // In case JSON contains |
      const e = JSON.parse(jsonPart) as {
        actor?: string;
        payload?: {
          event_hash?: string;
          prev_global_hash?: string;
          global_event_hash?: string;
        };
      };

      // Per-actor chain rebuild
      const actor = typeof e?.actor === 'string' ? e.actor : null;
      const eventHash = typeof e?.payload?.event_hash === 'string' ? e.payload.event_hash : null;

      if (actor && eventHash) {
        lastEventHashByActor.set(actor, eventHash);
        ok++;
      } else {
        bad++;
      }

      // Seal 2.3: Global chain rebuild (strict walk)
      const prevGlobal = e?.payload?.prev_global_hash;
      const globalHash = e?.payload?.global_event_hash;

      if (typeof prevGlobal === 'string' && typeof globalHash === 'string') {
        if (prevGlobal !== expectedPrevGlobal) {
          // Global chain break detected
          globalBad++;
          // In lenient mode, don't advance head - in strict mode we'd exit
          // Continue scanning to count all breaks
        } else {
          // Chain valid at this point, advance head
          expectedPrevGlobal = globalHash;
        }
      }
      // If global fields missing (pre-2.3 events), skip global check
    } catch {
      bad++;
    }
  }

  // Set global head to last verified position
  lastGlobalHash = expectedPrevGlobal;

  // #101: seed the chronicle ordinal from existing line count so post-restart
  // commit/outcome/reveal sequences stay monotonic across runs.
  chronicleSeqCounter = lines.length;

  const hasCorruption = bad > 0 || globalBad > 0;
  if (hasCorruption) {
    console.error(`[chronicle] Corruption detected: bad=${bad} globalBad=${globalBad}`);
    if (process.env.CHRONICLE_STRICT === '1') {
      console.error('[chronicle] FATAL: strict mode enabled, refusing to start');
    } else {
      console.warn('[chronicle] WARNING: continuing in non-strict mode');
    }
  }

  const globalStatus = expectedPrevGlobal === 'genesis' ? 'genesis' : expectedPrevGlobal.slice(0, 20) + '...';
  console.log(`[chronicle] Rebuilt: actors=${lastEventHashByActor.size} global=${globalStatus} lines=${lines.length} ok=${ok} bad=${bad} globalBad=${globalBad}`);

  if (hasCorruption && process.env.CHRONICLE_STRICT === '1') {
    process.exit(1);
  }
}

// Rebuild chain heads on boot (only when chronicle is enabled)
// Seal 2.4: If chronicle integrity fails and CHRONICLE_STRICT=1, the server MUST NOT start.
if (process.env.ENABLE_CHRONICLE === '1') {
  const chronicleLogPath = process.env.CHRONICLE_LOG_PATH ?? 'chronicle.log';
  rebuildChronicleHeadsFromLog(chronicleLogPath);
}

function blake3HexBytes(bytes: Uint8Array): string {
  return Buffer.from(blake3(bytes)).toString('hex');
}

function blake3HexUtf8(s: string): string {
  return blake3HexBytes(Buffer.from(s, 'utf8'));
}

function stableJson(obj: unknown): string {
  // Deterministic for nested objects + arrays (via fast-json-stable-stringify)
  return stringify(obj);
}

function stripPayloadHashFields(p: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...p };
  // Per-actor chain fields
  delete (copy as Record<string, unknown>).payload_hash;
  delete (copy as Record<string, unknown>).prev_event_hash;
  delete (copy as Record<string, unknown>).event_hash;
  // Global chain fields (Seal 2.3)
  delete (copy as Record<string, unknown>).prev_global_hash;
  delete (copy as Record<string, unknown>).global_event_hash;
  return copy;
}

function chronicleEvent(
  event_type: ChronicleEventType,
  actorDid: string,
  caps: string[],
  payload: Record<string, unknown>,
  rng: object | null = null
) {
  const caps_hash = `blake3:${blake3HexUtf8(stableJson(caps ?? []))}`;

  // Strip hash fields, then canonicalize (also drops undefined via JSON round-trip)
  const semanticPayload = stripPayloadHashFields(payload);
  const payloadCanonical = JSON.parse(stableJson(semanticPayload)) as Record<string, unknown>;
  const payload_hash = `blake3:${blake3HexUtf8(stableJson(payloadCanonical))}`;

  const prev_event_hash = lastEventHashByActor.get(actorDid) ?? 'genesis';
  const tick = Date.now();

  // Per-actor chain (Seal 2.1)
  const event_hash_preimage = {
    v: 1,
    world_id: 'akalynth-mainnet',
    rulebook_root: rulebookRoot,
    event_type,
    actor: actorDid,
    tick,
    caps_hash,
    payload_hash,
    prev_event_hash,
  };

  const DOMAIN_EVENT = 'akalynth:chronicle:event:v1\0';
  const event_hash = `blake3:${blake3HexUtf8(DOMAIN_EVENT + stableJson(event_hash_preimage))}`;

  lastEventHashByActor.set(actorDid, event_hash);

  // Global chain (Seal 2.3)
  const prev_global_hash = lastGlobalHash;

  const global_preimage = {
    v: 1,
    world_id: 'akalynth-mainnet',
    rulebook_root: rulebookRoot,
    event_type,
    actor: actorDid,
    tick,
    caps_hash,
    payload_hash,
    event_hash, // Commits global chain to per-actor chain
    prev_global_hash,
  };

  const DOMAIN_GLOBAL = 'akalynth:chronicle:global:v1\0';
  const global_event_hash = `blake3:${blake3HexUtf8(DOMAIN_GLOBAL + stableJson(global_preimage))}`;

  lastGlobalHash = global_event_hash;

  // #101: stamp a monotonic chronicle ordinal (per-run, 1-indexed) for ordering.
  const chronicle_seq = ++chronicleSeqCounter;

  chronicleAppend({
    v: 1,
    world_id: 'akalynth-mainnet',
    rulebook_root: rulebookRoot,
    tick,
    event_type,
    actor: actorDid,
    caps_hash,
    caps: caps ?? [],
    payload: {
      ...payloadCanonical,
      payload_hash,
      prev_event_hash,
      event_hash,
      prev_global_hash,    // Seal 2.3
      global_event_hash,   // Seal 2.3
    },
    rng,
  });

  // #101: return the ordering identifiers so callers (e.g. the spawn rng_commit)
  // can thread chronicle_seq/event_hash onto the session for outcome binding.
  return { chronicle_seq, event_hash, global_event_hash };
}

// Canonical path resolution (single source of truth)
const repoRoot = path.resolve(process.cwd());
const chainPaths = resolveChainPaths(repoRoot);
logResolvedPaths(chainPaths);

// Canonical history requirement: receipts file must exist unless bootstrap is explicit.
// Missing receipts MUST NOT be treated as a clean start (silent erasure vector).
if (!fs.existsSync(chainPaths.receiptsPath)) {
  if (!BOOTSTRAP_MODE) {
    console.error('[FATAL] receipts.jsonl missing (canonical history required)');
    console.error(`        expected at: ${chainPaths.receiptsPath}`);
    console.error('        set AKALYNTH_BOOTSTRAP=1 for explicit genesis/bootstrap only');
    process.exit(2);
  }

  // Bootstrap is only valid on a truly fresh state (no DB/marker present).
  if (fs.existsSync(chainPaths.dbPath) || fs.existsSync(chainPaths.markerPath)) {
    console.error('[FATAL] bootstrap refused: DB and/or replay marker exists but receipts are missing');
    console.error(`        receipts: ${chainPaths.receiptsPath}`);
    console.error(`        db:       ${chainPaths.dbPath}`);
    console.error(`        marker:   ${chainPaths.markerPath}`);
    process.exit(2);
  }

  fs.mkdirSync(path.dirname(chainPaths.receiptsPath), { recursive: true });
  fs.closeSync(fs.openSync(chainPaths.receiptsPath, 'a'));
  console.log(`[bootstrap] Created empty receipts file: ${chainPaths.receiptsPath}`);
}

// Production key discipline: hard fail early
if (isProductionMode()) {
  if (!chainPaths.keyPath) {
    console.error('[FATAL] CHRONICLE_KEY_PATH required in production');
    process.exit(2);
  }
  try {
    validateKeyFile(chainPaths.keyPath);
  } catch (e) {
    console.error(`[FATAL] ${(e as Error).message}`);
    process.exit(2);
  }
}

// Persistence layer (SQLite + JSONL replay)
const persist = createPersistenceLayer({
  dbPath: chainPaths.dbPath,
  markerPath: chainPaths.markerPath,
  receiptsPath: chainPaths.receiptsPath,
  replayMode: (() => {
    const requested = process.env.PERSIST_REPLAY_MODE === 'lenient' ? 'lenient' : 'strict';
    if (isProductionMode() && requested === 'lenient') {
      console.error('[FATAL] PERSIST_REPLAY_MODE=lenient is forbidden in production');
      process.exit(2);
    }
    return requested;
  })(),
});

// Run replay on startup (load state from receipts)
const replayResult = persist.startup();
console.log(`[persist] Startup complete: ${replayResult.receipts_processed} receipts replayed`);
console.log(`[persist] State: ${replayResult.players_loaded} players, ${replayResult.deaths_loaded} deaths`);

// Load legendary heat from DB into runtime map (restart-proof fuses)
const heatRows = persist.getLegendaryHeatRows();
for (const row of heatRows) {
  setLegendaryHeat(row.item_id, row.heat);
}
if (heatRows.length > 0) {
  console.log(`[persist] Loaded ${heatRows.length} legendary heat entries`);
}

// Load protected slots from DB into runtime map (Phase 3.2)
const protectedByPlayerId = new Map<string, string>(); // player_id -> item_id
const protectedSlotRows = persist.getProtectedSlots();
for (const row of protectedSlotRows) {
  // If multiple protected items per player (shouldn't happen), keep latest by updated_at
  const existing = protectedByPlayerId.get(row.owner_player_id);
  if (!existing) {
    protectedByPlayerId.set(row.owner_player_id, row.item_id);
  } else {
    console.warn(`[persist] WARN: Multiple protected slots for player ${row.owner_player_id}`);
  }
}
if (protectedSlotRows.length > 0) {
  console.log(`[persist] Loaded ${protectedSlotRows.length} protected slot entries`);
}

// Raw-seed Ed25519 signing pubkey (signs receipts + chronicle events). Computed
// once at boot; published in /v1/transparency so signatures verify offline.
let signingPublicKeyHex = '';
const SIGNING_KEY_DERIVATION = 'ed25519(chronicle_seed) — signs receipts + chronicle events';

// Identity v0.1: Load auth key pair for character token signing
let authKeyPair: ReturnType<typeof loadAuthKeyPair> | null = null;
try {
  if (chainPaths.keyPath) {
    authKeyPair = loadAuthKeyPair(chainPaths.keyPath);
    signingPublicKeyHex = loadVerifyingKeyHex(chainPaths.keyPath);
    console.log(`[identity] Auth key pair loaded (public key: ${authKeyPair.publicKeyHex.slice(0, 16)}...)`);
  } else {
    console.warn('[identity] No key path configured, character creation disabled');
  }
} catch (err) {
  console.error('[identity] Failed to load auth key pair:', err);
  if (isProductionMode()) {
    console.error('[identity] FATAL: Auth key required in production mode');
    process.exit(2);
  }
}

// Audit logger with persistence hook + origin sealing
const audit = createAuditLogger({
  receiptPath: chainPaths.receiptsPath,
  keyPath: chainPaths.keyPath ?? undefined,
  onWrite: (receipt, offsetAfterLine) => {
    // Compute receipt hash once for both operations
    const receiptHash = computeReceiptHash(receipt);

    // Materialize to SQLite
    persist.materialize(receipt, offsetAfterLine);

    // Origin sealing hook - checks if this action seals the player's origin
    // Only origin-worthy actions (combat_resolved, tem_witness_response, drop_item)
    // can trigger sealing. Materializer enforces timestamp-ordered idempotency.
    maybeSealOriginFromReceipt(audit, persist, receipt, receiptHash);
  },
});
const receiptsReader = createReceiptsReader(chainPaths.receiptsPath);

// Account Platform v1 (E2 / AKALYNTH_ACCOUNT_AUTH_API_V1): the /v1/accounts/*
// surface. Receipts are privacy-bounded (emitReceipt passes only event + opaque
// account_id + redacted inputs to the audit chain). Account rows are written
// directly to persist.db, not materialized from receipts.
// Account email delivery (E3). Construction never throws (misconfigured SMTP
// falls back to console); a TLS/prod context still on console means no real
// email is going out, so warn loudly.
const emailSender = createEmailSender({
  transport: EMAIL_TRANSPORT,
  smtp: { host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE, user: SMTP_USER, pass: SMTP_PASS, from: EMAIL_FROM },
});
const emailLinks = { portalBaseUrl: PORTAL_BASE_URL, from: EMAIL_FROM };
console.log(`[email] transport=${emailSender.transport} from="${EMAIL_FROM}" portal=${PORTAL_BASE_URL}`);
if (REQUIRE_TLS && emailSender.transport === 'console') {
  console.warn('[email] WARNING: console transport in a TLS/prod context — verification/reset emails are NOT being sent. Set EMAIL_TRANSPORT=smtp.');
}

const accountService = new AccountService({
  store: new AccountStore(persist.db),
  hashPassword,
  verifyPassword,
  emitReceipt: (e) =>
    audit.write({ player_id: e.accountId ?? 'system', action: e.action, inputs: e.inputs ?? {}, result: e.result }),
  now: () => Date.now(),
  config: {
    secureCookies: REQUIRE_TLS && !ALLOW_INSECURE_LOCAL,
    csrfCookieDomain: CSRF_COOKIE_DOMAIN,
    sessionTtlSec: 30 * 24 * 60 * 60,
    verificationTtlSec: 24 * 60 * 60,
    resetTtlSec: 60 * 60,
    // E3 delivers real email; dev/insecure-local ALSO exposes the token in the
    // response (and logs it) for local testing. Production never exposes it.
    devExposeLinks: ALLOW_INSECURE_LOCAL,
  },
  // Tokens are secrets: only log them under insecure-local dev, never in prod.
  logLink: ALLOW_INSECURE_LOCAL
    ? (kind, accountId, token) => console.log(`[account] ${kind} token for ${accountId}: ${token}`)
    : undefined,
  // Real delivery (E3): fire-and-forget so it never blocks the response or leaks
  // timing; the recipient email reaches the transport only, never receipts.
  deliverEmail: (m) => {
    void emailSender
      .send(buildAccountEmail(m.kind, m.email, m.token, emailLinks))
      .catch((err) => console.error(`[email] failed to send ${m.kind} for account ${m.accountId}: ${String(err)}`));
  },
});
const handleAccount = makeAccountRouter({
  service: accountService,
  loginLimiter: new RateLimiter(10, 5 * 60 * 1000),
  writeLimiter: new RateLimiter(5, 60 * 60 * 1000),
});

// Account Platform v1 (E4 / AKALYNTH_ACCOUNT_CHARACTER_V2_V1): catalogs +
// account-gated character create/list/select. Reuses the core player+token
// primitives via injection (createCharacterHandler + issuePlayTokenForPlayer,
// both hoisted function declarations defined below). Privacy-bounded receipts.
const characterStore = new CharacterStore(persist.db);
const characterService = new CharacterService({
  store: characterStore,
  mintCharacter: (name) => createCharacterHandler(name),
  issuePlayToken: (characterId) => issuePlayTokenForPlayer(characterId),
  emitReceipt: (e) =>
    audit.write({
      player_id: e.accountId,
      action: e.action,
      inputs: { character_id: e.characterId, ...(e.inputs ?? {}) },
      result: e.result,
    }),
  now: () => Date.now(),
  maxCharactersPerAccount: 5,
});
const handleCharacter = makeCharacterRouter({
  service: characterService,
  resolveAccount: (cookies) => accountService.sessionAccount(cookies),
  requireVerifiedForCreate: true,
});
const handleEconomy = makeWebEconomyRouter({
  resolveAccount: (cookies) => accountService.sessionAccount(cookies),
  findCharacter: (characterId) => characterStore.findById(characterId),
  shopItems: SHOP_ITEMS,
  canAfford,
  getGoldBalance,
  withTreasuryLock,
  writeReceipt: (r) => audit.write(r),
  computeReceiptHash,
  generateItemId,
  addInventoryItem: (playerId, itemId) => {
    if (!inventory.has(playerId)) inventory.set(playerId, new Set());
    inventory.get(playerId)!.add(itemId);
  },
  getProperty,
  isValidPrice,
  startWorkContract: (playerId) => startContract(playerId, 'temple_sweep', Date.now(), (r) => audit.write(r)),
  tickWorkContract: (playerId, contractId) => {
    const nowMs = Date.now();
    const tickResult = recordTick(playerId, contractId, nowMs, (r) => audit.write(r));
    if (!tickResult.ok) return tickResult;
    if (!tickResult.ready_to_complete) {
      return {
        ok: true as const,
        contract_id: contractId,
        ticks_observed: tickResult.ticks_observed,
        ticks_required: tickResult.ticks_required,
        remaining_ms: tickResult.remaining_ms,
        completed: false,
      };
    }
    const completeResult = completeContract(playerId, contractId, nowMs, (r) => audit.write(r));
    if (!completeResult.ok) return completeResult;
    return {
      ok: true as const,
      contract_id: contractId,
      ticks_observed: tickResult.ticks_observed,
      ticks_required: tickResult.ticks_required,
      remaining_ms: tickResult.remaining_ms,
      completed: true,
      credited_gold: completeResult.credited_gold,
      balance_gold: getGoldBalance(playerId),
    };
  },
});

// Identity Seal v1: privacy-light principal registry + signed challenge auth.
// This is additive beside Account Platform v1; it does not mint game tokens or
// migrate personal account rows. Clients prove key control, while server code
// derives roles/capabilities from stored principal state.
const principalService = new PrincipalService({
  store: new PrincipalStore(persist.db),
  emitReceipt: (e) =>
    audit.write({
      player_id: e.principalId ?? 'system',
      action: e.action,
      inputs: e.inputs ?? {},
      result: e.result,
    }),
  now: () => Date.now(),
  config: {
    domain: PRINCIPAL_DOMAIN,
    challengeTtlMs: 5 * 60 * 1000,
    sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
    termsVersion: PRINCIPAL_TERMS_VERSION,
  },
});
const handlePrincipal = makePrincipalRouter({
  service: principalService,
  writeLimiter: new RateLimiter(10, 60 * 60 * 1000),
  challengeLimiter: new RateLimiter(30, 10 * 60 * 1000),
});

const antiCheatPriorStore = createAntiCheatPriorStore({
  enabled: DEBUG_MODE,
  filePath: ANTICHEAT_PRIORS_PATH,
});
const lifecycleInputs = {
  receipts_path: chainPaths.receiptsPath,
  pid: process.pid,
};
const bootReceipt = audit.write({
  actor_id: 'server',
  action: 'server_boot',
  inputs: lifecycleInputs,
  result: 'ok',
});
const lifecycleWindowStartSequence = bootReceipt.sequence;

// Runtime Witness Loop: verify lifecycle after boot receipt
verifyLifecycle('boot', lifecycleWindowStartSequence);

// Runtime Witness Loop: Periodic heartbeat for observability
const heartbeatPathHash = receiptsPathHash(chainPaths.receiptsPath);
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

let shutdownEmitted = false;
function emitShutdown(signal: string) {
  if (shutdownEmitted) return;
  shutdownEmitted = true;
  // Stop heartbeat immediately
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  // Never block exit indefinitely: force-exit if graceful shutdown stalls
  // (e.g. lifecycle verification or audit flush hangs).
  const forceExit = setTimeout(() => {
    console.error(`[audit] Graceful shutdown timed out (${signal}); forcing exit`);
    process.exit(0);
  }, 5_000);
  forceExit.unref();
  try {
    audit.write({
      actor_id: 'server',
      action: 'server_shutdown',
      inputs: { ...lifecycleInputs, signal },
      result: 'ok',
    });
    // Runtime Witness Loop: verify lifecycle after shutdown receipt
    verifyLifecycle('shutdown', lifecycleWindowStartSequence);
  } catch (error) {
    console.error(`[audit] Failed to write server_shutdown receipt: ${String(error)}`);
  } finally {
    clearTimeout(forceExit);
    audit.close();
    process.exit(0);
  }
}
process.on('SIGINT', () => emitShutdown('SIGINT'));
process.on('SIGTERM', () => emitShutdown('SIGTERM'));

function emitHeartbeat() {
  try {
    audit.write({
      actor_id: 'server',
      action: 'server_heartbeat',
      inputs: {
        pid: process.pid,
        version: VERSION,
        receipts_path_hash: heartbeatPathHash,
      },
      result: 'ok',
    });
  } catch (error) {
    console.error(`[heartbeat] Failed to emit: ${String(error)}`);
  }
}

if (HEARTBEAT_INTERVAL_MS > 0) {
  heartbeatInterval = setInterval(emitHeartbeat, HEARTBEAT_INTERVAL_MS);
  console.log(`[heartbeat] Enabled with interval ${HEARTBEAT_INTERVAL_MS}ms`);
}
const legendFirsts = new Set<string>();
const legendSightedByPlayer = new Set<string>();
const legendAttemptCountByPlayer = new Map<string, number>();

// Sovereign presence tracking
let activeSovereignSessionId: string | null = null;
let activeSovereignPlayerId: string | null = null;

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

function summarizeLostItems(itemIds: string[], persist: PersistenceLayer): LostItemSummary[] {
  if (itemIds.length === 0) return [];
  const MAX_SUMMARY_ITEMS = 64;
  const cappedItemIds = itemIds.length > MAX_SUMMARY_ITEMS ? itemIds.slice(0, MAX_SUMMARY_ITEMS) : itemIds;
  const truncatedCount = itemIds.length - cappedItemIds.length;
  const summary = new Map<string, { kind: string; rarity?: string; qty: number }>();

  for (const itemId of cappedItemIds) {
    const item = persist.getItem(itemId);
    const kind = item?.item_type ?? 'item';
    let rarity: string | undefined;

    if (item?.meta_json) {
      try {
        const meta = JSON.parse(item.meta_json) as Record<string, unknown>;
        if (meta.legendary === true) {
          rarity = 'legendary';
        }
      } catch {
        // Ignore malformed meta_json.
      }
    }

    const key = `${kind}::${rarity ?? ''}`;
    const existing = summary.get(key);
    if (existing) {
      existing.qty += 1;
    } else {
      summary.set(key, { kind, rarity, qty: 1 });
    }
  }

  if (truncatedCount > 0) {
    const key = 'item::';
    const existing = summary.get(key);
    if (existing) {
      existing.qty += truncatedCount;
    } else {
      summary.set(key, { kind: 'item', qty: truncatedCount });
    }
  }

  return Array.from(summary.values())
    .sort((a, b) => {
      const kindCmp = a.kind.localeCompare(b.kind);
      if (kindCmp !== 0) return kindCmp;
      const rarityCmp = (a.rarity ?? '').localeCompare(b.rarity ?? '');
      if (rarityCmp !== 0) return rarityCmp;
      return b.qty - a.qty;
    })
    .map(({ kind, rarity, qty }) => ({
      kind,
      ...(rarity ? { rarity } : {}),
      ...(qty > 1 ? { qty } : {}),
    }));
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

    if (s.inWorld && s.currentMap) {
      maybeRequestWitnesses(s.player.id, s.player, 'heat_penalty', s.currentMap, now);
    }
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
const witnessMothBloom = createWitnessMothBloomRuntime();
if (hydrateWitnessMothBloomRuntime(witnessMothBloom, persist.getWorldEvent(WITNESS_MOTH_BLOOM_EVENT_ID))) {
  console.log(`[world-events] Hydrated ${WITNESS_MOTH_BLOOM_EVENT_ID} phase=${witnessMothBloom.phase}`);
}

// Register place boundaries for presence tracking
registerMapPlaces(worlds.Rookguard.map, 'Rookguard');
registerMapPlaces(worlds.Azura.map, 'Azura');

// Load item system state from SQLite (Phase 2) - after worlds is declared
loadInventories();
loadWorldItems();
loadPropertiesAndSeed();

// ============================================================================
// Item System Functions (Phase 2)
// ============================================================================

// Zone decay policy (minutes, null = no decay)
const ZONE_DECAY_MINUTES: Record<string, number | null> = {
  Rookguard: null,
  Azura: 20,
};

function getZoneDecayMinutes(zone: string): number | null {
  return ZONE_DECAY_MINUTES[zone] ?? 20; // default 20 minutes
}

// Load inventories from SQLite on startup
function loadInventories(): void {
  const rows = persist.getInventoryItems();
  for (const row of rows) {
    if (!inventory.has(row.owner_player_id)) {
      inventory.set(row.owner_player_id, new Set());
    }
    inventory.get(row.owner_player_id)!.add(row.item_id);
  }
  console.log(`[items] Loaded ${rows.length} inventory items for ${inventory.size} players`);
}

// Load world items from SQLite on startup
function loadWorldItems(): void {
  for (const zone of Object.keys(worlds)) {
    const rows = persist.getActiveWorldItems(zone);
    if (!worldItems.has(zone)) {
      worldItems.set(zone, new Map());
    }
    const zoneMap = worldItems.get(zone)!;
    for (const row of rows) {
      zoneMap.set(row.object_id, {
        x: row.x,
        y: row.y,
        decayAt: row.decay_at,
        itemType: row.object_type,
      });
    }
    if (rows.length > 0) {
      console.log(`[items] Loaded ${rows.length} world items in ${zone}`);
    }
  }
}

// ============================================================================
// Property Ownership v0
// ============================================================================

// Hydrate the in-memory property projection from SQLite, then emit a
// property_created receipt for any map house plot not yet registered.
// Idempotent: warm boots hydrate-then-skip; fresh boots seed once.
function loadPropertiesAndSeed(): void {
  const rows = persist.getProperties();
  for (const row of rows) {
    let history: PropertyProjection['owner_history'] = [];
    try {
      history = JSON.parse(row.owner_history);
    } catch {
      history = [];
    }
    hydrateProperty({
      property_id: row.property_id,
      zone: row.zone,
      plot_id: row.plot_id,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      district: row.district,
      owner_player_id: row.owner_player_id,
      status: row.status as PropertyProjection['status'],
      listed_price_gold: row.listed_price_gold,
      primary_price_gold: row.primary_price_gold,
      purchased_at: row.purchased_at,
      sale_count: row.sale_count,
      owner_history: history,
      genesis_receipt: row.genesis_receipt,
      last_receipt: row.last_receipt,
    });
  }

  // Hydrate OPEN auctions from the durable mirror so the close→settle loop can
  // re-arm without a full replay. DB remains a materialized mirror of receipts.
  const auctionRows = persist.getOpenAuctions();
  for (const a of auctionRows) {
    hydrateAuction({
      property_id: a.property_id,
      kind: a.kind as AuctionProjection['kind'],
      seller_id: a.seller_id,
      min_bid: a.min_bid,
      min_increment_gold: a.min_increment_gold,
      current_high: a.current_high,
      high_bidder_id: a.high_bidder_id,
      status: a.status as AuctionProjection['status'],
      scheduled_close_ms: a.scheduled_close_ms,
      opened_receipt: a.opened_receipt,
      last_receipt: a.last_receipt,
    });
  }

  // Seed any plots defined on the Azura map but not yet in the registry.
  const plots = worlds.Azura.map.landmarks.house_plots ?? [];
  ensurePropertiesSeeded(plots, 'Azura', (r) => audit.write(r));
  console.log(
    `[property] Loaded ${rows.length} properties, ${auctionRows.length} open auctions; ensured ${plots.length} Azura plots seeded`
  );
}

// Resolve a player id to a display name (durable lookup; null = treasury/unowned).
function resolvePlayerName(playerId: string | null): string | null {
  if (!playerId) return null;
  const online = findPlayerByIdOnline(playerId);
  if (online) return online.name;
  return persist.getPlayer(playerId)?.name ?? playerId;
}

// Project a property to its anonymized public wire form (owner_name, never id).
function propertyToPublic(p: PropertyProjection): PropertyPublic {
  return {
    property_id: p.property_id,
    zone: p.zone,
    plot_id: p.plot_id,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    district: p.district,
    status: p.status,
    owner_name: resolvePlayerName(p.owner_player_id),
    primary_price_gold: p.primary_price_gold,
    listed_price_gold: p.listed_price_gold,
    sale_count: p.sale_count,
  };
}

function ownerHistoryToPublic(p: PropertyProjection): PropertyOwnerHistoryEntry[] {
  return p.owner_history.map((h) => ({
    from_name: resolvePlayerName(h.from),
    to_name: resolvePlayerName(h.to) ?? h.to,
    price: h.price,
    action: h.action,
    timestamp: h.timestamp,
  }));
}

/**
 * Mint starter kit for new players entering Rookguard.
 * Items are basic equipment-flavored inventory proofs, not power grants.
 */
function mintStarterKit(playerId: string): void {
  if (playerHasStarterKit(playerId)) return;

  for (const itemDef of STARTER_KIT_ITEMS) {
    // 1. Write mint receipt and get the actual written receipt back
    const writtenReceipt = audit.write({
      action: 'item_minted',
      player_id: playerId,
      inputs: {
        item_type: itemDef.item_type,
        meta: itemDef.meta,
        reason: STARTER_KIT_SOURCE,
      },
      result: 'ok',
    });

    // 2. Compute hash from the ACTUAL written receipt (same logic as materializer)
    const mintHash = computeReceiptHash(writtenReceipt);
    const itemId = generateItemId(mintHash);

    // 4. Write item_added_to_inventory receipt
    audit.write({
      action: 'item_added_to_inventory',
      player_id: playerId,
      inputs: {
        item_id: itemId,
        item_type: itemDef.item_type,
        slot: null,
        source: STARTER_KIT_SOURCE,
      },
      result: 'ok',
    });

    // 5. Update in-memory state
    if (!inventory.has(playerId)) inventory.set(playerId, new Set());
    inventory.get(playerId)!.add(itemId);
  }
}

function playerHasStarterKit(playerId: string): boolean {
  for (const itemId of getPlayerInventoryIds(playerId)) {
    const item = persist.getItem(itemId);
    if (!item?.meta_json) continue;
    try {
      const meta = JSON.parse(item.meta_json) as Record<string, unknown>;
      if (meta.source === STARTER_KIT_SOURCE) return true;
    } catch {
      // Malformed item metadata should not block a legitimate starter kit.
    }
  }
  return false;
}

/**
 * Mint a legendary item for a player.
 * Used for testing the "lit fuse" mechanic.
 *
 * @param playerId - target player
 * @param itemType - base item type (e.g., 'mark_token')
 * @param tier - legendary tier (1-5, default 1)
 * @returns the minted item_id
 */
function mintLegendaryItem(
  playerId: string,
  itemType: string = 'mark_token',
  tier: number = 1
): string {
  const meta = {
    legendary: true,
    legendary_tier: tier,
  };

  // 1. Write mint receipt and get the actual written receipt back
  const writtenReceipt = audit.write({
    action: 'item_minted',
    player_id: playerId,
    inputs: {
      item_type: itemType,
      meta,
      reason: 'legendary_mint',
    },
    result: 'ok',
  });

  // 2. Compute hash from the ACTUAL written receipt (same logic as materializer)
  const mintHash = computeReceiptHash(writtenReceipt);
  const itemId = generateItemId(mintHash);

  // 4. Write item_added_to_inventory receipt
  audit.write({
    action: 'item_added_to_inventory',
    player_id: playerId,
    inputs: {
      item_id: itemId,
      slot: null,
      source: 'legendary_mint',
    },
    result: 'ok',
  });

  // 5. Update in-memory state
  if (!inventory.has(playerId)) inventory.set(playerId, new Set());
  inventory.get(playerId)!.add(itemId);

  console.log(`[legendary] Minted tier-${tier} ${itemType} (${itemId}) for player ${playerId}`);

  return itemId;
}

function mintItemToInventory(
  playerId: string,
  itemType: string,
  meta: Record<string, unknown>,
  reason: string,
  source: string
): { item_id: string; item_type: string } {
  const writtenReceipt = audit.write({
    action: 'item_minted',
    player_id: playerId,
    inputs: {
      item_type: itemType,
      meta,
      reason,
    },
    result: 'ok',
  });

  const mintHash = computeReceiptHash(writtenReceipt);
  const itemId = generateItemId(mintHash);

  audit.write({
    action: 'item_added_to_inventory',
    player_id: playerId,
    inputs: {
      item_id: itemId,
      slot: null,
      source,
    },
    result: 'ok',
  });

  if (!inventory.has(playerId)) inventory.set(playerId, new Set());
  inventory.get(playerId)!.add(itemId);

  return { item_id: itemId, item_type: itemType };
}

/**
 * Handle player dropping an item.
 * Returns true on success, false if item not in inventory.
 */
function handleDropItem(
  playerId: string,
  itemId: string,
  zone: string,
  x: number,
  y: number
): boolean {
  // Validate: player has item
  if (!inventory.get(playerId)?.has(itemId)) return false;

  // Zone policy: decay time
  const decayMinutes = getZoneDecayMinutes(zone);
  const decayAt = decayMinutes
    ? new Date(Date.now() + decayMinutes * 60000).toISOString()
    : null;

  // Emit receipts (order matters: remove from inventory first)
  audit.write({
    action: 'item_removed_from_inventory',
    player_id: playerId,
    inputs: {
      item_id: itemId,
      reason: 'drop',
    },
    result: 'ok',
  });

  audit.write({
    action: 'item_dropped_to_world',
    player_id: playerId,
    inputs: {
      item_id: itemId,
      zone,
      x,
      y,
      decay_at: decayAt,
    },
    result: 'ok',
  });

  // Update in-memory state
  inventory.get(playerId)?.delete(itemId);

  // Clear protected slot if this item was protected (Phase 3.2)
  if (protectedByPlayerId.get(playerId) === itemId) {
    protectedByPlayerId.delete(playerId);
  }

  // Get item type from DB for world item
  const item = persist.getItem(itemId);
  const itemType = item?.item_type ?? 'unknown';

  if (!worldItems.has(zone)) worldItems.set(zone, new Map());
  worldItems.get(zone)!.set(itemId, {
    x,
    y,
    decayAt,
    itemType,
  });

  return true;
}

/**
 * Handle player picking up an item from the world.
 * Returns true on success, false if item not at player position.
 */
function handlePickupItem(
  playerId: string,
  itemId: string,
  zone: string,
  playerX: number,
  playerY: number
): boolean {
  const zoneItems = worldItems.get(zone);
  const item = zoneItems?.get(itemId);

  // Validate: item exists and player is at same position
  if (!item) return false;
  if (item.x !== playerX || item.y !== playerY) return false;

  // Emit receipts
  audit.write({
    action: 'item_picked_up_from_world',
    player_id: playerId,
    inputs: {
      item_id: itemId,
      zone,
      x: item.x,
      y: item.y,
    },
    result: 'ok',
  });

  audit.write({
    action: 'item_added_to_inventory',
    player_id: playerId,
    inputs: {
      item_id: itemId,
      // Carry the world item's type so the materializer can record it. Since #82,
      // mob loot (`*_goo`, `slime`) is now `item_minted` at spawn, so the items row
      // already exists with the correct type; this field is kept for backward-compat
      // with any old `mob_loot_spawned` receipts on existing chains.
      item_type: item.itemType,
      slot: null,
      source: 'pickup',
    },
    result: 'ok',
  });

  // Update in-memory state
  zoneItems?.delete(itemId);
  if (!inventory.has(playerId)) inventory.set(playerId, new Set());
  inventory.get(playerId)!.add(itemId);

  return true;
}

/**
 * Decay tick: remove items that have expired.
 * Called periodically from server loop.
 */
function decayTick(now: Date): void {
  for (const [zone, items] of worldItems) {
    for (const [itemId, item] of items) {
      if (item.decayAt && new Date(item.decayAt) <= now) {
        audit.write({
          action: 'world_object_removed',
          player_id: 'system',
          inputs: {
            object_id: itemId,
            reason: 'decayed',
          },
          result: 'ok',
        });
        items.delete(itemId);
        broadcastToMap(zone as 'Rookguard' | 'Azura', ServerMessages.worldItemRemoved(itemId));
      }
    }
  }
}

/**
 * Get player's inventory item IDs.
 */
function getPlayerInventoryIds(playerId: string): string[] {
  return Array.from(inventory.get(playerId) ?? []);
}

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

// Account character minting. This is internal plumbing for the account-gated
// /v1/characters route, not a standalone legacy HTTP route.
type CharacterCreateResult =
  | { ok: true; player_id: string; name: string; token: string; issued_at: number; expires_at: number }
  | { ok: false; code: 'name_taken' | 'invalid_name' | 'rate_limited' | 'banned'; message: string; status: number };

// Reserved names (case-insensitive)
const RESERVED_NAMES = ['guest', 'admin', 'system', 'sovereign', 'moderator', 'gm', 'support'];
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{2,19}$/;

function createCharacterHandler(name: string): CharacterCreateResult {
  if (!authKeyPair) {
    return { ok: false, code: 'rate_limited', message: 'Character creation not available', status: 503 };
  }

  const nameLower = name.toLowerCase();

  // Validate name format
  if (!NAME_PATTERN.test(name)) {
    audit.write({
      actor_id: 'system',
      action: 'character_create',
      inputs: { name, name_lower: nameLower },
      result: 'invalid_name',
    });
    return { ok: false, code: 'invalid_name', message: 'Name must be 3-20 characters, start with a letter, and contain only letters, numbers, underscores, and hyphens', status: 400 };
  }

  // Check reserved names
  if (RESERVED_NAMES.includes(nameLower) || nameLower.startsWith('guest_')) {
    audit.write({
      actor_id: 'system',
      action: 'character_create',
      inputs: { name, name_lower: nameLower },
      result: 'invalid_name',
    });
    return { ok: false, code: 'invalid_name', message: 'This name is reserved', status: 400 };
  }

  // Check name uniqueness (case-insensitive)
  const existing = persist.getPlayerByNameLower(nameLower);
  if (existing) {
    audit.write({
      actor_id: 'system',
      action: 'character_create',
      inputs: { name, name_lower: nameLower },
      result: 'name_taken',
    });
    return { ok: false, code: 'name_taken', message: 'Character name is already in use', status: 409 };
  }

  // Generate player ID
  const playerId = `p_${randomUUID().replace(/-/g, '')}`;
  const now = Date.now();

  // Emit character_create receipt
  audit.write({
    actor_id: 'system',
    action: 'character_create',
    inputs: { player_id: playerId, name, name_lower: nameLower, auth_method: 'character' },
    result: 'ok',
  });

  // Generate and sign token
  const nonce = generateNonce();
  const signed = signToken(playerId, authKeyPair.privateKey, { nowMs: now, nonce });

  // Emit auth_token_issue receipt
  audit.write({
    actor_id: playerId,
    action: 'auth_token_issue',
    inputs: {
      token_id: signed.payload.token_id,
      player_id: playerId,
      issued_at: signed.payload.issued_at,
      expires_at: signed.payload.expires_at,
      nonce,
      trigger: 'character_create',
    },
    result: 'ok',
  });

  return {
    ok: true,
    player_id: playerId,
    name,
    token: signed.wire,
    issued_at: signed.payload.issued_at,
    expires_at: signed.payload.expires_at,
  };
}

// Account Platform v1 (E4): issue a fresh play token for an EXISTING character
// (used by /v1/characters/select). Mirrors the createCharacterHandler token mint
// without creating a new player. auth_token_issue captures the nonce for
// determinism; no PII.
function issuePlayTokenForPlayer(playerId: string): { token: string; expires_at: number } | null {
  if (!authKeyPair) return null;
  const now = Date.now();
  const nonce = generateNonce();
  const signed = signToken(playerId, authKeyPair.privateKey, { nowMs: now, nonce });
  audit.write({
    actor_id: playerId,
    action: 'auth_token_issue',
    inputs: {
      token_id: signed.payload.token_id,
      player_id: playerId,
      issued_at: signed.payload.issued_at,
      expires_at: signed.payload.expires_at,
      nonce,
      trigger: 'character_select',
    },
    result: 'ok',
  });
  return { token: signed.wire, expires_at: signed.payload.expires_at };
}

// HTTP control plane
const httpServer = http.createServer((req, res) => {
  const corsApplied = applyCors(req, res);
  if ((req.method ?? '').toUpperCase() === 'OPTIONS' && corsApplied) {
    res.statusCode = 204;
    res.end();
    return;
  }

  const gate = tlsGate(req);
  if (!gate.ok) {
    rejectInsecureHttp(res);
    return;
  }
  const handled = handleHttp(req, res, {
    getVersion: () => VERSION,
    getBuildInfo: () => BUILD_INFO,
    getTickMs: () => TICK_MS,
    handleAccount,
    handleCharacter,
    handlePrincipal,
    handleEconomy,
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
    getSimSnapshot: () => buildSimLifeSnapshot([
      { name: 'Rookguard', map: worlds.Rookguard.map },
      { name: 'Azura', map: worlds.Azura.map },
    ]),
    getTransparency: () => ({
      version: VERSION,
      server_version: VERSION,
      identity: {
        auth_public_key_hex: authKeyPair?.publicKeyHex ?? '',
        key_derivation: AUTH_KEY_DERIVATION,
        signing_public_key_hex: signingPublicKeyHex,
        signing_key_derivation: SIGNING_KEY_DERIVATION,
      },
      principles: [
        'Money cannot buy gameplay power',
        'Every state change is receipted',
        'Receipts are cryptographically signed and chain-linked',
        'Enforcement is deterministic and replayable',
      ],
      documentation: {
        monetization_constitution: '/docs/MONETIZATION_CONSTITUTION.md',
        architecture: '/docs/ARCHITECTURE.md',
        anticheat: '/docs/ANTICHEAT.md',
      },
      public_receipts_endpoint: '/v1/receipts/public',
      verification: {
        chain_integrity: 'npm run verify:lifecycle',
        monetization_policy: 'npm run verify:monetization',
        work_contracts: 'npm run verify:work-contracts',
      },
    }),
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
    queryAntiCheatPrior: (playerId) => antiCheatPriorStore.queryPlayerPrior(playerId),
    mintGuestSession: () => {
      const now = Date.now();
      pruneExpiredGuestSessions(now);

      if (guestSessions.size >= MAX_GUEST_SESSIONS) {
        return { error: 'guest_session_capacity', status: 429 };
      }

      const player_id = `p_${randomUUID()}`;
      const guest_token = `gt_${randomUUID()}`;
      let name = `Guest_${player_id.slice(-4)}`;

      // Debug-only: force next guest to be Sovereign
      if (SOVEREIGN_ENABLED && SOVEREIGN_FORCE_NEXT_GUEST && DEBUG_MODE) {
        name = SOVEREIGN_NAME;
      }

      const expires_at_ms = now + GUEST_SESSION_TTL_MS;
      guestSessions.set(guest_token, { player_id, name, minted_at_ms: now, expires_at_ms, consumed: false });
      audit.write({
        player_id,
        action: 'session_guest_minted',
        inputs: { source: 'http_mint', name },
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
    // Property Ownership v0 (public, anonymized)
    getPropertyMarket: () => {
      const listings = getMarketListings().map((p) => ({
        property_id: p.property_id,
        zone: p.zone,
        plot_id: p.plot_id,
        district: p.district,
        status: p.status,
        owner_name: resolvePlayerName(p.owner_player_id),
        primary_price_gold: p.primary_price_gold,
        listed_price_gold: p.listed_price_gold,
      }));
      return { listings, total: listings.length };
    },
    getPropertyLedger: (property_id: string) => {
      const p = getProperty(property_id);
      if (!p) return null;
      const history = ownerHistoryToPublic(p);
      const owners = new Set<string>();
      for (const h of p.owner_history) owners.add(h.to);
      const last = history.length > 0 ? history[history.length - 1] : null;
      return {
        property_id: p.property_id,
        district: p.district,
        owner_name: resolvePlayerName(p.owner_player_id),
        sale_count: p.sale_count,
        owner_count: owners.size,
        last_sale: last
          ? { from_name: last.from_name, to_name: last.to_name, price: last.price, timestamp: last.timestamp }
          : null,
        owner_history: history,
      };
    },
  });

  // Handle both sync and async responses from handleHttp
  if (handled instanceof Promise) {
    handled.then((result) => {
      if (!result) {
        res.statusCode = 404;
        res.end('not found');
      }
    }).catch((err) => {
      console.error('[http] Error handling request:', err);
      res.statusCode = 500;
      res.end('internal error');
    });
  } else if (!handled) {
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

  // Plan B: Per-IP connection rate limiting
  const clientIp = resolveClientIp(req);
  if (clientIp) {
    const ipCheck = checkIpConnectionLimit(clientIp, Date.now());
    if (!ipCheck.allowed) {
      // Emit rate_limit_exceeded receipt
      audit.write({
        player_id: 'system',
        action: 'rate_limit_exceeded',
        inputs: {
          ip_hash: hashIp(clientIp),
          scope: 'connect',
          limit: IP_CONNECTION_LIMIT,
          window_ms: IP_CONNECTION_WINDOW_MS,
        },
        result: 'rejected',
      });

      // Reject connection
      try {
        const body = 'Connection limit exceeded';
        socket.write(
          `HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(
            body
          )}\r\n\r\n${body}`
        );
      } catch {
        // ignore
      }
      socket.destroy();
      return;
    }
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    // Pass req through so we can access it in connection handler
    wss.emit('connection', ws, req);
  });
});

function worldFor(s: Session) {
  return worlds[s.currentMap];
}

/**
 * Find a player by ID from online sessions only.
 * Returns null if player is not connected or not in-world.
 */
function findPlayerByIdOnline(playerId: string): Player | null {
  for (const s of sessions.values()) {
    if (s.inWorld && s.player && s.player.id === playerId) {
      return s.player;
    }
  }
  return null;
}

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

// Apply the account-portal CORS allowlist (see api/cors.ts). Reflects an
// explicit allowlisted Origin with credentials enabled, or no CORS headers at
// all for disallowed origins. Returns true when headers were set so the OPTIONS
// preflight can short-circuit with 204.
function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const headers = corsHeadersFor(req.headers.origin, CORS_POLICY);
  if (!headers) return false;
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  return true;
}

function rookguardQuestInputFor(s: Session): RookguardQuestInput {
  return {
    tutorial: s.tutorial,
    trainingComplete: s.rookguardQuest.trainingComplete,
    vocation: s.rookguardQuest.vocation,
  };
}

function playLoopFor(s: Session) {
  const rookguardQuestInput = rookguardQuestInputFor(s);
  const gateOpen = rookguardGateOpen(rookguardQuestInput);
  const bloom = witnessMothBloomPublicState(witnessMothBloom);
  let objective = 'Step onto the move rune';

  if (s.currentMap === 'Rookguard') objective = rookguardQuestObjective(rookguardQuestInput);
  else if (!s.tutorial.gate) objective = 'Enter the High City gate';
  else if (!s.heraldMet) objective = 'Seek the High City herald in the southern plaza';
  else if (bloom.phase === 'signal' || bloom.phase === 'investigation') objective = 'Help resolve the Witness Moth Bloom above High City';
  else objective = 'Talk to the steward at guild hall';

  return {
    ...s.tutorial,
    gateOpen,
    objective,
    rookguardQuest: buildRookguardQuestProgress(rookguardQuestInput),
    onwardRoutes: buildOnwardRouteProgress(
      rookguardQuestInput,
      s.player ? getOnwardRouteReceiptProgress(s.player.id) : undefined
    ),
    lastEvent: bloom.phase === 'idle' ? null : `witness_moth_bloom_${bloom.phase}`,
    ...(bloom.teaser ? { teaser: bloom.teaser } : {}),
  };
}

function sendLoopUpdate(s: Session, event: string) {
  if (!s.player || s.ws.readyState !== WebSocket.OPEN) return;
  send(s.ws, ServerMessages.loopUpdate(event, playLoopFor(s)));
}

function toPublicSessionPlayer(s: Session, includeDeadUntil = false) {
  return {
    ...toPublicPlayer(s.player!, includeDeadUntil),
    loop: playLoopFor(s),
  };
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
      s.player!.hp = PLAYER_MAX_HP;
      s.player!.max_hp = PLAYER_MAX_HP;
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

  // Include Echo if on this map
  const respawnEcho = getEchoForMap(s.currentMap);
  if (respawnEcho) {
    nearby.push(echoToPublicPlayer(respawnEcho));
  }

  // Include alive mobs
  for (const mob of getMobsForMap(s.currentMap)) {
    nearby.push(mobToPublicPlayer(mob));
  }

  send(s.ws, ServerMessages.worldState(s.currentMap, toPublicSessionPlayer(s, true), nearby));
  s.respawnTimer = null;
}

// Re-send the authoritative world snapshot to one player (used after HP changes).
function sendWorldStateRefresh(s: Session): void {
  if (!s.player || s.ws.readyState !== WebSocket.OPEN) return;
  const w = worlds[s.currentMap];
  if (!w) return;
  const nearby = Array.from(w.players.values())
    .filter((p) => p.id !== s.player!.id)
    .map((p) => toPublicPlayer(p));
  const echo = getEchoForMap(s.currentMap);
  if (echo) nearby.push(echoToPublicPlayer(echo));
  for (const mob of getMobsForMap(s.currentMap)) nearby.push(mobToPublicPlayer(mob));
  send(s.ws, ServerMessages.worldState(s.currentMap, toPublicSessionPlayer(s, true), nearby));
}

// Apply death to a player slain by a mob (HP hit 0). Mirrors the kill_self path.
function applyMobDeath(s: Session, mobType: string, now: number): void {
  if (!s.player) return;
  const w = worlds[s.currentMap];
  if (!w) return;

  if (s.respawnTimer) {
    clearTimeout(s.respawnTimer);
    s.respawnTimer = null;
  }

  const deathResult = applyDeath({
    now,
    player_id: s.player.id,
    map: s.currentMap,
    position: { x: s.player.x, y: s.player.y },
    cause: 'npc',
    killer_id: null,
    respawn_delay_ms: DEATH_RESPAWN_DELAY_MS,
    current_status: s.player.status,
    current_dead_until_ms: s.player.dead_until_ms,
    lastDamage: { at_ms: now, source_type: 'unknown', source_id: mobType },
    gateUnlocked: s.tutorial.complete,
    emitFirstOf: () => {},
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
    recordLedgerDeath(s.player.id, s.currentMap, deathTs);
    s.ledgerHesitationArmed = false;
    s.ledgerHesitationDeathTs = null;
    chronicleEvent('death', `did:akalynth:${s.player.id}`, s.player.caps ?? [], {
      player_id: s.player.id,
      map: s.currentMap,
      x: s.player.x,
      y: s.player.y,
      cause: 'npc',
      killer_id: null,
    });
  }

  scheduleRespawnIfNeeded(s, now);
  send(s.ws, ServerMessages.deathNotice(
    deathResult.respawn_in_ms,
    s.currentMap,
    w.map.spawn,
    deathResult.changed ? 'npc' : 'already_dead'
  ));
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

wss.on('connection', (ws, req: IncomingMessage) => {
  const connId = randomUUID();
  const now = Date.now();
  const clientIp = resolveClientIp(req);

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
    connectedAtMs: now,
    rngRevealByDomain: {},
    rngCommitByDomain: {},
    rngCommitRefByDomain: {},
    clientIp,
    attackFailures: [],
    skillCooldowns: new Map(),
    heraldMet: false,
    rookguardQuest: {
      trainingComplete: false,
      vocation: null,
    },
  };

  sessions.set(connId, s);
  audit.write({ player_id: connId, action: 'connect', inputs: {}, result: 'connected' });
  send(ws, ServerMessages.welcome(PROTOCOL_VERSION));

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

    // Work contract failure on disconnect
    if (s.player && getActiveContract(s.player.id)) {
      failContract(s.player.id, 'disconnect', (r) => audit.write(r));
    }

    // Presence cleanup on disconnect
    if (s.player) {
      onPlayerDisconnect(s.player.id);
    }

    // Sovereign cleanup
    if (SOVEREIGN_ENABLED && activeSovereignSessionId === s.connId && s.player) {
      audit.write({
        player_id: s.player.id,
        action: SOVEREIGN_PRESENCE_ACTION,
        inputs: {
          map: s.currentMap,
          position: { x: s.player.x, y: s.player.y },
        },
        result: 'left',
      });

      // Sovereign Echo spawn (cap-gated)
      if (CAPS_ENABLED && s.inWorld && hasCap(s.player, CAP_ECHO_SPAWN)) {
        spawnEcho(s.player.id, s.player.name, s.currentMap, s.player.x, s.player.y, audit);
        const echo = getEchoForMap(s.currentMap);
        if (echo) {
          broadcastToMap(s.currentMap, ServerMessages.playerJoined(echoToPublicPlayer(echo)), s.connId);
        }
      }

      activeSovereignSessionId = null;
      activeSovereignPlayerId = null;
    }

    if (s.player && s.inWorld) {
      const w = worldFor(s);
      w.players.delete(s.player.id);
      broadcastToMap(s.currentMap, ServerMessages.playerLeft(s.player.id), connId);
      audit.write({ player_id: s.player.id, action: 'disconnect', inputs: {}, result: 'left_world' });

      // Seal 3.1: Emit rng_reveal before disconnect if session has v1 commits
      for (const [domain, reveal] of Object.entries(s.rngRevealByDomain)) {
        const commit = s.rngCommitByDomain[domain];
        if (commit) {
          chronicleEvent('rng_reveal', `did:akalynth:${s.player.id}`, s.player.caps ?? [], {
            rng_domain: domain,
            rng_commit: commit,
            rng_reveal: reveal,
            reveal_reason: 'disconnect',
          });
        }
      }

      // Chronicle witness: disconnect event (Seal 2)
      const disconnectNow = Date.now();
      chronicleEvent('disconnect', `did:akalynth:${s.player.id}`, s.player.caps ?? [], {
        player_id: s.player.id,
        map: s.currentMap,
        x: s.player.x,
        y: s.player.y,
        in_world: s.inWorld,
        session_duration_ms: disconnectNow - s.connectedAtMs,
      });
    } else {
      audit.write({ player_id: connId, action: 'disconnect', inputs: {}, result: 'disconnected' });
    }

    // Plan B: Release IP connection count
    releaseIpConnection(s.clientIp);
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
        send(s.ws, ServerMessages.welcome(PROTOCOL_VERSION));
        break;
      }

      case 'login': {
        let player_id: string;
        let guest_token: string | undefined;
        let name: string;
        let authToken: string | undefined;
        let tokenExpiresAt: number | undefined;

        // Identity v0.1: Signed token takes priority
        if (msg.token && authKeyPair) {
          const tokenResult = verifyToken(msg.token, authKeyPair.publicKey, { nowMs: msgNow });

          if (!tokenResult.ok) {
            const errorCode = tokenResult.error === 'expired' ? 'token_expired' : 'token_invalid';
            send(s.ws, ServerMessages.error(errorCode, `Token ${tokenResult.error}`));
            audit.write({
              player_id: s.connId,
              action: 'login',
              inputs: { token_provided: true, error: tokenResult.error },
              result: 'rejected',
            });
            break;
          }

          // Look up player name from DB
          const playerRow = persist.getPlayer(tokenResult.payload.player_id);
          if (!playerRow) {
            send(s.ws, ServerMessages.error('not_authenticated', 'Player not found'));
            audit.write({
              player_id: tokenResult.payload.player_id,
              action: 'login',
              inputs: { token_provided: true, error: 'player_not_found' },
              result: 'rejected',
            });
            break;
          }

          player_id = tokenResult.payload.player_id;
          name = playerRow.name;
          authToken = msg.token;
          tokenExpiresAt = tokenResult.payload.expires_at;

          audit.write({
            player_id,
            action: 'login',
            inputs: { source: 'token', auth_method: 'character' },
            result: 'ok',
          });
        }
        // Legacy: guest_token provided
        else if (msg.guest_token) {
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

          // Emit session_guest_minted first (creates player row in DB)
          audit.write({
            player_id,
            action: 'session_guest_minted',
            inputs: { source: 'ws_mint' },
            result: 'ok',
          });

          audit.write({
            player_id,
            action: 'session_guest_minted',
            inputs: { source: 'ws_mint', name },
            result: 'ok',
          });
        }

        const accountProjection = authToken ? accountCharacterLoginProjection(characterStore.findById(player_id)) : null;
        const restoredRookguardQuest = getRookguardQuestInput(player_id);
        const restoredIdentity = getIdentity(player_id);
        let loginMap = accountProjection?.map ?? 'Rookguard';
        if (loginMap === 'Rookguard' && restoredRookguardQuest.tutorial.complete) {
          loginMap = 'Azura';
        }
        const spriteId = accountProjection?.sprite_id ?? null;
        const spawn = worlds[loginMap].map.spawn;
        const hydratedTutorial = loginMap === 'Azura'
          ? { ...restoredRookguardQuest.tutorial, gate: true, complete: true }
          : restoredRookguardQuest.tutorial;

        s.guestToken = guest_token ?? null;
        s.currentMap = loginMap;
        s.tutorial = hydratedTutorial;
        s.ledgerHesitationArmed = false;
        s.ledgerHesitationDeathTs = null;
        s.rookguardQuest = {
          trainingComplete: restoredRookguardQuest.trainingComplete,
          vocation: restoredRookguardQuest.vocation,
        };
        s.player = {
          id: player_id,
          name,
          x: spawn.x,
          y: spawn.y,
          state: 'authenticated',
          status: 'alive',
          dead_until_ms: null,
          hp: PLAYER_MAX_HP,
          max_hp: PLAYER_MAX_HP,
          reputation: 0,
          sprite_id: spriteId,
          badges: restoredIdentity.vocation ? [VOCATION_COSMETICS[restoredIdentity.vocation].badge] : [],
          caps: [],
        };

        // Restore heat from persistence (Phase 3.5: closes heat reset exploit)
        const savedHeat = persist.getPlayerHeat(player_id);
        if (savedHeat) {
          const now = Date.now();
          s.heat = hydrateHeatState(savedHeat, now, HEAT_DECAY_PER_MIN);
        }

        const savedAntiCheat = persist.getPlayerAntiCheatEnforcement(player_id);
        if (savedAntiCheat) {
          s.anti = hydrateAntiCheatRuntime(savedAntiCheat, Date.now());
        }

        // Sovereign presence detection (security-gated)
        const isSovereignByName =
          SOVEREIGN_ENABLED &&
          (DEBUG_MODE || SOVEREIGN_ALLOW_NAME_MATCH) &&
          s.player.name === SOVEREIGN_NAME;

        if (isSovereignByName) {
          if (activeSovereignSessionId && activeSovereignSessionId !== s.connId) {
            // Reject duplicate sovereign
            send(s.ws, ServerMessages.loginAck(player_id, guest_token ?? '', name, false, 'sovereign_already_active'));
            audit.write({
              player_id,
              action: SOVEREIGN_DECLARED_ACTION,
              inputs: { name: SOVEREIGN_NAME },
              result: 'rejected',
            });
            s.player = null;
            s.guestToken = null;
            break;
          }
          // Echo despawn on new sovereign session (cause='replaced' - new session replaces old echo)
          if (CAPS_ENABLED && hasActiveEcho()) {
            const echoInfo = despawnEcho(audit, 'replaced');
            if (echoInfo) {
              broadcastToMap(echoInfo.map, ServerMessages.playerLeft(echoInfo.echo_id));
            }
          }

          activeSovereignSessionId = s.connId;
          activeSovereignPlayerId = player_id;
          audit.write({
            player_id,
            action: SOVEREIGN_DECLARED_ACTION,
            inputs: { name: SOVEREIGN_NAME },
            result: 'ok',
          });
        }

        send(s.ws, ServerMessages.loginAck(
          player_id,
          guest_token ?? '',
          name,
          true,
          undefined,
          authToken ? { token: authToken, expires_at: tokenExpiresAt } : undefined
        ));
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

        // Reset presence session state for fresh tracking
        resetSessionState(s.player!.id);

        // Mint starter kit for Rookguard players (Phase 2)
        // Skip in DEBUG mode to avoid FK constraint issues during skills testing
        if (s.currentMap === 'Rookguard' && process.env.DEBUG !== '1') {
          mintStarterKit(s.player!.id);
        }

        // Apply sovereign presence marking (cosmetic only)
        if (SOVEREIGN_ENABLED && activeSovereignPlayerId === s.player!.id) {
          s.player!.title = SOVEREIGN_TITLE;
          s.player!.badges = ['sovereign'];
          s.player!.mark = SOVEREIGN_MARK;
          audit.write({
            player_id: s.player!.id,
            action: SOVEREIGN_MARKED_ACTION,
            inputs: {
              title: SOVEREIGN_TITLE,
              badges: ['sovereign'],
              mark: SOVEREIGN_MARK,
              map: s.currentMap,
            },
            result: 'ok',
          });
          audit.write({
            player_id: s.player!.id,
            action: SOVEREIGN_PRESENCE_ACTION,
            inputs: {
              map: s.currentMap,
              position: { x: s.player!.x, y: s.player!.y },
            },
            result: 'entered',
          });
        }

        // Apply badge-derived capabilities (only when explicitly enabled)
        if (CAPS_ENABLED && CAPS_DEBUG_GRANT_SOVEREIGN && s.player!.badges?.includes('sovereign')) {
          applyBadgeDerivedCaps(s.player!, audit);
        }

        const w = worldFor(s);
        w.players.set(s.player!.id, s.player!);

        const nearby = Array.from(w.players.values())
          .filter((p) => p.id !== s.player!.id)
          .map((p) => toPublicPlayer(p));

        // Include Echo if on this map
        const echo = getEchoForMap(s.currentMap);
        if (echo) {
          nearby.push(echoToPublicPlayer(echo));
        }

        // Include alive mobs
        for (const mob of getMobsForMap(s.currentMap)) {
          nearby.push(mobToPublicPlayer(mob));
        }

        audit.write({ player_id: s.player!.id, action: 'enter_world', inputs: {}, result: 'ok' });

        send(s.ws, ServerMessages.worldState(s.currentMap, toPublicSessionPlayer(s, true), nearby));

        // Send inventory snapshot (Phase 2)
        const playerItems = getPlayerInventoryIds(s.player!.id);
        const itemInfos = playerItems.map((itemId) => {
          const item = persist.getItem(itemId);
          return { item_id: itemId, item_type: item?.item_type ?? 'unknown' };
        });
        send(s.ws, ServerMessages.inventorySnapshot(itemInfos));

        // Send property snapshot (Property Ownership v0) so the client can
        // render ownership/market state immediately.
        send(s.ws, ServerMessages.propertySnapshot(getAllProperties().map(propertyToPublic)));

        broadcastToMap(s.currentMap, ServerMessages.playerJoined(toPublicPlayer(s.player!)), s.connId);

        // Chronicle witness: spawn event (Seal 2)
        chronicleEvent('spawn', `did:akalynth:${s.player!.id}`, s.player!.caps ?? [], {
          player_id: s.player!.id,
          map: s.currentMap,
          x: s.player!.x,
          y: s.player!.y,
        });

        // Seal 3.1: Emit rng_commit for death_drop:v1 domain
        {
          const domain = 'death_drop:v1';
          const actorDid = `did:akalynth:${s.player!.id}`;
          const reveal = rngRevealHex32();
          const commit = rngCommitV1(domain, actorDid, reveal);
          s.rngRevealByDomain[domain] = reveal;
          s.rngCommitByDomain[domain] = commit;
          const commitRef = chronicleEvent('rng_commit', actorDid, s.player!.caps ?? [], {
            rng_domain: domain,
            rng_commit: commit,
            commit_scope: 'session',
            commit_seq: 1,
          });
          // #101: remember the chronicle ordering ref of THIS commit so a later
          // v2 loot-drop receipt can prove commit < outcome.
          s.rngCommitRefByDomain[domain] = {
            chronicle_seq: commitRef.chronicle_seq,
            chronicle_hash: commitRef.event_hash,
          };
        }

        // Initial presence tracking for spawn position
        onPlayerMoved(s.player!.id, s.currentMap, s.player!.x, s.player!.y, Date.now(), (r) => audit.write(r));
        break;
      }

      case 'tem_response': {
        if (!requireAuth(s)) break;
        const out = handleTemResponse(s.anti.state, msg.response);
        if (out.outcome === 'passed') {
          audit.write({ player_id: s.player!.id, action: 'tem_challenge_passed', inputs: {}, result: 'passed' });
          let rookguardTemCompleted = false;
          if (s.currentMap === 'Rookguard' && !s.tutorial.tem) {
            s.tutorial.tem = true;
            audit.write({
              player_id: s.player!.id,
              action: 'tutorial_step_complete',
              inputs: { step: 'tem' },
              result: 'ok',
            });
            rookguardTemCompleted = true;
          }
          if (rookguardTemCompleted) sendLoopUpdate(s, 'rookguard_tem_complete');
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

        // Plan B: Per-IP chat rate limiting (cross-session abuse detection)
        if (s.clientIp) {
          const ipCheck = checkIpActionLimit(s.clientIp, 'chat', msgNow);
          if (!ipCheck.allowed) {
            audit.write({
              player_id: s.player!.id,
              action: 'rate_limit_exceeded',
              inputs: {
                ip_hash: hashIp(s.clientIp),
                scope: 'chat',
                limit: IP_CHAT_RATE_LIMIT,
              },
              result: 'rejected',
            });
            send(s.ws, ServerMessages.error('rate_limited', 'Chat rate limit exceeded'));
            break;
          }
        }

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
            let rookguardTemCompleted = false;
            if (s.currentMap === 'Rookguard' && !s.tutorial.tem) {
              s.tutorial.tem = true;
              audit.write({
                player_id: s.player!.id,
                action: 'tutorial_step_complete',
                inputs: { step: 'tem', via: 'chat' },
                result: 'ok',
              });
              rookguardTemCompleted = true;
            }
            if (rookguardTemCompleted) sendLoopUpdate(s, 'rookguard_tem_complete');
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
          sendLoopUpdate(s, 'rookguard_chat_complete');
        }

        // Admin command: /legendary [tier] - mint a legendary item (DEBUG_MODE only)
        if (DEBUG_MODE && msg.message.startsWith('/legendary')) {
          const parts = msg.message.split(' ');
          const tier = parts[1] ? parseInt(parts[1], 10) : 1;
          const validTier = isNaN(tier) || tier < 1 || tier > 5 ? 1 : tier;
          const itemId = mintLegendaryItem(s.player!.id, 'mark_token', validTier);
          // Send inventory snapshot with new item
          const playerItems = Array.from(inventory.get(s.player!.id) ?? []).map((id) => {
            const item = persist.getItem(id);
            return { item_id: id, item_type: item?.item_type ?? 'unknown' };
          });
          send(s.ws, ServerMessages.inventorySnapshot(playerItems));
          // Broadcast confirmation via chat
          broadcastToMap(
            s.currentMap,
            ServerMessages.chatBroadcast('system', 'System', `${s.player!.name} acquired a legendary item!`)
          );
          break;
        }

        // Admin command: /heat - show heat levels of carried legendary items (DEBUG_MODE only)
        if (DEBUG_MODE && msg.message === '/heat') {
          const playerItems = Array.from(inventory.get(s.player!.id) ?? []);
          const heatInfo: string[] = [];
          for (const itemId of playerItems) {
            const item = persist.getItem(itemId);
            if (item?.meta_json) {
              try {
                const meta = JSON.parse(item.meta_json);
                if (meta.legendary) {
                  const heat = getLegendaryHeat(itemId);
                  heatInfo.push(`${item.item_type}(T${meta.legendary_tier ?? 1}): H=${heat.toFixed(2)}`);
                }
              } catch {
                // ignore parse errors
              }
            }
          }
          const heatMsg = heatInfo.length > 0
            ? `Heat: ${heatInfo.join(', ')}`
            : 'No legendary items carried';
          send(s.ws, ServerMessages.chatBroadcast('system', 'System', heatMsg));
          break;
        }

        audit.write({ player_id: s.player!.id, action: 'chat', inputs: { message: msg.message }, result: 'ok' });
        broadcastToMap(s.currentMap, ServerMessages.chatBroadcast(s.player!.id, s.player!.name, msg.message));

        // Chronicle witness: chat event (Seal 2, privacy-safe hash)
        const chatHash = createHash('sha256').update(msg.message, 'utf8').digest('hex');
        chronicleEvent('chat', `did:akalynth:${s.player!.id}`, s.player!.caps ?? [], {
          player_id: s.player!.id,
          map: s.currentMap,
          message_len: msg.message.length,
          message_hash: `sha256:${chatHash}`,
        });
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

          // Chronicle witness: death event (Seal 2, test death)
          chronicleEvent('death', `did:akalynth:${s.player!.id}`, s.player!.caps ?? [], {
            player_id: s.player!.id,
            map: s.currentMap,
            x: s.player!.x,
            y: s.player!.y,
            cause: 'test',
            killer_id: null,
          });
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

        // Plan B: Per-IP move rate limiting (cross-session abuse detection)
        if (s.clientIp) {
          const ipCheck = checkIpActionLimit(s.clientIp, 'move', msgNow);
          if (!ipCheck.allowed) {
            audit.write({
              player_id: s.player!.id,
              action: 'rate_limit_exceeded',
              inputs: {
                ip_hash: hashIp(s.clientIp),
                scope: 'move',
                limit: IP_MOVE_RATE_LIMIT,
              },
              result: 'rejected',
            });
            send(s.ws, ServerMessages.moveResult(false, s.player!.x, s.player!.y, 'rate_limited'));
            break;
          }
        }

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
              sendLoopUpdate(s, 'rookguard_move_complete');
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
              if (rookguardGateOpen(rookguardQuestInputFor(s))) {
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
                sendLoopUpdate(s, 'rookguard_codex_path_complete');

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

                // Include Echo if on Azura
                const azuraEcho = getEchoForMap('Azura');
                if (azuraEcho) {
                  nearbyAzura.push(echoToPublicPlayer(azuraEcho));
                }

                // Include alive mobs
                for (const mob of getMobsForMap('Azura')) {
                  nearbyAzura.push(mobToPublicPlayer(mob));
                }

                send(s.ws, ServerMessages.worldState(s.currentMap, toPublicSessionPlayer(s, true), nearbyAzura));
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

        send(
          s.ws,
          ServerMessages.moveResult(res.ok, finalX, finalY, res.reason, transferred ? s.currentMap : undefined)
        );
        if (res.ok && !transferred) broadcastToMap(s.currentMap, ServerMessages.playerMoved(s.player!.id, finalX, finalY), s.connId);

        // Track presence after successful movement
        if (res.ok) {
          onPlayerMoved(s.player!.id, s.currentMap, finalX, finalY, msgNow, (r) => audit.write(r));

          // Chronicle witness: move event (Seal 2)
          chronicleEvent('move', `did:akalynth:${s.player!.id}`, s.player!.caps ?? [], {
            player_id: s.player!.id,
            map: s.currentMap,
            from: { x: before.x, y: before.y },
            to: { x: finalX, y: finalY },
            dir: msg.direction,
            transferred,
          });
        }
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

      case 'tem_witness_response': {
        if (!requireAuth(s)) break;
        if (!s.player) break;

        const request = getWitnessRequest(msg.request_id);
        if (!request) {
          audit.write({
            player_id: s.player.id,
            action: WITNESS_RESPONSE_ACTION,
            inputs: { request_id: msg.request_id, error: 'request_not_found' },
            result: 'rejected',
          });
          break;
        }

        if (isWitnessRequestExpired(request, msgNow)) {
          audit.write({
            player_id: s.player.id,
            action: WITNESS_RESPONSE_ACTION,
            inputs: { request_id: msg.request_id, error: 'request_expired' },
            result: 'rejected',
          });
          break;
        }

        if (!isWitnessInRequest(request, s.player.id)) {
          audit.write({
            player_id: s.player.id,
            action: WITNESS_RESPONSE_ACTION,
            inputs: { request_id: msg.request_id, error: 'not_witness' },
            result: 'rejected',
          });
          break;
        }

        if (hasWitnessResponded(request, s.player.id)) {
          audit.write({
            player_id: s.player.id,
            action: WITNESS_RESPONSE_ACTION,
            inputs: { request_id: msg.request_id, error: 'duplicate_response' },
            result: 'rejected',
          });
          break;
        }

        if (!s.inWorld) {
          audit.write({
            player_id: s.player.id,
            action: WITNESS_RESPONSE_ACTION,
            inputs: { request_id: msg.request_id, error: 'not_in_world' },
            result: 'rejected',
          });
          break;
        }

        if (s.currentMap !== request.map) {
          // Silent rejection: no receipt for map mismatch (per spec)
          break;
        }

        const timestamp = new Date(msgNow).toISOString();
        const witnessActorRedacted = redactedActorForPlayerId(s.player.id, timestamp);
        
        // Round request creation time down to nearest minute in UTC
        const timestampBucketMs = Math.floor(request.createdAtMs / 60_000) * 60_000;
        const timestampBucket = new Date(timestampBucketMs).toISOString();

        const evidencePayload = {
          request_id: msg.request_id,
          kind: request.triggerKind,
          target_actor: request.targetActorRedacted,
          response: msg.response,
          witness_actor: witnessActorRedacted,
          map: request.map,
          timestamp_bucket: timestampBucket,
        };
        const evidenceHash = createHash('sha256').update(JSON.stringify(evidencePayload), 'utf8').digest('hex');

        audit.write({
          player_id: s.player.id,
          action: WITNESS_RESPONSE_ACTION,
          inputs: {
            request_id: msg.request_id,
            kind: request.triggerKind,
            target_actor: request.targetActorRedacted,
            response: msg.response,
            witness_actor: witnessActorRedacted,
            evidence_hash: `sha256:${evidenceHash}`,
            map: request.map,
          },
          result: 'ok',
        });

        // Record response for quorum aggregation
        const response = msg.response as WitnessResponse;
        const recordResult = recordWitnessResponse(request, s.player.id, response);

        // Try eager resolution if all witnesses have responded
        if (recordResult.allResponded) {
          const resolution = tryResolveQuorum(request, 'all_responded', msgNow);
          if (resolution) {
            emitQuorumResolutionReceipt(request, resolution);
          }
        }

        break;
      }

      // Phase 2: Item messages
      case 'drop_item': {
        if (!requireWorld(s)) break;

        const ok = handleDropItem(
          s.player!.id,
          msg.item_id,
          s.currentMap,
          s.player!.x,
          s.player!.y
        );

        if (ok) {
          const item = persist.getItem(msg.item_id);
          const itemType = item?.item_type ?? 'unknown';

          // Send result to player
          send(s.ws, ServerMessages.dropItemResult(true, msg.item_id, null));

          // Broadcast to zone: item appeared in world
          broadcastToMap(s.currentMap, ServerMessages.worldItemAdded(msg.item_id, itemType, s.player!.x, s.player!.y));

          audit.write({
            player_id: s.player!.id,
            action: 'drop_item',
            inputs: { item_id: msg.item_id, zone: s.currentMap, x: s.player!.x, y: s.player!.y },
            result: 'ok',
          });
        } else {
          send(s.ws, ServerMessages.dropItemResult(false, msg.item_id, 'not_in_inventory'));
          audit.write({
            player_id: s.player!.id,
            action: 'drop_item',
            inputs: { item_id: msg.item_id },
            result: 'rejected',
          });
        }
        break;
      }

      case 'pickup_item': {
        if (!requireWorld(s)) break;

        const ok = handlePickupItem(
          s.player!.id,
          msg.item_id,
          s.currentMap,
          s.player!.x,
          s.player!.y
        );

        if (ok) {
          // Send result to player
          send(s.ws, ServerMessages.pickupItemResult(true, msg.item_id, null));

          // Broadcast to zone: item removed from world
          broadcastToMap(s.currentMap, ServerMessages.worldItemRemoved(msg.item_id));

          // Sync inventory to client
          const invIds = getPlayerInventoryIds(s.player!.id);
          const invItems = invIds.map(id => {
            const item = persist.getItem(id);
            return { item_id: id, item_type: item?.item_type ?? 'unknown', slot: null };
          });
          send(s.ws, ServerMessages.inventorySnapshot(invItems));

          audit.write({
            player_id: s.player!.id,
            action: 'pickup_item',
            inputs: { item_id: msg.item_id, zone: s.currentMap, x: s.player!.x, y: s.player!.y },
            result: 'ok',
          });
        } else {
          send(s.ws, ServerMessages.pickupItemResult(false, msg.item_id, 'not_at_position'));
          audit.write({
            player_id: s.player!.id,
            action: 'pickup_item',
            inputs: { item_id: msg.item_id },
            result: 'rejected',
          });
        }
        break;
      }

      // Phase 3: Combat
      case 'attack_intent': {
        if (!requireWorld(s)) break;
        if (s.player!.status === 'dead') break;

        const attackerId = s.player!.id;
        const targetId = msg.target_id;
        const msgNow = Date.now();

        // Mob attack path — intercept before PvP handler
        if (targetId.startsWith('mob:')) {
          const mob = getMobById(targetId);
          if (!mob || mob.dead_until_ms !== null) {
            send(s.ws, ServerMessages.combatRejected('defender_dead'));
            break;
          }

          // Cooldown check (reuse PvP cooldown)
          const lastAttack = lastAttackAt.get(attackerId) ?? 0;
          if (msgNow - lastAttack < COMBAT_COOLDOWN_MS) {
            send(s.ws, ServerMessages.combatRejected('cooldown'));
            break;
          }

          // Adjacency check
          const ax = s.player!.x;
          const ay = s.player!.y;
          if (Math.abs(ax - mob.def.x) > 1 || Math.abs(ay - mob.def.y) > 1) {
            send(s.ws, ServerMessages.combatRejected('not_adjacent'));
            break;
          }

          lastAttackAt.set(attackerId, msgNow);

          const hit = hitMob(targetId, 1);
          if (!hit) break;

          if (!hit.dead) {
            // Broadcast updated mob (with HP reflected in name) to all players on map
            broadcastToMap(s.currentMap, ServerMessages.playerJoined(mobToPublicPlayer(hit.mob)));
          }

          if (hit.dead) {
            audit.write({
              player_id: attackerId,
              action: 'mob_kill',
              inputs: {
                mob_id: targetId,
                mob_type: mob.def.mob_type,
                map: s.currentMap,
                position: { x: mob.def.x, y: mob.def.y },
              },
              result: 'ok',
            });
            broadcastToMap(
              s.currentMap,
              ServerMessages.combatResolved(attackerId, targetId, 'kill', s.currentMap, mob.def.x, mob.def.y)
            );
            // Leave a corpse with a respawn countdown (status 'dead', not attackable)
            broadcastToMap(s.currentMap, ServerMessages.playerJoined(mobToPublicPlayer(hit.mob)));

            // Spawn loot at mob position. spawnMobLoot emits an item_minted receipt,
            // creating a durable items DB row at spawn time (before pickup) — same as
            // shop and legendary items. item_id is derived from the receipt hash —
            // deterministic, replay-safe, unique per spawn; the receipt body carries no item_id.
            const lootType = `${mob.def.mob_type}_goo`;
            const decayAt = new Date(Date.now() + 3 * 60_000).toISOString(); // 3 min decay
            const goo = spawnMobLoot(attackerId, lootType, s.currentMap, mob.def.x, mob.def.y, {
              writeReceipt: (r) => audit.write(r),
              computeReceiptHash,
              generateItemId,
            });
            if (!worldItems.has(s.currentMap)) worldItems.set(s.currentMap, new Map());
            worldItems.get(s.currentMap)!.set(goo.itemId, {
              x: goo.x,
              y: goo.y,
              decayAt,
              itemType: goo.itemType,
            });
            broadcastToMap(s.currentMap, ServerMessages.worldItemAdded(goo.itemId, goo.itemType, mob.def.x, mob.def.y));

            // Training Slime additionally drops a 'slime' trophy (guaranteed, plain item).
            // Mirrors the goo loot path: in-memory world item, item_minted receipt,
            // 3-min decay. The receipt-derived id is unique per spawn (no tile/ms collision).
            if (mob.def.mob_type === 'training_slime') {
              const slime = spawnMobLoot(attackerId, 'slime', s.currentMap, mob.def.x, mob.def.y, {
                writeReceipt: (r) => audit.write(r),
                computeReceiptHash,
                generateItemId,
              });
              worldItems.get(s.currentMap)!.set(slime.itemId, {
                x: slime.x,
                y: slime.y,
                decayAt,
                itemType: slime.itemType,
              });
              broadcastToMap(s.currentMap, ServerMessages.worldItemAdded(slime.itemId, slime.itemType, mob.def.x, mob.def.y));
              if (s.currentMap === 'Rookguard' && !s.rookguardQuest.trainingComplete) {
                s.rookguardQuest.trainingComplete = true;
                sendLoopUpdate(s, 'rookguard_training_complete');
              }
            }
          }
          break;
        }

        // Build combat context
        const ctx: CombatContext = {
          attackerId,
          targetId,
          now: msgNow,
          audit,
          persist,
          inventory,
          worldItems,
          lastAttackAt,
          sessions,
          applyDeathFn: applyDeath,
          respawnDelayMs: DEATH_RESPAWN_DELAY_MS,
          adjustReputation: (playerId: string, delta: number) => {
            for (const sess of sessions.values()) {
              if (sess.player?.id === playerId) {
                sess.player.reputation = (sess.player.reputation ?? 0) + delta;
                break;
              }
            }
          },
          setDead: (playerId: string, deadUntilMs: number) => {
            for (const sess of sessions.values()) {
              if (sess.player?.id === playerId) {
                sess.player.status = 'dead';
                sess.player.dead_until_ms = deadUntilMs;
                break;
              }
            }
          },
          getReputation: (playerId: string) => {
            for (const sess of sessions.values()) {
              if (sess.player?.id === playerId) {
                return sess.player.reputation ?? 0;
              }
            }
            return 0;
          },
          computeReceiptHash,
          getProtectedItemId: (playerId: string) => protectedByPlayerId.get(playerId),
          getRngCommitV1: (playerId: string) => {
            for (const sess of sessions.values()) {
              if (sess.player?.id === playerId) {
                return sess.rngCommitByDomain['death_drop:v1'];
              }
            }
            return undefined;
          },
          // #101: v2 precommit-anchored RNG (flag-gated). All three are no-ops
          // for combat when RNG_V2_ENABLED is false.
          rngV2Enabled: RNG_V2_ENABLED,
          getRngRevealV1: (playerId: string) => {
            for (const sess of sessions.values()) {
              if (sess.player?.id === playerId) {
                return sess.rngRevealByDomain['death_drop:v1'];
              }
            }
            return undefined;
          },
          getRngCommitRefV1: (playerId: string) => {
            for (const sess of sessions.values()) {
              if (sess.player?.id === playerId) {
                return sess.rngCommitRefByDomain['death_drop:v1'];
              }
            }
            return undefined;
          },
        };

        const result = handleAttackIntent(ctx);

        // Plan B: Attack spam detection (heat escalation on repeated failures)
        if (!result.success) {
          const now = Date.now();
          const failures = s.attackFailures;

          // Remove timestamps older than 30 seconds
          const cutoff = now - 30_000;
          while (failures.length > 0 && failures[0] < cutoff) {
            failures.shift();
          }

          // Add current failure
          failures.push(now);

          // Check if threshold exceeded (5 failures in 30s)
          if (failures.length >= 5) {
            // Escalate heat
            applyHeatChange(s, now, 15, 'attack_spam', { window_ms: 30_000 });

            // Clear window to avoid repeated escalations
            s.attackFailures = [];
          }
        }

        if (result.success && result.map && result.defenderPos && result.droppedItemIds) {
          // Find defender session for sending messages
          let defenderSession: typeof s | undefined;
          for (const sess of sessions.values()) {
            if (sess.player?.id === targetId) {
              defenderSession = sess;
              break;
            }
          }

          // Broadcast combat_resolved to all on map
          broadcastToMap(
            result.map,
            ServerMessages.combatResolved(
              attackerId,
              targetId,
              'kill',
              result.map,
              result.defenderPos.x,
              result.defenderPos.y
            )
          );

          // Chronicle witness: death event (Seal 2, PvP kill)
          chronicleEvent('death', `did:akalynth:${targetId}`, defenderSession?.player?.caps ?? [], {
            player_id: targetId,
            map: result.map,
            x: result.defenderPos.x,
            y: result.defenderPos.y,
            cause: 'killed_by_player',
            killer_id: attackerId,
            ...(result.dropSeedHash ? { drop_seed_hash: result.dropSeedHash } : {}),
            ...(result.droppedItemIds ? { dropped_item_ids: result.droppedItemIds } : {}),
            ...(result.dropRng ? result.dropRng : {}),
          });

          // Broadcast world_item_added for each dropped item
          for (const itemId of result.droppedItemIds) {
            const item = persist.getItem(itemId);
            broadcastToMap(
              result.map,
              ServerMessages.worldItemAdded(
                itemId,
                item?.item_type ?? 'unknown',
                result.defenderPos.x,
                result.defenderPos.y
              )
            );
          }

          // Send death notice to defender
          if (defenderSession) {
            const worldState = worlds[result.map];
            const lostItems = summarizeLostItems(result.droppedItemIds, persist);
            send(
              defenderSession.ws,
              ServerMessages.deathNotice(
                DEATH_RESPAWN_DELAY_MS,
                result.map,
                { x: worldState.map.spawn.x, y: worldState.map.spawn.y },
                'Killed by another player',
                { lost_items: lostItems }
              )
            );

            // Send empty inventory snapshot to defender
            send(defenderSession.ws, ServerMessages.inventorySnapshot([]));
          }
        } else if (!result.success && result.reason) {
          // Send rejection to attacker for debugging (no receipt emitted)
          send(s.ws, ServerMessages.combatRejected(result.reason as import('../../../packages/shared/protocol.js').CombatRejectionReason));
        }
        break;
      }

      // Dev-only: Legendary minting (gated by AKALYNTH_DEV_MINT=1)
      case 'mint_legendary': {
        if (!DEV_MINT_ENABLED) {
          send(s.ws, ServerMessages.error('kicked', 'mint_legendary disabled'));
          break;
        }
        if (!requireWorld(s)) break;

        const playerId = s.player!.id;
        const itemType = msg.item_type ?? 'mark_token';
        const tier = msg.tier ?? 1;
        const mintNow = Date.now();

        // Emit item_minted receipt with legendary meta
        audit.write({
          player_id: playerId,
          action: 'item_minted',
          inputs: {
            item_type: itemType,
            meta: { legendary: true, legendary_tier: tier },
          },
          result: 'ok',
        });

        // Derive item_id from receipt hash
        const receiptHash = computeReceiptHash({
          actor_id: playerId,
          action: 'item_minted',
          inputs: {
            item_type: itemType,
            meta: { legendary: true, legendary_tier: tier },
          },
          result: 'ok',
        });
        const itemId = generateItemId(receiptHash);

        // Emit item_added_to_inventory receipt
        audit.write({
          player_id: playerId,
          action: 'item_added_to_inventory',
          inputs: { item_id: itemId },
          result: 'ok',
        });

        // Update in-memory inventory
        if (!inventory.has(playerId)) {
          inventory.set(playerId, new Set());
        }
        inventory.get(playerId)!.add(itemId);

        // Send inventory snapshot to player
        const items = Array.from(inventory.get(playerId) ?? []).map((id) => {
          const item = persist.getItem(id);
          return { item_id: id, item_type: item?.item_type ?? itemType };
        });
        send(s.ws, ServerMessages.inventorySnapshot(items));

        console.log(`[DEV] Minted legendary ${itemType} tier=${tier} item_id=${itemId} for ${playerId}`);
        break;
      }

      // Phase 3.2: Protected slots
      case 'set_protected_slot': {
        if (!requireWorld(s)) break;

        const playerId = s.player!.id;
        const itemId = msg.item_id;

        // Validate item is in player's inventory
        const playerInv = inventory.get(playerId);
        if (!playerInv || !playerInv.has(itemId)) {
          send(s.ws, ServerMessages.error('invalid_message', 'item_not_in_inventory'));
          break;
        }

        // Get previous protected item (if any)
        const prevItemId = protectedByPlayerId.get(playerId) ?? null;

        // Emit inventory_slot_changed receipt (even if same item, for audit trail)
        audit.write({
          player_id: playerId,
          action: 'inventory_slot_changed',
          inputs: {
            item_id: itemId,
            slot: 'protected',
            prev_item_id: prevItemId,
          },
          result: 'ok',
        });

        // Update runtime map
        protectedByPlayerId.set(playerId, itemId);

        // Send ack
        send(s.ws, ServerMessages.protectedSlotSet(playerId, itemId, prevItemId));

        // Send updated inventory snapshot with slot info
        const items = Array.from(playerInv).map((id) => {
          const item = persist.getItem(id);
          return {
            item_id: id,
            item_type: item?.item_type ?? 'unknown',
            slot: id === itemId ? 'protected' : null,
          };
        });
        send(s.ws, ServerMessages.inventorySnapshot(items));
        break;
      }

      // Phase 4: Chronicle
      case 'get_chronicle': {
        if (!requireAuth(s)) break;

        const selfPlayerId = s.player?.id;
        if (!selfPlayerId) {
          send(s.ws, ServerMessages.error('not_authenticated', 'player_id_required'));
          break;
        }

        // Default to own player if not specified
        const targetPlayerId = msg.player_id ?? selfPlayerId;

        // v0: Only allow querying own chronicle (deny by default)
        if (targetPlayerId !== selfPlayerId) {
          send(s.ws, ServerMessages.error('invalid_message', 'chronicle_self_only'));
          break;
        }

        // Query chronicle events
        const limit = msg.limit ?? 50;
        const before = msg.before;
        const events = persist.getChronicleForPlayer(targetPlayerId, limit, before);

        // Transform to protocol format
        // Phase 4.4 E2: Include evidence_ref for applicable kinds
        const chronicleEvents = events.map((e) => {
          const event: {
            kind: string;
            timestamp: string;
            zone: string | null;
            x: number | null;
            y: number | null;
            details: Record<string, unknown>;
            evidence_ref?: { chronicle_event_id: number; receipt_hash: string } | null;
          } = {
            kind: e.kind,
            timestamp: e.timestamp,
            zone: e.zone,
            x: e.x,
            y: e.y,
            details: JSON.parse(e.details_json) as Record<string, unknown>,
          };

          // Parse and include evidence_ref if present
          if (e.evidence_ref) {
            try {
              event.evidence_ref = JSON.parse(e.evidence_ref) as { chronicle_event_id: number; receipt_hash: string };
            } catch {
              event.evidence_ref = null;
            }
          }

          return event;
        });

        // Determine if there are more events (pagination)
        const hasMore = events.length === Math.min(Math.max(1, limit), 200);

        send(s.ws, ServerMessages.chronicleSnapshot(targetPlayerId, chronicleEvents, hasMore));
        break;
      }

      // Phase 4.4: Chronicle Evidence
      case 'get_evidence': {
        if (!requireAuth(s)) break;

        const selfPlayerId = s.player?.id;
        if (!selfPlayerId) {
          send(s.ws, ServerMessages.error('not_authenticated', 'player_id_required'));
          break;
        }

        // Build evidence context with snapshot reconstruction functions
        const evidenceCtx: EvidenceContext = {
          persist,

          // Reconstruct inventory snapshot at a given timestamp
          // For now, return current inventory (simplified v0)
          // Full implementation would query receipts before timestamp
          getPlayerInventorySnapshot: (playerId: string, _timestamp: string): ItemForDrop[] => {
            const playerInv = inventory.get(playerId);
            if (!playerInv || playerInv.size === 0) return [];

            const protectedItemId = protectedByPlayerId.get(playerId);

            return Array.from(playerInv).map((itemId) => {
              const item = persist.getItem(itemId);
              let meta: Record<string, unknown> = {};
              if (item?.meta_json) {
                try {
                  meta = JSON.parse(item.meta_json);
                } catch { /* ignore */ }
              }
              return {
                item_id: itemId,
                item_type: item?.item_type ?? 'unknown',
                meta,
                slot: itemId === protectedItemId ? 'protected' : null,
              };
            });
          },

          // Get reputation at timestamp (simplified: returns current)
          getReputationAt: (playerId: string, _timestamp: string): number => {
            return persist.getReputationScore(playerId);
          },

          // Get legendary heat at timestamp (simplified: returns current from runtime)
          getLegendaryHeatAt: (itemId: string, _timestamp: string): number => {
            return getLegendaryHeat(itemId);
          },
        };

        const evidenceReq: EvidenceRequest = {
          playerId: selfPlayerId,
          chronicleEventId: msg.chronicle_event_id,
          receiptHash: msg.receipt_hash,
          kind: msg.kind,
        };

        const result = getEvidence(evidenceCtx, evidenceReq);

        // Build response message
        send(s.ws, ServerMessages.evidenceSnapshot(
          result.status,
          selfPlayerId,
          {
            chronicle_event_id: msg.chronicle_event_id,
            receipt_hash: msg.receipt_hash,
            source_action: result.chronicleEvent?.source_action,
            kind: result.chronicleEvent?.kind,
            evidence: result.evidence,
            error_code: result.errorCode,
          }
        ));
        break;
      }

      // Phase 5: Pressure Metrics
      case 'get_pressure_metrics': {
        if (!requireAuth(s)) break;

        const selfPlayerId = s.player?.id;
        if (!selfPlayerId) {
          send(s.ws, ServerMessages.error('not_authenticated', 'player_id_required'));
          break;
        }

        // Compute window bounds
        const now = new Date();
        const untilDate = msg.until ? new Date(msg.until) : now;
        const sinceDate = msg.since
          ? new Date(msg.since)
          : new Date(untilDate.getTime() - 7 * 24 * 60 * 60 * 1000);

        const metricsResult = computePressureMetrics(
          { db: persist.db },
          selfPlayerId,
          sinceDate.toISOString(),
          untilDate.toISOString()
        );

        send(s.ws, ServerMessages.pressureMetricsSnapshot(
          selfPlayerId,
          sinceDate.toISOString(),
          untilDate.toISOString(),
          metricsResult.status,
          metricsResult.metrics,
          metricsResult.error_code
        ));
        break;
      }

      // ====================================================================
      // Sovereign Vocations (Identity Layer v0)
      // ====================================================================

      case 'declare_vocation': {
        if (!requireWorld(s)) break;
        if (!s.player) break;

        const vocation = msg.vocation;
        if (!SOVEREIGN_VOCATIONS.includes(vocation)) break;
        const playerPlace = getCurrentPlace(s.player.id);
        const readyForCodex =
          s.currentMap === 'Rookguard' &&
          playerPlace === 'rookguard:guild_hall' &&
          s.tutorial.move &&
          s.tutorial.chat &&
          s.tutorial.tem &&
          s.rookguardQuest.trainingComplete;

        if (!readyForCodex) {
          send(s.ws, ServerMessages.error('invalid_message', 'vocation_requires_rookguard_codex_path'));
          sendLoopUpdate(s, 'rookguard_profession_not_ready');
          break;
        }

        const cosmetics = VOCATION_COSMETICS[vocation];
        const codexProfession = ROOKGUARD_CODEX_PROFESSIONS[vocation];

        // Update badges for visual purposes only (identity truth comes from getIdentity())
        // Additive: filter old vocation_* badges, then add new badge
        const existingBadges = s.player.badges ?? [];
        const filtered = existingBadges.filter(b => !b.startsWith('vocation_'));
        s.player.badges = [...filtered, cosmetics.badge];
        // NOTE: Don't store mark or vocation on player — compute at inspect time

        // Emit receipt — identity Map updated via reducer hook on audit write
        audit.write({
          player_id: s.player.id,
          action: VOCATION_DECLARED_ACTION,
          inputs: {
            vocation,
            badge: cosmetics.badge,
            codex_lore_id: codexProfession.lore_id,
            codex_title: codexProfession.title,
            starter_role: codexProfession.starter_role,
          },
          result: 'ok',
        });
        s.rookguardQuest.vocation = vocation;
        sendWorldStateRefresh(s);
        sendLoopUpdate(s, 'rookguard_profession_declared');
        break;
      }

      case 'inspect_player': {
        if (!requireAuth(s)) break;
        if (!s.player) break;

        // Costed action: debit BEFORE action (Bolt A)
        const debitResult = debitForAction(s.player.id, 'inspect_player', (r) => audit.write(r));
        if (!debitResult.ok) {
          send(s.ws, ServerMessages.error('insufficient_gold', 'Not enough gold for this action'));
          break;
        }

        const target = findPlayerByIdOnline(msg.target_player_id);  // Online-only lookup
        if (!target) {
          send(s.ws, ServerMessages.playerInspect(
            msg.target_player_id,
            '',
            null,
            null,
            [],
            null,
            'not_found'
          ));
          break;
        }

        // Get identity from in-memory projection (rebuilt from receipts on startup)
        const identity = getIdentity(target.id);

        // Compute display vocation using explicit label mapping
        let display_vocation: string | null = null;
        if (identity.vocation) {
          const label = VOCATION_LABEL[identity.vocation];
          display_vocation = identity.sovereign_prefix
            ? `Sovereign ${label}`
            : label;
        }

        // Compute mark at inspect time (don't store it — avoids stomping other marks)
        const mark = identity.vocation ? VOCATION_COSMETICS[identity.vocation].mark : null;

        send(s.ws, ServerMessages.playerInspect(
          target.id,
          target.name,
          identity.vocation,
          display_vocation,
          target.badges ?? [],
          mark
        ));
        break;
      }

      case 'grant_sovereign_prefix': {
        if (!DEBUG_MODE) break;
        if (!process.env.SOVEREIGN_PREFIX_DEBUG) break;  // Double-gate
        if (!requireAuth(s)) break;

        const target = findPlayerByIdOnline(msg.target_player_id);
        if (!target) break;

        // Get current identity to include vocation in receipt
        const identity = getIdentity(target.id);

        // ONLY emit receipt — do NOT mutate player object
        // Identity Map will be updated via reducer hook on audit write
        audit.write({
          player_id: target.id,
          action: msg.grant ? SOVEREIGN_PREFIX_GRANTED_ACTION : SOVEREIGN_PREFIX_REVOKED_ACTION,
          inputs: {
            source: 'debug' as PrefixGrantSource,
            vocation: identity.vocation,
            granted_by: s.player?.id,
          },
          result: 'ok',
        });
        break;
      }

      // ====================================================================
      // Treasury Kernel v0 (Gold)
      // ====================================================================

      case 'inspect_wallet': {
        if (!requireAuth(s)) break;
        if (!s.player) break;

        const gold = getGoldBalance(s.player.id);
        send(s.ws, ServerMessages.walletSnapshot(gold));
        break;
      }

      case 'pay_tithe': {
        if (!requireAuth(s) || !s.player) break;

        const amount = msg.amount;

        // Validate amount bounds
        if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0 || amount > MAX_GOLD_AMOUNT) {
          send(s.ws, ServerMessages.titheResult(false, undefined, 'invalid_amount'));
          break;
        }

        // Check balance BEFORE write
        // Note: messages are processed sequentially per session, and audit.write is synchronous
        // (uses writeSync + fsyncSync), so balance is updated before we return here
        const current = getGoldBalance(s.player.id);
        if (!canAfford(s.player.id, amount)) {
          send(s.ws, ServerMessages.titheResult(false, undefined, 'insufficient_gold'));
          break;
        }

        // Emit debit receipt — treasury Map updated via reducer hook (synchronous)
        audit.write({
          player_id: s.player.id,
          action: WALLET_DEBIT_ACTION,
          inputs: { amount, reason: 'temple_tithe' as WalletDebitReason },
          result: 'ok',
        });

        // Respond with locally computed balance (deterministic)
        send(s.ws, ServerMessages.titheResult(true, current - amount));
        break;
      }

      case 'grant_gold': {
        if (!DEBUG_MODE) break;
        if (!requireAuth(s)) break;

        const target = findPlayerByIdOnline(msg.target_player_id);
        if (!target) break;

        const amount = msg.amount;
        if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount) || amount > MAX_GOLD_AMOUNT) break;

        // Emit credit receipt — treasury Map updated via reducer hook
        audit.write({
          player_id: target.id,
          action: WALLET_CREDIT_ACTION,
          inputs: { amount, reason: 'debug_grant' as WalletCreditReason },
          result: 'ok',
        });
        break;
      }

      // ========================================================================
      // Work Contract Faucet v0
      // ========================================================================

      case 'start_work_contract': {
        if (!requireAuth(s) || !s.player) break;

        const result = startContract(
          s.player.id,
          msg.contract_type,
          Date.now(),
          (r) => audit.write(r)
        );

        if (result.ok) {
          send(s.ws, ServerMessages.workContractStarted(
            result.contract_id,
            msg.contract_type,
            result.payout_gold,
            result.cooldown_seconds,
            result.min_duration_ms
          ));
        } else {
          send(s.ws, ServerMessages.workContractResult(
            '',
            false,
            undefined,
            result.error
          ));
        }
        break;
      }

      case 'work_tick': {
        if (!requireAuth(s) || !s.player) break;

        const nowMs = Date.now();
        const tickResult = recordTick(s.player.id, msg.contract_id, nowMs, (r) => audit.write(r));

        if (tickResult.ok) {
          send(s.ws, ServerMessages.workProgress(
            msg.contract_id,
            tickResult.ticks_observed,
            tickResult.ticks_required,
            tickResult.remaining_ms
          ));

          // Auto-complete if all gates passed
          if (tickResult.ready_to_complete) {
            const completeResult = completeContract(
              s.player.id,
              msg.contract_id,
              nowMs,
              (r) => audit.write(r)
            );
            send(s.ws, ServerMessages.workContractResult(
              msg.contract_id,
              completeResult.ok,
              completeResult.ok ? completeResult.credited_gold : undefined,
              completeResult.ok ? undefined : completeResult.error
            ));
            if (completeResult.ok) {
              send(s.ws, ServerMessages.walletSnapshot(getGoldBalance(s.player.id)));
            }
          }
        }
        // Silent drop for invalid ticks (anti-spam)
        break;
      }

      // ========================================================================
      // Property Ownership v0 (House Market)
      // Handlers are fully synchronous: per-session sequential processing +
      // synchronous audit.write make the read→validate→emit sequence atomic on
      // the event loop (same guarantee pay_tithe relies on). The materializer's
      // owner-predicate WHERE clause is the durable backstop.
      // ========================================================================

      case 'buy_house': {
        if (!requireAuth(s) || !s.player) break;
        const buyer = s.player.id;
        const prop = getProperty(msg.property_id);
        if (!prop) {
          send(s.ws, ServerMessages.propertyResult('buy_house', false, msg.property_id, 'unknown_plot'));
          break;
        }
        if (prop.owner_player_id === buyer) {
          send(s.ws, ServerMessages.propertyResult('buy_house', false, msg.property_id, 'cannot_buy_own'));
          break;
        }

        if (prop.status === 'unowned') {
          // Primary sale: treasury → buyer (pure gold sink).
          const price = prop.primary_price_gold;
          if (!canAfford(buyer, price)) {
            send(s.ws, ServerMessages.propertyResult('buy_house', false, msg.property_id, 'insufficient_gold'));
            break;
          }
          audit.write({
            player_id: buyer,
            action: WALLET_DEBIT_ACTION,
            inputs: { amount: price, reason: `property_purchase:${prop.property_id}` as WalletDebitReason },
            result: 'ok',
          });
          audit.write({
            player_id: buyer,
            action: PROPERTY_PURCHASED_ACTION,
            inputs: { property_id: prop.property_id, price },
            result: 'ok',
          });
        } else if (prop.status === 'listed' && prop.listed_price_gold != null && prop.owner_player_id) {
          // Resale: seller → buyer (conserved). Price read server-side.
          const price = prop.listed_price_gold;
          const seller = prop.owner_player_id;
          if (!canAfford(buyer, price)) {
            send(s.ws, ServerMessages.propertyResult('buy_house', false, msg.property_id, 'insufficient_gold'));
            break;
          }
          audit.write({
            player_id: buyer,
            action: WALLET_DEBIT_ACTION,
            inputs: { amount: price, reason: `property_transfer:${prop.property_id}` as WalletDebitReason },
            result: 'ok',
          });
          audit.write({
            player_id: seller,
            action: WALLET_CREDIT_ACTION,
            inputs: { amount: price, reason: `property_sale:${prop.property_id}` as WalletCreditReason },
            result: 'ok',
          });
          audit.write({
            player_id: buyer,
            action: PROPERTY_TRANSFERRED_ACTION,
            inputs: { property_id: prop.property_id, seller_id: seller, price },
            result: 'ok',
          });
        } else {
          send(s.ws, ServerMessages.propertyResult('buy_house', false, msg.property_id, 'not_for_sale'));
          break;
        }

        // Success: projection updated synchronously via the audit reducer hook.
        const updated = getProperty(msg.property_id)!;
        const sellerName = updated.owner_history.length >= 2
          ? resolvePlayerName(updated.owner_history[updated.owner_history.length - 1].from)
          : null;
        send(s.ws, ServerMessages.propertyResult('buy_house', true, msg.property_id));
        send(s.ws, ServerMessages.propertyState(propertyToPublic(updated)));
        send(s.ws, ServerMessages.walletSnapshot(getGoldBalance(buyer)));
        broadcastToMap(
          updated.zone as 'Rookguard' | 'Azura',
          ServerMessages.houseSold(
            updated.property_id,
            updated.plot_id,
            updated.zone,
            s.player.name,
            sellerName,
            updated.owner_history[updated.owner_history.length - 1]?.price ?? 0,
            updated.sale_count
          )
        );
        break;
      }

      case 'list_house': {
        if (!requireAuth(s) || !s.player) break;
        const prop = getProperty(msg.property_id);
        if (!prop) {
          send(s.ws, ServerMessages.propertyResult('list_house', false, msg.property_id, 'unknown_plot'));
          break;
        }
        if (prop.owner_player_id !== s.player.id) {
          send(s.ws, ServerMessages.propertyResult('list_house', false, msg.property_id, 'not_owner'));
          break;
        }
        if (!isValidPrice(msg.price)) {
          send(s.ws, ServerMessages.propertyResult('list_house', false, msg.property_id, 'invalid_price'));
          break;
        }
        audit.write({
          player_id: s.player.id,
          action: PROPERTY_LISTED_ACTION,
          inputs: { property_id: prop.property_id, price: msg.price },
          result: 'ok',
        });
        const updated = getProperty(msg.property_id)!;
        send(s.ws, ServerMessages.propertyResult('list_house', true, msg.property_id));
        send(s.ws, ServerMessages.propertyState(propertyToPublic(updated)));
        broadcastToMap(updated.zone as 'Rookguard' | 'Azura', ServerMessages.propertyState(propertyToPublic(updated)), s.connId);
        break;
      }

      case 'unlist_house': {
        if (!requireAuth(s) || !s.player) break;
        const prop = getProperty(msg.property_id);
        if (!prop) {
          send(s.ws, ServerMessages.propertyResult('unlist_house', false, msg.property_id, 'unknown_plot'));
          break;
        }
        if (prop.owner_player_id !== s.player.id) {
          send(s.ws, ServerMessages.propertyResult('unlist_house', false, msg.property_id, 'not_owner'));
          break;
        }
        audit.write({
          player_id: s.player.id,
          action: PROPERTY_UNLISTED_ACTION,
          inputs: { property_id: prop.property_id },
          result: 'ok',
        });
        const updated = getProperty(msg.property_id)!;
        send(s.ws, ServerMessages.propertyResult('unlist_house', true, msg.property_id));
        send(s.ws, ServerMessages.propertyState(propertyToPublic(updated)));
        broadcastToMap(updated.zone as 'Rookguard' | 'Azura', ServerMessages.propertyState(propertyToPublic(updated)), s.connId);
        break;
      }

      case 'get_property_ledger': {
        if (!requireAuth(s) || !s.player) break;
        const prop = getProperty(msg.property_id);
        if (!prop) break;
        send(s.ws, ServerMessages.propertyLedger(prop.property_id, ownerHistoryToPublic(prop), prop.sale_count));
        break;
      }

      // ========================================================================
      // Property Auctions (Step 4a): open / bid / cancel handlers.
      // These emit the receipts proven to conserve gold in Step 3. There is NO
      // automatic settlement here — close→settle (the wall-clock path) is a
      // separate later lane (4b). Synchronous per-session processing + synchronous
      // audit.write make read→validate→emit atomic on the event loop.
      // ========================================================================

      case 'open_house_auction': {
        if (!requireAuth(s) || !s.player) break;
        const prop = getProperty(msg.property_id);
        if (!prop) {
          send(s.ws, ServerMessages.propertyResult('open_house_auction', false, msg.property_id, 'unknown_plot'));
          break;
        }
        if (prop.owner_player_id !== s.player.id) {
          send(s.ws, ServerMessages.propertyResult('open_house_auction', false, msg.property_id, 'not_owner'));
          break;
        }
        if (prop.status !== 'owned') {
          send(s.ws, ServerMessages.propertyResult('open_house_auction', false, msg.property_id,
            prop.status === 'auctioning' ? 'already_auctioning' : 'already_listed'));
          break;
        }
        if (!isValidPrice(msg.min_bid) || !isValidPrice(msg.min_increment_gold)) {
          send(s.ws, ServerMessages.propertyResult('open_house_auction', false, msg.property_id, 'invalid_price'));
          break;
        }
        // Record the absolute close (live wall-clock) into the receipt so it is
        // replayable; the reducer stores it as metadata and never compares it to
        // a clock. The close→settle loop reads it to decide WHEN to settle.
        const durationS = clampAuctionDurationS(msg.duration_s);
        const scheduledCloseMs = Date.now() + durationS * 1000;
        audit.write({
          player_id: s.player.id,
          action: PROPERTY_AUCTION_OPENED_ACTION,
          inputs: {
            property_id: prop.property_id,
            kind: 'resale',
            seller_id: s.player.id,
            min_bid: msg.min_bid,
            min_increment_gold: msg.min_increment_gold,
            duration_s: durationS,
            scheduled_close_ms: scheduledCloseMs,
          },
          result: 'ok',
        });
        const auction = getAuction(msg.property_id);
        const updated = getProperty(msg.property_id)!;
        send(s.ws, ServerMessages.propertyResult('open_house_auction', true, msg.property_id));
        send(s.ws, ServerMessages.propertyState(propertyToPublic(updated)));
        if (auction) {
          const stateMsg = ServerMessages.propertyAuctionState(
            auction.property_id, auction.kind, auction.current_high,
            resolvePlayerName(auction.high_bidder_id), minNextBid(auction), auction.scheduled_close_ms
          );
          send(s.ws, stateMsg);
          broadcastToMap(updated.zone as 'Rookguard' | 'Azura', stateMsg, s.connId);
        }
        break;
      }

      case 'place_house_bid': {
        if (!requireAuth(s) || !s.player) break;
        const bidder = s.player.id;
        const auction = getAuction(msg.property_id);
        if (!auction || auction.status !== 'open') {
          send(s.ws, ServerMessages.propertyResult('place_house_bid', false, msg.property_id, 'not_auctioning'));
          break;
        }
        if (auction.kind === 'resale' && auction.seller_id === bidder) {
          send(s.ws, ServerMessages.propertyResult('place_house_bid', false, msg.property_id, 'cannot_bid_own'));
          break;
        }
        if (!isValidPrice(msg.amount)) {
          send(s.ws, ServerMessages.propertyResult('place_house_bid', false, msg.property_id, 'invalid_price'));
          break;
        }
        if (msg.amount < minNextBid(auction)) {
          send(s.ws, ServerMessages.propertyResult('place_house_bid', false, msg.property_id, 'bid_too_low'));
          break;
        }
        if (!canAfford(bidder, msg.amount)) {
          send(s.ws, ServerMessages.propertyResult('place_house_bid', false, msg.property_id, 'insufficient_gold'));
          break;
        }
        // Capture the prior high BEFORE recording the new bid (for the refund).
        const priorBidder = auction.high_bidder_id;
        const priorAmount = auction.current_high;
        // Escrow the new bid (gold leaves circulation; no escrow ledger).
        audit.write({
          player_id: bidder,
          action: WALLET_DEBIT_ACTION,
          inputs: { amount: msg.amount, reason: `auction_escrow:${auction.property_id}` as WalletDebitReason },
          result: 'ok',
        });
        // Refund the outbid prior high bidder the EXACT prior amount.
        if (priorBidder && priorAmount != null) {
          audit.write({
            player_id: priorBidder,
            action: WALLET_CREDIT_ACTION,
            inputs: { amount: priorAmount, reason: `auction_refund:${auction.property_id}` as WalletCreditReason },
            result: 'ok',
          });
          audit.write({
            player_id: 'system',
            action: PROPERTY_BID_REFUNDED_ACTION,
            inputs: { property_id: auction.property_id, refunded_player_id: priorBidder, amount: priorAmount },
            result: 'ok',
          });
        }
        // Record the bid (reducer sets current_high/high_bidder).
        audit.write({
          player_id: bidder,
          action: PROPERTY_BID_ACTION,
          inputs: { property_id: auction.property_id, amount: msg.amount },
          result: 'ok',
        });
        const updated = getAuction(msg.property_id)!;
        const prop = getProperty(msg.property_id)!;
        const stateMsg = ServerMessages.propertyAuctionState(
          updated.property_id, updated.kind, updated.current_high,
          resolvePlayerName(updated.high_bidder_id), minNextBid(updated), updated.scheduled_close_ms
        );
        send(s.ws, ServerMessages.propertyResult('place_house_bid', true, msg.property_id));
        send(s.ws, stateMsg);
        send(s.ws, ServerMessages.walletSnapshot(getGoldBalance(bidder)));
        broadcastToMap(prop.zone as 'Rookguard' | 'Azura', stateMsg, s.connId);
        break;
      }

      case 'cancel_house_auction': {
        if (!requireAuth(s) || !s.player) break;
        const auction = getAuction(msg.property_id);
        if (!auction || auction.status !== 'open') {
          send(s.ws, ServerMessages.propertyResult('cancel_house_auction', false, msg.property_id, 'not_auctioning'));
          break;
        }
        if (auction.seller_id !== s.player.id) {
          send(s.ws, ServerMessages.propertyResult('cancel_house_auction', false, msg.property_id, 'not_owner'));
          break;
        }
        if (auction.current_high !== null) {
          // Owner cancel is allowed only with zero bids (D4).
          send(s.ws, ServerMessages.propertyResult('cancel_house_auction', false, msg.property_id, 'has_bids'));
          break;
        }
        audit.write({
          player_id: s.player.id,
          action: PROPERTY_AUCTION_CANCELLED_ACTION,
          inputs: { property_id: auction.property_id },
          result: 'ok',
        });
        const updated = getProperty(msg.property_id)!;
        send(s.ws, ServerMessages.propertyResult('cancel_house_auction', true, msg.property_id));
        send(s.ws, ServerMessages.propertyState(propertyToPublic(updated)));
        broadcastToMap(updated.zone as 'Rookguard' | 'Azura', ServerMessages.propertyState(propertyToPublic(updated)), s.connId);
        break;
      }

      // NPC Recognition v0
      case 'talk_to_npc': {
        if (!requireWorld(s)) break;

        const npc = getNpcDef(msg.npc_id);
        if (!npc) {
          send(s.ws, ServerMessages.npcDialogueError(msg.npc_id, 'not_found'));
          break;
        }

        const playerPlace = getCurrentPlace(s.player!.id);
        if (playerPlace !== npc.place_id) {
          send(s.ws, ServerMessages.npcDialogueError(msg.npc_id, 'not_in_place'));
          break;
        }

        const tier = resolveDialogueTier(s.player!.id, npc.place_id);

        // Dialogue Contract v1: seed varied-but-deterministic phrasing on a
        // DURABLE per-(player,npc,tier) talk counter. The nonce is the number
        // of prior talks, read from the receipt-sourced projection — so it
        // survives reconnects AND is reconstructed identically on replay.
        const nonce = persist.getNpcTalkCount(s.player!.id, msg.npc_id, tier);
        const line = buildNpcDialogue(npc, tier, { playerId: s.player!.id, nonce });

        // Record the talk so the next visit's nonce advances. The onWrite hook
        // materializes this into npc_talk_events synchronously (canon source).
        // Dialogue is read-only flavor: this receipt records that the player
        // spoke, not any world mutation.
        audit.write({
          player_id: s.player!.id,
          action: 'npc_talked',
          inputs: { npc_id: msg.npc_id, tier },
          result: 'ok',
        });

        send(s.ws, ServerMessages.npcDialogue(msg.npc_id, npc.place_id, tier, line));

        if (msg.npc_id === 'azura_herald' && !s.heraldMet) {
          s.heraldMet = true;
          const bloomStart = startWitnessMothBloom(
            witnessMothBloom,
            { player_id: s.player!.id, map: s.currentMap, now_ms: Date.now() },
            (receipt) => audit.write(receipt)
          );
          if (bloomStart.ok && bloomStart.started) {
            broadcastToMap('Azura', ServerMessages.chatBroadcast('system', 'Witness Bloom', bloomStart.message));
          }
          sendLoopUpdate(s, 'herald_met');
        }
        break;
      }

      // Skills v0
      case 'use_skill': {
        if (!requireAuth(s)) break;
        if (!s.player) break;

        // Shop purchase intercept
        if (msg.skill_id.startsWith('shop:')) {
          const shopKey = msg.skill_id.slice(5);
          const shopItem = SHOP_ITEMS[shopKey];

          if (!shopItem) {
            send(s.ws, ServerMessages.skillResult(msg.skill_id, false, { reason: 'invalid_skill' }));
            break;
          }

          const playerPlace = getCurrentPlace(s.player.id);
          if (playerPlace !== 'azura:guild_hall') {
            send(s.ws, ServerMessages.skillResult(msg.skill_id, false, { reason: 'invalid_target' }));
            break;
          }

          if (!canAfford(s.player.id, shopItem.price)) {
            send(s.ws, ServerMessages.skillResult(msg.skill_id, false, { reason: 'invalid_skill', payload: { error: 'insufficient_gold' } }));
            break;
          }

          // Debit gold
          audit.write({
            player_id: s.player.id,
            action: WALLET_DEBIT_ACTION,
            inputs: { amount: shopItem.price, reason: 'action_cost:shop_purchase' as WalletDebitReason },
            result: 'ok',
          });

          // Mint item using receipt chain
          const mintReceipt = audit.write({
            action: 'item_minted',
            player_id: s.player.id,
            inputs: { item_type: shopItem.item_type, meta: { source: 'shop', shop_key: shopKey }, reason: 'shop_purchase' },
            result: 'ok',
          });
          const mintHash = computeReceiptHash(mintReceipt);
          const shopItemId = generateItemId(mintHash);

          audit.write({
            action: 'item_added_to_inventory',
            player_id: s.player.id,
            inputs: { item_id: shopItemId, slot: null, source: 'shop' },
            result: 'ok',
          });

          if (!inventory.has(s.player.id)) inventory.set(s.player.id, new Set());
          inventory.get(s.player.id)!.add(shopItemId);

          // Sync inventory (use known type for newly minted item)
          const shopInvIds = getPlayerInventoryIds(s.player.id);
          const shopInvItems = shopInvIds.map(id => ({
            item_id: id,
            item_type: persist.getItem(id)?.item_type ?? (id === shopItemId ? shopItem.item_type : 'unknown'),
            slot: null,
          }));
          send(s.ws, ServerMessages.inventorySnapshot(shopInvItems));
          send(s.ws, ServerMessages.walletSnapshot(getGoldBalance(s.player.id)));
          send(s.ws, ServerMessages.skillResult(msg.skill_id, true, { payload: { item_id: shopItemId, item_type: shopItem.item_type } }));
          break;
        }

        // Item use intercept
        if (msg.skill_id.startsWith('item:use:')) {
          const itemId = msg.skill_id.slice(9);
          const playerInv = inventory.get(s.player.id);
          if (!playerInv || !playerInv.has(itemId)) {
            send(s.ws, ServerMessages.skillResult(msg.skill_id, false, { reason: 'invalid_target' }));
            break;
          }

          const item = persist.getItem(itemId);
          const itemType = item?.item_type ?? 'unknown';

          let effectMsg = 'Used.';
          let hpChanged = false;
          if (itemType === 'healing_herb') {
            if (s.player.status === 'dead' && s.player.dead_until_ms != null) {
              s.player.dead_until_ms = Math.max(Date.now(), s.player.dead_until_ms - 10_000);
              effectMsg = 'The herb restores vitality. Respawn hastened by 10 seconds.';
            } else {
              const before = s.player.hp ?? PLAYER_MAX_HP;
              const max = s.player.max_hp ?? PLAYER_MAX_HP;
              const after = Math.min(max, before + HEALING_HERB_AMOUNT);
              s.player.hp = after;
              hpChanged = after !== before;
              effectMsg = hpChanged
                ? `The herb knits your wounds. +${after - before} HP (${after}/${max}).`
                : 'You are already at full health.';
            }
          } else if (itemType.endsWith('_goo')) {
            effectMsg = 'The goo dissolves. Something in the air shifts.';
          }

          playerInv.delete(itemId);

          audit.write({
            player_id: s.player.id,
            action: 'item_used',
            inputs: { item_id: itemId, item_type: itemType, effect: effectMsg },
            result: 'ok',
          });

          const invIds = getPlayerInventoryIds(s.player.id);
          const invItems = invIds.map(id => ({
            item_id: id,
            item_type: persist.getItem(id)?.item_type ?? 'unknown',
            slot: null,
          }));
          send(s.ws, ServerMessages.inventorySnapshot(invItems));
          if (hpChanged) sendWorldStateRefresh(s);
          send(s.ws, ServerMessages.skillResult(msg.skill_id, true, { payload: { effect: effectMsg, item_type: itemType } }));
          break;
        }

        if (msg.skill_id.startsWith('event:witness_moth_bloom:')) {
          if (!s.inWorld) {
            send(s.ws, ServerMessages.skillResult(msg.skill_id, false, { reason: 'invalid_target', payload: { error: 'not_in_world' } }));
            break;
          }

          const result = handleWitnessMothBloomSkillIntent(
            witnessMothBloom,
            {
              player_id: s.player.id,
              map: s.currentMap,
              skill_id: msg.skill_id,
              now_ms: Date.now(),
            },
            (receipt) => audit.write(receipt)
          );

          if (!result.ok) {
            send(s.ws, ServerMessages.skillResult(msg.skill_id, false, { reason: result.reason, payload: result.payload }));
            break;
          }

          const loopEvent = 'resolved' in result
            ? result.resolved ? 'witness_moth_bloom_resolved' : 'witness_moth_bloom_progress'
            : 'witness_moth_bloom_evidence';
          const shouldBroadcast = ('recorded' in result && result.recorded) || ('recovered' in result && result.recovered);

          send(s.ws, ServerMessages.skillResult(msg.skill_id, true, { payload: result.payload }));
          sendLoopUpdate(s, loopEvent);
          if (shouldBroadcast) {
            broadcastToMap('Azura', ServerMessages.chatBroadcast('system', 'Witness Bloom', result.message));
          }
          break;
        }

        const skillCtx: SkillContext = {
          playerId: s.player.id,
          playerName: s.player.name,
          ws: s.ws,
          antiState: s.anti.state,
          skillCooldowns: s.skillCooldowns,
          onwardRoutesAvailable: buildRookguardQuestProgress(rookguardQuestInputFor(s)).completed,
          getOnwardRouteProgress: () => getOnwardRouteReceiptProgress(s.player!.id),
          audit: (receipt) => audit.write(receipt),
          findPlayerOnline: findPlayerByIdOnline,
          issueTem: issueTemChallenge,
          getChronicle: (pid, limit) => persist.getChronicleForPlayer(pid, limit),
          send: (m) => send(s.ws, m as ServerMessage),
          onSkillResolved: (skillId) => {
            if (skillId.startsWith('route:')) sendLoopUpdate(s, 'onward_route_progress');
          },
          mintItemToInventory: (itemType, meta, reason, source) =>
            mintItemToInventory(s.player!.id, itemType, meta, reason, source),
          syncInventory: () => {
            const invIds = getPlayerInventoryIds(s.player!.id);
            const invItems = invIds.map(id => ({
              item_id: id,
              item_type: persist.getItem(id)?.item_type ?? 'unknown',
              slot: null,
            }));
            send(s.ws, ServerMessages.inventorySnapshot(invItems));
          },
          creditWallet: (amount, reason) => {
            audit.write({
              player_id: s.player!.id,
              action: WALLET_CREDIT_ACTION,
              inputs: { amount, reason: reason as WalletCreditReason },
              result: 'ok',
            });
            const balance = getGoldBalance(s.player!.id);
            send(s.ws, ServerMessages.walletSnapshot(balance));
            return { balance_gold: balance };
          },
          debitWallet: (amount, reason) => {
            if (!canAfford(s.player!.id, amount)) return { ok: false, reason: 'insufficient_gold' };
            audit.write({
              player_id: s.player!.id,
              action: WALLET_DEBIT_ACTION,
              inputs: { amount, reason: reason as WalletDebitReason },
              result: 'ok',
            });
            const balance = getGoldBalance(s.player!.id);
            send(s.ws, ServerMessages.walletSnapshot(balance));
            return { ok: true, balance_gold: balance };
          },
          creditWalletForPlayer: (playerId, amount, reason) => {
            audit.write({
              player_id: playerId,
              action: WALLET_CREDIT_ACTION,
              inputs: { amount, reason: reason as WalletCreditReason },
              result: 'ok',
            });
            return { balance_gold: getGoldBalance(playerId) };
          },
        };

        handleUseSkill(skillCtx, msg);
        break;
      }

      // Moderation v1 (DEBUG only)
      case 'get_mod_reports': {
        if (!requireAuth(s)) break;
        if (!s.player) break;

        const modCtx: ModerationContext = {
          playerId: s.player.id,
          ws: s.ws,
          isDebugMode: !!process.env.DEBUG,
          audit: (receipt) => audit.write(receipt),
          getModerationReports: (status, limit) => persist.getModerationReports(status, limit),
          getModerationReportByCaseId: (caseId) => persist.getModerationReportByCaseId(caseId),
          getModerationReportByReceiptHash: (rh) => persist.getModerationReportByReceiptHash(rh),
          send: (m) => send(s.ws, m as ServerMessage),
        };

        handleGetModReports(modCtx, msg);
        break;
      }

      case 'mod_resolve': {
        if (!requireAuth(s)) break;
        if (!s.player) break;

        const modCtx: ModerationContext = {
          playerId: s.player.id,
          ws: s.ws,
          isDebugMode: !!process.env.DEBUG,
          audit: (receipt) => audit.write(receipt),
          getModerationReports: (status, limit) => persist.getModerationReports(status, limit),
          getModerationReportByCaseId: (caseId) => persist.getModerationReportByCaseId(caseId),
          getModerationReportByReceiptHash: (rh) => persist.getModerationReportByReceiptHash(rh),
          send: (m) => send(s.ws, m as ServerMessage),
        };

        handleModResolve(modCtx, msg);
        break;
      }
    }
  }
}

// Property auction close→settle scan runs inside the existing world tick loop,
// throttled to a low frequency. This is the ONLY auction wall-clock trigger;
// `now` is passed into settleDueAuctions (the loop module never calls Date.now()
// itself), and replay never runs this path.
const AUCTION_SCAN_INTERVAL_MS = 1000;
let lastAuctionScanMs = 0;

setInterval(() => {
  const now = Date.now();
  // Resolve expired unresolved witness requests before cleanup
  const expired = getUnresolvedExpiredRequests(now);
  for (const request of expired) {
    const resolution = tryResolveQuorum(request, 'ttl_expired', now);
    if (resolution) {
      emitQuorumResolutionReceipt(request, resolution);
    }
  }
  cleanupExpiredRequests(now);
  for (const s of sessions.values()) {
    processSessionQueue(s, now);
    // Presence tick (linger + co-presence)
    if (s.inWorld && s.player) {
      onPresenceTick(s.player.id, now, (r) => audit.write(r));
    }
  }
  // Close→settle due auctions (resale). Settlement truth is the emitted receipt.
  if (now - lastAuctionScanMs >= AUCTION_SCAN_INTERVAL_MS) {
    lastAuctionScanMs = now;
    const settlements = settleDueAuctions(now, (r) => audit.write(r));
    for (const st of settlements) {
      broadcastToMap(
        st.zone as 'Rookguard' | 'Azura',
        ServerMessages.houseAuctionSettled(
          st.property_id, st.plot_id, st.zone,
          resolvePlayerName(st.winner_id), resolvePlayerName(st.seller_id), st.price, st.sale_count
        )
      );
    }
  }
}, TICK_MS);

setInterval(() => pruneExpiredGuestSessions(Date.now()), GUEST_SESSION_CLEANUP_MS);

// Item decay tick (every 10 seconds)
const DECAY_TICK_MS = 10_000;
setInterval(() => decayTick(new Date()), DECAY_TICK_MS);

// Legendary heat decay tick (every 60 seconds)
// Decays heat on legendary items carried by players in safe zones (Rookguard)
// Emits receipts for replay-proof persistence
const HEAT_DECAY_TICK_MS = 60_000;
const LEGENDARY_HEAT_DECAY_PER_MINUTE = 0.2;
setInterval(() => {
  const now = Date.now();
  for (const s of sessions.values()) {
    if (!s.inWorld || !s.player) continue;
    // Only decay in Rookguard (safe zone)
    if (s.currentMap !== 'Rookguard') continue;

    const playerInventory = inventory.get(s.player.id);
    if (!playerInventory || playerInventory.size === 0) continue;

    const itemIds = Array.from(playerInventory);
    for (const itemId of itemIds) {
      const item = persist.getItem(itemId);
      if (!item?.meta_json) continue;

      let meta: { legendary?: boolean };
      try {
        meta = JSON.parse(item.meta_json);
      } catch {
        continue;
      }

      if (!meta.legendary) continue;

      const currentHeat = getLegendaryHeat(itemId);
      if (currentHeat <= 0) continue;

      const newHeat = Math.max(0, currentHeat - LEGENDARY_HEAT_DECAY_PER_MINUTE);

      // Emit legendary_heat_changed receipt
      audit.write({
        player_id: s.player.id,
        action: 'legendary_heat_changed',
        inputs: {
          item_id: itemId,
          delta: -LEGENDARY_HEAT_DECAY_PER_MINUTE,
          new_heat: newHeat,
          reason: 'decay',
          context: {
            map: s.currentMap,
            at_ms: now,
          },
        },
        result: 'ok',
      });

      // Update runtime map
      setLegendaryHeat(itemId, newHeat);
    }
  }
}, HEAT_DECAY_TICK_MS);

// Mob system init
initMobs();

// Mob respawn tick — revive due mobs, refresh corpse countdowns
setInterval(() => {
  tickMobRespawns();
  // Re-broadcast every mob (alive HP / dead countdown) so clients update
  for (const map of ['Rookguard', 'Azura'] as const) {
    for (const mob of getMobsForMap(map)) {
      broadcastToMap(map, ServerMessages.playerJoined(mobToPublicPlayer(mob)));
    }
  }
}, 1_000);

// Mob aggression tick — aggressive mobs damage adjacent in-world players (PvE)
setInterval(() => {
  const now = Date.now();
  for (const map of ['Rookguard', 'Azura'] as const) {
    const aggressors = getMobsForMap(map).filter(
      (m) => m.dead_until_ms === null && AGGRESSIVE_MOB_TYPES.has(m.def.mob_type)
    );
    if (aggressors.length === 0) continue;
    for (const s of sessions.values()) {
      if (!s.player || !s.inWorld || s.currentMap !== map) continue;
      if (s.player.status === 'dead') continue;
      for (const mob of aggressors) {
        if (Math.abs(s.player.x - mob.def.x) <= 1 && Math.abs(s.player.y - mob.def.y) <= 1) {
          const hp = Math.max(0, (s.player.hp ?? PLAYER_MAX_HP) - MOB_AGGRO_DAMAGE);
          s.player.hp = hp;
          s.lastDamage = { at_ms: now, source_type: 'unknown', source_id: mob.def.mob_type };
          audit.write({
            player_id: s.player.id,
            action: 'mob_attack',
            inputs: { mob_id: mob.mob_id, mob_type: mob.def.mob_type, damage: MOB_AGGRO_DAMAGE, hp_remaining: hp, map },
            result: 'ok',
          });
          if (hp <= 0) {
            applyMobDeath(s, mob.def.mob_type, now);
          } else {
            sendWorldStateRefresh(s);
          }
          break; // at most one aggressor hit per tick
        }
      }
    }
  }
}, MOB_AGGRO_TICK_MS);

httpServer.listen(PORT, HOST, () => {
  console.log(`HTTP+WS listening on ${HOST}:${PORT}`);
  console.log(`HTTP health: http://${HOST}:${PORT}/v1/health`);
  console.log(`WS: ws://${HOST}:${PORT}`);
  console.log(`build: ${BUILD_INFO.commit_short} (${BUILD_INFO.ref}) built ${BUILD_INFO.built_at}`);
});
