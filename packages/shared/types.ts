// Akalynth Shared Types
// Used by both server and client

// ============================================================================
// Positions & Tiles
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export type Direction = 'north' | 'south' | 'east' | 'west';

export const DIRECTION_OFFSETS: Record<Direction, Position> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

export enum TileType {
  Grass = 0,
  Stone = 1,
  Wall = 2,
  Water = 3,
  Door = 4,
}

export enum TileCode {
  Grass = 0,
  Stone = 1,
  Wall = 2,
  Water = 3,
  Door = 4,

  TutorialMove = 5,
  TutorialChat = 6,
  TutorialTem = 7,
  GateToAzura = 8,
}

export const WALKABLE_TILES = new Set<number>([
  TileCode.Grass,
  TileCode.Stone,
  TileCode.TutorialMove,
  TileCode.TutorialChat,
  TileCode.TutorialTem,
  TileCode.GateToAzura,
]);

// ============================================================================
// Players
// ============================================================================

export type PlayerStatus = 'alive' | 'dead';

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  state: PlayerState;
  status: PlayerStatus;
  dead_until_ms?: number | null;
  reputation?: number;
  // Sovereign presence (cosmetic only)
  title?: string | null;
  badges?: string[];
  mark?: string | null;
  // Capabilities (enforcement gates, server-only)
  caps?: string[];
}

export type PlayerState = 'connected' | 'authenticated' | 'in_world';

export type TutorialStep = 'move' | 'chat' | 'tem' | 'gate';

export interface TutorialProgress {
  move: boolean;
  chat: boolean;
  tem: boolean;
  gate: boolean;
  complete: boolean;
}

export interface PlayerPublic {
  id: string;
  name: string;
  x: number;
  y: number;
  status: PlayerStatus;
  dead_until_ms?: number | null;
  reputation?: number;
  // Sovereign presence (cosmetic only)
  title?: string | null;
  badges?: string[];
  mark?: string | null;
}

// ============================================================================
// Map Data
// ============================================================================

