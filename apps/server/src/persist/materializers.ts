// Akalynth Receipt Materializers
// Phase 1 + 2: Transform receipts into SQLite rows (idempotent, transactional)

import { blake3 } from '@noble/hashes/blake3';
import type Database from 'better-sqlite3';
import type { AuditReceipt } from '../../../../packages/shared/types.js';
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
  // Phase 3.2: Protected slots
  [RECEIPT_ACTIONS.INVENTORY_SLOT_CHANGED]: handleInventorySlotChanged,
  // Phase 3.5: Player heat
  [RECEIPT_ACTIONS.PLAYER_HEAT_CHANGED]: handlePlayerHeatChanged,
  [RECEIPT_ACTIONS.HEAT_PENALTY_APPLIED]: handleHeatPenaltyApplied,
  [RECEIPT_ACTIONS.HEAT_TEM_ESCALATION]: handleHeatTemEscalation,
  // Origin Act: Player's first meaningful action
  [RECEIPT_ACTIONS.ORIGIN_ACT_SEALED]: handleOriginActSealed,
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
  const playerId = receipt.player_id;
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
  const playerId = receipt.player_id;
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
  const playerId = receipt.player_id;
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
  const playerId = receipt.player_id;
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
    { player_id: receipt.player_id, action: 'dropped', timestamp: receipt.timestamp },
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

  const newOwner = (inputs.new_owner as string) ?? receipt.player_id;

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
  `).run(receipt.player_id, `Guest_${receipt.player_id.slice(-4)}`, receipt.timestamp, receiptHash);

  // Safety net: ensure item exists (handles receipt reordering edge cases)
  // This creates a stub row if item_minted receipt hasn't been processed yet
  db.prepare(`
    INSERT OR IGNORE INTO items (item_id, item_type, created_at, genesis_receipt, meta_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(itemId, 'unknown', receipt.timestamp, receiptHash, '{}');

  // Upsert into inventory
  db.prepare(`
    INSERT INTO inventory_items (item_id, owner_player_id, slot, updated_at, last_receipt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(item_id) DO UPDATE SET
      owner_player_id = excluded.owner_player_id,
      slot = excluded.slot,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
  `).run(itemId, receipt.player_id, slot, receipt.timestamp, receiptHash);
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
    player_id: receipt.player_id,
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
  const playerId = receipt.player_id;

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
// Player Heat Handlers (Phase 3.5)
// ============================================================================

/**
 * Handle heat_changed: Project absolute player heat value.
 * Uses new_score directly (not delta), so replay converges to same state.
 * Timestamp guard ensures older receipts don't overwrite newer state.
 */
function handlePlayerHeatChanged(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const playerId = receipt.player_id;
  const newScore = inputs.new_score as number;

  // Guard: reject non-number, NaN, Infinity
  if (typeof newScore !== 'number' || !Number.isFinite(newScore)) return;

  // Clamp to sane bounds (0..1000)
  const HEAT_MAX = 1000;
  const clampedScore = Math.max(0, Math.min(HEAT_MAX, newScore));

  // UPSERT with timestamp guard - older receipts won't overwrite newer state
  // Uses > (not >=) so same-timestamp receipts don't cause non-determinism
  db.prepare(`
    INSERT INTO player_heat (player_id, heat, updated_at, last_receipt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      heat = excluded.heat,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
    WHERE excluded.updated_at > player_heat.updated_at
  `).run(playerId, clampedScore, receipt.timestamp, receiptHash);
}

/**
 * Handle heat_penalty_applied: Project penalty window.
 * Computes penalty_until_ms from receipt timestamp + duration_ms.
 * Timestamp guard ensures older receipts don't overwrite newer state.
 */
function handleHeatPenaltyApplied(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const playerId = receipt.player_id;

  const durationMs = Number((inputs as Record<string, unknown>).duration_ms);
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;

  const tsMs = Date.parse(receipt.timestamp);
  if (!Number.isFinite(tsMs)) return;

  const penaltyUntilMs = tsMs + durationMs;

  // Uses > (not >=) so same-timestamp receipts don't cause non-determinism
  db.prepare(`
    INSERT INTO player_heat (player_id, heat, penalty_until_ms, updated_at, last_receipt)
    VALUES (?, 0, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      penalty_until_ms = excluded.penalty_until_ms,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
    WHERE excluded.updated_at > player_heat.updated_at
  `).run(playerId, penaltyUntilMs, receipt.timestamp, receiptHash);
}

/**
 * Handle heat_tem_escalation: Project TEM trigger timestamp.
 * Stores last_tem_ms for cooldown window computation on login restore.
 * Timestamp guard ensures older receipts don't overwrite newer state.
 */
function handleHeatTemEscalation(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const playerId = receipt.player_id;

  const tsMs = Date.parse(receipt.timestamp);
  if (!Number.isFinite(tsMs)) return;

  // Uses > (not >=) so same-timestamp receipts don't cause non-determinism
  db.prepare(`
    INSERT INTO player_heat (player_id, heat, last_tem_ms, updated_at, last_receipt)
    VALUES (?, 0, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      last_tem_ms = excluded.last_tem_ms,
      updated_at = excluded.updated_at,
      last_receipt = excluded.last_receipt
    WHERE excluded.updated_at > player_heat.updated_at
  `).run(playerId, tsMs, receipt.timestamp, receiptHash);
}

// ============================================================================
// Origin Act Handler
// ============================================================================

/**
 * Handle origin_act_sealed: Seal the player's origin act (first meaningful action).
 *
 * CRITICAL: Timestamp-ordered, earliest-timestamp wins.
 * - If no origin exists: set it
 * - If this origin is earlier than existing: overwrite (shouldn't happen in practice)
 * - If this origin is later than existing: skip
 *
 * This makes replay truly order-independent and deterministic.
 */
function handleOriginActSealed(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const playerId = receipt.player_id;
  const inputs = receipt.inputs ?? {};
  const triggerAction = inputs.trigger_action as string;
  const timestamp = receipt.timestamp;

  if (!triggerAction) return;

  // Earliest-timestamp wins (deterministic regardless of replay order)
  // The condition: origin_receipt_id IS NULL OR origin_sealed_at > timestamp
  // means we only update if no origin exists OR this one is earlier
  db.prepare(`
    UPDATE players
    SET origin_receipt_id = ?, origin_action = ?, origin_sealed_at = ?
    WHERE player_id = ?
      AND (origin_receipt_id IS NULL OR origin_sealed_at > ?)
  `).run(receiptHash, triggerAction, timestamp, playerId, timestamp);

  // Chronicle event for forensic record (idempotent via dedup)
  insertChronicleEvent(
    db,
    playerId,
    'origin_sealed',
    timestamp,
    'origin_act_sealed',
    receiptHash,
    null,
    null,
    null,
    null,
    { trigger_action: triggerAction }
  );
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
  const playerId = receipt.player_id;
  const timestamp = receipt.timestamp;

  switch (action) {
    // Player created
    case RECEIPT_ACTIONS.PLAYER_CREATED: {
      const name = (inputs.name as string) ?? `Guest_${playerId.slice(-4)}`;
      // entity_id: null (player_id is the entity)
      insertChronicleEvent(db, playerId, 'player_created', timestamp, originalAction, receiptHash, null, null, null, null, { name });
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

    default:
      // Not a chronicle-worthy event
      break;
  }
}
