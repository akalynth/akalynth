// Akalynth Persistence Queries
// Read operations for Phase 1: Players, Reputation, Deaths, World Objects
// ============================================================================
// Player Queries
// ============================================================================
export function getPlayer(db, playerId) {
    const stmt = db.prepare(`
    SELECT player_id, name, created_at, created_receipt, deleted_at
    FROM players
    WHERE player_id = ?
  `);
    return stmt.get(playerId) ?? null;
}
export function getPlayerByName(db, name) {
    const stmt = db.prepare(`
    SELECT player_id, name, created_at, created_receipt, deleted_at
    FROM players
    WHERE name = ? AND deleted_at IS NULL
  `);
    return stmt.get(name) ?? null;
}
export function getPlayerByNameLower(db, nameLower) {
    const stmt = db.prepare(`
    SELECT player_id, name, created_at, created_receipt, deleted_at, auth_method, name_lower
    FROM players
    WHERE name_lower = ? AND deleted_at IS NULL
  `);
    return stmt.get(nameLower) ?? null;
}
export function getPlayerCount(db) {
    const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM players WHERE deleted_at IS NULL
  `);
    const row = stmt.get();
    return row.count;
}
// ============================================================================
// Origin Act Queries
// ============================================================================
/**
 * Check if a player's origin act has been sealed.
 * Used to gate origin sealing (only one origin per player).
 */
export function hasOriginActSealed(db, playerId) {
    const stmt = db.prepare(`
    SELECT origin_receipt_id FROM players WHERE player_id = ?
  `);
    const row = stmt.get(playerId);
    return !!row?.origin_receipt_id;
}
/**
 * Get a player's origin act details (null if not sealed).
 * Returns the triggering action, not 'origin_act_sealed'.
 */
export function getOriginAct(db, playerId) {
    const stmt = db.prepare(`
    SELECT origin_receipt_id, origin_action, origin_sealed_at
    FROM players
    WHERE player_id = ? AND origin_receipt_id IS NOT NULL
  `);
    const row = stmt.get(playerId);
    if (!row)
        return null;
    return {
        receipt_id: row.origin_receipt_id,
        action: row.origin_action,
        sealed_at: row.origin_sealed_at,
    };
}
// ============================================================================
// Reputation Queries
// ============================================================================
export function getReputationScore(db, playerId) {
    const stmt = db.prepare(`
    SELECT COALESCE(SUM(delta), 0) as score
    FROM reputation_events
    WHERE player_id = ?
  `);
    const row = stmt.get(playerId);
    return row.score;
}
export function getReputationEvents(db, playerId, limit) {
    const sql = limit
        ? `SELECT * FROM reputation_events WHERE player_id = ? ORDER BY timestamp DESC LIMIT ?`
        : `SELECT * FROM reputation_events WHERE player_id = ? ORDER BY timestamp DESC`;
    const stmt = db.prepare(sql);
    const rows = limit ? stmt.all(playerId, limit) : stmt.all(playerId);
    return rows;
}
// ============================================================================
// Death Queries
// ============================================================================
export function getDeathCount(db, playerId) {
    const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM deaths WHERE player_id = ?
  `);
    const row = stmt.get(playerId);
    return row.count;
}
/**
 * Dialogue Contract v1: number of prior talks for (player, npc, tier).
 * This is the durable, replay-reconstructable variation nonce.
 */
