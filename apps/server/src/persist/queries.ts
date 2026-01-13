// Akalynth Persistence Queries
// Read operations for Phase 1: Players, Reputation, Deaths, World Objects

import type Database from 'better-sqlite3';
import type {
  PlayerRow,
  ReputationEventRow,
  DeathRow,
  WorldObjectRow,
  ItemRow,
  InventoryItemRow,
  LegendaryHeatRow,
  ChronicleEventRow,
  ModerationReportRow,
} from './types.js';

// ============================================================================
// Player Queries
// ============================================================================

export function getPlayer(
  db: Database.Database,
  playerId: string
): PlayerRow | null {
  const stmt = db.prepare(`
    SELECT player_id, name, created_at, created_receipt, deleted_at
    FROM players
    WHERE player_id = ?
  `);
  return (stmt.get(playerId) as PlayerRow) ?? null;
}

export function getPlayerByName(
  db: Database.Database,
  name: string
): PlayerRow | null {
  const stmt = db.prepare(`
    SELECT player_id, name, created_at, created_receipt, deleted_at
    FROM players
    WHERE name = ? AND deleted_at IS NULL
  `);
  return (stmt.get(name) as PlayerRow) ?? null;
}

export function getPlayerCount(db: Database.Database): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM players WHERE deleted_at IS NULL
  `);
  const row = stmt.get() as { count: number };
  return row.count;
}

// ============================================================================
// Reputation Queries
// ============================================================================

export function getReputationScore(
  db: Database.Database,
  playerId: string
): number {
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(delta), 0) as score
    FROM reputation_events
    WHERE player_id = ?
  `);
  const row = stmt.get(playerId) as { score: number };
  return row.score;
}

export function getReputationEvents(
  db: Database.Database,
  playerId: string,
  limit?: number
): ReputationEventRow[] {
  const sql = limit
    ? `SELECT * FROM reputation_events WHERE player_id = ? ORDER BY timestamp DESC LIMIT ?`
    : `SELECT * FROM reputation_events WHERE player_id = ? ORDER BY timestamp DESC`;

  const stmt = db.prepare(sql);
  const rows = limit ? stmt.all(playerId, limit) : stmt.all(playerId);
  return rows as ReputationEventRow[];
}

// ============================================================================
// Death Queries
// ============================================================================

export function getDeathCount(
  db: Database.Database,
  playerId: string
): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM deaths WHERE player_id = ?
  `);
  const row = stmt.get(playerId) as { count: number };
  return row.count;
}

export function getLastDeath(
  db: Database.Database,
  playerId: string
): DeathRow | null {
  const stmt = db.prepare(`
    SELECT * FROM deaths
    WHERE player_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  return (stmt.get(playerId) as DeathRow) ?? null;
}

export function getDeaths(
  db: Database.Database,
  playerId: string,
  limit?: number
): DeathRow[] {
  const sql = limit
    ? `SELECT * FROM deaths WHERE player_id = ? ORDER BY timestamp DESC LIMIT ?`
    : `SELECT * FROM deaths WHERE player_id = ? ORDER BY timestamp DESC`;

  const stmt = db.prepare(sql);
  const rows = limit ? stmt.all(playerId, limit) : stmt.all(playerId);
  return rows as DeathRow[];
}

export function getTotalDeathCount(db: Database.Database): number {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM deaths`);
  const row = stmt.get() as { count: number };
  return row.count;
}

// ============================================================================
// World Object Queries
// ============================================================================

export function getWorldObjects(
  db: Database.Database,
  zone: string
): WorldObjectRow[] {
  const stmt = db.prepare(`
    SELECT * FROM world_objects
    WHERE zone = ? AND status = 'active'
  `);
  return stmt.all(zone) as WorldObjectRow[];
}

export function getWorldObject(
  db: Database.Database,
  objectId: string
): WorldObjectRow | null {
  const stmt = db.prepare(`
    SELECT * FROM world_objects WHERE object_id = ?
  `);
  return (stmt.get(objectId) as WorldObjectRow) ?? null;
}

export function getActiveObjectCount(db: Database.Database): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM world_objects WHERE status = 'active'
  `);
  const row = stmt.get() as { count: number };
  return row.count;
}

