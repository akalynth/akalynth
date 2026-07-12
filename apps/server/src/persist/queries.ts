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
  PlayerHeatRow,
  PlayerAntiCheatEnforcementRow,
  ChronicleEventRow,
  ModerationReportRow,
  PropertyRow,
  AuctionRow,
  WorldEventRow,
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

export function getPlayerByNameLower(
  db: Database.Database,
  nameLower: string
): PlayerRow | null {
  const stmt = db.prepare(`
    SELECT player_id, name, created_at, created_receipt, deleted_at, auth_method, name_lower
    FROM players
    WHERE name_lower = ? AND deleted_at IS NULL
  `);
  return (stmt.get(nameLower) as PlayerRow) ?? null;
}

export function getPlayerCount(db: Database.Database): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM players WHERE deleted_at IS NULL
  `);
  const row = stmt.get() as { count: number };
  return row.count;
}

// ============================================================================
// Origin Act Queries
// ============================================================================

/**
 * Check if a player's origin act has been sealed.
 * Used to gate origin sealing (only one origin per player).
 */
export function hasOriginActSealed(
  db: Database.Database,
  playerId: string
): boolean {
  const stmt = db.prepare(`
    SELECT origin_receipt_id FROM players WHERE player_id = ?
  `);
  const row = stmt.get(playerId) as { origin_receipt_id: string | null } | undefined;
  return !!row?.origin_receipt_id;
}

/**
 * Get a player's origin act details (null if not sealed).
 * Returns the triggering action, not 'origin_act_sealed'.
 */
export function getOriginAct(
  db: Database.Database,
  playerId: string
): { receipt_id: string; action: string; sealed_at: string } | null {
  const stmt = db.prepare(`
    SELECT origin_receipt_id, origin_action, origin_sealed_at
    FROM players
    WHERE player_id = ? AND origin_receipt_id IS NOT NULL
  `);
  const row = stmt.get(playerId) as {
    origin_receipt_id: string;
    origin_action: string;
    origin_sealed_at: string;
  } | undefined;

  if (!row) return null;

  return {
    receipt_id: row.origin_receipt_id,
    action: row.origin_action,
    sealed_at: row.origin_sealed_at,
  };
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

/**
 * Dialogue Contract v1: number of prior talks for (player, npc, tier).
 * This is the durable, replay-reconstructable variation nonce.
 */
export function getNpcTalkCount(
  db: Database.Database,
  playerId: string,
  npcId: string,
  tier: string
): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM npc_talk_events
    WHERE player_id = ? AND npc_id = ? AND tier = ?
  `);
  const row = stmt.get(playerId, npcId, tier) as { count: number };
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
// Property Queries (Property Ownership v0)
// ============================================================================

export function getProperties(db: Database.Database, zone?: string): PropertyRow[] {
  if (zone) {
    return db
      .prepare(`SELECT * FROM properties WHERE zone = ? ORDER BY property_id`)
      .all(zone) as PropertyRow[];
  }
  return db.prepare(`SELECT * FROM properties ORDER BY property_id`).all() as PropertyRow[];
}

export function getProperty(db: Database.Database, propertyId: string): PropertyRow | null {
  return (
    (db.prepare(`SELECT * FROM properties WHERE property_id = ?`).get(propertyId) as PropertyRow) ??
    null
  );
}

export function getPropertyByPlot(
  db: Database.Database,
  zone: string,
  plotId: string
): PropertyRow | null {
  return (
    (db
      .prepare(`SELECT * FROM properties WHERE zone = ? AND plot_id = ?`)
      .get(zone, plotId) as PropertyRow) ?? null
  );
}

export function getPropertiesForOwner(db: Database.Database, playerId: string): PropertyRow[] {
  return db
    .prepare(`SELECT * FROM properties WHERE owner_player_id = ? ORDER BY property_id`)
    .all(playerId) as PropertyRow[];
}

export function getAuction(db: Database.Database, propertyId: string): AuctionRow | null {
  return (
    (db.prepare(`SELECT * FROM property_auctions WHERE property_id = ?`).get(propertyId) as AuctionRow) ??
    null
  );
}

export function getOpenAuctions(db: Database.Database): AuctionRow[] {
  return db
    .prepare(`SELECT * FROM property_auctions WHERE status = 'open' ORDER BY property_id`)
    .all() as AuctionRow[];
}

// ============================================================================
// World Event Queries
// ============================================================================

export function getWorldEvent(db: Database.Database, eventId: string): WorldEventRow | null {
  return (
    (db.prepare(`SELECT * FROM world_events WHERE event_id = ?`).get(eventId) as WorldEventRow) ??
    null
  );
}

export function getWorldEvents(db: Database.Database): WorldEventRow[] {
  return db.prepare(`SELECT * FROM world_events ORDER BY event_id`).all() as WorldEventRow[];
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

// Houses v1.2: all items currently held in houses (item_id -> property_id), for boot hydration.
export function getHouseStorage(db: Database.Database): Array<{ item_id: string; property_id: string }> {
  return db.prepare(`SELECT item_id, property_id FROM house_storage`).all() as Array<{ item_id: string; property_id: string }>;
}

// Guild v1.1: durable treasury total, for boot hydration.
export function getGuildTreasury(db: Database.Database): number {
  const row = db.prepare(`SELECT total FROM guild_treasury WHERE id = 1`).get() as { total: number } | undefined;
  return row?.total ?? 0;
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
// Player Heat Queries (Phase 3.5)
// ============================================================================

/**
 * Get player heat record (null if not tracked).
 * Returns full row for login restoration.
 */
export function getPlayerHeat(
  db: Database.Database,
  playerId: string
): PlayerHeatRow | null {
  const stmt = db.prepare(`
    SELECT player_id, heat, penalty_until_ms, last_tem_ms, updated_at, last_receipt
    FROM player_heat
    WHERE player_id = ?
  `);
  return (stmt.get(playerId) as PlayerHeatRow) ?? null;
}

export function getPlayerAntiCheatEnforcement(
  db: Database.Database,
  playerId: string
): PlayerAntiCheatEnforcementRow | null {
  const stmt = db.prepare(`
    SELECT player_id, warn_count, tem_failed_count, throttle_count, kick_count, throttle_until_ms, updated_at, last_receipt
    FROM player_anticheat_enforcement
    WHERE player_id = ?
  `);
  return (stmt.get(playerId) as PlayerAntiCheatEnforcementRow) ?? null;
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
 * Get canonical world-event Chronicle rows visible to any authenticated
 * observer. This is deliberately world-scoped rather than player-scoped; the
 * causal record still identifies the originating actor and receipt.
 */
export function getSharedWorldEvents(
  db: Database.Database,
  worldId: string,
  limit: number = 50,
): ChronicleEventRow[] {
  const boundLimit = Math.min(Math.max(1, limit), 200);
  const stmt = db.prepare(`
    SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
    FROM chronicle_events
    WHERE kind = 'world_event'
      AND (
        json_extract(details_json, '$.world_id') = ?
        OR json_extract(details_json, '$.causal.world_id') = ?
      )
    ORDER BY timestamp DESC, id DESC
    LIMIT ?
  `);
  return stmt.all(worldId, worldId, boundLimit) as ChronicleEventRow[];
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
