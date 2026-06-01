// Verify Item Pickup Type — item_type survives materialization at pickup
//
// Since #82, mob loot (`*_goo`, `slime`) is now emitted as `item_minted` at
// spawn time, so each item has a durable `items` row before pickup — the same
// as shop and legendary items. The `item_added_to_inventory` handler still
// carries item_type for backward-compat with any old `mob_loot_spawned`
// receipts on existing chains (those have no materializer, so items row is
// created at pickup via the type carried on the pickup receipt).
//
// Drives the REAL materializer against a real (in-memory) SQLite schema. Checks:
//   1. A pickup receipt carrying item_type creates an items row with that type
//      (backward-compat path for old mob_loot_spawned receipts).
//   2. Backward-compat: a pickup receipt WITHOUT item_type falls back to 'unknown'
//      (so replay of older chains is unchanged).
//   3. The fallback never clobbers a minted item: when the real item_minted row
//      already exists (as all mob loot now has at spawn), a later
//      item_added_to_inventory without item_type is a no-op (INSERT OR IGNORE)
//      and the real type is preserved.

import Database from 'better-sqlite3';
import { initSchema } from '../src/persist/schema.js';
import { materialize } from '../src/persist/materializers.js';
import { computeReceiptHash, generateItemId } from '../src/persist/index.js';
import type { AuditReceipt } from '../../../packages/shared/types.js';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err}`);
    process.exit(1);
  }
}

function assert(condition: unknown, msg: string) {
  if (!condition) throw new Error(msg);
}

let seq = 0;
function makeReceipt(action: string, inputs: Record<string, unknown>, actorId = 'ci_player'): AuditReceipt {
  seq += 1;
  const r: AuditReceipt = {
    sequence: seq,
    timestamp: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
    prev_hash: 'genesis',
    event_hash: '',
    signature: '',
    actor_id: actorId,
    action,
    inputs,
    result: 'ok',
    inputs_hash: 'test-inputs-hash',
    outputs_hash: 'test-outputs-hash',
  };
  r.event_hash = computeReceiptHash(r);
  return r;
}

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  initSchema(db);
  return db;
}

function itemType(db: Database.Database, itemId: string): string | undefined {
  const row = db.prepare('SELECT item_type FROM items WHERE item_id = ?').get(itemId) as
    | { item_type: string }
    | undefined;
  return row?.item_type;
}

// ---------------------------------------------------------------------------

test('pickup receipt carrying item_type records that type (not unknown)', () => {
  const db = freshDb();
  const itemId = 'a1b2c3d4e5f600112233445566778899';
  materialize(db, makeReceipt('item_added_to_inventory', {
    item_id: itemId,
    item_type: 'slime',
    slot: null,
    source: 'pickup',
  }));
  assert(itemType(db, itemId) === 'slime', `expected 'slime', got '${itemType(db, itemId)}'`);
});

test('pickup receipt without item_type falls back to unknown (backward-compat)', () => {
  const db = freshDb();
  const itemId = 'ffeeddccbbaa00998877665544332211';
  // Simulates an older receipt written before the fix.
  materialize(db, makeReceipt('item_added_to_inventory', {
    item_id: itemId,
    slot: null,
    source: 'pickup',
  }));
  assert(itemType(db, itemId) === 'unknown', `expected 'unknown', got '${itemType(db, itemId)}'`);
});

test('fallback never clobbers a minted item row', () => {
  const db = freshDb();
  // Mint a real item first; its id is derived from the mint receipt hash.
  const mint = makeReceipt('item_minted', { item_type: 'healing_herb', meta: {} });
  materialize(db, mint);
  const mintedId = generateItemId(computeReceiptHash(mint));
  assert(itemType(db, mintedId) === 'healing_herb', `mint should create healing_herb row, got '${itemType(db, mintedId)}'`);

  // A later add-to-inventory WITHOUT item_type must not downgrade it to 'unknown'.
  materialize(db, makeReceipt('item_added_to_inventory', { item_id: mintedId, slot: null, source: 'pickup' }));
  assert(itemType(db, mintedId) === 'healing_herb', `minted type must survive; got '${itemType(db, mintedId)}'`);

  // And it should be owned in inventory (item_type lives in `items`, not here).
  const inv = db.prepare('SELECT item_id FROM inventory_items WHERE item_id = ?').get(mintedId);
  assert(inv !== undefined, 'minted item should be in inventory_items after add');
});

console.log('\n✓ all item-pickup-type checks passed');
