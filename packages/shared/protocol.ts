// Akalynth Protocol Messages
// All messages sent over WebSocket

import type { BuilderPreviewWorldFork } from './builderDraft.js';
import type { Direction, Element, PlayerPublic, PlayLoopProgress, PropertyAuctionKind, PropertyAuctionDenialReason, PropertyDenialReason, PropertyStatus, RunestoneDenialReason, SovereignVocation } from './types.js';
import { ELEMENTS, SOVEREIGN_VOCATIONS, TEM_CHALLENGE_RESPONSE } from './types.js';
import type { MapName } from './http.js';

// ============================================================================
// Protocol Version
// ============================================================================

export const PROTOCOL_VERSION = '2.1.0';

// ============================================================================
// Base Message
// ============================================================================

export interface BaseMessage {
  type: string;
}

// ============================================================================
// Client → Server Messages
// ============================================================================

export interface ConnectMessage extends BaseMessage {
  type: 'connect';
}

export interface LoginMessage extends BaseMessage {
  type: 'login';
  guest_token?: string | null;  // Legacy guest token (optional)
  token?: string;               // Signed auth token (preferred)
}

export interface EnterWorldMessage extends BaseMessage {
  type: 'enter_world';
}

export interface MoveIntentMessage extends BaseMessage {
  type: 'move_intent';
  direction: Direction;
}

export interface ChatMessage extends BaseMessage {
  type: 'chat';
  message: string;
}

export interface TemResponseMessage extends BaseMessage {
  type: 'tem_response';
  response: string;
}

export interface KillSelfMessage extends BaseMessage {
  type: 'kill_self';
}

export interface RunestoneCastMessage extends BaseMessage {
  type: 'runestone_cast';
  table_id: string;
  guess: Element | null;
}

export type WitnessResponse = 'confirm' | 'deny' | 'uncertain';

export interface TemWitnessResponseMessage extends BaseMessage {
  type: 'tem_witness_response';
  request_id: string;
  response: WitnessResponse;
}

// Phase 2: Item messages
export interface DropItemMessage extends BaseMessage {
  type: 'drop_item';
  item_id: string;
}

export interface PickupItemMessage extends BaseMessage {
  type: 'pickup_item';
  item_id: string;
}

// Phase 3: Combat messages
export interface AttackIntentMessage extends BaseMessage {
  type: 'attack_intent';
  target_id: string;
}

// Dev-only: Legendary minting (gated by env flag)
export interface MintLegendaryMessage extends BaseMessage {
  type: 'mint_legendary';
  item_type?: string; // default 'mark_token'
  tier?: number;      // default 1 (1-5)
}

// Phase 3.2: Protected slots
export interface SetProtectedSlotMessage extends BaseMessage {
  type: 'set_protected_slot';
  item_id: string; // must exist in player's inventory
}

// Phase 4: Chronicle
export interface GetChronicleMessage extends BaseMessage {
  type: 'get_chronicle';
  player_id?: string; // if omitted, returns own chronicle
  limit?: number;     // default 50, max 200
  before?: string;    // pagination cursor (ISO8601 timestamp)
}

// Phase 4.4: Chronicle Evidence
export interface GetEvidenceMessage extends BaseMessage {
  type: 'get_evidence';
  chronicle_event_id?: number; // preferred (stable)
  receipt_hash?: string;       // alternate (direct)
  kind?: string;               // optional sanity guard
}

// Phase 5: Pressure Metrics
export interface GetPressureMetricsMessage extends BaseMessage {
  type: 'get_pressure_metrics';
  since?: string;  // ISO8601, default now - 7 days
  until?: string;  // ISO8601, default now
}

// ============================================================================
// Sovereign Vocations (Identity Layer v0)
// ============================================================================

// Client → Server: Declare vocation
export interface DeclareVocationMessage extends BaseMessage {
  type: 'declare_vocation';
  vocation: SovereignVocation;
}

// Client → Server: Inspect player (profile view)
export interface InspectPlayerMessage extends BaseMessage {
  type: 'inspect_player';
  target_player_id: string;
}

// Admin: Grant/revoke sovereign prefix (DEBUG_MODE && SOVEREIGN_PREFIX_DEBUG only)
export interface GrantSovereignPrefixMessage extends BaseMessage {
  type: 'grant_sovereign_prefix';
  target_player_id: string;
  grant: boolean;  // true = grant, false = revoke
}

// ============================================================================
// Treasury Kernel v0 (Gold)
// ============================================================================

// Client → Server: Inspect own wallet
export interface InspectWalletMessage extends BaseMessage {
  type: 'inspect_wallet';
}

// Client → Server: Pay tithe (sink)
export interface PayTitheMessage extends BaseMessage {
  type: 'pay_tithe';
  amount: number;
}

// Admin: Grant gold (DEBUG_MODE only)
export interface GrantGoldMessage extends BaseMessage {
  type: 'grant_gold';
  target_player_id: string;
  amount: number;
}

// ============================================================================
// Work Contract Faucet v0
// ============================================================================

// Client → Server: Start work contract
export interface StartWorkContractMessage extends BaseMessage {
  type: 'start_work_contract';
  contract_type: 'temple_sweep';
}

// Client → Server: Work tick (presence proof)
export interface WorkTickMessage extends BaseMessage {
  type: 'work_tick';
  contract_id: string;
}

// ============================================================================
// NPC Recognition v0
// ============================================================================

// Client → Server: Talk to NPC
export interface TalkToNpcMessage extends BaseMessage {
  type: 'talk_to_npc';
  npc_id: string;
}

// ============================================================================
// Skills v0 (Utility/Admin)
// ============================================================================

// Client → Server: Use a skill
export interface UseSkillMessage extends BaseMessage {
  type: 'use_skill';
  skill_id: string;
  target_id?: string;
}

// ============================================================================
// Moderation v1 (Admin-Only)
// ============================================================================

export type ModerationResolution = 'no_action' | 'warning' | 'temp_mute';

// Client → Server: List moderation reports (DEBUG only)
export interface GetModReportsMessage extends BaseMessage {
  type: 'get_mod_reports';
  status?: 'open' | 'resolved' | 'all';
  limit?: number;
}

// Client → Server: Resolve a moderation report (DEBUG only)
// Accept either receipt_hash (preferred) or case_id (legacy) as lookup key
export interface ModResolveMessage extends BaseMessage {
  type: 'mod_resolve';
  case_id?: string;          // Legacy lookup key
  receipt_hash?: string;     // Canonical lookup key (preferred)
  resolution: ModerationResolution;
  reason?: string;
}

// ============================================================================
// Property Ownership v0 (House Market)
// ============================================================================