export function getNpcTalkCount(db, playerId, npcId, tier) {
    const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM npc_talk_events
    WHERE player_id = ? AND npc_id = ? AND tier = ?
  `);
    const row = stmt.get(playerId, npcId, tier);
    return row.count;
}
export function getLastDeath(db, playerId) {
    const stmt = db.prepare(`
    SELECT * FROM deaths
    WHERE player_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `);
    return stmt.get(playerId) ?? null;
}
export function getDeaths(db, playerId, limit) {
    const sql = limit
        ? `SELECT * FROM deaths WHERE player_id = ? ORDER BY timestamp DESC LIMIT ?`
        : `SELECT * FROM deaths WHERE player_id = ? ORDER BY timestamp DESC`;
    const stmt = db.prepare(sql);
    const rows = limit ? stmt.all(playerId, limit) : stmt.all(playerId);
    return rows;
}
export function getTotalDeathCount(db) {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM deaths`);
    const row = stmt.get();
    return row.count;
}
// ============================================================================
// World Object Queries
// ============================================================================
export function getWorldObjects(db, zone) {
    const stmt = db.prepare(`
    SELECT * FROM world_objects
    WHERE zone = ? AND status = 'active'
  `);
    return stmt.all(zone);
}
export function getWorldObject(db, objectId) {
    const stmt = db.prepare(`
    SELECT * FROM world_objects WHERE object_id = ?
  `);
    return stmt.get(objectId) ?? null;
}
export function getActiveObjectCount(db) {
    const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM world_objects WHERE status = 'active'
  `);
    const row = stmt.get();
    return row.count;
}
// ============================================================================
// Property Queries (Property Ownership v0)
// ============================================================================
export function getProperties(db, zone) {
    if (zone) {
        return db
            .prepare(`SELECT * FROM properties WHERE zone = ? ORDER BY property_id`)
            .all(zone);
    }
    return db.prepare(`SELECT * FROM properties ORDER BY property_id`).all();
}
export function getProperty(db, propertyId) {
    return (db.prepare(`SELECT * FROM properties WHERE property_id = ?`).get(propertyId) ??
        null);
}
export function getPropertyByPlot(db, zone, plotId) {
    return (db
        .prepare(`SELECT * FROM properties WHERE zone = ? AND plot_id = ?`)
        .get(zone, plotId) ?? null);
}
export function getPropertiesForOwner(db, playerId) {
    return db
        .prepare(`SELECT * FROM properties WHERE owner_player_id = ? ORDER BY property_id`)
        .all(playerId);
}
export function getAuction(db, propertyId) {
    return (db.prepare(`SELECT * FROM property_auctions WHERE property_id = ?`).get(propertyId) ??
        null);
}
export function getOpenAuctions(db) {
    return db
        .prepare(`SELECT * FROM property_auctions WHERE status = 'open' ORDER BY property_id`)
        .all();
}
// ============================================================================
// World Event Queries
// ============================================================================
export function getWorldEvent(db, eventId) {
    return (db.prepare(`SELECT * FROM world_events WHERE event_id = ?`).get(eventId) ??
        null);
}
export function getWorldEvents(db) {
    return db.prepare(`SELECT * FROM world_events ORDER BY event_id`).all();
}
// ============================================================================
// Meta Queries
// ============================================================================
export function getMeta(db, key) {
    const stmt = db.prepare(`SELECT value FROM _meta WHERE key = ?`);
    const row = stmt.get(key);
    return row?.value ?? null;
}
export function setMeta(db, key, value) {
    const stmt = db.prepare('INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)');
    stmt.run(key, value);
}
export function getSchemaVersion(db) {
    const version = getMeta(db, 'schema_version');
    return version ? parseInt(version, 10) : 0;
}
// ============================================================================
// Item Queries (Phase 2)
// ============================================================================
export function getItem(db, itemId) {
    const stmt = db.prepare(`
    SELECT item_id, item_type, created_at, genesis_receipt, meta_json
    FROM items
    WHERE item_id = ?
  `);
    return stmt.get(itemId) ?? null;
}
export function getItemByGenesisReceipt(db, receiptHash) {
    const stmt = db.prepare(`
    SELECT item_id, item_type, created_at, genesis_receipt, meta_json
    FROM items
    WHERE genesis_receipt = ?
  `);
    return stmt.get(receiptHash) ?? null;
}
export function getItemCount(db) {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM items`);
    const row = stmt.get();
    return row.count;
}
// ============================================================================
// Inventory Queries (Phase 2)
// ============================================================================
export function getInventoryItems(db) {
    const stmt = db.prepare(`SELECT * FROM inventory_items`);
    return stmt.all();
}
// Houses v1.2: all items currently held in houses (item_id -> property_id), for boot hydration.
export function getHouseStorage(db) {
    return db.prepare(`SELECT item_id, property_id FROM house_storage`).all();
}
// Guild v1.1: durable treasury total, for boot hydration.
export function getGuildTreasury(db) {
    const row = db.prepare(`SELECT total FROM guild_treasury WHERE id = 1`).get();
    return row?.total ?? 0;
}
export function getPlayerInventory(db, playerId) {
    const stmt = db.prepare(`
    SELECT * FROM inventory_items WHERE owner_player_id = ?
  `);
    return stmt.all(playerId);
}
export function getInventoryItem(db, itemId) {
    const stmt = db.prepare(`
    SELECT * FROM inventory_items WHERE item_id = ?
  `);
    return stmt.get(itemId) ?? null;
}
export function getActiveWorldItems(db, zone) {
    const stmt = db.prepare(`
    SELECT * FROM world_objects
    WHERE zone = ? AND status = 'active'
  `);
    return stmt.all(zone);
}
// ============================================================================
// Legendary Heat Queries (Phase 3)
// ============================================================================
/**
 * Get all legendary heat rows (for startup reconstruction).
 */
