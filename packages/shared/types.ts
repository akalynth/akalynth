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
  hp?: number;
  max_hp?: number;
  reputation?: number;
  sprite_id?: string | null;
  // Sovereign presence (cosmetic only)
  title?: string | null;
  badges?: string[];
  mark?: string | null;
  // Capabilities (enforcement gates, server-only)
  caps?: string[];
}

export type PlayerState = 'connected' | 'authenticated' | 'in_world';

export type TutorialStep = 'move' | 'chat' | 'tem' | 'gate';

export type RookguardQuestStepId =
  | 'move'
  | 'chat'
  | 'tem'
  | 'training'
  | 'profession'
  | 'gate';

export type RookguardQuestPhase =
  | 'tutorial'
  | 'training'
  | 'profession'
  | 'gate'
  | 'complete';

export interface TutorialProgress {
  move: boolean;
  chat: boolean;
  tem: boolean;
  gate: boolean;
  complete: boolean;
}

export interface RookguardQuestStep {
  step_id: RookguardQuestStepId;
  label: string;
  complete: boolean;
  receipt_actions: string[];
}

export type RookguardCodexShelfId =
  | 'artifacts-codex'
  | 'chronicle-of-ages'
  | 'dungeon-codex'
  | 'emberwilds-atlas'
  | 'factions-codex'
  | 'heroes-codex';

export interface RookguardCodexShelf {
  object_id: RookguardCodexShelfId;
  title: string;
  subtitle: string;
  role: 'active_profession_lore' | 'proof_history' | 'future_lane';
  gameplay_hint: string;
}

export interface RookguardCodexAnchor {
  object_id: 'heroes-codex';
  status: 'accepted';
  source: 'AKALYNTH_HEROES_CODEX_V1';
  evidence: '3f9d4f90...11d630 source';
  authority: 'Akalynth';
  related: RookguardCodexShelfId[];
}

export interface RookguardCodexProfession {
  vocation: SovereignVocation;
  lore_id: 'codex_warden' | 'codex_cantor' | 'codex_hexer' | 'codex_reaver';
  codex_anchor: RookguardCodexAnchor;
  title: string;
  oath: string;
  starter_role: string;
  starter_actions: string[];
}

export interface RookguardQuestProgress {
  quest_id: 'rookguard_city_codex_path_v1';
  title: string;
  phase: RookguardQuestPhase;
  steps: RookguardQuestStep[];
  codexShelves: RookguardCodexShelf[];
  codexProfession?: RookguardCodexProfession | null;
  completed: boolean;
}

export type OnwardRouteId =
  | 'forgehold_route_slice_v1'
  | 'moonspire_dream_gate_slice_v1';

export type OnwardRouteStatus = 'locked' | 'available';

export interface OnwardRouteObjective {
  id: string;
  label: string;
  system: 'economy' | 'quest' | 'crafting' | 'dream_gate' | 'ui' | 'android' | 'anti_cheat' | 'server';
}

export interface OnwardRouteProgress {
  route_id: OnwardRouteId;
  title: string;
  status: OnwardRouteStatus;
  unlock_requirement: string;
  next_objective: string;
  objectives: OnwardRouteObjective[];
  completed_objective_ids: string[];
  source_drop: string;
  receipt_actions: string[];
}

export interface PlayLoopProgress extends TutorialProgress {
  gateOpen: boolean;
  objective: string;
  rookguardQuest?: RookguardQuestProgress;
  onwardRoutes?: OnwardRouteProgress[];
  lastEvent?: string | null;
  teaser?: {
    id: 'ember_road_marker';
    unlocked: boolean;
  };
}

export interface PlayerPublic {
  id: string;
  name: string;
  x: number;
  y: number;
  status: PlayerStatus;
  dead_until_ms?: number | null;
  hp?: number;
  max_hp?: number;
  reputation?: number;
  sprite_id?: string | null;
  // Sovereign presence (cosmetic only)
  title?: string | null;
  badges?: string[];
  mark?: string | null;
  loop?: PlayLoopProgress;
}

export type RespectRank = 'Frayed' | 'Unproven' | 'Known' | 'Trusted' | 'Honored';

export function respectRankForReputation(reputation: number | undefined | null): RespectRank {
  const value = Number.isFinite(reputation) ? Number(reputation) : 0;
  if (value <= -5) return 'Frayed';
  if (value < 3) return 'Unproven';
  if (value < 10) return 'Known';
  if (value < 25) return 'Trusted';
  return 'Honored';
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
  profession_hall?: Landmark;
  quest_board?: Landmark;
  training_yard?: Landmark;
  codex_arch?: Landmark;
  house_plots?: HousePlot[];
  tutorial?: {
    move: Landmark;
    chat: Landmark;
    tem: Landmark;
  };
};