// Public (anonymized) view of a property — NEVER carries raw player_id.
export interface PropertyPublic {
  property_id: string;
  zone: string;
  plot_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  district: string | null;
  status: PropertyStatus;
  owner_name: string | null;        // resolved display name (null = unowned/treasury)
  primary_price_gold: number;
  listed_price_gold: number | null; // set when status = 'listed'
  sale_count: number;
}

export interface PropertyOwnerHistoryEntry {
  from_name: string | null;
  to_name: string;
  price: number;
  action: 'purchased' | 'transferred';
  timestamp: string;
}

// Client → Server: buy a house (primary sale if unowned, resale if listed)
export interface BuyHouseMessage extends BaseMessage {
  type: 'buy_house';
  property_id: string;
}

// Client → Server: list an owned house for sale
export interface ListHouseMessage extends BaseMessage {
  type: 'list_house';
  property_id: string;
  price: number;
}

// Client → Server: remove an owned house from the market
export interface UnlistHouseMessage extends BaseMessage {
  type: 'unlist_house';
  property_id: string;
}

// Client → Server: request a property's ownership ledger
export interface GetPropertyLedgerMessage extends BaseMessage {
  type: 'get_property_ledger';
  property_id: string;
}

// ----------------------------------------------------------------------------
// Property Auctions — client messages (active as of Step 4a handlers).
// Handlers open/bid/cancel and emit receipts. NOTE: there is NO automatic
// settlement in 4a — the world-loop close→settle path is a separate later lane
// (4b). Clients are intent-only; accepted amount/winner state is server-derived.
// ----------------------------------------------------------------------------

// Client → Server: owner opens a resale auction on an owned plot.
export interface OpenHouseAuctionMessage extends BaseMessage {
  type: 'open_house_auction';
  property_id: string;
  min_bid: number;
  min_increment_gold: number;
  duration_s: number;
}

// Client → Server: place a gold bid on an open auction.
export interface PlaceHouseBidMessage extends BaseMessage {
  type: 'place_house_bid';
  property_id: string;
  amount: number;
}

// Client → Server: owner cancels a resale auction (only with zero bids).
export interface CancelHouseAuctionMessage extends BaseMessage {
  type: 'cancel_house_auction';
  property_id: string;
}

// ============================================================================
// Chill-Zone Gather v0 (Step 2) — Client → Server intents
// ============================================================================

export interface GatherIntentMessage extends BaseMessage {
  type: 'gather_intent';
  node_id: string;
}

export interface DeliverIntentMessage extends BaseMessage {
  type: 'deliver_intent';
  station_id: string;
}

// Chill-Zone Refine (Step 2): start refining the held raw item at a refinery station.
export interface RefineIntentMessage extends BaseMessage {
  type: 'refine_intent';
  station_id: string;
}

export type ClientMessage =
  | ConnectMessage
  | LoginMessage
  | EnterWorldMessage
  | MoveIntentMessage
  | ChatMessage
  | TemResponseMessage
  | KillSelfMessage
  | RunestoneCastMessage
  | TemWitnessResponseMessage
  | DropItemMessage
  | PickupItemMessage
  | AttackIntentMessage
  | MintLegendaryMessage
  | SetProtectedSlotMessage
  | GetChronicleMessage
  | GetEvidenceMessage
  | GetPressureMetricsMessage
  | DeclareVocationMessage
  | InspectPlayerMessage
  | GrantSovereignPrefixMessage
  | InspectWalletMessage
  | PayTitheMessage
  | GrantGoldMessage
  | StartWorkContractMessage
  | WorkTickMessage
  | TalkToNpcMessage
  | UseSkillMessage
  | GetModReportsMessage
  | ModResolveMessage
  | BuyHouseMessage
  | ListHouseMessage
  | UnlistHouseMessage
  | GetPropertyLedgerMessage
  | OpenHouseAuctionMessage
  | PlaceHouseBidMessage
  | CancelHouseAuctionMessage
  | GatherIntentMessage
  | DeliverIntentMessage
  | RefineIntentMessage;

// ============================================================================
// Server → Client Messages
// ============================================================================

export interface WelcomeMessage extends BaseMessage {
  type: 'welcome';
  version: string;
}

export interface LoginAckMessage extends BaseMessage {
  type: 'login_ack';
  ok?: boolean;
  player_id: string;
  guest_token?: string;      // Legacy (deprecated)
  token?: string;            // Signed auth token (preferred)
  expires_at?: number;       // Token expiry (epoch ms)
  name: string;
  reason?: string;
}

export interface WorldStateMessage extends BaseMessage {
  type: 'world_state';
  map: MapName;
  player: PlayerPublic;
  nearby_players: PlayerPublic[];
  builder_preview?: BuilderPreviewWorldFork;
}

export interface MoveResultMessage extends BaseMessage {
  type: 'move_result';
  ok: boolean;
  x: number;
  y: number;
  reason: string | null;
  map?: MapName;
}

export interface LoopUpdateMessage extends BaseMessage {
  type: 'loop_update';
  event: string;
  loop: PlayLoopProgress;
}

export interface PlayerMovedMessage extends BaseMessage {
  type: 'player_moved';
  player_id: string;
  x: number;
  y: number;
}

export interface PlayerJoinedMessage extends BaseMessage {
  type: 'player_joined';
  player: PlayerPublic;
}

export interface PlayerLeftMessage extends BaseMessage {
  type: 'player_left';
  player_id: string;
}

export interface ChatBroadcastMessage extends BaseMessage {
  type: 'chat_broadcast';
  player_id: string;
  name: string;
  message: string;
}

export interface TemChallengeMessage extends BaseMessage {
  type: 'tem_challenge';
  challenge_id: string;
  message: string;
  timeout_seconds: number;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  code: ErrorCode;
  message: string;
}

// Optional v0 UI context (safe to omit for backward compatibility).
export interface LostItemSummary {
  kind: string;
  qty?: number;
  rarity?: string;
}

export interface DeathNoticeExtras {
  chronicle_event_id?: number;
  lost_items?: LostItemSummary[];
  killer_name?: string;
  zone?: string;
  x?: number;
  y?: number;
  time?: string;
}

export interface DeathNoticeMessage extends BaseMessage, DeathNoticeExtras {
  type: 'death_notice';
  ok: true;
  respawn_in_ms: number;
  map: MapName;
  spawn: { x: number; y: number };
  reason: string;
}

export type ErrorCode =
  | 'invalid_message'
  | 'not_authenticated'
  | 'not_in_world'
  | 'rate_limited'
  | 'kicked'
  | 'insufficient_gold'
  | 'token_invalid'      // Token signature/format validation failed
  | 'token_expired'      // Token expired
  | 'name_taken'         // Character name already in use
  | 'invalid_name'       // Character name violates rules
  | 'banned';            // Account banned (deferred, reserved)

