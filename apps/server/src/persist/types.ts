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

// Phase 4: Chronicle event projection
export type ChronicleEventKind =
  | 'player_created'
  | 'death'
  | 'kill'
  | 'item_acquired'
  | 'item_lost'
  | 'reputation_change'
  | 'legendary_obtained'
  | 'legendary_lost';

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
} as const;

// Alias mapping for existing receipt actions
export const ACTION_ALIASES: Record<string, string> = {
  session_guest_minted: RECEIPT_ACTIONS.PLAYER_CREATED,
  death_penalty_applied: RECEIPT_ACTIONS.REPUTATION_EVENT,
  object_dropped: RECEIPT_ACTIONS.WORLD_OBJECT_SPAWNED,
  object_picked_up: RECEIPT_ACTIONS.WORLD_OBJECT_TRANSFERRED,
  object_decayed: RECEIPT_ACTIONS.WORLD_OBJECT_REMOVED,
};

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

  // Read queries - Protected Slots (Phase 3.2)
  getProtectedSlots(): Array<{ owner_player_id: string; item_id: string; updated_at: string }>;

  // Read queries - Chronicle (Phase 4)
  getChronicleForPlayer(player_id: string, limit?: number, before?: string): ChronicleEventRow[];

  // Read queries - Evidence (Phase 4.4)
  getChronicleEventById(event_id: number): ChronicleEventRow | null;
  getChronicleEventByReceiptHash(receipt_hash: string, player_id: string): ChronicleEventRow | null;
  getDeathByReceiptHash(receipt_hash: string): DeathRow | null;
  getDeathBeforeTimestamp(player_id: string, before_or_at: string): DeathRow | null;

  // Meta queries (for debugging/recovery)
  getMeta(key: string): string | null;
  getSchemaVersion(): number;
}