// ============================================================================
// Meta Queries
// ============================================================================

export function getMeta(
  db: Database.Database,
  key: string
): string | null {
  const stmt = db.prepare(`SELECT value FROM _meta WHERE key = ?`);
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(
  db: Database.Database,
  key: string,
  value: string
): void {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  stmt.run(key, value);
}

export function getSchemaVersion(db: Database.Database): number {
  const version = getMeta(db, 'schema_version');
  return version ? parseInt(version, 10) : 0;
}

// ============================================================================
// Item Queries (Phase 2)
// ============================================================================

export function getItem(
  db: Database.Database,
  itemId: string
): ItemRow | null {
  const stmt = db.prepare(`
    SELECT item_id, item_type, created_at, genesis_receipt, meta_json
    FROM items
    WHERE item_id = ?
  `);
  return (stmt.get(itemId) as ItemRow) ?? null;
}

export function getItemByGenesisReceipt(
  db: Database.Database,
  receiptHash: string
): ItemRow | null {
  const stmt = db.prepare(`
    SELECT item_id, item_type, created_at, genesis_receipt, meta_json
    FROM items
    WHERE genesis_receipt = ?
  `);
  return (stmt.get(receiptHash) as ItemRow) ?? null;
}

export function getItemCount(db: Database.Database): number {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM items`);
  const row = stmt.get() as { count: number };
  return row.count;
}

// ============================================================================
// Inventory Queries (Phase 2)
// ============================================================================

export function getInventoryItems(db: Database.Database): InventoryItemRow[] {
  const stmt = db.prepare(`SELECT * FROM inventory_items`);
  return stmt.all() as InventoryItemRow[];
}

export function getPlayerInventory(
  db: Database.Database,
  playerId: string
): InventoryItemRow[] {
  const stmt = db.prepare(`
    SELECT * FROM inventory_items WHERE owner_player_id = ?
  `);
  return stmt.all(playerId) as InventoryItemRow[];
}

export function getInventoryItem(
  db: Database.Database,
  itemId: string
): InventoryItemRow | null {
  const stmt = db.prepare(`
    SELECT * FROM inventory_items WHERE item_id = ?
  `);
  return (stmt.get(itemId) as InventoryItemRow) ?? null;
}

export function getActiveWorldItems(
  db: Database.Database,
  zone: string
): WorldObjectRow[] {
  const stmt = db.prepare(`
    SELECT * FROM world_objects
    WHERE zone = ? AND status = 'active'
  `);
  return stmt.all(zone) as WorldObjectRow[];
}

// ============================================================================
// Legendary Heat Queries (Phase 3)
// ============================================================================

/**
 * Get all legendary heat rows (for startup reconstruction).
 */
export function getLegendaryHeatRows(db: Database.Database): LegendaryHeatRow[] {
  const stmt = db.prepare(`SELECT item_id, heat, updated_at, last_receipt FROM legendary_heat`);
  return stmt.all() as LegendaryHeatRow[];
}

/**
 * Get heat for a single item (0 if not tracked).
 */
export function getLegendaryHeat(db: Database.Database, itemId: string): number {
  const stmt = db.prepare(`SELECT heat FROM legendary_heat WHERE item_id = ?`);
  const row = stmt.get(itemId) as { heat: number } | undefined;
  return row?.heat ?? 0;
}

// ============================================================================
// Protected Slot Queries (Phase 3.2)
// ============================================================================

/**
 * Get all protected slot assignments (for startup reconstruction).
 */
export function getProtectedSlots(
  db: Database.Database
): Array<{ owner_player_id: string; item_id: string; updated_at: string }> {
  const stmt = db.prepare(`
    SELECT owner_player_id, item_id, updated_at
    FROM inventory_items
    WHERE slot = 'protected'
  `);
  return stmt.all() as Array<{ owner_player_id: string; item_id: string; updated_at: string }>;
}

// ============================================================================
// Chronicle Queries (Phase 4)
// ============================================================================

/**
 * Get chronicle events for a player, ordered by timestamp descending.
 * Uses (timestamp DESC, id DESC) for stable pagination when timestamps tie.
 *
 * @param playerId - player to get chronicle for
 * @param limit - max number of events (default 50)
 * @param before - pagination cursor (ISO8601 timestamp, exclusive)
 */
export function getChronicleForPlayer(
  db: Database.Database,
  playerId: string,
  limit: number = 50,
  before?: string
): ChronicleEventRow[] {
  const boundLimit = Math.min(Math.max(1, limit), 200); // clamp to 1-200

  if (before) {
    const stmt = db.prepare(`
      SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
      FROM chronicle_events
      WHERE player_id = ? AND timestamp < ?
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    `);
    return stmt.all(playerId, before, boundLimit) as ChronicleEventRow[];
  } else {
    const stmt = db.prepare(`
      SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
      FROM chronicle_events
      WHERE player_id = ?
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    `);
    return stmt.all(playerId, boundLimit) as ChronicleEventRow[];
  }
}

/**
 * Get total chronicle event count for a player.
 */
export function getChronicleCount(
  db: Database.Database,
  playerId: string
): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM chronicle_events WHERE player_id = ?
  `);
  const row = stmt.get(playerId) as { count: number };
  return row.count;
}