export interface RunestoneResultMessage extends BaseMessage {
  type: 'runestone_result';
  table_id: string;
  caster: { id: string; name: string };
  face: Element;
  whisper: string;
}

export interface RunestoneDeniedMessage extends BaseMessage {
  type: 'runestone_denied';
  reason: RunestoneDenialReason;
}

export interface TemWitnessRequestMessage extends BaseMessage {
  type: 'tem_witness_request';
  request_id: string;
  timestamp: string;
  map: MapName;
  target_actor: string;
  prompt: string;
  kind: 'heat_penalty';
}

// Phase 2: Item response messages
export interface ItemInfo {
  item_id: string;
  item_type: string;
  slot?: string | null; // Phase 3.2: 'protected' or null
}

export interface DropItemResultMessage extends BaseMessage {
  type: 'drop_item_result';
  ok: boolean;
  item_id: string;
  reason: string | null;
}

export interface PickupItemResultMessage extends BaseMessage {
  type: 'pickup_item_result';
  ok: boolean;
  item_id: string;
  reason: string | null;
}

export interface InventorySnapshotMessage extends BaseMessage {
  type: 'inventory_snapshot';
  items: ItemInfo[];
  // Houses v1.2: items the player has stored in a house they own (additive; optional).
  houseStorage?: ItemInfo[];
}

export interface WorldItemAddedMessage extends BaseMessage {
  type: 'world_item_added';
  item_id: string;
  item_type: string;
  x: number;
  y: number;
}

export interface WorldItemRemovedMessage extends BaseMessage {
  type: 'world_item_removed';
  item_id: string;
}

// Phase 3: Combat response messages
export interface CombatResolvedMessage extends BaseMessage {
  type: 'combat_resolved';
  attacker_id: string;
  defender_id: string;
  outcome: 'kill';
  map: MapName;
  x: number;
  y: number;
}

export type CombatRejectionReason =
  | 'cooldown'
  | 'not_adjacent'
  | 'pvp_disabled'
  | 'attacker_dead'
  | 'defender_dead'
  | 'different_maps'
  | 'attacker_not_found'
  | 'defender_not_found';

export interface CombatRejectedMessage extends BaseMessage {
  type: 'combat_rejected';
  reason: CombatRejectionReason;
}

// Phase 3.2: Protected slots
export interface ProtectedSlotSetMessage extends BaseMessage {
  type: 'protected_slot_set';
  player_id: string;
  item_id: string;           // now protected
  prev_item_id: string | null;
}

// Phase 4: Chronicle
// Phase 4.4 E2: Added evidence_ref for death/item_lost/legendary_lost linkage
export interface EvidenceRef {
  chronicle_event_id: number;
  receipt_hash: string;
}

export interface ChronicleEvent {
  kind: string;
  timestamp: string;         // ISO8601
  zone: string | null;
  x: number | null;
  y: number | null;
  details: Record<string, unknown>;
  evidence_ref?: EvidenceRef | null;  // Phase 4.4 E2: present for death/item_lost/legendary_lost
}

export interface ChronicleSnapshotMessage extends BaseMessage {
  type: 'chronicle_snapshot';
  player_id: string;
  events: ChronicleEvent[];
  has_more: boolean;         // true if more events exist before oldest in this batch
}

// Phase 4.4: Chronicle Evidence
export type EvidenceStatus = 'ok' | 'not_found' | 'not_applicable' | 'insufficient_data';

export interface DropExplanationWire {
  policy: {
    base_drop_ratio: number;
    min_drop: number;
    max_drop: number | null;
    rep_bias: number;
    stack_bias: number;
    protected_slots: number;
    decay_minutes: number;
  };
  ratio_breakdown: {
    base_drop_ratio: number;
    reputation: number;
    neg_rep: number;
    inventory_size: number;
    stack_excess: number;
    rep_contribution: number;
    stack_contribution: number;
    final_ratio: number;
    K_raw: number;
    K_bounded: number;
    K_final: number;
  };
  player_protected_ids: string[];
  policy_protected_ids: string[];
  candidates: Array<{
    item_id: string;
    item_type: string;
    base_weight: number;
    legendary: boolean;
    legendary_tier: number | null;
    heat: number;
    legendary_multiplier: number | null;
    final_weight: number;
    deterministic_u: number;
    selection_key: number;
    rank: number;
    dropped: boolean;
    exclusion_reason: 'none' | 'player_protected' | 'policy_protected' | 'below_cutoff';
  }>;
  dropped_item_ids: string[];
  kept_item_ids: string[];
  seed_hash: string;
}

export interface EvidenceSnapshotMessage extends BaseMessage {
  type: 'evidence_snapshot';
  status: EvidenceStatus;
  player_id: string;

  // Echo back anchor
  chronicle_event_id?: number;
  receipt_hash?: string;
  source_action?: string;
  kind?: string;

  // Present when status === 'ok'
  evidence?: {
    receipt_hashes: {
      anchor: string;
      combat_resolved?: string;
      death?: string;
    };
    drop_explanation?: DropExplanationWire;
  };

  // If not ok, machine-readable error
  error_code?: string;
}

// Phase 5: Pressure Metrics
export type PressureMetricsStatus = 'ok' | 'not_ready';

export interface PressureMetricsContributors {
  lost_event_ids: number[];
  death_event_ids: number[];
  evidence_receipt_hashes: string[];
}

export interface PressureMetrics {
  items_lost_total: number;
  items_lost_by_type: Record<string, number>;
  legendaries_lost_total: number;

  exposure_item_minutes: number;
  legendary_exposure_minutes: number;

  heat_now: number;
  hottest_item_id?: string;
  hottest_item_heat?: number;

  deaths_total: number;
  deaths_with_protection: number;

  average_drop_ratio?: number;
  worst_death?: {
    receipt_hash: string;
    drop_ratio: number;
  };

  contributors: PressureMetricsContributors;
}

export interface PressureMetricsSnapshotMessage extends BaseMessage {
  type: 'pressure_metrics_snapshot';
  player_id: string;
  since: string;
  until: string;
  metrics?: PressureMetrics;
  status: PressureMetricsStatus;
  error_code?: 'schema_too_old' | 'no_chronicle';
}

// Sovereign Vocations: Player inspect response
export interface PlayerInspectMessage extends BaseMessage {
  type: 'player_inspect';
  player_id: string;  // The inspected player
  name: string;
  vocation: SovereignVocation | null;
  display_vocation: string | null;  // "Sovereign Warden" if prefix, else "Warden"
  badges: string[];
  mark: string | null;  // Computed at inspect time, not stored
  error?: 'not_found';
}

// Treasury Kernel v0: Wallet snapshot (self-only)
export interface WalletSnapshotMessage extends BaseMessage {
  type: 'wallet_snapshot';
  gold: number;
}

