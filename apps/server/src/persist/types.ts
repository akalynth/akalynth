// Akalynth Persistence Layer Types
// Phase 2: Identity, Death, Reputation, World Objects, Items, Inventory

import type { AuditReceipt } from '../../../../packages/shared/types.js';
import type Database from 'better-sqlite3';

// ============================================================================
// Configuration
// ============================================================================

export interface PersistenceConfig {
  dbPath: string;
  markerPath: string;
  receiptsPath: string;
  syncMode?: 'wal' | 'journal' | 'off';
  replayMode?: 'strict' | 'lenient';
}

// ============================================================================
// Replay Marker
// ============================================================================

export interface ReplayMarker {
  offset: number; // Byte offset after last processed line
  hash: string; // blake3:<hex> of last processed receipt
}

export interface ReplayResult {
  players_loaded: number;
  reputation_events_loaded: number;
  deaths_loaded: number;
  objects_loaded: number;
  last_receipt_hash: string | null;
  last_offset: number;
  replayed_from_scratch: boolean;
  receipts_processed: number;
}

// ============================================================================
// Row Types (SQLite Results)
// ============================================================================

export interface PlayerRow {
  player_id: string;
  name: string;
  created_at: string; // ISO8601
  created_receipt: string; // receipt_hash that created this player
  deleted_at: string | null; // ISO8601 or null
  // Origin Act: The player's first meaningful action (sealed permanently)
  origin_receipt_id: string | null; // blake3:<hex> of origin_act_sealed receipt
  origin_action: string | null; // The TRIGGER action (e.g., 'combat_resolved'), NOT 'origin_act_sealed'
  origin_sealed_at: string | null; // ISO8601 timestamp
  // Identity v0.1: Auth method and case-insensitive name
  auth_method: string; // 'guest' | 'character' | 'sovereign'
  name_lower: string | null; // LOWER(name) for case-insensitive uniqueness
}

export interface ReputationEventRow {
  id: number;
  player_id: string;
  event_type: string;
  delta: number;
  timestamp: string; // ISO8601
  receipt_hash: string;
  witnesses: string | null; // JSON array or null
  context: string | null; // JSON object or null
}

export interface DeathRow {
  id: number;
  player_id: string;
  zone: string;
  x: number;
  y: number;
  timestamp: string; // ISO8601
  cause: string;
  receipt_hash: string;
  witnesses: string | null; // JSON array or null
}

export type WorldObjectStatus = 'active' | 'picked_up' | 'decayed';

export interface WorldObjectRow {
  object_id: string;
  object_type: string;
  zone: string;
  x: number;
  y: number;
  created_at: string; // ISO8601
  decay_at: string | null; // ISO8601 or null
  status: WorldObjectStatus;
  owner_history: string; // JSON array of {player_id, action, timestamp}
  last_receipt: string; // receipt_hash of last modification
}

// Phase 2: Item metadata (immutable after creation)
export interface ItemRow {
  item_id: string;
  item_type: string;
  created_at: string; // ISO8601
  genesis_receipt: string; // receipt_hash that created this item
  meta_json: string; // JSON object with item-specific metadata
}

// Phase 2: Inventory projection (current state)
export interface InventoryItemRow {
  item_id: string;
  owner_player_id: string;
  slot: string | null;
  updated_at: string; // ISO8601
  last_receipt: string; // receipt_hash of last modification
}

export interface MetaRow {
  key: string;
  value: string;
}

// Phase 3: Legendary heat projection
export interface LegendaryHeatRow {
  item_id: string;
  heat: number;
  updated_at: string; // ISO8601
  last_receipt: string; // receipt_hash of last modification
}

// Phase 3.5: Player heat projection (anti-cheat heat score)
export interface PlayerHeatRow {
  player_id: string;
  heat: number;
  penalty_until_ms: number | null; // epoch ms or null
  last_tem_ms: number | null; // epoch ms or null
  updated_at: string; // ISO8601 (receipt timestamp for ordering)
  last_receipt: string; // receipt_hash of last modification
}

