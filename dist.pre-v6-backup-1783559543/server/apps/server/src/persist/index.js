// Akalynth Persistence Layer
// Phase 1: Identity, Death, Reputation, World Objects
//
// Storage strategy: SQLite as query layer, JSONL receipts as canonical source of truth.
// Invariants:
//   1. Receipts are canon: if SQLite diverges, receipts win
//   2. Replay is idempotent: running replay twice yields identical state
//   3. Durable write ordering: fsync receipts BEFORE materializing to SQLite
//   4. Canonical hash: BLAKE3(canonicalJson(receipt)) with no newline
//   5. No silent deletions: soft delete only (status/deleted_at fields)
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { initSchema } from './schema.js';
import { replayReceipts } from './replay.js';
import { materialize as materializeReceipt } from './materializers.js';
import * as queries from './queries.js';
// ============================================================================
// Factory
// ============================================================================
export function createPersistenceLayer(config) {
    // Ensure data directory exists
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    // Open SQLite database
    const db = new Database(config.dbPath);
    // Initialize schema (migrations, pragmas)
    initSchema(db);
    return {
        // Direct DB access (for metrics computation)
        db,
        startup() {
            return replayReceipts({
                db,
                receiptsPath: config.receiptsPath,
                markerPath: config.markerPath,
                mode: config.replayMode ?? 'strict',
            });
        },
        materialize(receipt, offsetAfterLine) {
            materializeReceipt(db, receipt, offsetAfterLine);
        },
        checkpoint() {
            db.pragma('wal_checkpoint(TRUNCATE)');
        },
        close() {
            db.close();
        },
        // Player queries
        getPlayer(playerId) {
            return queries.getPlayer(db, playerId);
        },
        getPlayerByNameLower(nameLower) {
            return queries.getPlayerByNameLower(db, nameLower);
        },
        // Reputation queries
        getReputationScore(playerId) {
            return queries.getReputationScore(db, playerId);
        },
        getReputationEvents(playerId, limit) {
            return queries.getReputationEvents(db, playerId, limit);
        },
        // Death queries
        getDeathCount(playerId) {
            return queries.getDeathCount(db, playerId);
        },
        getLastDeath(playerId) {
            return queries.getLastDeath(db, playerId);
        },
        getDeaths(playerId, limit) {
            return queries.getDeaths(db, playerId, limit);
        },
        // World object queries
        getWorldObjects(zone) {
            return queries.getWorldObjects(db, zone);
        },
        getWorldObject(objectId) {
            return queries.getWorldObject(db, objectId);
        },
        // Item queries (Phase 2)
        getItem(itemId) {
            return queries.getItem(db, itemId);
        },
        getItemByGenesisReceipt(receiptHash) {
            return queries.getItemByGenesisReceipt(db, receiptHash);
        },
        // Inventory queries (Phase 2)
        getInventoryItems() {
            return queries.getInventoryItems(db);
        },
        getHouseStorage() {
            return queries.getHouseStorage(db);
        },
        getGuildTreasury() {
            return queries.getGuildTreasury(db);
        },
        getPlayerInventory(playerId) {
            return queries.getPlayerInventory(db, playerId);
        },
        getInventoryItem(itemId) {
            return queries.getInventoryItem(db, itemId);
        },
        getActiveWorldItems(zone) {
            return queries.getActiveWorldItems(db, zone);
        },
        // Legendary heat queries (Phase 3)
        getLegendaryHeatRows() {
            return queries.getLegendaryHeatRows(db);
        },
        getLegendaryHeat(itemId) {
            return queries.getLegendaryHeat(db, itemId);
        },
        getPlayerHeat(playerId) {
            return queries.getPlayerHeat(db, playerId);
        },
        getPlayerAntiCheatEnforcement(playerId) {
            return queries.getPlayerAntiCheatEnforcement(db, playerId);
        },
        // NPC dialogue (Dialogue Contract v1)
        getNpcTalkCount(playerId, npcId, tier) {
            return queries.getNpcTalkCount(db, playerId, npcId, tier);
        },
        // Protected slot queries (Phase 3.2)
        getProtectedSlots() {
            return queries.getProtectedSlots(db);
        },
        // Property queries (Property Ownership v0)
        getProperties(zone) {
            return queries.getProperties(db, zone);
        },
        getProperty(propertyId) {
            return queries.getProperty(db, propertyId);
        },
        getPropertyByPlot(zone, plotId) {
            return queries.getPropertyByPlot(db, zone, plotId);
        },
        getPropertiesForOwner(playerId) {
            return queries.getPropertiesForOwner(db, playerId);
        },
        getAuction(propertyId) {
            return queries.getAuction(db, propertyId);
        },
        getOpenAuctions() {
            return queries.getOpenAuctions(db);
        },
        // World event queries (World Events v0)
        getWorldEvent(eventId) {
            return queries.getWorldEvent(db, eventId);
        },
        getWorldEvents() {
            return queries.getWorldEvents(db);
        },
        // Chronicle queries (Phase 4)
        getChronicleForPlayer(playerId, limit, before) {
            return queries.getChronicleForPlayer(db, playerId, limit, before);
        },
        // Evidence queries (Phase 4.4)
        getChronicleEventById(eventId) {
            return queries.getChronicleEventById(db, eventId);
        },
        getChronicleEventByReceiptHash(receiptHash, playerId) {
            return queries.getChronicleEventByReceiptHash(db, receiptHash, playerId);
        },
        getDeathByReceiptHash(receiptHash) {
            return queries.getDeathByReceiptHash(db, receiptHash);
        },
        getDeathBeforeTimestamp(playerId, beforeOrAt) {
            return queries.getDeathBeforeTimestamp(db, playerId, beforeOrAt);
        },
        // Moderation queries (v1)
        getModerationReports(status, limit) {
            return queries.getModerationReports(db, status, limit);
        },
        getModerationReportByCaseId(caseId) {
            return queries.getModerationReportByCaseId(db, caseId);
        },
        getModerationReportByReceiptHash(receiptHash) {
            return queries.getModerationReportByReceiptHash(db, receiptHash);
        },
        // Meta queries
        getMeta(key) {
            return queries.getMeta(db, key);
        },
        getSchemaVersion() {
            return queries.getSchemaVersion(db);
        },
    };
}
// Re-export types
export * from './types.js';
export { computeReceiptHash, canonicalize, toJsonlLine } from './hash.js';
export { generateItemId } from './materializers.js';