// Treasury Kernel v0: Tithe result
export interface TitheResultMessage extends BaseMessage {
  type: 'tithe_result';
  success: boolean;
  new_balance?: number;
  error?: 'invalid_amount' | 'insufficient_gold';
}

// Work Contract Faucet v0: Contract started
export interface WorkContractStartedMessage extends BaseMessage {
  type: 'work_contract_started';
  contract_id: string;
  contract_type: 'temple_sweep';
  payout_gold: number;
  cooldown_seconds: number;
  min_duration_ms: number;
}

// Work Contract Faucet v0: Progress update
export interface WorkProgressMessage extends BaseMessage {
  type: 'work_progress';
  contract_id: string;
  ticks_observed: number;
  ticks_required: number;
  remaining_ms: number;
}

// Work Contract Faucet v0: Contract result
export type WorkContractError =
  | 'on_cooldown'
  | 'already_active'
  | 'invalid_contract'
  | 'insufficient_presence';

export interface WorkContractResultMessage extends BaseMessage {
  type: 'work_contract_result';
  contract_id: string;
  success: boolean;
  credited_gold?: number;
  error?: WorkContractError;
}

// NPC Recognition v0: Server responses
export type NpcRecognitionTier = 'stranger' | 'seen' | 'recognized';

export interface NpcDialogueMessage extends BaseMessage {
  type: 'npc_dialogue';
  npc_id: string;
  place_id: string;
  tier: NpcRecognitionTier;
  line: string;
}

export type NpcDialogueError = 'not_found' | 'not_in_place';

export interface NpcDialogueErrorMessage extends BaseMessage {
  type: 'npc_dialogue_error';
  npc_id: string;
  error: NpcDialogueError;
}

// ============================================================================
// Skills v0 (Utility/Admin) - Server Responses
// ============================================================================

export type SkillRejectionReason =
  | 'cooldown'
  | 'invalid_skill'
  | 'invalid_target'
  | 'target_not_found'
  | 'debug_only';

export interface SkillResultMessage extends BaseMessage {
  type: 'skill_result';
  skill_id: string;
  success: boolean;
  reason?: SkillRejectionReason;
  cooldown_until_ms?: number;
  payload?: Record<string, unknown>;
}

// ============================================================================
// Moderation v1 (Admin-Only) - Server Responses
// ============================================================================

// Report shape for snapshots
export interface ModerationReport {
  case_id: string;
  receipt_hash: string;     // Canonical identifier (player_reported receipt)
  reporter_id: string;
  target_id: string;
  reported_at: string;      // ISO8601
  status: 'open' | 'resolved';
  resolved_by?: string;
  resolved_at?: string;     // ISO8601
  resolution?: ModerationResolution;
  reason?: string;
  resolution_receipt_hash?: string;  // moderation_resolved receipt (if resolved)
}

// Server → Client: List of moderation reports
export interface ModReportsSnapshotMessage extends BaseMessage {
  type: 'mod_reports_snapshot';
  reports: ModerationReport[];
  has_more: boolean;
}

export type ModResolveError = 'not_found' | 'already_resolved' | 'invalid_resolution' | 'not_authorized';

// Server → Client: Resolution result
export interface ModResolveResultMessage extends BaseMessage {
  type: 'mod_resolve_result';
  success: boolean;
  case_id: string;
  error?: ModResolveError;
}

// ============================================================================
// Property Ownership v0 (Server → Client)
// ============================================================================

// Full property state on enter_world.
export interface PropertySnapshotMessage extends BaseMessage {
  type: 'property_snapshot';
  properties: PropertyPublic[];
}

// Single property state (after buy/list/unlist), and zone broadcast of changes.
export interface PropertyStateMessage extends BaseMessage {
  type: 'property_state';
  property: PropertyPublic;
}

// Broadcast when a house changes hands (primary sale or resale).
export interface HouseSoldMessage extends BaseMessage {
  type: 'house_sold';
  property_id: string;
  plot_id: string;
  zone: string;
  buyer_name: string;
  seller_name: string | null; // null = treasury (primary sale)
  price: number;
  sale_count: number;
}

// Result of a buy/list/unlist intent, or an auction open/bid/cancel intent (4a).
export interface PropertyResultMessage extends BaseMessage {
  type: 'property_result';
  action: 'buy_house' | 'list_house' | 'unlist_house' | 'open_house_auction' | 'place_house_bid' | 'cancel_house_auction';
  success: boolean;
  property_id: string;
  reason?: PropertyDenialReason | PropertyAuctionDenialReason;
}

// Ownership ledger for a property.
export interface PropertyLedgerMessage extends BaseMessage {
  type: 'property_ledger';
  property_id: string;
  owner_history: PropertyOwnerHistoryEntry[];
  sale_count: number;
}

// ----------------------------------------------------------------------------
// Property Auctions — server messages.
// `property_auction_state` is ACTIVE as of Step 4a (emitted after open/bid/cancel).
// `scheduled_close` is a display hint, never authoritative — auction truth comes
// only from a settlement receipt.
// ----------------------------------------------------------------------------

// Server → Client: current state of an open auction.
export interface PropertyAuctionStateMessage extends BaseMessage {
  type: 'property_auction_state';
  property_id: string;
  kind: PropertyAuctionKind;
  current_high: number | null;
  high_bidder_name: string | null; // anonymized display only
  min_next: number;
  scheduled_close: number | null;  // display hint (epoch ms), NOT authoritative
}

// Server → Client: broadcast when an auction closes and settles. The live
// world-loop decides when to emit; the settlement receipt is authoritative.
export interface HouseAuctionSettledMessage extends BaseMessage {
  type: 'house_auction_settled';
  property_id: string;
  plot_id: string;
  zone: string;
  winner_name: string | null;  // null = no bids
  seller_name: string | null;  // null = primary (treasury)
  price: number;
  sale_count: number;
}

// ============================================================================
// Chill-Zone Gather v0 (Step 2) — Server → Client
// ============================================================================

export type GatherNodeState = 'available' | 'depleting' | 'depleted';

export interface GatherNodePublic {
  node_id: string;
  zone: string;
  x: number;
  y: number;
  state: GatherNodeState;
  respawn_at_ms: number | null;
}

export type GatherStationKind = 'curation' | 'refinery';

export interface GatherStationPublic {
  station_id: string;
  zone: string;
  x: number;
  y: number;
  // Step 2: curation = delivery point; refinery = refine point. Lets clients render the
  // right marker + action. Older clients ignore the field (additive).
  kind: GatherStationKind;
}