export interface Landmark {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Some landmarks may be represented as points in future maps.
export interface PointLandmark {
  x: number;
  y: number;
}

export type LandmarkWire = Landmark | PointLandmark;
export type LandmarkGroupWire = Record<string, LandmarkWire>;

// Map JSON landmarks are a mix of single landmarks (e.g. runestone_table)
// and grouped landmarks (e.g. tutorial: { move, chat, tem }).
export type LandmarksWire = Record<string, LandmarkWire | LandmarkGroupWire | LandmarkWire[]> & {
  guild_hall?: Landmark;
  plaza?: Landmark;
  house_plots?: HousePlot[];
  tutorial?: {
    move: Landmark;
    chat: Landmark;
    tem: Landmark;
  };
};

export interface HousePlot extends Landmark {
  id: string;
}

export interface MapData {
  name: string;
  width: number;
  height: number;
  spawn: Position;
  tiles: number[]; // Flat array, index = y * width + x
  // Landmarks differ by map (e.g. Rookguard tutorial zones vs Azura civic sites).
  landmarks: LandmarksWire;
}

// Protocol/docs terminology: the game "World" is the loaded map + landmarks.
export type World = MapData;

// ============================================================================
// Anti-Cheat
// ============================================================================

export type SignalType =
  | 'speed_violation'
  | 'pathing_anomaly'
  | 'action_cadence'
  | 'repeated_timing'
  | 'perfect_cadence'
  | 'chat_spam'
  | 'action_spam';

export interface Signal {
  type: SignalType;
  timestamp: number;
  details: Record<string, unknown>;
}

export type EnforcementLevel = 'warn' | 'tem_challenge' | 'throttle' | 'kick' | 'temp_ban';

export interface AntiCheatState {
  signals: Signal[];
  warnCount: number;
  temChallengeActive: boolean;
  temChallengeId: string | null;
  temChallengeExpires: number | null;
  throttleUntil: number | null;
  kickCount: number;
}

// ============================================================================
// Audit
// ============================================================================

export interface AuditReceipt {
  sequence: number;
  timestamp: string;
  prev_hash: string;
  event_hash: string;
  signature: string;
  actor_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
  inputs_hash: string;
  outputs_hash: string;
}

export const LEDGER_HESITATION_ACTION = 'ledger_hesitation';
export const RUMOR_SEEDED_ACTION = 'rumor_seeded';
export const LEDGER_MARKED_ACTION = 'ledger_marked';
export const LEGEND_SIGHTED_ACTION = 'legend_sighted';
export const LEGEND_ATTEMPTED_ACTION = 'legend_attempted';
export const LEGEND_REFUSED_ACTION = 'legend_refused';
export const FIRST_ATTEMPT_STONE_ACTION = 'first_attempt_stone_cannot_obtain';
export const HEAT_CHANGED_ACTION = 'heat_changed';
export const HEAT_TEM_ESCALATION_ACTION = 'heat_tem_escalation';
export const HEAT_PENALTY_APPLIED_ACTION = 'heat_penalty_applied';
export const WITNESS_REQUESTED_ACTION = 'witness_requested';
export const WITNESS_RESPONSE_ACTION = 'witness_response';
export const WITNESS_QUORUM_ACTION = 'witness_quorum';
export const WITNESS_QUORUM_RESOLVED_ACTION = 'witness_quorum_resolved';

// Sovereign presence (cosmetic only)
export const SOVEREIGN_DECLARED_ACTION = 'sovereign_declared';
export const SOVEREIGN_PRESENCE_ACTION = 'sovereign_presence';
export const SOVEREIGN_MARKED_ACTION = 'sovereign_marked';
export const SOVEREIGN_ECHO_SPAWNED_ACTION = 'sovereign_echo_spawned';
export const SOVEREIGN_ECHO_DESPAWNED_ACTION = 'sovereign_echo_despawned';

// ============================================================================
// Capabilities (enforcement gates, server-only)
// ============================================================================

export const CAP_HOUSE_BUY = 'house:buy';
export const CAP_ECHO_SPAWN = 'echo:spawn';
export const CAP_MAP_ACCESS_PREFIX = 'map:access:';

// Capability receipt actions (private-only, never in PUBLIC_RECEIPTS_ALLOW)
export const CAPABILITY_GRANTED_ACTION = 'capability_granted';
export const CAPABILITY_REVOKED_ACTION = 'capability_revoked';
export const CAPABILITY_GATED_ACTION = 'capability_gated';

export type DeathReceiptAction = 'death' | 'respawn' | 'death_penalty_applied';

export const TEM_CHALLENGE_RESPONSE = 'AZURA';
export const THROTTLE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const SIGNAL_DECAY_MS = 60 * 1000; // 60 seconds

// ============================================================================
// Death
// ============================================================================

export type DeathCause = 'test' | 'player' | 'npc' | 'environment' | 'unknown';

// ============================================================================
// Runestone
// ============================================================================

export type Element = 'fire' | 'water' | 'earth' | 'air' | 'light' | 'shadow';

export const ELEMENTS: Element[] = ['fire', 'water', 'earth', 'air', 'light', 'shadow'];

export type RunestoneDenialReason = 'cooldown' | 'not_near_table' | 'not_authorized' | 'rate_limited';

// Runestone receipt actions
export const RUNESTONE_CAST_ACTION = 'runestone_cast';
export const RUNESTONE_RESULT_ACTION = 'runestone_result';
export const RUNESTONE_DENIED_ACTION = 'runestone_denied';
export const TRINITY_OF_SHADOW_ACTION = 'trinity_of_shadow';

// Combat receipt actions (Phase 3)
export const ATTACK_INTENT_ACTION = 'attack_intent';
export const COMBAT_RESOLVED_ACTION = 'combat_resolved';

// ============================================================================
// Sovereign Vocations (Identity Layer v0)
// ============================================================================

export type SovereignVocation = 'warden' | 'cantor' | 'hexer' | 'reaver';

export const SOVEREIGN_VOCATIONS: readonly SovereignVocation[] = [
  'warden',
  'cantor',
  'hexer',
  'reaver',
] as const;

// Explicit label mapping (no ad-hoc capitalize)
export const VOCATION_LABEL: Record<SovereignVocation, string> = {
  warden: 'Warden',
  cantor: 'Cantor',
  hexer: 'Hexer',
  reaver: 'Reaver',
};

export const VOCATION_COSMETICS: Record<
  SovereignVocation,
  { badge: string; mark: string }
> = {
  warden: { badge: 'vocation_warden', mark: 'warden_shield' },
  cantor: { badge: 'vocation_cantor', mark: 'cantor_rings' },
  hexer: { badge: 'vocation_hexer', mark: 'hexer_sigil' },
  reaver: { badge: 'vocation_reaver', mark: 'reaver_ember' },
};

// Receipt actions (ALL private in v0)
export const VOCATION_DECLARED_ACTION = 'vocation_declared';
export const SOVEREIGN_PREFIX_GRANTED_ACTION = 'sovereign_prefix_granted';
export const SOVEREIGN_PREFIX_REVOKED_ACTION = 'sovereign_prefix_revoked';

// Grant sources
export type PrefixGrantSource = 'debug' | 'admin' | 'purchase';

// ============================================================================
// Treasury Kernel v0 (Gold)
// ============================================================================

// Receipt actions (ALL private in v0)
export const WALLET_CREDIT_ACTION = 'wallet_credit';
export const WALLET_DEBIT_ACTION = 'wallet_debit';

// Amount bounds (prevent integer blowups / DoS)
export const MAX_GOLD_AMOUNT = 1_000_000;

// Credit/debit reasons (audit trail)
export type WalletCreditReason =
  | 'work_contract'  // Faucet: earned through labor (future)
  | 'debug_grant';   // Debug-only: admin grant

export type WalletDebitReason =
  | 'temple_tithe'            // Sink: voluntary tithe
  | 'debug_burn'              // Debug-only: admin burn
  | `action_cost:${string}`;  // Costed action: action_cost:<action_type>

// ============================================================================
// Monetization (Support Credits) — Policy-Governed
// ============================================================================

export type MonetizationCategory =
  | 'cosmetic'
  | 'memory'
  | 'convenience'
  | 'world_support'
  | 'service';

// Receipt actions (private-only by default; never in PUBLIC_RECEIPTS_ALLOW)
export const SUPPORT_CREDIT_GRANTED_ACTION = 'support_credit_granted';
export const SUPPORT_CREDIT_SPENT_ACTION = 'support_credit_spent';
export const SUPPORT_ENTITLEMENT_GRANTED_ACTION = 'support_entitlement_granted';
export const SUPPORT_ENTITLEMENT_REVOKED_ACTION = 'support_entitlement_revoked';
export const SUPPORT_REFUND_ISSUED_ACTION = 'support_refund_issued';

export type SupportCreditReason =
  | 'purchase'
  | 'promo'
  | 'correction'
  | 'refund';

// ============================================================================
// Costed Actions v0 (Gold Pressure)
// ============================================================================

// Fixed cost schedule (no dynamic pricing in v0)
// Keys must match protocol message `type` strings exactly
export const ACTION_GOLD_COST: Record<string, number> = {
  inspect_player: 1,
  // Future costed actions:
  // echo_spawn: 1,
  // world_patch: 1,
};

// ============================================================================
// Work Contract Faucet v0
// ============================================================================

// Receipt actions (ALL private in v0)
export const WORK_CONTRACT_STARTED_ACTION = 'work_contract_started';
export const WORK_CONTRACT_TICK_RECORDED_ACTION = 'work_contract_tick_recorded';
export const WORK_CONTRACT_COMPLETED_ACTION = 'work_contract_completed';
export const WORK_CONTRACT_FAILED_ACTION = 'work_contract_failed';

// Contract types
export type WorkContractType = 'temple_sweep';

export const WORK_CONTRACT_TYPES: readonly WorkContractType[] = ['temple_sweep'] as const;

// Failure reasons
export type WorkContractFailReason =
  | 'disconnect'
  | 'insufficient_presence'
  | 'expired';

// Fixed schedule (no dynamic tuning in v0)
export const WORK_CONTRACT_SCHEDULE: Record<WorkContractType, {
  payout: number;
  cooldown_ms: number;
  min_duration_ms: number;
  required_ticks: number;
  tick_min_interval_ms: number;
  tick_max_interval_ms: number;
}> = {
  temple_sweep: {
    payout: 10,
    cooldown_ms: 10 * 60 * 1000,       // 10 minutes
    min_duration_ms: 30 * 1000,         // 30 seconds
    required_ticks: 6,
    tick_min_interval_ms: 3 * 1000,     // 3 seconds
    tick_max_interval_ms: 8 * 1000,     // 8 seconds
  },
};

// ============================================================================
// World Presence v0
// ============================================================================

// Receipt actions (ALL private in v0)
export const PRESENCE_ENTERED_ACTION = 'presence_entered';
export const PRESENCE_LINGERED_ACTION = 'presence_lingered';
export const PRESENCE_OBSERVED_ACTION = 'presence_observed';

// Place identifier (server-defined spatial anchors)
export type PlaceId = string;

// Presence thresholds (server-side enforcement)
export const PRESENCE_LINGER_THRESHOLD_MS = 5 * 60 * 1000;  // 5 minutes to linger
export const PRESENCE_OBSERVE_THRESHOLD_MS = 30 * 1000;     // 30 seconds to observe