export interface PlayerAntiCheatEnforcementRow {
  player_id: string;
  warn_count: number;
  tem_failed_count: number;
  throttle_count: number;
  kick_count: number;
  throttle_until_ms: number | null; // epoch ms or null
  updated_at: string; // ISO8601
  last_receipt: string; // receipt_hash of last modification
}

// Phase 4: Chronicle event projection
export type ChronicleEventKind =
  | 'player_created'
  | 'death'
  | 'kill'
  | 'item_acquired'
  | 'item_lost'
  | 'reputation_change'
  | 'legendary_obtained'
  | 'legendary_lost'
  | 'origin_sealed'
  | 'property_acquired';

// Phase 4.4 E2: Evidence reference for forensic linkage
// Format: JSON { chronicle_event_id: number, receipt_hash: string }
// Present only for: death, item_lost, legendary_lost
export interface EvidenceRef {
  chronicle_event_id: number;
  receipt_hash: string;
}

export interface ChronicleEventRow {
  id: number;
  player_id: string;
  kind: ChronicleEventKind;
  timestamp: string; // ISO8601
  zone: string | null;
  x: number | null;
  y: number | null;
  entity_id: string | null; // dedup key: item_id, victim_id, etc. (kind-dependent)
  details_json: string; // JSON object with event-specific details
  source_action: string; // original receipt action (for audit traceability)
  receipt_hash: string;
  evidence_ref: string | null; // Phase 4.4 E2: JSON EvidenceRef or null
}

// Property Ownership v0: durable house registry projection.
// owner_player_id NULL = treasury/unowned. owner_history is a JSON string.
export interface PropertyRow {
  property_id: string; // `${zone}:${plot_id}`
  zone: string;
  plot_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  district: string | null;
  owner_player_id: string | null;
  status: string; // PropertyStatus
  listed_price_gold: number | null;
  primary_price_gold: number;
  purchased_at: string | null;
  sale_count: number;
  owner_history: string; // JSON array of {from,to,price,action,timestamp}
  genesis_receipt: string;
  last_receipt: string;
  created_at: string; // ISO8601
}

// Property Auction Lane: durable mirror of the in-memory auction projection.
// One row per property (latest auction). Receipts remain the source of truth.
export interface AuctionRow {
  property_id: string;
  kind: string; // PropertyAuctionKind
  seller_id: string | null;
  min_bid: number;
  min_increment_gold: number;
  current_high: number | null;
  high_bidder_id: string | null;
  status: string; // 'open' | 'settled' | 'cancelled'
  scheduled_close_ms: number | null;
  opened_receipt: string;
  last_receipt: string;
}

// Dialogue Contract v1: append-only NPC talk event (durable variation nonce source)
export interface NpcTalkEventRow {
  id: number;
  player_id: string;
  npc_id: string;
  tier: string;
  timestamp: string; // ISO8601
  receipt_hash: string;
}

// Moderation v1: Report queue projection
export type ModerationReportStatus = 'open' | 'resolved';
export type ModerationResolution = 'no_action' | 'warning' | 'temp_mute';

export interface ModerationReportRow {
  id: number;
  case_id: string;
  reporter_id: string;
  target_id: string;
  reported_at: string; // ISO8601
  receipt_hash: string;
  status: ModerationReportStatus;
  resolved_by: string | null;
  resolved_at: string | null; // ISO8601
  resolution: ModerationResolution | null;
  reason: string | null;
  resolution_receipt_hash: string | null;
}

// ============================================================================
// Account Platform v1 (E1): account/auth row shapes.
//
// PII (email) and security material (password_hash + every *_hash token column)
// live ONLY in the account DB, never in receipts. Token columns store HASHES at
// rest. See docs/account-portal/AKALYNTH_ACCOUNT_PORTAL_PRODUCT_DECISION_V1/.
// ============================================================================