export function getLegendaryHeatRows(db) {
    const stmt = db.prepare(`SELECT item_id, heat, updated_at, last_receipt FROM legendary_heat`);
    return stmt.all();
}
/**
 * Get heat for a single item (0 if not tracked).
 */
export function getLegendaryHeat(db, itemId) {
    const stmt = db.prepare(`SELECT heat FROM legendary_heat WHERE item_id = ?`);
    const row = stmt.get(itemId);
    return row?.heat ?? 0;
}
// ============================================================================
// Player Heat Queries (Phase 3.5)
// ============================================================================
/**
 * Get player heat record (null if not tracked).
 * Returns full row for login restoration.
 */
export function getPlayerHeat(db, playerId) {
    const stmt = db.prepare(`
    SELECT player_id, heat, penalty_until_ms, last_tem_ms, updated_at, last_receipt
    FROM player_heat
    WHERE player_id = ?
  `);
    return stmt.get(playerId) ?? null;
}
export function getPlayerAntiCheatEnforcement(db, playerId) {
    const stmt = db.prepare(`
    SELECT player_id, warn_count, tem_failed_count, throttle_count, kick_count, throttle_until_ms, updated_at, last_receipt
    FROM player_anticheat_enforcement
    WHERE player_id = ?
  `);
    return stmt.get(playerId) ?? null;
}
// ============================================================================
// Protected Slot Queries (Phase 3.2)
// ============================================================================
/**
 * Get all protected slot assignments (for startup reconstruction).
 */
