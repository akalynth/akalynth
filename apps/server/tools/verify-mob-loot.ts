// Verify Mob Loot Spawn — receipt-derived item ids + item_minted at spawn
//
// Guards the invariant that mob loot (training-mob goo + slime trophy) is minted
// via `item_minted` at spawn time, giving each item a durable `items` DB row
// before pickup (matching shop and legendary items). Also checks:
//   1. The receipt body carries NO item_id (avoids a hash cycle).
//   2. item_id === generateItemId(computeReceiptHash(receipt)) (real functions).
//   3. ids are unique per spawn, even for identical (type, tile) loot.
//   4. ids are deterministic / replay-safe: replaying the same receipt chain
//      reproduces the exact same id sequence (no wall-clock dependence).
//   5. id format matches generateItemId (32-char hex).
//   6. The emitted receipt action is `item_minted` (not `mob_loot_spawned`).

import Database from 'better-sqlite3';
import { spawnMobLoot, type MobLootWriteInput } from '../src/world/mobs.js';
import { computeReceiptHash, generateItemId } from '../src/persist/index.js';
import { materialize } from '../src/persist/materializers.js';
import { initSchema } from '../src/persist/schema.js';
import type { AuditReceipt } from '../../../packages/shared/types.js';

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  initSchema(db);
  return db;
}

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

/**
 * Deterministic stand-in for the real audit logger: chains receipts exactly
 * like the production logger (incrementing sequence, prev_hash = last
 * event_hash, logical clock) so each write produces distinct content — and a
 * fresh writer started from the same seed replays identically. event_hash is
 * filled with the real content hash; computeReceiptHash strips it before
 * canonicalizing, so this matches what the live chain stores.
 */
function makeChainWriter(seedMs = 1_700_000_000_000) {
  let sequence = 0;
  let prevHash = 'genesis';
  const written: AuditReceipt[] = [];

  const write = (input: MobLootWriteInput): AuditReceipt => {
    sequence += 1;
    const receipt: AuditReceipt = {
      sequence,
      timestamp: new Date(seedMs + sequence * 1000).toISOString(),
      prev_hash: prevHash,
      event_hash: '',
      signature: '',
      actor_id: input.actor_id ?? input.player_id ?? '',
      action: input.action as string,
      inputs: input.inputs,
      result: input.result,
      inputs_hash: 'test-inputs-hash',
      outputs_hash: 'test-outputs-hash',
    };
    receipt.event_hash = computeReceiptHash(receipt);
    prevHash = receipt.event_hash;
    written.push(receipt);
    return receipt;
  };

  return { write, written };
}

function deps(writer: { write: (i: MobLootWriteInput) => AuditReceipt }) {
  return { writeReceipt: writer.write, computeReceiptHash, generateItemId };
}

// ---------------------------------------------------------------------------

test('item_minted receipt body carries no item_id (hash-cycle guard)', () => {
  const w = makeChainWriter();
  spawnMobLoot('player:hero', 'training_slime_goo', 'Rookguard', 14, 14, deps(w));

  assert(w.written.length === 1, 'expected exactly one receipt written');
  const r = w.written[0];
  assert(r.action === 'item_minted', `action should be item_minted, got ${r.action}`);
  assert(!('item_id' in r.inputs), 'receipt inputs must NOT contain item_id (hash-cycle guard)');
  assert(r.inputs.item_type === 'training_slime_goo', 'item_type should be in receipt body');
  assert(r.inputs.map === 'Rookguard' && r.inputs.x === 14 && r.inputs.y === 14, 'position/map should be in body');
});

test('item_id is derived from the receipt hash via real generateItemId', () => {
  const w = makeChainWriter();
  const spawn = spawnMobLoot('player:hero', 'slime', 'Rookguard', 14, 14, deps(w));
  const expected = generateItemId(computeReceiptHash(w.written[0]));
  assert(spawn.itemId === expected, `itemId should equal generateItemId(hash); got ${spawn.itemId} expected ${expected}`);
});

test('item_id format is 32-char lowercase hex', () => {
  const w = makeChainWriter();
  const spawn = spawnMobLoot('player:hero', 'slime', 'Rookguard', 14, 14, deps(w));
  assert(/^[0-9a-f]{32}$/.test(spawn.itemId), `itemId not 32-hex: ${spawn.itemId}`);
});

test('identical loot at the same tile yields distinct ids per spawn', () => {
  const w = makeChainWriter();
  // Same attacker, type, and tile — the old Date.now() id could collide; the
  // receipt-derived id must not (each receipt is a distinct chain link).
  const a = spawnMobLoot('player:hero', 'slime', 'Rookguard', 14, 14, deps(w));
  const b = spawnMobLoot('player:hero', 'slime', 'Rookguard', 14, 14, deps(w));
  const c = spawnMobLoot('player:hero', 'training_slime_goo', 'Rookguard', 14, 14, deps(w));
  const ids = new Set([a.itemId, b.itemId, c.itemId]);
  assert(ids.size === 3, `expected 3 distinct ids, got ${ids.size}: ${[...ids].join(', ')}`);
});

test('ids are deterministic / replay-safe across identical chains', () => {
  const seq = (w: ReturnType<typeof makeChainWriter>) => [
    spawnMobLoot('player:hero', 'training_slime_goo', 'Rookguard', 14, 14, deps(w)).itemId,
    spawnMobLoot('player:hero', 'slime', 'Rookguard', 14, 14, deps(w)).itemId,
    spawnMobLoot('player:foe', 'city_rat_goo', 'Azura', 40, 20, deps(w)).itemId,
  ];
  const run1 = seq(makeChainWriter());
  const run2 = seq(makeChainWriter());
  assert(JSON.stringify(run1) === JSON.stringify(run2), `replay diverged:\n  ${run1.join(',')}\n  ${run2.join(',')}`);
});

test('returned loot mirrors the requested type/position', () => {
  const w = makeChainWriter();
  const spawn = spawnMobLoot('player:hero', 'city_rat_goo', 'Azura', 40, 20, deps(w));
  assert(spawn.itemType === 'city_rat_goo', 'itemType mismatch');
  assert(spawn.map === 'Azura' && spawn.x === 40 && spawn.y === 20, 'position/map mismatch');
});

test('item_minted materializer creates items row at spawn (before pickup)', () => {
  const db = freshDb();
  const w = makeChainWriter();
  const spawn = spawnMobLoot('player:hero', 'training_slime_goo', 'Rookguard', 14, 14, deps(w));

  // Run the written item_minted receipt through the real materializer.
  materialize(db, w.written[0]);

  const row = db.prepare('SELECT item_id, item_type FROM items WHERE item_id = ?').get(spawn.itemId) as
    | { item_id: string; item_type: string }
    | undefined;
  assert(row !== undefined, `items row should exist for ${spawn.itemId} after spawn (before pickup)`);
  assert(row!.item_type === 'training_slime_goo', `item_type should be training_slime_goo, got '${row!.item_type}'`);
});

test('meta is forwarded into item_minted receipt inputs', () => {
  const w = makeChainWriter();
  const meta = { rare: true, tier: 2 };
  spawnMobLoot('player:hero', 'slime', 'Rookguard', 14, 14, { ...deps(w), meta });
  const r = w.written[0];
  assert(r.action === 'item_minted', `action should be item_minted`);
  assert(JSON.stringify(r.inputs.meta) === JSON.stringify(meta), `meta mismatch: ${JSON.stringify(r.inputs.meta)}`);
});

console.log('\n✓ all mob-loot spawn checks passed');
