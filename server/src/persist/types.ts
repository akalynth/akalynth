// Akalynth Persistence Layer Types
// Phase 1: Identity, Death, Reputation, World Objects

import type { AuditReceipt } from '../../../shared/types.js';

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

export interface MetaRow {
  key: string;
  value: string;
}

// ============================================================================
// Receipt Taxonomy (Phase 1)
// ============================================================================

// Canonical receipt actions for Phase 1
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
  // Lifecycle
  startup(): ReplayResult;
  checkpoint(): void;
  close(): void;

  // Write (called by audit.onWrite hook)
  materialize(receipt: AuditReceipt, offsetAfterLine?: number): void;

  // Read queries
  getPlayer(player_id: string): PlayerRow | null;
  getReputationScore(player_id: string): number;
  getReputationEvents(player_id: string, limit?: number): ReputationEventRow[];
  getDeathCount(player_id: string): number;
  getLastDeath(player_id: string): DeathRow | null;
  getDeaths(player_id: string, limit?: number): DeathRow[];
  getWorldObjects(zone: string): WorldObjectRow[];
  getWorldObject(object_id: string): WorldObjectRow | null;

  // Meta queries (for debugging/recovery)
  getMeta(key: string): string | null;
  getSchemaVersion(): number;
}
