// Akalynth Receipt Materializers
// Phase 1: Transform receipts into SQLite rows (idempotent, transactional)

import type Database from 'better-sqlite3';
import type { AuditReceipt } from '../../../shared/types.js';
import { ACTION_ALIASES, RECEIPT_ACTIONS } from './types.js';
import { computeReceiptHash } from './hash.js';

// ============================================================================
// Handler Registry
// ============================================================================

type Handler = (db: Database.Database, receipt: AuditReceipt, receiptHash: string) => void;

const HANDLERS: Record<string, Handler> = {
  [RECEIPT_ACTIONS.PLAYER_CREATED]: handlePlayerCreated,
  [RECEIPT_ACTIONS.PLAYER_RENAMED]: handlePlayerRenamed,
  [RECEIPT_ACTIONS.DEATH]: handleDeath,
  [RECEIPT_ACTIONS.REPUTATION_EVENT]: handleReputationEvent,
  [RECEIPT_ACTIONS.WORLD_OBJECT_SPAWNED]: handleWorldObjectSpawned,
  [RECEIPT_ACTIONS.WORLD_OBJECT_TRANSFERRED]: handleWorldObjectTransferred,
  [RECEIPT_ACTIONS.WORLD_OBJECT_REMOVED]: handleWorldObjectRemoved,
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

  if (!handler) {
    // Unknown action type - no-op (not all receipts are persisted)
    return;
  }

  // Compute canonical receipt hash
  const receiptHash = computeReceiptHash(receipt);

  // Wrap in transaction for atomicity
  db.transaction(() => {
    handler(db, receipt, receiptHash);

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

  // INSERT OR IGNORE (idempotent via UNIQUE created_receipt)
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO players (player_id, name, created_at, created_receipt, deleted_at)
    VALUES (?, ?, ?, ?, NULL)
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
