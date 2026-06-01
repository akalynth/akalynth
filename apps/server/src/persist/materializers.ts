// Akalynth Receipt Materializers
// Phase 1 + 2: Transform receipts into SQLite rows (idempotent, transactional)

import { blake3 } from '@noble/hashes/blake3';
import type Database from 'better-sqlite3';
import type { AuditReceipt } from '../../../../packages/shared/types.js';
import { THROTTLE_DURATION_MS } from '../../../../packages/shared/types.js';
import { ACTION_ALIASES, RECEIPT_ACTIONS } from './types.js';
import { computeReceiptHash } from './hash.js';

// ============================================================================
// Item ID Derivation
// ============================================================================

/**
 * Generate item_id from receipt hash (deterministic, replay-safe).
 * This avoids hash cycles: item_minted receipt does NOT contain item_id.
 *
 * @param receiptHash - Format "blake3:<hex>"
 * @returns 32-character hex string (16 bytes)
 */
export function generateItemId(receiptHash: string): string {
  // Strip "blake3:" prefix
  const hashHex = receiptHash.replace(/^blake3:/, '');
  const input = `item:${hashHex}`;
  const hash = blake3(new TextEncoder().encode(input));
  return Buffer.from(hash).toString('hex').slice(0, 32);
}

// ============================================================================
// Handler Registry
// ============================================================================

type Handler = (db: Database.Database, receipt: AuditReceipt, receiptHash: string) => void;

// Moderation action constants (imported separately to avoid circular deps)
const MODERATION_PLAYER_REPORTED = 'player_reported';
const MODERATION_RESOLVED = 'moderation_resolved';

const HANDLERS: Record<string, Handler> = {
  // Phase 1: Core
  [RECEIPT_ACTIONS.PLAYER_CREATED]: handlePlayerCreated,
  [RECEIPT_ACTIONS.PLAYER_RENAMED]: handlePlayerRenamed,
  [RECEIPT_ACTIONS.DEATH]: handleDeath,
  [RECEIPT_ACTIONS.REPUTATION_EVENT]: handleReputationEvent,
  [RECEIPT_ACTIONS.WORLD_OBJECT_SPAWNED]: handleWorldObjectSpawned,
  [RECEIPT_ACTIONS.WORLD_OBJECT_TRANSFERRED]: handleWorldObjectTransferred,
  [RECEIPT_ACTIONS.WORLD_OBJECT_REMOVED]: handleWorldObjectRemoved,
  // Phase 2: Items
  [RECEIPT_ACTIONS.ITEM_MINTED]: handleItemMinted,
  [RECEIPT_ACTIONS.ITEM_ADDED_TO_INVENTORY]: handleItemAddedToInventory,
  [RECEIPT_ACTIONS.ITEM_REMOVED_FROM_INVENTORY]: handleItemRemovedFromInventory,
  [RECEIPT_ACTIONS.ITEM_DROPPED_TO_WORLD]: handleItemDroppedToWorld,
  [RECEIPT_ACTIONS.ITEM_PICKED_UP_FROM_WORLD]: handleItemPickedUpFromWorld,
  // Phase 3: Legendary heat
  [RECEIPT_ACTIONS.LEGENDARY_HEAT_CHANGED]: handleLegendaryHeatChanged,
  // Phase 3.5: Player heat + enforcement memory
  [RECEIPT_ACTIONS.PLAYER_HEAT_CHANGED]: handlePlayerHeatChanged,
  [RECEIPT_ACTIONS.HEAT_PENALTY_APPLIED]: handleHeatPenaltyApplied,
  [RECEIPT_ACTIONS.HEAT_TEM_ESCALATION]: handleHeatTemEscalation,
  [RECEIPT_ACTIONS.TEM_CHALLENGE_FAILED]: handleTemChallengeFailed,
  [RECEIPT_ACTIONS.THROTTLE]: handleThrottleApplied,
  [RECEIPT_ACTIONS.KICK]: handleKickApplied,
  [RECEIPT_ACTIONS.WARN_ISSUED]: handleWarnIssued,
  // Phase 3.2: Protected slots
  [RECEIPT_ACTIONS.INVENTORY_SLOT_CHANGED]: handleInventorySlotChanged,
  // Moderation v1
  [MODERATION_PLAYER_REPORTED]: handlePlayerReported,
  [MODERATION_RESOLVED]: handleModerationResolved,
  // Identity v0.1
  [RECEIPT_ACTIONS.CHARACTER_CREATE]: handleCharacterCreate,
  [RECEIPT_ACTIONS.AUTH_TOKEN_ISSUE]: handleAuthTokenIssue,
  // Dialogue Contract v1
  [RECEIPT_ACTIONS.NPC_TALKED]: handleNpcTalked,
  // Property Ownership v0
  [RECEIPT_ACTIONS.PROPERTY_CREATED]: handlePropertyCreated,
  [RECEIPT_ACTIONS.PROPERTY_LISTED]: handlePropertyListed,
  [RECEIPT_ACTIONS.PROPERTY_UNLISTED]: handlePropertyUnlisted,
  [RECEIPT_ACTIONS.PROPERTY_PURCHASED]: handlePropertyPurchased,
  [RECEIPT_ACTIONS.PROPERTY_TRANSFERRED]: handlePropertyTransferred,
  [RECEIPT_ACTIONS.PROPERTY_AUCTION_OPENED]: handlePropertyAuctionOpened,
  [RECEIPT_ACTIONS.PROPERTY_BID]: handlePropertyBid,
  [RECEIPT_ACTIONS.PROPERTY_BID_REFUNDED]: handlePropertyBidRefunded,
  [RECEIPT_ACTIONS.PROPERTY_AUCTION_SETTLED]: handlePropertyAuctionSettled,
  [RECEIPT_ACTIONS.PROPERTY_AUCTION_CANCELLED]: handlePropertyAuctionCancelled,
};

// ============================================================================
// Main Materializer
// ============================================================================

export function materialize(
  db: Database.Database,
  receipt: AuditReceipt,
  offsetAfterLine?: number
): void {
  // Resolve action alias
  const action = ACTION_ALIASES[receipt.action] ?? receipt.action;
  const handler = HANDLERS[action];

  // Compute canonical receipt hash
  const receiptHash = computeReceiptHash(receipt);

  // Wrap in transaction for atomicity
  db.transaction(() => {
    // Run primary handler if applicable
    if (handler) {
      handler(db, receipt, receiptHash);
    }

    // Always attempt chronicle materialization (Phase 4)
    // This runs regardless of whether there's a primary handler
    materializeChronicle(db, receipt, receiptHash);

    // Update _meta for debugging/recovery
    const updateMeta = db.prepare(
      'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
    );
    updateMeta.run('last_materialized_hash', receiptHash);
    if (offsetAfterLine !== undefined) {
      updateMeta.run('last_materialized_offset', String(offsetAfterLine));
    }
  })();
}