// Lowercase mirror of the gather state-machine reject codes
// (apps/server/src/world/gather.ts RejectCode).
export type GatherRejectReason =
  | 'unknown_zone'
  | 'node_not_found'
  | 'node_not_available'
  | 'out_of_range'
  | 'already_gathering'
  | 'already_refining'
  | 'not_refinable'
  | 'held_slot_full'
  | 'held_slot_empty'
  | 'station_not_found';

export interface GatherSnapshotMessage extends BaseMessage {
  type: 'gather_snapshot';
  nodes: GatherNodePublic[];
  stations: GatherStationPublic[];
}

export interface GatherNodeUpdateMessage extends BaseMessage {
  type: 'gather_node_update';
  node: GatherNodePublic;
}

export interface GatherResultMessage extends BaseMessage {
  type: 'gather_result';
  ok: boolean;
  node_id?: string;
  complete_at_ms?: number;
  reason?: GatherRejectReason;
}

export interface GatherProgressMessage extends BaseMessage {
  type: 'gather_progress';
  node_id: string;
  progress_pct: number;
}

export interface GatherCompletedMessage extends BaseMessage {
  type: 'gather_completed';
  node_id: string;
  item_type: string;
}

export interface DeliverResultMessage extends BaseMessage {
  type: 'deliver_result';
  ok: boolean;
  station_id?: string;
  item_type?: string;
  source_node_id?: string;
  reward?: string;
  /** Step 2: whether the delivered item had been refined (drives reward + UI copy). */
  refined?: boolean;
  reason?: GatherRejectReason;
}

// Chill-Zone Refine (Step 2) — Server → Client. Mirror the gather result/progress/completed trio.
export interface RefineResultMessage extends BaseMessage {
  type: 'refine_result';
  ok: boolean;
  station_id?: string;
  complete_at_ms?: number;
  reason?: GatherRejectReason;
}

export interface RefineProgressMessage extends BaseMessage {
  type: 'refine_progress';
  station_id: string;
  progress_pct: number;
}

export interface RefineCompletedMessage extends BaseMessage {
  type: 'refine_completed';
  station_id: string;
  item_type: string;
}

export type ServerMessage =
  | WelcomeMessage
  | LoginAckMessage
  | WorldStateMessage
  | MoveResultMessage
  | LoopUpdateMessage
  | PlayerMovedMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | ChatBroadcastMessage
  | TemChallengeMessage
  | ErrorMessage
  | DeathNoticeMessage
  | RunestoneResultMessage
  | RunestoneDeniedMessage
  | TemWitnessRequestMessage
  | DropItemResultMessage
  | PickupItemResultMessage
  | InventorySnapshotMessage
  | WorldItemAddedMessage
  | WorldItemRemovedMessage
  | CombatResolvedMessage
  | CombatRejectedMessage
  | ProtectedSlotSetMessage
  | ChronicleSnapshotMessage
  | EvidenceSnapshotMessage
  | PressureMetricsSnapshotMessage
  | PlayerInspectMessage
  | WalletSnapshotMessage
  | TitheResultMessage
  | WorkContractStartedMessage
  | WorkProgressMessage
  | WorkContractResultMessage
  | NpcDialogueMessage
  | NpcDialogueErrorMessage
  | SkillResultMessage
  | ModReportsSnapshotMessage
  | ModResolveResultMessage
  | PropertySnapshotMessage
  | PropertyStateMessage
  | HouseSoldMessage
  | PropertyResultMessage
  | PropertyLedgerMessage
  | PropertyAuctionStateMessage
  | HouseAuctionSettledMessage
  | GatherSnapshotMessage
  | GatherNodeUpdateMessage
  | GatherResultMessage
  | GatherProgressMessage
  | GatherCompletedMessage
  | DeliverResultMessage
  | RefineResultMessage
  | RefineProgressMessage
  | RefineCompletedMessage;

// ============================================================================
// Message Factories
// ============================================================================