/**
 * Get all chronicle events (for verification).
 */
export function getAllChronicleEvents(db: Database.Database): ChronicleEventRow[] {
  const stmt = db.prepare(`
    SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
    FROM chronicle_events
    ORDER BY timestamp DESC, id DESC
  `);
  return stmt.all() as ChronicleEventRow[];
}

/**
 * Get a single chronicle event by ID.
 */
export function getChronicleEventById(
  db: Database.Database,
  eventId: number
): ChronicleEventRow | null {
  const stmt = db.prepare(`
    SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
    FROM chronicle_events
    WHERE id = ?
  `);
  return (stmt.get(eventId) as ChronicleEventRow) ?? null;
}

/**
 * Get a chronicle event by receipt hash and player (for authorization check).
 */
export function getChronicleEventByReceiptHash(
  db: Database.Database,
  receiptHash: string,
  playerId: string
): ChronicleEventRow | null {
  const stmt = db.prepare(`
    SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
    FROM chronicle_events
    WHERE receipt_hash = ? AND player_id = ?
    LIMIT 1
  `);
  return (stmt.get(receiptHash, playerId) as ChronicleEventRow) ?? null;
}

// ============================================================================
// Death Row Queries (for Evidence)
// ============================================================================

/**
 * Get death row by receipt hash for evidence reconstruction.
 */
export function getDeathByReceiptHash(
  db: Database.Database,
  receiptHash: string
): DeathRow | null {
  const stmt = db.prepare(`
    SELECT id, player_id, zone, x, y, timestamp, cause, receipt_hash, witnesses
    FROM deaths
    WHERE receipt_hash = ?
  `);
  return (stmt.get(receiptHash) as DeathRow) ?? null;
}

/**
 * Get the most recent death for a player at or before a timestamp.
 * Used to find the death that caused an item_lost event.
 */