// ============================================================================
// Player Handlers
// ============================================================================

function handlePlayerCreated(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  // Extract player data from receipt
  const playerId = receipt.actor_id;
  const name = (receipt.inputs?.name as string) ?? `Guest_${playerId.slice(-4)}`;
  const timestamp = receipt.timestamp;

  // UPSERT to refresh stub rows when receipts arrive out of order
  const stmt = db.prepare(`
    INSERT INTO players (player_id, name, created_at, created_receipt, deleted_at)
    VALUES (?, ?, ?, ?, NULL)
    ON CONFLICT(player_id) DO UPDATE SET
      name = excluded.name,
      created_at = excluded.created_at,
      deleted_at = NULL
  `);
  stmt.run(playerId, name, timestamp, receiptHash);
}

function handlePlayerRenamed(
  db: Database.Database,
  receipt: AuditReceipt,
  _receiptHash: string
): void {
  const playerId = receipt.actor_id;
  const newName = receipt.inputs?.new_name as string;

  if (!newName) return;

  const stmt = db.prepare(`
    UPDATE players SET name = ? WHERE player_id = ?
  `);
  stmt.run(newName, playerId);
}

// ============================================================================
// Death Handler
// ============================================================================

function handleDeath(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const playerId = receipt.actor_id;
  const timestamp = receipt.timestamp;
  const inputs = receipt.inputs ?? {};

  const zone = (inputs.zone as string) ?? (inputs.map as string) ?? 'unknown';
  const x = (inputs.x as number) ?? (inputs.pos as { x: number })?.x ?? 0;
  const y = (inputs.y as number) ?? (inputs.pos as { y: number })?.y ?? 0;
  const cause = (inputs.cause as string) ?? 'unknown';
  const witnesses = inputs.witnesses ? JSON.stringify(inputs.witnesses) : null;

  // INSERT OR IGNORE (idempotent via UNIQUE receipt_hash)
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO deaths (player_id, zone, x, y, timestamp, cause, receipt_hash, witnesses)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(playerId, zone, x, y, timestamp, cause, receiptHash, witnesses);
}

// ============================================================================
// Reputation Handler
// ============================================================================

function handleReputationEvent(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const playerId = receipt.actor_id;
  const timestamp = receipt.timestamp;
  const inputs = receipt.inputs ?? {};

  const eventType = (inputs.type as string) ?? receipt.action;
  const delta = (inputs.delta as number) ?? (inputs.penalty as number) ?? 0;
  const witnesses = inputs.witnesses ? JSON.stringify(inputs.witnesses) : null;
  const context = inputs.context ? JSON.stringify(inputs.context) : null;

  // INSERT OR IGNORE (idempotent via UNIQUE receipt_hash)
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO reputation_events (player_id, event_type, delta, timestamp, receipt_hash, witnesses, context)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(playerId, eventType, delta, timestamp, receiptHash, witnesses, context);
}

// ============================================================================
// World Object Handlers
// ============================================================================

function handleWorldObjectSpawned(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};

  const objectId = (inputs.object_id as string) ?? (inputs.item_id as string);
  if (!objectId) return;

  const objectType = (inputs.object_type as string) ?? (inputs.type as string) ?? 'item';
  const zone = (inputs.zone as string) ?? (inputs.map as string) ?? 'unknown';
  const x = (inputs.x as number) ?? 0;
  const y = (inputs.y as number) ?? 0;
  const createdAt = receipt.timestamp;
  const decayAt = (inputs.decay_at as string) ?? null;
  const ownerHistory = JSON.stringify([
    { player_id: receipt.actor_id, action: 'dropped', timestamp: receipt.timestamp },
  ]);

  // UPSERT (idempotent via PRIMARY KEY object_id)
  const stmt = db.prepare(`
    INSERT INTO world_objects (object_id, object_type, zone, x, y, created_at, decay_at, status, owner_history, last_receipt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    ON CONFLICT(object_id) DO UPDATE SET
      zone = excluded.zone,
      x = excluded.x,
      y = excluded.y,
      status = 'active',
      last_receipt = excluded.last_receipt
  `);
  stmt.run(objectId, objectType, zone, x, y, createdAt, decayAt, ownerHistory, receiptHash);
}

function handleWorldObjectTransferred(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};

  const objectId = (inputs.object_id as string) ?? (inputs.item_id as string);
  if (!objectId) return;

  const newOwner = (inputs.new_owner as string) ?? receipt.actor_id;

  // Get current owner history
  const existing = db
    .prepare('SELECT owner_history FROM world_objects WHERE object_id = ?')
    .get(objectId) as { owner_history: string } | undefined;

  let ownerHistory: Array<{ player_id: string; action: string; timestamp: string }> = [];
  if (existing?.owner_history) {
    try {
      ownerHistory = JSON.parse(existing.owner_history);
    } catch {
      ownerHistory = [];
    }
  }

  ownerHistory.push({
    player_id: newOwner,
    action: 'picked_up',
    timestamp: receipt.timestamp,
  });

  // Update object
  const stmt = db.prepare(`
    UPDATE world_objects
    SET status = 'picked_up', owner_history = ?, last_receipt = ?
    WHERE object_id = ?
  `);
  stmt.run(JSON.stringify(ownerHistory), receiptHash, objectId);
}

function handleWorldObjectRemoved(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};

  const objectId = (inputs.object_id as string) ?? (inputs.item_id as string);
  if (!objectId) return;

  // Soft delete (update status to 'decayed')
  const stmt = db.prepare(`
    UPDATE world_objects
    SET status = 'decayed', last_receipt = ?
    WHERE object_id = ?
  `);
  stmt.run(receiptHash, objectId);
}

// ============================================================================
// Property Handlers (Property Ownership v0)
// ============================================================================

interface PropertyOwnerHistoryRow {
  from: string | null;
  to: string;
  price: number;
  action: 'purchased' | 'transferred';
  timestamp: string;
}