export const ServerMessages = {
  welcome: (version: string): WelcomeMessage => ({
    type: 'welcome',
    version,
  }),

  loginAck: (
    player_id: string,
    guest_token: string,
    name: string,
    ok: boolean = true,
    reason?: string,
    options?: { token?: string; expires_at?: number }
  ): LoginAckMessage => ({
    type: 'login_ack',
    ok,
    player_id,
    guest_token,
    name,
    reason,
    ...(options?.token && { token: options.token }),
    ...(options?.expires_at && { expires_at: options.expires_at }),
  }),

  worldState: (
    map: MapName,
    player: PlayerPublic,
    nearby_players: PlayerPublic[],
    builder_preview?: BuilderPreviewWorldFork,
  ): WorldStateMessage => ({
    type: 'world_state',
    map,
    player,
    nearby_players,
    ...(builder_preview ? { builder_preview } : {}),
  }),

  // Chill-Zone Gather v0 (Step 2)
  gatherSnapshot: (nodes: GatherNodePublic[], stations: GatherStationPublic[]): GatherSnapshotMessage => ({
    type: 'gather_snapshot',
    nodes,
    stations,
  }),

  gatherNodeUpdate: (node: GatherNodePublic): GatherNodeUpdateMessage => ({
    type: 'gather_node_update',
    node,
  }),

  gatherResult: (
    ok: boolean,
    node_id?: string,
    complete_at_ms?: number,
    reason?: GatherRejectReason
  ): GatherResultMessage => ({
    type: 'gather_result',
    ok,
    node_id,
    complete_at_ms,
    reason,
  }),

  gatherProgress: (node_id: string, progress_pct: number): GatherProgressMessage => ({
    type: 'gather_progress',
    node_id,
    progress_pct,
  }),

  gatherCompleted: (node_id: string, item_type: string): GatherCompletedMessage => ({
    type: 'gather_completed',
    node_id,
    item_type,
  }),

  deliverResult: (
    ok: boolean,
    station_id?: string,
    item_type?: string,
    source_node_id?: string,
    reason?: GatherRejectReason,
    reward?: string,
    refined?: boolean
  ): DeliverResultMessage => ({
    type: 'deliver_result',
    ok,
    station_id,
    item_type,
    source_node_id,
    reward,
    refined,
    reason,
  }),

  refineResult: (
    ok: boolean,
    station_id?: string,
    complete_at_ms?: number,
    reason?: GatherRejectReason
  ): RefineResultMessage => ({
    type: 'refine_result',
    ok,
    station_id,
    complete_at_ms,
    reason,
  }),

  refineProgress: (station_id: string, progress_pct: number): RefineProgressMessage => ({
    type: 'refine_progress',
    station_id,
    progress_pct,
  }),

  refineCompleted: (station_id: string, item_type: string): RefineCompletedMessage => ({
    type: 'refine_completed',
    station_id,
    item_type,
  }),

  moveResult: (ok: boolean, x: number, y: number, reason: string | null = null, map?: MapName): MoveResultMessage => ({
    type: 'move_result',
    ok,
    x,
    y,
    reason,
    map,
  }),

  loopUpdate: (event: string, loop: PlayLoopProgress): LoopUpdateMessage => ({
    type: 'loop_update',
    event,
    loop,
  }),

  playerMoved: (player_id: string, x: number, y: number): PlayerMovedMessage => ({
    type: 'player_moved',
    player_id,
    x,
    y,
  }),

  playerJoined: (player: PlayerPublic): PlayerJoinedMessage => ({
    type: 'player_joined',
    player,
  }),

  playerLeft: (player_id: string): PlayerLeftMessage => ({
    type: 'player_left',
    player_id,
  }),

  chatBroadcast: (player_id: string, name: string, message: string): ChatBroadcastMessage => ({
    type: 'chat_broadcast',
    player_id,
    name,
    message,
  }),

  temChallenge: (challenge_id: string, timeout_seconds: number): TemChallengeMessage => ({
    type: 'tem_challenge',
    challenge_id,
    message: `Type ${TEM_CHALLENGE_RESPONSE} to confirm you are playing by hand. You have ${timeout_seconds} seconds.`,
    timeout_seconds,
  }),

  deathNotice: (
    respawn_in_ms: number,
    map: MapName,
    spawn: { x: number; y: number },
    reason: string,
    extras?: DeathNoticeExtras
  ): DeathNoticeMessage => ({
    type: 'death_notice',
    ok: true,
    respawn_in_ms,
    map,
    spawn,
    reason,
    ...(extras ?? {}),
  }),

  error: (code: ErrorCode, message: string): ErrorMessage => ({
    type: 'error',
    code,
    message,
  }),

  runestoneResult: (
    table_id: string,
    caster: { id: string; name: string },
    face: Element,
    whisper: string
  ): RunestoneResultMessage => ({
    type: 'runestone_result',
    table_id,
    caster,
    face,
    whisper,
  }),

  runestoneDenied: (reason: RunestoneDenialReason): RunestoneDeniedMessage => ({
    type: 'runestone_denied',
    reason,
  }),

  temWitnessRequest: (
    request_id: string,
    timestamp: string,
    map: MapName,
    target_actor: string,
    prompt: string,
    kind: 'heat_penalty'
  ): TemWitnessRequestMessage => ({
    type: 'tem_witness_request',
    request_id,
    timestamp,
    map,
    target_actor,
    prompt,
    kind,
  }),

  // Phase 2: Item messages
  dropItemResult: (ok: boolean, item_id: string, reason: string | null = null): DropItemResultMessage => ({
    type: 'drop_item_result',
    ok,
    item_id,
    reason,
  }),

  pickupItemResult: (ok: boolean, item_id: string, reason: string | null = null): PickupItemResultMessage => ({
    type: 'pickup_item_result',
    ok,
    item_id,
    reason,
  }),

  inventorySnapshot: (items: ItemInfo[], houseStorage?: ItemInfo[]): InventorySnapshotMessage => ({
    type: 'inventory_snapshot',
    items,
    ...(houseStorage ? { houseStorage } : {}),
  }),

  worldItemAdded: (item_id: string, item_type: string, x: number, y: number): WorldItemAddedMessage => ({
    type: 'world_item_added',
    item_id,
    item_type,
    x,
    y,
  }),

  worldItemRemoved: (item_id: string): WorldItemRemovedMessage => ({
    type: 'world_item_removed',
    item_id,
  }),

  // Phase 3: Combat messages
  combatResolved: (
    attacker_id: string,
    defender_id: string,
    outcome: 'kill',
    map: MapName,
    x: number,
    y: number
  ): CombatResolvedMessage => ({
    type: 'combat_resolved',
    attacker_id,
    defender_id,
    outcome,
    map,
    x,
    y,
  }),

  combatRejected: (reason: CombatRejectionReason): CombatRejectedMessage => ({
    type: 'combat_rejected',
    reason,
  }),

  // Phase 3.2: Protected slots
  protectedSlotSet: (
    player_id: string,
    item_id: string,
    prev_item_id: string | null
  ): ProtectedSlotSetMessage => ({
    type: 'protected_slot_set',
    player_id,
    item_id,
    prev_item_id,
  }),

  // Phase 4: Chronicle
  chronicleSnapshot: (
    player_id: string,
    events: ChronicleEvent[],
    has_more: boolean
  ): ChronicleSnapshotMessage => ({
    type: 'chronicle_snapshot',
    player_id,
    events,
    has_more,
  }),

  // Phase 4.4: Chronicle Evidence
  evidenceSnapshot: (
    status: EvidenceStatus,
    player_id: string,
    opts: {
      chronicle_event_id?: number;
      receipt_hash?: string;
      source_action?: string;
      kind?: string;
      evidence?: EvidenceSnapshotMessage['evidence'];
      error_code?: string;
    }
  ): EvidenceSnapshotMessage => ({
    type: 'evidence_snapshot',
    status,
    player_id,
    ...opts,
  }),

  // Phase 5: Pressure Metrics
  pressureMetricsSnapshot: (
    player_id: string,
    since: string,
    until: string,
    status: PressureMetricsStatus,
    metrics?: PressureMetrics,
    error_code?: 'schema_too_old' | 'no_chronicle'
  ): PressureMetricsSnapshotMessage => ({
    type: 'pressure_metrics_snapshot',
    player_id,
    since,
    until,
    status,
    metrics,
    error_code,
  }),

  // Sovereign Vocations: Player inspect response
  playerInspect: (
    player_id: string,
    name: string,
    vocation: SovereignVocation | null,
    display_vocation: string | null,
    badges: string[],
    mark: string | null,
    error?: 'not_found'
  ): PlayerInspectMessage => ({
    type: 'player_inspect',
    player_id,
    name,
    vocation,
    display_vocation,
    badges,
    mark,
    error,
  }),

  // Treasury Kernel v0
  walletSnapshot: (gold: number): WalletSnapshotMessage => ({
    type: 'wallet_snapshot',
    gold,
  }),

  titheResult: (
    success: boolean,
    new_balance?: number,
    error?: 'invalid_amount' | 'insufficient_gold'
  ): TitheResultMessage => ({
    type: 'tithe_result',
    success,
    new_balance,
    error,
  }),

  // Work Contract Faucet v0
  workContractStarted: (
    contract_id: string,
    contract_type: 'temple_sweep',
    payout_gold: number,
    cooldown_seconds: number,
    min_duration_ms: number
  ): WorkContractStartedMessage => ({
    type: 'work_contract_started',
    contract_id,
    contract_type,
    payout_gold,
    cooldown_seconds,
    min_duration_ms,
  }),

  workProgress: (
    contract_id: string,
    ticks_observed: number,
    ticks_required: number,
    remaining_ms: number
  ): WorkProgressMessage => ({
    type: 'work_progress',
    contract_id,
    ticks_observed,
    ticks_required,
    remaining_ms,
  }),

  workContractResult: (
    contract_id: string,
    success: boolean,
    credited_gold?: number,
    error?: WorkContractError
  ): WorkContractResultMessage => ({
    type: 'work_contract_result',
    contract_id,
    success,
    credited_gold,
    error,
  }),

  // NPC Recognition v0
  npcDialogue: (
    npc_id: string,
    place_id: string,
    tier: NpcRecognitionTier,
    line: string
  ): NpcDialogueMessage => ({
    type: 'npc_dialogue',
    npc_id,
    place_id,
    tier,
    line,
  }),

  npcDialogueError: (
    npc_id: string,
    error: NpcDialogueError
  ): NpcDialogueErrorMessage => ({
    type: 'npc_dialogue_error',
    npc_id,
    error,
  }),

  // Skills v0
  skillResult: (
    skill_id: string,
    success: boolean,
    opts?: {
      reason?: SkillRejectionReason;
      cooldown_until_ms?: number;
      payload?: Record<string, unknown>;
    }
  ): SkillResultMessage => ({
    type: 'skill_result',
    skill_id,
    success,
    ...opts,
  }),

  // Moderation v1
  modReportsSnapshot: (
    reports: ModerationReport[],
    has_more: boolean
  ): ModReportsSnapshotMessage => ({
    type: 'mod_reports_snapshot',
    reports,
    has_more,
  }),

  modResolveResult: (
    case_id: string,
    success: boolean,
    error?: ModResolveError
  ): ModResolveResultMessage => ({
    type: 'mod_resolve_result',
    success,
    case_id,
    error,
  }),

  // Property Ownership v0
  propertySnapshot: (properties: PropertyPublic[]): PropertySnapshotMessage => ({
    type: 'property_snapshot',
    properties,
  }),

  propertyState: (property: PropertyPublic): PropertyStateMessage => ({
    type: 'property_state',
    property,
  }),

  houseSold: (
    property_id: string,
    plot_id: string,
    zone: string,
    buyer_name: string,
    seller_name: string | null,
    price: number,
    sale_count: number
  ): HouseSoldMessage => ({
    type: 'house_sold',
    property_id,
    plot_id,
    zone,
    buyer_name,
    seller_name,
    price,
    sale_count,
  }),

  propertyResult: (
    action: PropertyResultMessage['action'],
    success: boolean,
    property_id: string,
    reason?: PropertyDenialReason | PropertyAuctionDenialReason
  ): PropertyResultMessage => ({
    type: 'property_result',
    action,
    success,
    property_id,
    reason,
  }),

  propertyAuctionState: (
    property_id: string,
    kind: PropertyAuctionKind,
    current_high: number | null,
    high_bidder_name: string | null,
    min_next: number,
    scheduled_close: number | null
  ): PropertyAuctionStateMessage => ({
    type: 'property_auction_state',
    property_id,
    kind,
    current_high,
    high_bidder_name,
    min_next,
    scheduled_close,
  }),

  houseAuctionSettled: (
    property_id: string,
    plot_id: string,
    zone: string,
    winner_name: string | null,
    seller_name: string | null,
    price: number,
    sale_count: number
  ): HouseAuctionSettledMessage => ({
    type: 'house_auction_settled',
    property_id,
    plot_id,
    zone,
    winner_name,
    seller_name,
    price,
    sale_count,
  }),

  propertyLedger: (
    property_id: string,
    owner_history: PropertyOwnerHistoryEntry[],
    sale_count: number
  ): PropertyLedgerMessage => ({
    type: 'property_ledger',
    property_id,
    owner_history,
    sale_count,
  }),
};

