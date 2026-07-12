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

import type { AuditReceipt } from '../../../../packages/shared/types.js';
import type {
  PersistenceConfig,
  PersistenceLayer,
  ReplayResult,
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
export type { DeathRow, ModerationReportRow } from './types.js';
import { initSchema } from './schema.js';
import { replayReceipts } from './replay.js';
import { materialize as materializeReceipt } from './materializers.js';
import * as queries from './queries.js';

// ============================================================================
// Factory
// ============================================================================

export function createPersistenceLayer(
  config: PersistenceConfig
): PersistenceLayer {
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

    startup(): ReplayResult {
      return replayReceipts({
        db,
        receiptsPath: config.receiptsPath,
        markerPath: config.markerPath,
        mode: config.replayMode ?? 'strict',
      });
    },

    materialize(receipt: AuditReceipt, offsetAfterLine?: number): void {
      materializeReceipt(db, receipt, offsetAfterLine);
    },

    checkpoint(): void {
      db.pragma('wal_checkpoint(TRUNCATE)');
    },

    close(): void {
      db.close();
    },

    // Player queries
    getPlayer(playerId: string): PlayerRow | null {
      return queries.getPlayer(db, playerId);
    },

    getPlayerByNameLower(nameLower: string): PlayerRow | null {
      return queries.getPlayerByNameLower(db, nameLower);
    },

    // Reputation queries
    getReputationScore(playerId: string): number {
      return queries.getReputationScore(db, playerId);
    },

    getReputationEvents(playerId: string, limit?: number): ReputationEventRow[] {
      return queries.getReputationEvents(db, playerId, limit);
    },

    // Death queries
    getDeathCount(playerId: string): number {
      return queries.getDeathCount(db, playerId);
    },

    getLastDeath(playerId: string): DeathRow | null {
      return queries.getLastDeath(db, playerId);
    },

    getDeaths(playerId: string, limit?: number): DeathRow[] {
      return queries.getDeaths(db, playerId, limit);
    },

    // World object queries
    getWorldObjects(zone: string): WorldObjectRow[] {
      return queries.getWorldObjects(db, zone);
    },

    getWorldObject(objectId: string): WorldObjectRow | null {
      return queries.getWorldObject(db, objectId);
    },

    // Item queries (Phase 2)
    getItem(itemId: string): ItemRow | null {
      return queries.getItem(db, itemId);
    },

    getItemByGenesisReceipt(receiptHash: string): ItemRow | null {
      return queries.getItemByGenesisReceipt(db, receiptHash);
    },

    // Inventory queries (Phase 2)
    getInventoryItems(): InventoryItemRow[] {
      return queries.getInventoryItems(db);
    },
    getHouseStorage(): Array<{ item_id: string; property_id: string }> {
      return queries.getHouseStorage(db);
    },
    getGuildTreasury(): number {
      return queries.getGuildTreasury(db);
    },

    getPlayerInventory(playerId: string): InventoryItemRow[] {
      return queries.getPlayerInventory(db, playerId);
    },

    getInventoryItem(itemId: string): InventoryItemRow | null {
      return queries.getInventoryItem(db, itemId);
    },

    getActiveWorldItems(zone: string): WorldObjectRow[] {
      return queries.getActiveWorldItems(db, zone);
    },

    // Legendary heat queries (Phase 3)
    getLegendaryHeatRows(): LegendaryHeatRow[] {
      return queries.getLegendaryHeatRows(db);
    },

    getLegendaryHeat(itemId: string): number {
      return queries.getLegendaryHeat(db, itemId);
    },

    getPlayerHeat(playerId: string): PlayerHeatRow | null {
      return queries.getPlayerHeat(db, playerId);
    },

    getPlayerAntiCheatEnforcement(playerId: string): PlayerAntiCheatEnforcementRow | null {
      return queries.getPlayerAntiCheatEnforcement(db, playerId);
    },

    // NPC dialogue (Dialogue Contract v1)
    getNpcTalkCount(playerId: string, npcId: string, tier: string): number {
      return queries.getNpcTalkCount(db, playerId, npcId, tier);
    },

    // Protected slot queries (Phase 3.2)
    getProtectedSlots(): Array<{ owner_player_id: string; item_id: string; updated_at: string }> {
      return queries.getProtectedSlots(db);
    },

    // Property queries (Property Ownership v0)
    getProperties(zone?: string): PropertyRow[] {
      return queries.getProperties(db, zone);
    },

    getProperty(propertyId: string): PropertyRow | null {
      return queries.getProperty(db, propertyId);
    },

    getPropertyByPlot(zone: string, plotId: string): PropertyRow | null {
      return queries.getPropertyByPlot(db, zone, plotId);
    },

    getPropertiesForOwner(playerId: string): PropertyRow[] {
      return queries.getPropertiesForOwner(db, playerId);
    },

    getAuction(propertyId: string): AuctionRow | null {
      return queries.getAuction(db, propertyId);
    },

    getOpenAuctions(): AuctionRow[] {
      return queries.getOpenAuctions(db);
    },

    // World event queries (World Events v0)
    getWorldEvent(eventId: string): WorldEventRow | null {
      return queries.getWorldEvent(db, eventId);
    },

    getWorldEvents(): WorldEventRow[] {
      return queries.getWorldEvents(db);
    },

    // Chronicle queries (Phase 4)
    getChronicleForPlayer(playerId: string, limit?: number, before?: string): ChronicleEventRow[] {
      return queries.getChronicleForPlayer(db, playerId, limit, before);
    },

    getSharedWorldEvents(worldId: string, limit?: number): ChronicleEventRow[] {
      return queries.getSharedWorldEvents(db, worldId, limit);
    },

    // Evidence queries (Phase 4.4)
    getChronicleEventById(eventId: number): ChronicleEventRow | null {
      return queries.getChronicleEventById(db, eventId);
    },

    getChronicleEventByReceiptHash(receiptHash: string, playerId: string): ChronicleEventRow | null {
      return queries.getChronicleEventByReceiptHash(db, receiptHash, playerId);
    },

    getDeathByReceiptHash(receiptHash: string): DeathRow | null {
      return queries.getDeathByReceiptHash(db, receiptHash);
    },

    getDeathBeforeTimestamp(playerId: string, beforeOrAt: string): DeathRow | null {
      return queries.getDeathBeforeTimestamp(db, playerId, beforeOrAt);
    },

    // Moderation queries (v1)
    getModerationReports(status?: 'open' | 'resolved' | 'all', limit?: number): ModerationReportRow[] {
      return queries.getModerationReports(db, status, limit);
    },

    getModerationReportByCaseId(caseId: string): ModerationReportRow | null {
      return queries.getModerationReportByCaseId(db, caseId);
    },

    getModerationReportByReceiptHash(receiptHash: string): ModerationReportRow | null {
      return queries.getModerationReportByReceiptHash(db, receiptHash);
    },

    // Meta queries
    getMeta(key: string): string | null {
      return queries.getMeta(db, key);
    },

    getSchemaVersion(): number {
      return queries.getSchemaVersion(db);
    },
  };
}

// Re-export types
export * from './types.js';
export { computeReceiptHash, canonicalize, toJsonlLine } from './hash.js';
export { generateItemId } from './materializers.js';