export interface HousePlot extends Landmark {
  id: string;
  // Property Ownership v0: addressable district label + primary (treasury) sale price.
  district?: string;
  primary_price_gold?: number;
  // How an UNOWNED plot is allocated. Absent/`'fixed'` means fixed-price primary
  // buy; `'auction'` is the future primary/system auction allocation mode.
  allocation_mode?: PropertyAllocationMode;
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

export const TEM_CHALLENGE_RESPONSE = 'AKALYNTH';
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

// ============================================================================
// Learning / Anti-Cheat Advisory
// ============================================================================

export type SuspicionBand = 'low' | 'medium' | 'high';

export interface SuspicionTopSignal {
  name: string;
  value: number;
  contribution: number;
}

export interface LearningFeatureRow {
  feature_version: string;
  player_id: string;
  session_id: string;
  window_start: string;
  window_end: string;
  move_intent_count: number;
  accepted_move_count: number;
  rejected_move_count: number;
  reject_ratio: number;
  avg_move_interval_ms: number;
  move_interval_variance_ms: number;
  perfect_cadence_count: number;
  tem_challenge_issued_count: number;
  tem_response_count: number;
  tem_failed_count: number;
  heat_changed_count: number;
  max_heat_seen: number;
  heat_escalation_count: number;
  runestone_denial_spam_count: number;
  repeated_legend_probe_count: number;
  chat_message_count: number;
  chat_rate_spike_count: number;
  throttle_count: number;
  kick_count: number;
  rate_limit_exceeded_count: number;
  session_duration_ms: number;
  map_transition_count: number;
  disconnect_count: number;
  first_sequence: number;
  last_sequence: number;
  receipt_count: number;
}

export interface SuspicionScore {
  player_id: string;
  session_id: string;
  score: number;
  band: SuspicionBand;
  top_signals: SuspicionTopSignal[];
  feature_version: string;
  model_version: string;
  computed_at: string;
  first_sequence: number;
  last_sequence: number;
  receipt_count: number;
}

export interface LearningModelManifest {
  model_version: string;
  feature_version: string;
  kind: 'heuristic';
  weights_checksum: string;
  generated_at: string;
}

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
  | 'work_contract'              // Faucet: earned through labor (future)
  | 'debug_grant'                // Debug-only: admin grant
  | `property_sale:${string}`    // Resale: seller credited (property_sale:<property_id>)
  // Auction lane: escrow is represented by receipt sequence + derived balance
  // state, not a treasury escrow ledger.
  | `auction_refund:${string}`   // Outbid bidder made whole (auction_refund:<property_id>)
  | `auction_sale:${string}`     // Resale auction: seller credited on settle (auction_sale:<property_id>)
  | `forgehold_payout:${string}`; // Forgehold route payout (forgehold_payout:<settlement_id>)

export type WalletDebitReason =
  | 'temple_tithe'                  // Sink: voluntary tithe
  | 'debug_burn'                    // Debug-only: admin burn
  | `action_cost:${string}`         // Costed action: action_cost:<action_type>
  | `property_purchase:${string}`   // Primary sale sink (property_purchase:<property_id>)
  | `property_transfer:${string}`   // Resale buyer debit (property_transfer:<property_id>)
  // Auction lane: a bid escrows the bidder's gold (debit); being outbid refunds
  // it (credit). No escrow ledger.
  | `auction_escrow:${string}`;     // Bid escrow debit (auction_escrow:<property_id>)

// ============================================================================
// Property Registry v0 (House Ownership)
// ============================================================================

// Receipt actions. property_created is system-emitted at boot (seed); the rest
// carry player ids and are surfaced publicly only via anonymized endpoints.
export const PROPERTY_CREATED_ACTION = 'property_created';
export const PROPERTY_LISTED_ACTION = 'property_listed';
export const PROPERTY_UNLISTED_ACTION = 'property_unlisted';
export const PROPERTY_PURCHASED_ACTION = 'property_purchased';     // primary sale (treasury → player, gold sink)
export const PROPERTY_TRANSFERRED_ACTION = 'property_transferred'; // resale (player → player, conserved)

// 'auctioning' = an open auction is running on the plot. It is set/cleared only
// by the property auction reducer from receipts (never wall-clock). Folded in at
// the reducer/projection step alongside its consumers (e.g. http
// PropertyMarketListing.status).
export type PropertyStatus = 'unowned' | 'owned' | 'listed' | 'auctioning';

/** @deprecated 'auctioning' is now part of PropertyStatus; prefer PropertyStatus. */
export type ReservedPropertyStatus = PropertyStatus;

export type PropertyDenialReason =
  | 'unknown_plot'
  | 'not_for_sale'
  | 'already_owned'
  | 'cannot_buy_own'
  | 'insufficient_gold'
  | 'not_owner'
  | 'invalid_price';

// ============================================================================
// Property Auctions
// ============================================================================
// Resale open/bid/cancel and close-to-settle are active. Primary/system auction
// opening remains a later lane.

// How an unowned plot is allocated. Absent/'fixed' = current v0 fixed-price buy.
export type PropertyAllocationMode = 'fixed' | 'auction';

// Auction kind: 'primary' = unowned plot allocation (gold sink); 'resale' =
// owner-initiated auction (conserved, seller credited on settle).
export type PropertyAuctionKind = 'primary' | 'resale';

// Reserved receipt action names (NOT emitted by any code path in this change).
export const PROPERTY_AUCTION_OPENED_ACTION = 'property_auction_opened';
export const PROPERTY_BID_ACTION = 'property_bid';
export const PROPERTY_BID_REFUNDED_ACTION = 'property_bid_refunded';
export const PROPERTY_AUCTION_SETTLED_ACTION = 'property_auction_settled';
export const PROPERTY_AUCTION_CANCELLED_ACTION = 'property_auction_cancelled';

// Denial reasons for auction intents (open/bid/cancel).
export type PropertyAuctionDenialReason =
  | 'unknown_plot'
  | 'not_owner'
  | 'already_listed'
  | 'already_auctioning'
  | 'not_auctioning'
  | 'bid_too_low'
  | 'insufficient_gold'
  | 'auction_closed'
  | 'cannot_bid_own'
  | 'has_bids'
  | 'invalid_price';

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