// ============================================================================
// Type Guards
// ============================================================================

export function isValidDirection(d: unknown): d is Direction {
  return d === 'north' || d === 'south' || d === 'east' || d === 'west';
}

export function parseClientMessage(data: unknown): ClientMessage | null {
  if (typeof data !== 'object' || data === null) return null;

  const msg = data as Record<string, unknown>;
  if (typeof msg.type !== 'string') return null;

  switch (msg.type) {
    case 'connect':
      return { type: 'connect' };

    case 'login':
      return {
        type: 'login',
        guest_token: typeof msg.guest_token === 'string' ? msg.guest_token : null,
        token: typeof msg.token === 'string' ? msg.token : undefined,
      };

    case 'enter_world':
      return { type: 'enter_world' };

    case 'move_intent':
      if (!isValidDirection(msg.direction)) return null;
      return { type: 'move_intent', direction: msg.direction };

    case 'chat':
      if (typeof msg.message !== 'string') return null;
      return { type: 'chat', message: msg.message };

    case 'tem_response':
      if (typeof msg.response !== 'string') return null;
      return { type: 'tem_response', response: msg.response };

    case 'kill_self':
      return { type: 'kill_self' };

    case 'runestone_cast': {
      if (typeof msg.table_id !== 'string') return null;
      const guess = typeof msg.guess === 'string' && ELEMENTS.includes(msg.guess as Element)
        ? (msg.guess as Element)
        : null;
      return { type: 'runestone_cast', table_id: msg.table_id, guess };
    }

    case 'tem_witness_response': {
      const request_id = typeof msg.request_id === 'string' ? msg.request_id : null;
      const response = msg.response;
      if (!request_id) return null;
      if (response !== 'confirm' && response !== 'deny' && response !== 'uncertain') return null;
      return {
        type: 'tem_witness_response',
        request_id,
        response,
      };
    }

    // Phase 2: Item messages
    case 'drop_item': {
      if (typeof msg.item_id !== 'string') return null;
      return { type: 'drop_item', item_id: msg.item_id };
    }

    case 'pickup_item': {
      if (typeof msg.item_id !== 'string') return null;
      return { type: 'pickup_item', item_id: msg.item_id };
    }

    // Phase 3: Combat messages
    case 'attack_intent': {
      const target =
        typeof msg.target_id === 'string'
          ? msg.target_id
          : typeof msg.target_player_id === 'string'
            ? msg.target_player_id
            : null;
      if (!target) return null;
      return { type: 'attack_intent', target_id: target };
    }

    // Dev-only: Legendary minting
    case 'mint_legendary': {
      const item_type = typeof msg.item_type === 'string' ? msg.item_type : undefined;
      const tier = typeof msg.tier === 'number' && msg.tier >= 1 && msg.tier <= 5 ? msg.tier : undefined;
      return { type: 'mint_legendary', item_type, tier };
    }

    // Phase 3.2: Protected slots
    case 'set_protected_slot': {
      if (typeof msg.item_id !== 'string') return null;
      return { type: 'set_protected_slot', item_id: msg.item_id };
    }

    // Phase 4: Chronicle
    case 'get_chronicle': {
      const player_id = typeof msg.player_id === 'string' ? msg.player_id : undefined;
      const limit = typeof msg.limit === 'number' ? msg.limit : undefined;
      const before = typeof msg.before === 'string' ? msg.before : undefined;
      return { type: 'get_chronicle', player_id, limit, before };
    }

    // Phase 4.4: Chronicle Evidence
    case 'get_evidence': {
      const chronicle_event_id = typeof msg.chronicle_event_id === 'number' ? msg.chronicle_event_id : undefined;
      const receipt_hash = typeof msg.receipt_hash === 'string' ? msg.receipt_hash : undefined;
      const kind = typeof msg.kind === 'string' ? msg.kind : undefined;
      // Require at least one anchor
      if (!chronicle_event_id && !receipt_hash) return null;
      return { type: 'get_evidence', chronicle_event_id, receipt_hash, kind };
    }

    // Phase 5: Pressure Metrics
    case 'get_pressure_metrics': {
      const since = typeof msg.since === 'string' ? msg.since : undefined;
      const until = typeof msg.until === 'string' ? msg.until : undefined;
      return { type: 'get_pressure_metrics', since, until };
    }

    // Sovereign Vocations
    case 'declare_vocation': {
      const vocation = msg.vocation;
      if (typeof vocation !== 'string') return null;
      if (!SOVEREIGN_VOCATIONS.includes(vocation as SovereignVocation)) return null;
      return { type: 'declare_vocation', vocation: vocation as SovereignVocation };
    }

    case 'inspect_player': {
      if (typeof msg.target_player_id !== 'string') return null;
      return { type: 'inspect_player', target_player_id: msg.target_player_id };
    }

    case 'grant_sovereign_prefix': {
      if (typeof msg.target_player_id !== 'string') return null;
      if (typeof msg.grant !== 'boolean') return null;
      return { type: 'grant_sovereign_prefix', target_player_id: msg.target_player_id, grant: msg.grant };
    }

    // Treasury Kernel v0
    case 'inspect_wallet':
      return { type: 'inspect_wallet' };

    case 'pay_tithe': {
      if (typeof msg.amount !== 'number') return null;
      return { type: 'pay_tithe', amount: msg.amount };
    }

    case 'grant_gold': {
      if (typeof msg.target_player_id !== 'string') return null;
      if (typeof msg.amount !== 'number') return null;
      return { type: 'grant_gold', target_player_id: msg.target_player_id, amount: msg.amount };
    }

    // Work Contract Faucet v0
    case 'start_work_contract': {
      if (msg.contract_type !== 'temple_sweep') return null;
      return { type: 'start_work_contract', contract_type: msg.contract_type };
    }

    case 'work_tick': {
      if (typeof msg.contract_id !== 'string') return null;
      return { type: 'work_tick', contract_id: msg.contract_id };
    }

    // NPC Recognition v0
    case 'talk_to_npc': {
      if (typeof msg.npc_id !== 'string') return null;
      return { type: 'talk_to_npc', npc_id: msg.npc_id };
    }

    // Skills v0
    case 'use_skill': {
      if (typeof msg.skill_id !== 'string') return null;
      const target_id = typeof msg.target_id === 'string' ? msg.target_id : undefined;
      return { type: 'use_skill', skill_id: msg.skill_id, target_id };
    }

    // Moderation v1
    case 'get_mod_reports': {
      const rawStatus = msg.status;
      const status =
        rawStatus === undefined ? undefined :
        rawStatus === 'open' ? 'open' :
        rawStatus === 'resolved' ? 'resolved' :
        rawStatus === 'all' ? 'all' :
        null;
      if (status === null) return null;
      const limit = typeof msg.limit === 'number' ? msg.limit : undefined;
      return { type: 'get_mod_reports', status, limit };
    }

    case 'mod_resolve': {
      const case_id = typeof msg.case_id === 'string' ? msg.case_id : undefined;
      const receipt_hash = typeof msg.receipt_hash === 'string' ? msg.receipt_hash : undefined;
      // Require at least one lookup key
      if (!case_id && !receipt_hash) return null;
      const resolution = msg.resolution;
      if (resolution !== 'no_action' && resolution !== 'warning' && resolution !== 'temp_mute') {
        return null;
      }
      const reason = typeof msg.reason === 'string' ? msg.reason : undefined;
      return { type: 'mod_resolve', case_id, receipt_hash, resolution, reason };
    }

    // Property Ownership v0
    case 'buy_house': {
      if (typeof msg.property_id !== 'string') return null;
      return { type: 'buy_house', property_id: msg.property_id };
    }

    case 'list_house': {
      if (typeof msg.property_id !== 'string') return null;
      if (typeof msg.price !== 'number') return null;
      return { type: 'list_house', property_id: msg.property_id, price: msg.price };
    }

    case 'unlist_house': {
      if (typeof msg.property_id !== 'string') return null;
      return { type: 'unlist_house', property_id: msg.property_id };
    }

    case 'get_property_ledger': {
      if (typeof msg.property_id !== 'string') return null;
      return { type: 'get_property_ledger', property_id: msg.property_id };
    }

    case 'open_house_auction': {
      if (typeof msg.property_id !== 'string') return null;
      if (typeof msg.min_bid !== 'number') return null;
      if (typeof msg.min_increment_gold !== 'number') return null;
      if (typeof msg.duration_s !== 'number') return null;
      return {
        type: 'open_house_auction',
        property_id: msg.property_id,
        min_bid: msg.min_bid,
        min_increment_gold: msg.min_increment_gold,
        duration_s: msg.duration_s,
      };
    }

    case 'place_house_bid': {
      if (typeof msg.property_id !== 'string') return null;
      if (typeof msg.amount !== 'number') return null;
      return { type: 'place_house_bid', property_id: msg.property_id, amount: msg.amount };
    }

    case 'cancel_house_auction': {
      if (typeof msg.property_id !== 'string') return null;
      return { type: 'cancel_house_auction', property_id: msg.property_id };
    }

    // Chill-Zone Gather v0 (Step 2)
    case 'gather_intent': {
      if (typeof msg.node_id !== 'string') return null;
      return { type: 'gather_intent', node_id: msg.node_id };
    }

    case 'deliver_intent': {
      if (typeof msg.station_id !== 'string') return null;
      return { type: 'deliver_intent', station_id: msg.station_id };
    }

    case 'refine_intent': {
      if (typeof msg.station_id !== 'string') return null;
      return { type: 'refine_intent', station_id: msg.station_id };
    }

    default:
      return null;
  }
}