export type AccountStatus =
  | 'registered_unverified'
  | 'email_verified'
  | 'active'
  | 'locked'
  | 'disabled'
  | 'deletion_requested';

export interface AccountRow {
  account_id: string;
  email: string; // PII — DB only, never receipted
  email_lower: string; // normalized for lookup/uniqueness
  password_hash: string; // Argon2id encoded string (salt + params embedded)
  email_verified: number; // 0 | 1 (SQLite boolean)
  status: AccountStatus;
  created_at: string; // ISO8601
  created_receipt: string | null; // account_created receipt hash
  updated_at: string | null; // ISO8601
}

export interface AccountEmailVerificationRow {
  id: string;
  account_id: string;
  token_hash: string; // hash of the verification token; plaintext only in the email
  created_at: string; // ISO8601
  expires_at: string; // ISO8601
  consumed_at: string | null; // ISO8601 or null
}

export interface AccountSessionRow {
  session_id: string;
  account_id: string;
  token_hash: string; // hash of the session token at rest
  client: string | null; // redacted label, e.g. 'web' | 'android'
  created_at: string; // ISO8601
  expires_at: string; // ISO8601
  last_seen_at: string | null; // ISO8601 or null
  revoked_at: string | null; // ISO8601 or null
}

export interface AccountPasswordResetRow {
  id: string;
  account_id: string;
  token_hash: string; // hash of the reset token at rest
  created_at: string; // ISO8601
  expires_at: string; // ISO8601
  consumed_at: string | null; // ISO8601 or null
}

// ============================================================================
// Receipt Taxonomy (Phase 1 + Phase 2)
// ============================================================================

// Canonical receipt actions
export const RECEIPT_ACTIONS = {
  // Player lifecycle
  PLAYER_CREATED: 'player_created',
  PLAYER_RENAMED: 'player_renamed',

  // Death
  DEATH: 'death',

  // Reputation
  REPUTATION_EVENT: 'reputation_event',

  // World objects
  WORLD_OBJECT_SPAWNED: 'world_object_spawned',
  WORLD_OBJECT_TRANSFERRED: 'world_object_transferred',
  WORLD_OBJECT_REMOVED: 'world_object_removed',

  // Phase 2: Items
  ITEM_MINTED: 'item_minted',
  ITEM_ADDED_TO_INVENTORY: 'item_added_to_inventory',
  ITEM_REMOVED_FROM_INVENTORY: 'item_removed_from_inventory',
  ITEM_DROPPED_TO_WORLD: 'item_dropped_to_world',
  ITEM_PICKED_UP_FROM_WORLD: 'item_picked_up_from_world',

  // Phase 3: Legendary heat
  LEGENDARY_HEAT_CHANGED: 'legendary_heat_changed',

  // Phase 3.2: Protected slots
  INVENTORY_SLOT_CHANGED: 'inventory_slot_changed',

  // Phase 3.5: Player heat
  PLAYER_HEAT_CHANGED: 'heat_changed',

  // Phase 3.5: Player heat (PR2)
  HEAT_PENALTY_APPLIED: 'heat_penalty_applied',
  HEAT_TEM_ESCALATION: 'heat_tem_escalation',
  TEM_CHALLENGE_FAILED: 'tem_challenge_failed',
  TEM_CHALLENGE_PASSED: 'tem_challenge_passed',
  THROTTLE: 'throttle',
  KICK: 'kick',
  WARN_ISSUED: 'warn_issued',

  // Origin Act: Player's first meaningful action
  ORIGIN_ACT_SEALED: 'origin_act_sealed',

  // Identity v0.1: Named character creation and token issuance
  CHARACTER_CREATE: 'character_create',
  AUTH_TOKEN_ISSUE: 'auth_token_issue',

  // Dialogue Contract v1: durable NPC talk counter (seeds dialogue variation)
  NPC_TALKED: 'npc_talked',

  // Property Ownership v0: house registry
  PROPERTY_CREATED: 'property_created',
  PROPERTY_LISTED: 'property_listed',
  PROPERTY_UNLISTED: 'property_unlisted',
  PROPERTY_PURCHASED: 'property_purchased',
  PROPERTY_TRANSFERRED: 'property_transferred',

  // Property Auction Lane: durable auction projection
  PROPERTY_AUCTION_OPENED: 'property_auction_opened',
  PROPERTY_BID: 'property_bid',
  PROPERTY_BID_REFUNDED: 'property_bid_refunded',
  PROPERTY_AUCTION_SETTLED: 'property_auction_settled',
  PROPERTY_AUCTION_CANCELLED: 'property_auction_cancelled',

  // Account Platform v1 (E1): privacy-bounded account lifecycle. Receipts for
  // these events carry ONLY event type + opaque account_id + timestamp/sequence
  // + redacted metadata — NEVER email, password, or any verification/reset/
  // session token (plaintext or hash). See docs/account-portal/ +
  // RECEIPT_PRIVACY_BOUNDARY.md. Account rows themselves are written directly by
  // the account API (E2), not materialized from these receipts.
  ACCOUNT_CREATED: 'account_created',
  ACCOUNT_EMAIL_VERIFICATION_REQUESTED: 'account_email_verification_requested',
  ACCOUNT_EMAIL_VERIFIED: 'account_email_verified',
  ACCOUNT_LOGIN_SUCCEEDED: 'account_login_succeeded',
  ACCOUNT_LOGIN_FAILED: 'account_login_failed',
  ACCOUNT_PASSWORD_RESET_REQUESTED: 'account_password_reset_requested',
  ACCOUNT_PASSWORD_RESET_COMPLETED: 'account_password_reset_completed',
  ACCOUNT_SESSION_ISSUED: 'account_session_issued',
  ACCOUNT_SESSION_REVOKED: 'account_session_revoked',
} as const;