function readPropertyOwnerHistory(
  db: Database.Database,
  propertyId: string
): PropertyOwnerHistoryRow[] {
  const existing = db
    .prepare('SELECT owner_history FROM properties WHERE property_id = ?')
    .get(propertyId) as { owner_history: string } | undefined;
  if (!existing?.owner_history) return [];
  try {
    return JSON.parse(existing.owner_history) as PropertyOwnerHistoryRow[];
  } catch {
    return [];
  }
}

function handlePropertyCreated(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const propertyId = inputs.property_id as string | undefined;
  const zone = inputs.zone as string | undefined;
  const plotId = inputs.plot_id as string | undefined;
  if (!propertyId || !zone || !plotId) return;

  // Idempotent: genesis_receipt UNIQUE + INSERT OR IGNORE means re-materialize is a no-op.
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO properties (
      property_id, zone, plot_id, x, y, width, height, district,
      owner_player_id, status, listed_price_gold, primary_price_gold,
      purchased_at, sale_count, owner_history, genesis_receipt, last_receipt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'unowned', NULL, ?, NULL, 0, '[]', ?, ?, ?)
  `);
  stmt.run(
    propertyId,
    zone,
    plotId,
    Number(inputs.x ?? 0),
    Number(inputs.y ?? 0),
    Number(inputs.width ?? 0),
    Number(inputs.height ?? 0),
    (inputs.district as string | null) ?? null,
    Number(inputs.primary_price_gold ?? 0),
    receiptHash,
    receiptHash,
    receipt.timestamp
  );
}

function handlePropertyListed(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const propertyId = inputs.property_id as string | undefined;
  const price = inputs.price as number | undefined;
  if (!propertyId || typeof price !== 'number') return;

  // Owner predicate: only the current owner can list (self-correcting on replay).
  db.prepare(`
    UPDATE properties
    SET status = 'listed', listed_price_gold = ?, last_receipt = ?
    WHERE property_id = ? AND owner_player_id = ?
  `).run(price, receiptHash, propertyId, receipt.actor_id);
}

function handlePropertyUnlisted(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const propertyId = inputs.property_id as string | undefined;
  if (!propertyId) return;

  db.prepare(`
    UPDATE properties
    SET status = 'owned', listed_price_gold = NULL, last_receipt = ?
    WHERE property_id = ? AND owner_player_id = ?
  `).run(receiptHash, propertyId, receipt.actor_id);
}

function handlePropertyPurchased(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  // Primary sale: treasury (unowned) → buyer (actor_id).
  const inputs = receipt.inputs ?? {};
  const propertyId = inputs.property_id as string | undefined;
  const buyer = receipt.actor_id;
  if (!propertyId || !buyer) return;

  const price = typeof inputs.price === 'number' ? (inputs.price as number) : 0;
  const history = readPropertyOwnerHistory(db, propertyId);
  history.push({ from: null, to: buyer, price, action: 'purchased', timestamp: receipt.timestamp });

  // owner IS NULL predicate prevents sale_count double-increment on re-materialize
  // and blocks any second primary sale.
  db.prepare(`
    UPDATE properties
    SET owner_player_id = ?, status = 'owned', listed_price_gold = NULL,
        purchased_at = ?, sale_count = sale_count + 1, owner_history = ?, last_receipt = ?
    WHERE property_id = ? AND owner_player_id IS NULL
  `).run(buyer, receipt.timestamp, JSON.stringify(history), receiptHash, propertyId);
}

function handlePropertyTransferred(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  // Resale: seller → buyer (actor_id = buyer).
  const inputs = receipt.inputs ?? {};
  const propertyId = inputs.property_id as string | undefined;
  const sellerId = inputs.seller_id as string | undefined;
  const buyer = receipt.actor_id;
  if (!propertyId || !sellerId || !buyer) return;

  const price = typeof inputs.price === 'number' ? (inputs.price as number) : 0;
  const history = readPropertyOwnerHistory(db, propertyId);
  history.push({ from: sellerId, to: buyer, price, action: 'transferred', timestamp: receipt.timestamp });

  // seller predicate: resale only fires when the named seller still owns it
  // (blocks double-sell and double-increment on replay).
  db.prepare(`
    UPDATE properties
    SET owner_player_id = ?, status = 'owned', listed_price_gold = NULL,
        purchased_at = ?, sale_count = sale_count + 1, owner_history = ?, last_receipt = ?
    WHERE property_id = ? AND owner_player_id = ?
  `).run(buyer, receipt.timestamp, JSON.stringify(history), receiptHash, propertyId, sellerId);
}

// ----------------------------------------------------------------------------
// Property Auction Lane: durable mirror of the in-memory auction reducer.
// One property_auctions row per property (latest auction). The properties.status
// transitions (owned↔auctioning) are written so that re-materializing the full
// receipt log leaves identical state (the transient 'auctioning' set by `opened`
// is corrected by `settled`/`cancelled` within the same replay pass; sale_count
// stays guarded by the owner predicate so it never double-counts).
// ----------------------------------------------------------------------------

function handlePropertyAuctionOpened(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const propertyId = inputs.property_id as string | undefined;
  const kind = inputs.kind as string | undefined;
  const minBid = inputs.min_bid as number | undefined;
  const minIncrement = inputs.min_increment_gold as number | undefined;
  if (!propertyId || (kind !== 'primary' && kind !== 'resale')) return;
  if (typeof minBid !== 'number' || typeof minIncrement !== 'number') return;

  const sellerId = kind === 'resale' ? receipt.actor_id : null;
  const scheduledClose =
    typeof inputs.scheduled_close_ms === 'number' ? (inputs.scheduled_close_ms as number) : null;

  // One row per property (latest auction) — REPLACE on a new open.
  db.prepare(`
    INSERT OR REPLACE INTO property_auctions (
      property_id, kind, seller_id, min_bid, min_increment_gold,
      current_high, high_bidder_id, status, scheduled_close_ms, opened_receipt, last_receipt
    ) VALUES (?, ?, ?, ?, ?, NULL, NULL, 'open', ?, ?, ?)
  `).run(propertyId, kind, sellerId, minBid, minIncrement, scheduledClose, receiptHash, receiptHash);

  // Mark the plot auctioning (only from a valid pre-auction state).
  db.prepare(`
    UPDATE properties
    SET status = 'auctioning', listed_price_gold = NULL, last_receipt = ?
    WHERE property_id = ? AND status IN ('owned', 'unowned')
  `).run(receiptHash, propertyId);
}

function handlePropertyBid(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const propertyId = inputs.property_id as string | undefined;
  const amount = inputs.amount as number | undefined;
  const bidder = receipt.actor_id;
  if (!propertyId || typeof amount !== 'number' || !bidder) return;

  // Accepted bids arrive in monotonically increasing order in the log.
  db.prepare(`
    UPDATE property_auctions
    SET current_high = ?, high_bidder_id = ?, last_receipt = ?
    WHERE property_id = ? AND status = 'open'
  `).run(amount, bidder, receiptHash, propertyId);
}

function handlePropertyBidRefunded(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const propertyId = inputs.property_id as string | undefined;
  if (!propertyId) return;
  // The outbid refund is a wallet (treasury) effect; the auction row's high state
  // already reflects the outbidding bid. Record only the last_receipt.
  db.prepare(`UPDATE property_auctions SET last_receipt = ? WHERE property_id = ?`).run(
    receiptHash,
    propertyId
  );
}

function handlePropertyAuctionSettled(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const propertyId = inputs.property_id as string | undefined;
  if (!propertyId) return;
  const kind = inputs.kind as string | undefined;
  const winnerId = (inputs.winner_id as string | null | undefined) ?? null;
  const sellerId = (inputs.seller_id as string | null | undefined) ?? null;
  const price = typeof inputs.price === 'number' ? (inputs.price as number) : 0;

  if (winnerId) {
    const history = readPropertyOwnerHistory(db, propertyId);
    if (kind === 'primary') {
      history.push({ from: null, to: winnerId, price, action: 'purchased', timestamp: receipt.timestamp });
      // owner IS NULL predicate prevents sale_count double-increment on re-materialize.
      db.prepare(`
        UPDATE properties
        SET owner_player_id = ?, status = 'owned', listed_price_gold = NULL,
            purchased_at = ?, sale_count = sale_count + 1, owner_history = ?, last_receipt = ?
        WHERE property_id = ? AND owner_player_id IS NULL
      `).run(winnerId, receipt.timestamp, JSON.stringify(history), receiptHash, propertyId);
    } else {
      history.push({ from: sellerId, to: winnerId, price, action: 'transferred', timestamp: receipt.timestamp });
      // seller predicate prevents double-sell / double-increment on re-materialize.
      db.prepare(`
        UPDATE properties
        SET owner_player_id = ?, status = 'owned', listed_price_gold = NULL,
            purchased_at = ?, sale_count = sale_count + 1, owner_history = ?, last_receipt = ?
        WHERE property_id = ? AND owner_player_id = ?
      `).run(winnerId, receipt.timestamp, JSON.stringify(history), receiptHash, propertyId, sellerId);
    }
    // Status correction (idempotent): flip a still-auctioning plot to owned even
    // when the guarded ownership update above did not re-fire (re-materialize).
    db.prepare(`
      UPDATE properties SET status = 'owned', last_receipt = ?
      WHERE property_id = ? AND status = 'auctioning'
    `).run(receiptHash, propertyId);
  } else {
    // No bids: revert to the pre-auction status.
    const revertTo = kind === 'primary' ? 'unowned' : 'owned';
    db.prepare(`
      UPDATE properties SET status = ?, last_receipt = ?
      WHERE property_id = ? AND status = 'auctioning'
    `).run(revertTo, receiptHash, propertyId);
  }

  db.prepare(`
    UPDATE property_auctions SET status = 'settled', last_receipt = ?
    WHERE property_id = ? AND status = 'open'
  `).run(receiptHash, propertyId);
}

function handlePropertyAuctionCancelled(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const propertyId = inputs.property_id as string | undefined;
  if (!propertyId) return;

  // Cancel only fires for a zero-bid open auction owned/sellered by the actor.
  db.prepare(`
    UPDATE property_auctions SET status = 'cancelled', last_receipt = ?
    WHERE property_id = ? AND status = 'open' AND current_high IS NULL AND seller_id = ?
  `).run(receiptHash, propertyId, receipt.actor_id);

  db.prepare(`
    UPDATE properties SET status = 'owned', last_receipt = ?
    WHERE property_id = ? AND status = 'auctioning'
  `).run(receiptHash, propertyId);
}

// ============================================================================
// Item Handlers (Phase 2)
// ============================================================================

/**
 * Handle item_minted: Create immutable item record.
 * CRITICAL: item_id is DERIVED from receiptHash, NOT stored in receipt body.
 */
function handleItemMinted(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const itemType = inputs.item_type as string;
  const meta = inputs.meta ?? {};

  if (!itemType) return;

  // Derive item_id from receipt hash (this is the ONLY place item_id is computed during materialization)
  const itemId = generateItemId(receiptHash);

  // INSERT OR IGNORE (idempotent via UNIQUE genesis_receipt)
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO items (item_id, item_type, created_at, genesis_receipt, meta_json)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(itemId, itemType, receipt.timestamp, receiptHash, JSON.stringify(meta));
}

/**
 * Handle item_added_to_inventory: Upsert item into player's inventory.
 * Also repairs projection by marking world_objects as picked_up if needed.
 */
function handleItemAddedToInventory(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const itemId = inputs.item_id as string;
  const slot = (inputs.slot as string) ?? null;

  if (!itemId) return;

  // Projection repair: if item exists in world as active, mark it picked_up
  // (ensures exclusivity even under weird receipt sequences)
  db.prepare(`
    UPDATE world_objects SET status = 'picked_up', last_receipt = ?
    WHERE object_id = ? AND status = 'active'
  `).run(receiptHash, itemId);

  // Safety net: ensure player exists (handles receipt reordering edge cases)
  // This creates a stub row if player_created receipt hasn't been processed yet
  db.prepare(`
    INSERT OR IGNORE INTO players (player_id, name, created_at, created_receipt, deleted_at)
    VALUES (?, ?, ?, ?, NULL)
  `).run(receipt.actor_id, `Guest_${receipt.actor_id.slice(-4)}`, receipt.timestamp, receiptHash);

  // Safety net: ensure item exists (handles receipt reordering edge cases)
  // This creates a stub row if item_minted receipt hasn't been processed yet.
  // Since #82, mob loot is item_minted at spawn so its row already exists;
  // item_type on the pickup receipt is kept for backward-compat with old
  // mob_loot_spawned receipts (which have no materializer). Falls back to
  // 'unknown' for older receipts so INSERT OR IGNORE is a no-op for minted items.
  const stubItemType = (inputs.item_type as string) ?? 'unknown';
  db.prepare(`
    INSERT OR IGNORE INTO items (item_id, item_type, created_at, genesis_receipt, meta_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(itemId, stubItemType, receipt.timestamp, receiptHash, '{}');

  // Upsert into inventory
  db.prepare(`
    INSERT INTO inventory_items (item_id, owner_player_id, slot, updated_at, last_receipt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(item_id) DO UPDATE SET
      owner_player_id = excluded.owner_player_id,
      slot = excluded.slot,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
  `).run(itemId, receipt.actor_id, slot, receipt.timestamp, receiptHash);
}

/**
 * Handle item_removed_from_inventory: Remove item from player's inventory.
 */
function handleItemRemovedFromInventory(
  db: Database.Database,
  receipt: AuditReceipt,
  _receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const itemId = inputs.item_id as string;

  if (!itemId) return;

  db.prepare(`DELETE FROM inventory_items WHERE item_id = ?`).run(itemId);
}

/**
 * Handle item_dropped_to_world: Create/update world object for dropped item.
 * Owner history is appended in application code (not SQL json_patch).
 */
function handleItemDroppedToWorld(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const itemId = inputs.item_id as string;
  const zone = inputs.zone as string;
  const x = inputs.x as number;
  const y = inputs.y as number;
  const decayAt = (inputs.decay_at as string) ?? null;

  if (!itemId || !zone || x === undefined || y === undefined) return;

  // Projection repair: remove from inventory if still present
  // (ensures exclusivity even under weird receipt sequences)
  db.prepare(`DELETE FROM inventory_items WHERE item_id = ?`).run(itemId);

  // Get item_type from items table
  const item = db.prepare(`SELECT item_type FROM items WHERE item_id = ?`).get(itemId) as
    | { item_type: string }
    | undefined;
  const itemType = item?.item_type ?? 'unknown';

  // Build new owner history entry
  const newEntry = {
    player_id: receipt.actor_id,
    action: 'dropped',
    timestamp: receipt.timestamp,
  };

  // Check if object already exists (for re-drop scenarios)
  const existing = db
    .prepare(`SELECT owner_history FROM world_objects WHERE object_id = ?`)
    .get(itemId) as { owner_history: string } | undefined;

  let ownerHistory: string;
  if (existing) {
    // Append to existing history
    const history = JSON.parse(existing.owner_history) as unknown[];
    history.push(newEntry);
    ownerHistory = JSON.stringify(history);
  } else {
    ownerHistory = JSON.stringify([newEntry]);
  }

  // UPSERT into world_objects
  db.prepare(`
    INSERT INTO world_objects (object_id, object_type, zone, x, y, created_at, decay_at, status, owner_history, last_receipt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    ON CONFLICT(object_id) DO UPDATE SET
      zone = excluded.zone,
      x = excluded.x,
      y = excluded.y,
      decay_at = excluded.decay_at,
      status = 'active',
      owner_history = excluded.owner_history,
      last_receipt = excluded.last_receipt
  `).run(itemId, itemType, zone, x, y, receipt.timestamp, decayAt, ownerHistory, receiptHash);
}

/**
 * Handle item_picked_up_from_world: Mark world object as picked up.
 */
function handleItemPickedUpFromWorld(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const itemId = inputs.item_id as string;

  if (!itemId) return;

  db.prepare(`
    UPDATE world_objects
    SET status = 'picked_up', last_receipt = ?
    WHERE object_id = ?
  `).run(receiptHash, itemId);
}

// ============================================================================
// Legendary Heat Handlers (Phase 3)
// ============================================================================

/**
 * Handle legendary_heat_changed: Set absolute heat value (idempotent).
 * Uses new_heat directly, not delta, so replay converges to same state.
 */
function handleLegendaryHeatChanged(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const itemId = inputs.item_id as string;
  const newHeat = inputs.new_heat as number;

  if (!itemId || typeof newHeat !== 'number') return;

  db.prepare(`
    INSERT INTO legendary_heat (item_id, heat, updated_at, last_receipt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(item_id) DO UPDATE SET
      heat = excluded.heat,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
  `).run(itemId, newHeat, receipt.timestamp, receiptHash);
}

function handlePlayerHeatChanged(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const newScore = inputs.new_score as number;

  if (typeof newScore !== 'number' || !Number.isFinite(newScore)) return;

  db.prepare(`
    INSERT INTO player_heat (player_id, heat, penalty_until_ms, last_tem_ms, updated_at, last_receipt)
    VALUES (?, ?, NULL, NULL, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      heat = excluded.heat,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
  `).run(receipt.actor_id, newScore, receipt.timestamp, receiptHash);
}

function handleHeatPenaltyApplied(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const durationMs = inputs.duration_ms as number;
  const timestampMs = Date.parse(receipt.timestamp);

  if (!Number.isFinite(durationMs) || !Number.isFinite(timestampMs)) return;

  const penaltyUntilMs = timestampMs + durationMs;
  db.prepare(`
    INSERT INTO player_heat (player_id, heat, penalty_until_ms, last_tem_ms, updated_at, last_receipt)
    VALUES (?, 0, ?, NULL, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      penalty_until_ms = excluded.penalty_until_ms,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
  `).run(receipt.actor_id, penaltyUntilMs, receipt.timestamp, receiptHash);
}

function handleHeatTemEscalation(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const timestampMs = Date.parse(receipt.timestamp);
  if (!Number.isFinite(timestampMs)) return;

  db.prepare(`
    INSERT INTO player_heat (player_id, heat, penalty_until_ms, last_tem_ms, updated_at, last_receipt)
    VALUES (?, 0, NULL, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      last_tem_ms = excluded.last_tem_ms,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
  `).run(receipt.actor_id, timestampMs, receipt.timestamp, receiptHash);
}

function handleTemChallengeFailed(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const timestampMs = Date.parse(receipt.timestamp);
  if (!Number.isFinite(timestampMs)) return;
  const throttleUntilMs = timestampMs + THROTTLE_DURATION_MS;

  db.prepare(`
    INSERT INTO player_anticheat_enforcement
    (player_id, warn_count, tem_failed_count, throttle_count, kick_count, throttle_until_ms, updated_at, last_receipt)
    VALUES (?, 0, 1, 1, 0, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      tem_failed_count = player_anticheat_enforcement.tem_failed_count + 1,
      throttle_count = player_anticheat_enforcement.throttle_count + 1,
      throttle_until_ms = CASE
        WHEN player_anticheat_enforcement.throttle_until_ms IS NULL THEN excluded.throttle_until_ms
        WHEN excluded.throttle_until_ms > player_anticheat_enforcement.throttle_until_ms THEN excluded.throttle_until_ms
        ELSE player_anticheat_enforcement.throttle_until_ms
      END,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
  `).run(receipt.actor_id, throttleUntilMs, receipt.timestamp, receiptHash);
}

function handleThrottleApplied(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const durationMs = typeof inputs.duration_ms === 'number' ? (inputs.duration_ms as number) : THROTTLE_DURATION_MS;
  const timestampMs = Date.parse(receipt.timestamp);
  if (!Number.isFinite(durationMs) || !Number.isFinite(timestampMs)) return;

  const throttleUntilMs = timestampMs + durationMs;
  db.prepare(`
    INSERT INTO player_anticheat_enforcement
    (player_id, warn_count, tem_failed_count, throttle_count, kick_count, throttle_until_ms, updated_at, last_receipt)
    VALUES (?, 0, 0, 1, 0, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      throttle_count = player_anticheat_enforcement.throttle_count + 1,
      throttle_until_ms = CASE
        WHEN player_anticheat_enforcement.throttle_until_ms IS NULL THEN excluded.throttle_until_ms
        WHEN excluded.throttle_until_ms > player_anticheat_enforcement.throttle_until_ms THEN excluded.throttle_until_ms
        ELSE player_anticheat_enforcement.throttle_until_ms
      END,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
  `).run(receipt.actor_id, throttleUntilMs, receipt.timestamp, receiptHash);
}

function handleKickApplied(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  db.prepare(`
    INSERT INTO player_anticheat_enforcement
    (player_id, warn_count, tem_failed_count, throttle_count, kick_count, throttle_until_ms, updated_at, last_receipt)
    VALUES (?, 0, 0, 0, 1, NULL, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      kick_count = player_anticheat_enforcement.kick_count + 1,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
  `).run(receipt.actor_id, receipt.timestamp, receiptHash);
}

function handleWarnIssued(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  db.prepare(`
    INSERT INTO player_anticheat_enforcement
    (player_id, warn_count, tem_failed_count, throttle_count, kick_count, throttle_until_ms, updated_at, last_receipt)
    VALUES (?, 1, 0, 0, 0, NULL, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      warn_count = player_anticheat_enforcement.warn_count + 1,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
  `).run(receipt.actor_id, receipt.timestamp, receiptHash);
}

// ============================================================================
// Protected Slot Handlers (Phase 3.2)
// ============================================================================

/**
 * Handle inventory_slot_changed: Set protected slot for a player.
 * Enforces single protected per player transactionally.
 */
function handleInventorySlotChanged(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const itemId = inputs.item_id as string;
  const slot = inputs.slot as string | null;
  const playerId = receipt.actor_id;

  if (!itemId || !playerId) return;

  // Clear any prior protected slot for this player
  db.prepare(`
    UPDATE inventory_items
    SET slot = NULL, last_receipt = ?, updated_at = ?
    WHERE owner_player_id = ? AND slot = 'protected'
  `).run(receiptHash, receipt.timestamp, playerId);

  // Set protected on target item (if slot is 'protected')
  if (slot === 'protected') {
    db.prepare(`
      UPDATE inventory_items
      SET slot = 'protected', last_receipt = ?, updated_at = ?
      WHERE owner_player_id = ? AND item_id = ?
    `).run(receiptHash, receipt.timestamp, playerId, itemId);
  }
}

// ============================================================================
// Moderation Handlers (v1)
// ============================================================================

/**
 * Handle player_reported: Create open moderation report.
 * Idempotent via UNIQUE receipt_hash constraint.
 */
function handlePlayerReported(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const caseId = inputs.case_id as string;
  const reporterId = inputs.reporter_id as string;
  const targetId = inputs.target_id as string;
  const timestamp = inputs.timestamp as string ?? receipt.timestamp;

  if (!caseId || !reporterId || !targetId) return;

  // INSERT OR IGNORE (idempotent via UNIQUE receipt_hash)
  db.prepare(`
    INSERT OR IGNORE INTO moderation_reports
    (case_id, reporter_id, target_id, reported_at, receipt_hash, status)
    VALUES (?, ?, ?, ?, ?, 'open')
  `).run(caseId, reporterId, targetId, timestamp, receiptHash);
}

/**
 * Handle moderation_resolved: Update report with resolution.
 * Only updates if status is 'open' (prevents re-resolution on replay).
 */
function handleModerationResolved(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const caseId = inputs.case_id as string;
  const resolution = inputs.resolution as string;
  const reason = (inputs.reason as string) ?? null;
  const resolvedBy = receipt.actor_id;
  const resolvedAt = receipt.timestamp;

  if (!caseId || !resolution) return;

  // Only update if status is still 'open' (idempotent)
  db.prepare(`
    UPDATE moderation_reports
    SET status = 'resolved',
        resolved_by = ?,
        resolved_at = ?,
        resolution = ?,
        reason = ?,
        resolution_receipt_hash = ?
    WHERE case_id = ? AND status = 'open'
  `).run(resolvedBy, resolvedAt, resolution, reason, receiptHash, caseId);
}

// ============================================================================
// Identity v0.1 Handlers
// ============================================================================

/**
 * Handle character_create: Named character creation with deterministic outcomes.
 *
 * Receipt schema:
 *   action: 'character_create'
 *   actor_id: 'system'
 *   inputs: { player_id, name, name_lower }
 *   result: 'ok' | 'name_taken' | 'invalid_name' | 'rate_limited' | 'banned'
 *
 * Materializer behavior:
 *   - result: 'ok' -> INSERT player with auth_method='character'
 *   - Other results -> No DB mutation (audit-only)
 *
 * Determinism: Replay produces same player_id <-> name mapping because:
 *   1. player_id is captured in inputs (not generated during replay)
 *   2. name_lower enables case-insensitive uniqueness check
 *   3. All outcomes (including failures) are recorded
 */
function handleCharacterCreate(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const result = receipt.result;

  // Only materialize successful creations
  if (result !== 'ok') {
    // Audit-only: name_taken, invalid_name, rate_limited, banned
    // No DB mutation for failed attempts (they're still recorded in receipt chain)
    return;
  }

  const playerId = inputs.player_id as string;
  const name = inputs.name as string;
  const nameLower = inputs.name_lower as string;
  const timestamp = receipt.timestamp;

  if (!playerId || !name || !nameLower) return;

  // INSERT OR IGNORE: idempotent via UNIQUE player_id
  // Uses auth_method='character' to distinguish from guest sessions
  const stmt = db.prepare(`
    INSERT INTO players (player_id, name, name_lower, created_at, created_receipt, deleted_at, auth_method)
    VALUES (?, ?, ?, ?, ?, NULL, 'character')
    ON CONFLICT(player_id) DO UPDATE SET
      name = excluded.name,
      name_lower = excluded.name_lower,
      created_at = excluded.created_at,
      auth_method = 'character',
      deleted_at = NULL
  `);
  stmt.run(playerId, name, nameLower, timestamp, receiptHash);
}

/**
 * Handle auth_token_issue: Audit-only proof of token issuance.
 *
 * Receipt schema:
 *   action: 'auth_token_issue'
 *   actor_id: player_id
 *   inputs: { token_id, player_id, issued_at, expires_at, nonce, trigger }
 *   result: 'ok'
 *
 * Materializer behavior:
 *   - No DB mutation (audit-only receipt)
 *   - Token validation happens at runtime, not during replay
 *
 * Determinism: nonce captures the RNG/time state at issuance,
 * allowing verification that the same token would be issued on replay.
 */
function handleAuthTokenIssue(
  _db: Database.Database,
  _receipt: AuditReceipt,
  _receiptHash: string
): void {
  // Audit-only: no DB mutation
  // The receipt itself is the proof of token issuance
  // Token validation is runtime-only (tokens are not stored in DB)
}

// ============================================================================
// Dialogue Contract v1 Handler
// ============================================================================

/**
 * Handle npc_talked: append one row per talk to the durable counter log.
 *
 * Idempotent via UNIQUE(receipt_hash): re-materializing the same receipt
 * (replay resume, full rebuild) never double-counts. The variation nonce is
 * derived at read time as COUNT(*) per (player, npc, tier), so a rebuild from
 * receipts reconstructs identical counts — "receipts are canon".
 */
function handleNpcTalked(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const npcId = inputs.npc_id as string;
  const tier = inputs.tier as string;
  const playerId = receipt.actor_id;

  if (!npcId || !tier || !playerId) return;

  db.prepare(`
    INSERT OR IGNORE INTO npc_talk_events (player_id, npc_id, tier, timestamp, receipt_hash)
    VALUES (?, ?, ?, ?, ?)
  `).run(playerId, npcId, tier, receipt.timestamp, receiptHash);
}

// ============================================================================
// Chronicle Materialization (Phase 4 + 4.4 E2)
// ============================================================================

// Kinds eligible for evidence_ref (Phase 4.4 E2)
const EVIDENCE_ELIGIBLE_KINDS = new Set(['death', 'item_lost', 'legendary_lost']);

/**
 * Insert a chronicle event (idempotent via UNIQUE (player_id, receipt_hash, kind, entity_id)).
 * Returns the inserted row's id, or null if INSERT OR IGNORE skipped (duplicate).
 *
 * Phase 4.4 E2: evidence_ref is populated for death/item_lost/legendary_lost events.
 */
function insertChronicleEvent(
  db: Database.Database,
  playerId: string,
  kind: string,
  timestamp: string,
  sourceAction: string,
  receiptHash: string,
  zone: string | null = null,
  x: number | null = null,
  y: number | null = null,
  entityId: string | null = null,
  details: Record<string, unknown> = {},
  evidenceRef: string | null = null
): number | null {
  const result = db.prepare(`
    INSERT OR IGNORE INTO chronicle_events
    (player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(playerId, kind, timestamp, zone, x, y, entityId, JSON.stringify(details), sourceAction, receiptHash, evidenceRef);

  // If changes === 0, INSERT was ignored (duplicate)
  if (result.changes === 0) {
    return null;
  }

  return Number(result.lastInsertRowid);
}

/**
 * Build evidence_ref JSON for a chronicle event.
 * Format: { chronicle_event_id: number, receipt_hash: string }
 */
function buildEvidenceRef(chronicleEventId: number, receiptHash: string): string {
  return JSON.stringify({
    chronicle_event_id: chronicleEventId,
    receipt_hash: receiptHash,
  });
}

/**
 * Update evidence_ref for an existing chronicle event (self-reference for death).
 */
function updateEvidenceRef(db: Database.Database, eventId: number, evidenceRef: string): void {
  db.prepare(`
    UPDATE chronicle_events SET evidence_ref = ? WHERE id = ?
  `).run(evidenceRef, eventId);
}

/**
 * Find the death chronicle event that caused an item loss.
 * Looks for death event at same timestamp (same receipt batch) or most recent before.
 */
function findCausingDeathEvent(
  db: Database.Database,
  playerId: string,
  beforeOrAt: string
): { id: number; receipt_hash: string } | null {
  // First try exact timestamp match (same receipt batch)
  const exactMatch = db.prepare(`
    SELECT id, receipt_hash FROM chronicle_events
    WHERE player_id = ? AND kind = 'death' AND timestamp = ?
    ORDER BY id DESC LIMIT 1
  `).get(playerId, beforeOrAt) as { id: number; receipt_hash: string } | undefined;

  if (exactMatch) return exactMatch;

  // Fall back to most recent death before this timestamp
  const beforeMatch = db.prepare(`
    SELECT id, receipt_hash FROM chronicle_events
    WHERE player_id = ? AND kind = 'death' AND timestamp < ?
    ORDER BY timestamp DESC, id DESC LIMIT 1
  `).get(playerId, beforeOrAt) as { id: number; receipt_hash: string } | undefined;

  return beforeMatch ?? null;
}

/**
 * Materialize chronicle events from receipts.
 * Called by main materialize() after the primary handler.
 *
 * entity_id semantics by kind:
 *   - player_created: null (player_id is the entity)
 *   - death: killer_id or null
 *   - kill: victim_id
 *   - item_acquired/legendary_obtained: item_id
 *   - item_lost/legendary_lost: item_id
 *   - reputation_change: null (no distinct entity)
 *
 * Phase 4.4 E2: evidence_ref for death/item_lost/legendary_lost
 *   - death: self-referencing (points to itself)
 *   - item_lost/legendary_lost: points to causing death event
 */
export function materializeChronicle(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const action = ACTION_ALIASES[receipt.action] ?? receipt.action;
  const originalAction = receipt.action; // Store original for source_action
  const inputs = receipt.inputs ?? {};
  const playerId = receipt.actor_id;
  const timestamp = receipt.timestamp;

  switch (action) {
    // Player created
    case RECEIPT_ACTIONS.PLAYER_CREATED: {
      const name = (inputs.name as string) ?? `Guest_${playerId.slice(-4)}`;
      // entity_id: null (player_id is the entity)
      insertChronicleEvent(db, playerId, 'player_created', timestamp, originalAction, receiptHash, null, null, null, null, { name });
      break;
    }

    // Character create (Identity v0.1 - named character creation)
    // Only emit chronicle for successful creations (result='ok')
    case RECEIPT_ACTIONS.CHARACTER_CREATE: {
      if (receipt.result !== 'ok') break; // Only chronicle successful creations
      const charPlayerId = inputs.player_id as string;
      const name = inputs.name as string;
      if (!charPlayerId || !name) break;
      // entity_id: null (player_id is the entity)
      // Use charPlayerId as the chronicle subject (not actor_id which is 'system')
      insertChronicleEvent(db, charPlayerId, 'player_created', timestamp, originalAction, receiptHash, null, null, null, null, { name, auth_method: 'character' });
      break;
    }

    // Death (victim perspective)
    // Phase 4.4 E2: evidence_ref is self-referencing (insert then update)
    case RECEIPT_ACTIONS.DEATH: {
      const zone = (inputs.zone as string) ?? (inputs.map as string) ?? null;
      const x = (inputs.x as number) ?? (inputs.pos as { x: number })?.x ?? null;
      const y = (inputs.y as number) ?? (inputs.pos as { y: number })?.y ?? null;
      const cause = (inputs.cause as string) ?? 'unknown';
      const killerId = (inputs.killer_id as string) ?? null;
      // entity_id: killer_id (for dedup if same player dies twice in same receipt - rare)
      // Insert without evidence_ref first
      const eventId = insertChronicleEvent(db, playerId, 'death', timestamp, originalAction, receiptHash, zone, x, y, killerId, { cause, killer_id: killerId }, null);
      // If inserted (not duplicate), update with self-referencing evidence_ref
      if (eventId !== null) {
        const evidenceRef = buildEvidenceRef(eventId, receiptHash);
        updateEvidenceRef(db, eventId, evidenceRef);
      }
      break;
    }

    // Combat resolved (killer perspective - add 'kill' event for attacker)
    case 'combat_resolved': {
      const targetId = inputs.target_player_id as string;
      const zone = (inputs.map as string) ?? null;
      const pos = inputs.position as { x: number; y: number } | undefined;
      const x = pos?.x ?? null;
      const y = pos?.y ?? null;
      // entity_id: victim_id
      insertChronicleEvent(db, playerId, 'kill', timestamp, originalAction, receiptHash, zone, x, y, targetId, { victim_id: targetId });
      break;
    }

    // Item added to inventory
    case RECEIPT_ACTIONS.ITEM_ADDED_TO_INVENTORY: {
      const itemId = inputs.item_id as string;
      if (!itemId) break;
      // Check if item is legendary (requires items table lookup)
      const item = db.prepare(`SELECT meta_json FROM items WHERE item_id = ?`).get(itemId) as { meta_json: string } | undefined;
      let isLegendary = false;
      if (item?.meta_json) {
        try {
          const meta = JSON.parse(item.meta_json);
          isLegendary = !!meta.legendary;
        } catch { /* ignore parse errors */ }
      }
      const kind = isLegendary ? 'legendary_obtained' : 'item_acquired';
      // entity_id: item_id
      insertChronicleEvent(db, playerId, kind, timestamp, originalAction, receiptHash, null, null, null, itemId, { item_id: itemId });
      break;
    }

    // Item removed from inventory
    // Phase 4.4 E2: evidence_ref links to causing death event (if reason is death-related)
    case RECEIPT_ACTIONS.ITEM_REMOVED_FROM_INVENTORY: {
      const itemId = inputs.item_id as string;
      const reason = (inputs.reason as string) ?? 'unknown';
      if (!itemId) break;
      // Check if item is legendary
      const item = db.prepare(`SELECT meta_json FROM items WHERE item_id = ?`).get(itemId) as { meta_json: string } | undefined;
      let isLegendary = false;
      if (item?.meta_json) {
        try {
          const meta = JSON.parse(item.meta_json);
          isLegendary = !!meta.legendary;
        } catch { /* ignore parse errors */ }
      }
      const kind = isLegendary ? 'legendary_lost' : 'item_lost';

      // Phase 4.4 E2: Find causing death event for evidence linkage
      // Evidence is only linked for death-related item losses
      let evidenceRef: string | null = null;
      if (reason === 'death' || reason === 'death_drop') {
        const causingDeath = findCausingDeathEvent(db, playerId, timestamp);
        if (causingDeath) {
          evidenceRef = buildEvidenceRef(causingDeath.id, causingDeath.receipt_hash);
        }
      }

      // entity_id: item_id
      insertChronicleEvent(db, playerId, kind, timestamp, originalAction, receiptHash, null, null, null, itemId, { item_id: itemId, reason }, evidenceRef);
      break;
    }

    // Reputation event
    case RECEIPT_ACTIONS.REPUTATION_EVENT: {
      const eventType = (inputs.type as string) ?? receipt.action;
      const delta = (inputs.delta as number) ?? (inputs.penalty as number) ?? 0;
      // entity_id: null (no distinct entity)
      insertChronicleEvent(db, playerId, 'reputation_change', timestamp, originalAction, receiptHash, null, null, null, null, { event_type: eventType, delta });
      break;
    }

    // Property acquired (buyer perspective) — primary purchase or resale
    case RECEIPT_ACTIONS.PROPERTY_PURCHASED:
    case RECEIPT_ACTIONS.PROPERTY_TRANSFERRED: {
      const propertyId = inputs.property_id as string | undefined;
      if (!propertyId || !playerId) break;
      const price = typeof inputs.price === 'number' ? (inputs.price as number) : 0;
      const fromSeller = (inputs.seller_id as string) ?? null;
      // entity_id: property_id (dedup)
      insertChronicleEvent(db, playerId, 'property_acquired', timestamp, originalAction, receiptHash, null, null, null, propertyId, { property_id: propertyId, price, from: fromSeller });
      break;
    }

    default:
      // Not a chronicle-worthy event
      break;
  }
}
