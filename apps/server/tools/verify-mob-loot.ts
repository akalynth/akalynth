// Verify Mob Loot Spawn — receipt-derived item ids
//
// Guards the invariant that mob loot (training-mob goo + slime trophy) derives
// its item_id from the `mob_loot_spawned` receipt hash — the same convention as
// `item_minted` — rather than from wall-clock time. Properties checked:
//   1. The receipt body carries NO item_id (avoids a hash cycle).
//   2. item_id === generateItemId(computeReceiptHash(receipt)) (real functions).
//   3. ids are unique per spawn, even for identical (type, tile) loot.
//   4. ids are deterministic / replay-safe: replaying the same receipt chain
//      reproduces the exact same id sequence (no wall-clock dependence).
//   5. id format matches generateItemId (32-char hex).

import { spawnMobLoot, type MobLootWriteInput } from '../src/world/mobs.js';
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
      action: input.action,
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

test('mob_loot_spawned receipt body carries no item_id', () => {
  const w = makeChainWriter();
  spawnMobLoot('player:hero', 'training_slime_goo', 'Rookguard', 14, 14, deps(w));

  assert(w.written.length === 1, 'expected exactly one receipt written');
  const r = w.written[0];
  assert(r.action === 'mob_loot_spawned', `action should be mob_loot_spawned, got ${r.action}`);
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

console.log('\n✓ all mob-loot spawn checks passed');