// Alias mapping for existing receipt actions
export const ACTION_ALIASES: Record<string, string> = {
  session_guest_minted: RECEIPT_ACTIONS.PLAYER_CREATED,
  // Legacy: old WS mint receipts used 'login' - treat as player_created for replay
  login: RECEIPT_ACTIONS.PLAYER_CREATED,
  death_penalty_applied: RECEIPT_ACTIONS.REPUTATION_EVENT,
  object_dropped: RECEIPT_ACTIONS.WORLD_OBJECT_SPAWNED,
  object_picked_up: RECEIPT_ACTIONS.WORLD_OBJECT_TRANSFERRED,
  object_decayed: RECEIPT_ACTIONS.WORLD_OBJECT_REMOVED,
};

// ============================================================================
// Identity v0.1 Receipt Types
// ============================================================================

/**
 * character_create receipt result values.
 * All outcomes are recorded for deterministic replay.
 */
export type CharacterCreateResult =
  | 'ok'           // Name allocated successfully
  | 'name_taken'   // Name already in use (case-insensitive)
  | 'invalid_name' // Name failed validation (length, characters, reserved)
  | 'rate_limited' // Too many creation attempts
  | 'banned';      // Actor is banned (deferred in v0.1)

/**
 * character_create receipt inputs.
 * Contains all data needed for deterministic replay.
 */
export interface CharacterCreateInputs {
  player_id: string;   // Newly generated player ID (p_...)
  name: string;        // Display name
  name_lower: string;  // Lowercase for uniqueness check
}

/**
 * auth_token_issue receipt inputs.
 * Audit-only: no DB mutation, proves token issuance.
 */
export interface AuthTokenIssueInputs {
  token_id: string;    // blake3:<hex> of token
  player_id: string;   // Player ID token is bound to
  issued_at: number;   // Epoch ms
  expires_at: number;  // Epoch ms
  nonce: string;       // Determinism binding (captures RNG/time at issuance)
  trigger: 'character_create' | 'token_refresh' | 'login';
}