export function getProtectedSlots(db) {
    const stmt = db.prepare(`
    SELECT owner_player_id, item_id, updated_at
    FROM inventory_items
    WHERE slot = 'protected'
  `);
    return stmt.all();
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
export function getChronicleForPlayer(db, playerId, limit = 50, before) {
    const boundLimit = Math.min(Math.max(1, limit), 200); // clamp to 1-200
    if (before) {
        const stmt = db.prepare(`
      SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
      FROM chronicle_events
      WHERE player_id = ? AND timestamp < ?
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    `);
        return stmt.all(playerId, before, boundLimit);
    }
    else {
        const stmt = db.prepare(`
      SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
      FROM chronicle_events
      WHERE player_id = ?
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    `);
        return stmt.all(playerId, boundLimit);
    }
}
/**
 * Get total chronicle event count for a player.
 */
export function getChronicleCount(db, playerId) {
    const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM chronicle_events WHERE player_id = ?
  `);
    const row = stmt.get(playerId);
    return row.count;
}
/**
 * Get all chronicle events (for verification).
 */
export function getAllChronicleEvents(db) {
    const stmt = db.prepare(`
    SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
    FROM chronicle_events
    ORDER BY timestamp DESC, id DESC
  `);
    return stmt.all();
}
/**
 * Get a single chronicle event by ID.
 */
export function getChronicleEventById(db, eventId) {
    const stmt = db.prepare(`
    SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
    FROM chronicle_events
    WHERE id = ?
  `);
    return stmt.get(eventId) ?? null;
}
/**
 * Get a chronicle event by receipt hash and player (for authorization check).
 */
export function getChronicleEventByReceiptHash(db, receiptHash, playerId) {
    const stmt = db.prepare(`
    SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
    FROM chronicle_events
    WHERE receipt_hash = ? AND player_id = ?
    LIMIT 1
  `);
    return stmt.get(receiptHash, playerId) ?? null;
}
// ============================================================================
// Death Row Queries (for Evidence)
// ============================================================================
/**
 * Get death row by receipt hash for evidence reconstruction.
 */
export function getDeathByReceiptHash(db, receiptHash) {
    const stmt = db.prepare(`
    SELECT id, player_id, zone, x, y, timestamp, cause, receipt_hash, witnesses
    FROM deaths
    WHERE receipt_hash = ?
  `);
    return stmt.get(receiptHash) ?? null;
}
/**
 * Get the most recent death for a player at or before a timestamp.
 * Used to find the death that caused an item_lost event.
 */
export function getDeathBeforeTimestamp(db, playerId, beforeOrAt) {
    const stmt = db.prepare(`
    SELECT id, player_id, zone, x, y, timestamp, cause, receipt_hash, witnesses
    FROM deaths
    WHERE player_id = ? AND timestamp <= ?
    ORDER BY timestamp DESC
    LIMIT 1
  `);
    return stmt.get(playerId, beforeOrAt) ?? null;
}
// ============================================================================
// Phase 5: Pressure Metrics Queries (Range-based)
// ============================================================================
/**
 * Get chronicle events for a player within a time range.
 * Optionally filter by kinds.
 */
export function getChronicleRange(db, playerId, since, until, kinds) {
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
        return stmt.all(playerId, since, until, ...kinds);
    }
    else {
        const stmt = db.prepare(`
      SELECT id, player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
      FROM chronicle_events
      WHERE player_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
      ORDER BY timestamp DESC, id DESC
    `);
        return stmt.all(playerId, since, until);
    }
}
/**
 * Get deaths for a player within a time range.
 */
export function getDeathsRange(db, playerId, since, until) {
    const stmt = db.prepare(`
    SELECT id, player_id, zone, x, y, timestamp, cause, receipt_hash, witnesses
    FROM deaths
    WHERE player_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
    ORDER BY timestamp DESC
  `);
    return stmt.all(playerId, since, until);
}
/**
 * Get total heat for all legendary items owned by a player.
 * Returns { total_heat, hottest_item_id, hottest_heat }
 */
export function getPlayerHeatSummary(db, playerId) {
    // Get all items owned by player that have heat
    const stmt = db.prepare(`
    SELECT lh.item_id, lh.heat
    FROM legendary_heat lh
    INNER JOIN inventory_items ii ON lh.item_id = ii.item_id
    WHERE ii.owner_player_id = ?
    ORDER BY lh.heat DESC
  `);
    const rows = stmt.all(playerId);
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
export function getModerationReports(db, status = 'open', limit = 50) {
    const boundLimit = Math.min(Math.max(1, limit), 200);
    if (status === 'all') {
        const stmt = db.prepare(`
      SELECT * FROM moderation_reports
      ORDER BY reported_at DESC
      LIMIT ?
    `);
        return stmt.all(boundLimit);
    }
    const stmt = db.prepare(`
    SELECT * FROM moderation_reports
    WHERE status = ?
    ORDER BY reported_at DESC
    LIMIT ?
  `);
    return stmt.all(status, boundLimit);
}
/**
 * Get a single moderation report by case_id.
 */
export function getModerationReportByCaseId(db, caseId) {
    const stmt = db.prepare(`
    SELECT * FROM moderation_reports WHERE case_id = ?
  `);
    return stmt.get(caseId) ?? null;
}
/**
 * Get a single moderation report by receipt_hash (canonical lookup).
 */
export function getModerationReportByReceiptHash(db, receiptHash) {
    const stmt = db.prepare(`
    SELECT * FROM moderation_reports WHERE receipt_hash = ?
  `);
    return stmt.get(receiptHash) ?? null;
}
/**
 * Get reports for a specific target player.
 */
export function getModerationReportsForTarget(db, targetId, limit = 50) {
    const boundLimit = Math.min(Math.max(1, limit), 200);
    const stmt = db.prepare(`
    SELECT * FROM moderation_reports
    WHERE target_id = ?
    ORDER BY reported_at DESC
    LIMIT ?
  `);
    return stmt.all(targetId, boundLimit);
}