export function getDeathBeforeTimestamp(
  db: Database.Database,
  playerId: string,
  beforeOrAt: string
): DeathRow | null {
  const stmt = db.prepare(`
    SELECT id, player_id, zone, x, y, timestamp, cause, receipt_hash, witnesses
    FROM deaths
    WHERE player_id = ? AND timestamp <= ?
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  return (stmt.get(playerId, beforeOrAt) as DeathRow) ?? null;
}

// ============================================================================
// Phase 5: Pressure Metrics Queries (Range-based)
// ============================================================================

/**
 * Get chronicle events for a player within a time range.
 * Optionally filter by kinds.
 */
export function getChronicleRange(
  db: Database.Database,
  playerId: string,
  since: string,
  until: string,
  kinds?: string[]
): ChronicleEventRow[] {
  if (kinds && kinds.length > 0) {
    const placeholders = kinds.map(() => '?').join(',');
    const stmt = db.prepare(`
      SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
      FROM chronicle_events
      WHERE player_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
        AND kind IN (${placeholders})
      ORDER BY timestamp DESC, id DESC
    `);
    return stmt.all(playerId, since, until, ...kinds) as ChronicleEventRow[];
  } else {
    const stmt = db.prepare(`
      SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
      FROM chronicle_events
      WHERE player_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
      ORDER BY timestamp DESC, id DESC
    `);
    return stmt.all(playerId, since, until) as ChronicleEventRow[];
  }
}

/**
 * Get deaths for a player within a time range.
 */
export function getDeathsRange(
  db: Database.Database,
  playerId: string,
  since: string,
  until: string
): DeathRow[] {
  const stmt = db.prepare(`
    SELECT id, player_id, zone, x, y, timestamp, cause, receipt_hash, witnesses
    FROM deaths
    WHERE player_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
    ORDER BY timestamp DESC
  `);
  return stmt.all(playerId, since, until) as DeathRow[];
}

/**
 * Get total heat for all legendary items owned by a player.
 * Returns { total_heat, hottest_item_id, hottest_heat }
 */
export function getPlayerHeatSummary(
  db: Database.Database,
  playerId: string
): { total_heat: number; hottest_item_id: string | null; hottest_heat: number } {
  // Get all items owned by player that have heat
  const stmt = db.prepare(`
    SELECT lh.item_id, lh.heat
    FROM legendary_heat lh
    INNER JOIN inventory_items ii ON lh.item_id = ii.item_id
    WHERE ii.owner_player_id = ?
    ORDER BY lh.heat DESC
  `);
  const rows = stmt.all(playerId) as Array<{ item_id: string; heat: number }>;

  if (rows.length === 0) {
    return { total_heat: 0, hottest_item_id: null, hottest_heat: 0 };
  }

  const total_heat = rows.reduce((sum, r) => sum + r.heat, 0);
  return {
    total_heat,
    hottest_item_id: rows[0].item_id,
    hottest_heat: rows[0].heat,
  };
}

// ============================================================================
// Moderation Queries (v1)
// ============================================================================

/**
 * Get moderation reports by status.
 * @param status - 'open' | 'resolved' | 'all' (default 'open')
 * @param limit - max number of reports (default 50)
 */
export function getModerationReports(
  db: Database.Database,
  status: 'open' | 'resolved' | 'all' = 'open',
  limit: number = 50
): ModerationReportRow[] {
  const boundLimit = Math.min(Math.max(1, limit), 200);

  if (status === 'all') {
    const stmt = db.prepare(`
      SELECT * FROM moderation_reports
      ORDER BY reported_at DESC
      LIMIT ?
    `);
    return stmt.all(boundLimit) as ModerationReportRow[];
  }

  const stmt = db.prepare(`
    SELECT * FROM moderation_reports
    WHERE status = ?
    ORDER BY reported_at DESC
    LIMIT ?
  `);
  return stmt.all(status, boundLimit) as ModerationReportRow[];
}

/**
 * Get a single moderation report by case_id.
 */
export function getModerationReportByCaseId(
  db: Database.Database,
  caseId: string
): ModerationReportRow | null {
  const stmt = db.prepare(`
    SELECT * FROM moderation_reports WHERE case_id = ?
  `);
  return (stmt.get(caseId) as ModerationReportRow) ?? null;
}

/**
 * Get a single moderation report by receipt_hash (canonical lookup).
 */
export function getModerationReportByReceiptHash(
  db: Database.Database,
  receiptHash: string
): ModerationReportRow | null {
  const stmt = db.prepare(`
    SELECT * FROM moderation_reports WHERE receipt_hash = ?
  `);
  return (stmt.get(receiptHash) as ModerationReportRow) ?? null;
}

/**
 * Get reports for a specific target player.
 */
export function getModerationReportsForTarget(
  db: Database.Database,
  targetId: string,
  limit: number = 50
): ModerationReportRow[] {
  const boundLimit = Math.min(Math.max(1, limit), 200);
  const stmt = db.prepare(`
    SELECT * FROM moderation_reports
    WHERE target_id = ?
    ORDER BY reported_at DESC
    LIMIT ?
  `);
  return stmt.all(targetId, boundLimit) as ModerationReportRow[];
}