// ============================================================================
// Persistence Layer Interface
// ============================================================================

export interface PersistenceLayer {
  // Direct DB access (for metrics computation)
  readonly db: Database.Database;

  // Lifecycle
  startup(): ReplayResult;
  checkpoint(): void;
  close(): void;

  // Write (called by audit.onWrite hook)
  materialize(receipt: AuditReceipt, offsetAfterLine?: number): void;

  // Read queries - Players
  getPlayer(player_id: string): PlayerRow | null;
  getPlayerByNameLower(name_lower: string): PlayerRow | null;
  getReputationScore(player_id: string): number;
  getReputationEvents(player_id: string, limit?: number): ReputationEventRow[];
  getDeathCount(player_id: string): number;
  getLastDeath(player_id: string): DeathRow | null;
  getDeaths(player_id: string, limit?: number): DeathRow[];

  // Read queries - World Objects
  getWorldObjects(zone: string): WorldObjectRow[];
  getWorldObject(object_id: string): WorldObjectRow | null;

  // Read queries - Items (Phase 2)
  getItem(item_id: string): ItemRow | null;
  getItemByGenesisReceipt(receipt_hash: string): ItemRow | null;

  // Read queries - Inventory (Phase 2)
  getInventoryItems(): InventoryItemRow[];
  getPlayerInventory(player_id: string): InventoryItemRow[];
  getInventoryItem(item_id: string): InventoryItemRow | null;
  getActiveWorldItems(zone: string): WorldObjectRow[];

  // Read queries - Legendary Heat (Phase 3)
  getLegendaryHeatRows(): LegendaryHeatRow[];
  getLegendaryHeat(item_id: string): number;

  // Read queries - Player Heat (Phase 3.5)
  getPlayerHeat(player_id: string): PlayerHeatRow | null;
  getPlayerAntiCheatEnforcement(player_id: string): PlayerAntiCheatEnforcementRow | null;

  // Read queries - NPC dialogue (Dialogue Contract v1)
  // Returns how many times the player has already talked to this NPC at this
  // tier; used as the deterministic, durable variation nonce.
  getNpcTalkCount(player_id: string, npc_id: string, tier: string): number;

  // Read queries - Protected Slots (Phase 3.2)
  getProtectedSlots(): Array<{ owner_player_id: string; item_id: string; updated_at: string }>;

  // Read queries - Property Ownership v0
  getProperties(zone?: string): PropertyRow[];
  getProperty(property_id: string): PropertyRow | null;
  getPropertyByPlot(zone: string, plot_id: string): PropertyRow | null;
  getPropertiesForOwner(player_id: string): PropertyRow[];

  // Read queries - Property Auction Lane (durable auction projection)
  getAuction(property_id: string): AuctionRow | null;
  getOpenAuctions(): AuctionRow[];

  // Read queries - Chronicle (Phase 4)
  getChronicleForPlayer(player_id: string, limit?: number, before?: string): ChronicleEventRow[];

  // Read queries - Evidence (Phase 4.4)
  getChronicleEventById(event_id: number): ChronicleEventRow | null;
  getChronicleEventByReceiptHash(receipt_hash: string, player_id: string): ChronicleEventRow | null;
  getDeathByReceiptHash(receipt_hash: string): DeathRow | null;
  getDeathBeforeTimestamp(player_id: string, before_or_at: string): DeathRow | null;

  // Read queries - Moderation (v1)
  getModerationReports(status?: 'open' | 'resolved' | 'all', limit?: number): ModerationReportRow[];
  getModerationReportByCaseId(case_id: string): ModerationReportRow | null;
  getModerationReportByReceiptHash(receipt_hash: string): ModerationReportRow | null;

  // Meta queries (for debugging/recovery)
  getMeta(key: string): string | null;
  getSchemaVersion(): number;
}
