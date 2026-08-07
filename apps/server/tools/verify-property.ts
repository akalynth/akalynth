// Verify Property Registry v0 (House Ownership)
// Invariants:
//   P-H1 single owner (primary only from unowned; resale only from owner; no double-increment)
//   P-H2 gold conservation / no mint (primary = sink; resale = net-zero buyer↔seller)
//   P-H3 receipt-derived state (rebuilt purely from replaying receipts)
//   P-H4 guard rails (no funds → no receipts; can't list unowned; can't buy own; price bounds; ungated buy works)
//   P-H5 replay determinism (clear + replay → identical projection + balances)
//   P-H6 projection == durable DB (materializer agrees with in-memory reducer)

import Database from 'better-sqlite3';
import {
  clearPropertyProjection,
  applyReceiptToProperty,
  getProperty,
  getAllProperties,
  isValidPrice,
  propertyPublicFromProjection,
} from '../src/world/property.js';
import {
  clearTreasuryProjection,
  getGoldBalance,
  canAfford,
  applyReceiptToTreasury,
} from '../src/world/treasury.js';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import {
  WALLET_CREDIT_ACTION,
  WALLET_DEBIT_ACTION,
  PROPERTY_CREATED_ACTION,
  PROPERTY_LISTED_ACTION,
  PROPERTY_PURCHASED_ACTION,
  PROPERTY_TRANSFERRED_ACTION,
} from '../../../packages/shared/types.js';
import {
  computeEventHash,
  computeInputsHash,
  computeOutputsHash,
  GENESIS_MARKER,
} from '@akalynth/coordination-kernel';
import { initSchema } from '../src/persist/schema.js';
import { materialize } from '../src/persist/materializers.js';

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

function assertEquals<T>(actual: T, expected: T, msg?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ============================================================================
// Receipt harness
// ============================================================================

let lastEventHash: string | null = null;
let lastSequence = 0;
let logicalNowMs = 1_700_000_000_000;
const receipts: AuditReceipt[] = [];

function buildReceipt(
  receipt: Omit<
    AuditReceipt,
    'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'
  >
): AuditReceipt {
  const inputs_hash = computeInputsHash(receipt.inputs);
  const outputs_hash = computeOutputsHash(receipt.result);
  const timestamp = new Date(logicalNowMs).toISOString();
  logicalNowMs += 1000;
  const sequence = lastSequence + 1;
  const prev_hash = lastEventHash ?? GENESIS_MARKER;
  const body = { ...receipt, sequence, timestamp, prev_hash, inputs_hash, outputs_hash };
  const event_hash = computeEventHash(body);
  const full: AuditReceipt = { ...body, event_hash, signature: 'test-signature' };
  lastEventHash = event_hash;
  lastSequence = sequence;
  return full;
}

function emit(
  receipt: Omit<
    AuditReceipt,
    'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'
  >
): AuditReceipt {
  const full = buildReceipt(receipt);
  receipts.push(full);
  applyReceiptToProperty(full);
  applyReceiptToTreasury(full);
  return full;
}

function resetState() {
  clearPropertyProjection();
  clearTreasuryProjection();
  receipts.length = 0;
  lastEventHash = null;
  lastSequence = 0;
  logicalNowMs = 1_700_000_000_000;
}

// ----- helpers that mirror the WS handler decision logic -----

function seedProperty(propertyId: string, primaryPrice: number) {
  const [zone, plotId] = propertyId.split(':');
  emit({
    actor_id: 'system',
    action: PROPERTY_CREATED_ACTION,
    inputs: { property_id: propertyId, zone, plot_id: plotId, x: 1, y: 1, width: 2, height: 2, district: 'Test', primary_price_gold: primaryPrice },
    result: 'ok',
  });
}

function fund(player: string, amount: number) {
  emit({ actor_id: player, action: WALLET_CREDIT_ACTION, inputs: { amount, reason: 'debug_grant' }, result: 'ok' });
}

type SimResult = { ok: true } | { ok: false; reason: string };

function simPrimaryBuy(buyer: string, propertyId: string): SimResult {
  const p = getProperty(propertyId);
  if (!p) return { ok: false, reason: 'unknown_plot' };
  if (p.owner_player_id === buyer) return { ok: false, reason: 'cannot_buy_own' };
  if (p.status !== 'unowned') return { ok: false, reason: 'not_for_sale' };
  const price = p.primary_price_gold;
  if (!canAfford(buyer, price)) return { ok: false, reason: 'insufficient_gold' };
  emit({ actor_id: buyer, action: WALLET_DEBIT_ACTION, inputs: { amount: price, reason: `property_purchase:${propertyId}` }, result: 'ok' });
  emit({ actor_id: buyer, action: PROPERTY_PURCHASED_ACTION, inputs: { property_id: propertyId, price }, result: 'ok' });
  return { ok: true };
}

function simResaleBuy(buyer: string, propertyId: string): SimResult {
  const p = getProperty(propertyId);
  if (!p) return { ok: false, reason: 'unknown_plot' };
  if (p.owner_player_id === buyer) return { ok: false, reason: 'cannot_buy_own' };
  if (p.status !== 'listed' || p.listed_price_gold == null) return { ok: false, reason: 'not_for_sale' };
  const price = p.listed_price_gold;
  const seller = p.owner_player_id!;
  if (!canAfford(buyer, price)) return { ok: false, reason: 'insufficient_gold' };
  emit({ actor_id: buyer, action: WALLET_DEBIT_ACTION, inputs: { amount: price, reason: `property_transfer:${propertyId}` }, result: 'ok' });
  emit({ actor_id: seller, action: WALLET_CREDIT_ACTION, inputs: { amount: price, reason: `property_sale:${propertyId}` }, result: 'ok' });
  emit({ actor_id: buyer, action: PROPERTY_TRANSFERRED_ACTION, inputs: { property_id: propertyId, seller_id: seller, price }, result: 'ok' });
  return { ok: true };
}

function simList(owner: string, propertyId: string, price: number): SimResult {
  const p = getProperty(propertyId);
  if (!p) return { ok: false, reason: 'unknown_plot' };
  if (p.owner_player_id !== owner) return { ok: false, reason: 'not_owner' };
  if (!isValidPrice(price)) return { ok: false, reason: 'invalid_price' };
  emit({ actor_id: owner, action: PROPERTY_LISTED_ACTION, inputs: { property_id: propertyId, price }, result: 'ok' });
  return { ok: true };
}

function totalGold(players: string[]): number {
  return players.reduce((sum, p) => sum + getGoldBalance(p), 0);
}

// ============================================================================
// Tests
// ============================================================================

test('P-H1: primary purchase claims an unowned plot (single owner)', () => {
  resetState();
  seedProperty('Azura:H1', 500);
  fund('p1', 1000);
  const r = simPrimaryBuy('p1', 'Azura:H1');
  assertEquals(r.ok, true, 'buy should succeed');
  const p = getProperty('Azura:H1')!;
  assertEquals(p.owner_player_id, 'p1');
  assertEquals(p.status, 'owned');
  assertEquals(p.sale_count, 1);
});

test('P-H1: a second primary purchase on an owned plot is a no-op (reducer guard)', () => {
  resetState();
  seedProperty('Azura:H1', 500);
  fund('p1', 1000);
  fund('p2', 1000);
  simPrimaryBuy('p1', 'Azura:H1');
  // Force a raw second primary purchase receipt (bypassing the handler gate).
  emit({ actor_id: 'p2', action: PROPERTY_PURCHASED_ACTION, inputs: { property_id: 'Azura:H1', price: 500 }, result: 'ok' });
  const p = getProperty('Azura:H1')!;
  assertEquals(p.owner_player_id, 'p1', 'owner must remain p1');
  assertEquals(p.sale_count, 1, 'sale_count must not increment on rejected purchase');
});

test('P-H2: primary purchase is a pure gold sink (no mint)', () => {
  resetState();
  seedProperty('Azura:H2', 1000);
  fund('p1', 1500);
  const before = totalGold(['p1']);
  simPrimaryBuy('p1', 'Azura:H2');
  const after = totalGold(['p1']);
  assertEquals(before - after, 1000, 'exactly the price must leave circulation (sink)');
  // No wallet_credit tied to a primary purchase
  const orphanCredit = receipts.find(
    (r) => r.action === WALLET_CREDIT_ACTION && String(r.inputs?.reason ?? '').startsWith('property_')
  );
  assert(!orphanCredit, 'primary purchase must not emit any property credit');
});

test('P-H2: resale conserves gold (buyer debit == seller credit, net zero)', () => {
  resetState();
  seedProperty('Azura:H3', 2000);
  fund('seller', 3000);
  fund('buyer', 3000);
  simPrimaryBuy('seller', 'Azura:H3'); // seller now owns it (paid 2000 sink)
  simList('seller', 'Azura:H3', 2500);
  const totalBefore = totalGold(['seller', 'buyer']);
  const sellerBefore = getGoldBalance('seller');
  const buyerBefore = getGoldBalance('buyer');
  const r = simResaleBuy('buyer', 'Azura:H3');
  assertEquals(r.ok, true, 'resale should succeed');
  assertEquals(getGoldBalance('buyer'), buyerBefore - 2500, 'buyer debited listed price');
  assertEquals(getGoldBalance('seller'), sellerBefore + 2500, 'seller credited listed price');
  assertEquals(totalGold(['seller', 'buyer']), totalBefore, 'resale conserves total gold');
  const p = getProperty('Azura:H3')!;
  assertEquals(p.owner_player_id, 'buyer');
  assertEquals(p.sale_count, 2, 'sale_count = primary + resale');
  assertEquals(p.owner_history.map((h) => h.to), ['seller', 'buyer'], 'ownership trail Treasury→seller→buyer');
});

test('P-H4: cannot buy without funds (no receipts, balance unchanged)', () => {
  resetState();
  seedProperty('Azura:H1', 500);
  fund('broke', 100);
  const countBefore = receipts.length;
  const balBefore = getGoldBalance('broke');
  const r = simPrimaryBuy('broke', 'Azura:H1');
  assertEquals(r.ok, false);
  assertEquals(receipts.length, countBefore, 'no receipts emitted on failed buy');
  assertEquals(getGoldBalance('broke'), balBefore, 'balance unchanged');
  assertEquals(getProperty('Azura:H1')!.owner_player_id, null, 'plot remains unowned');
});

test('P-H4: cannot list a plot you do not own; cannot buy your own; price bounds enforced', () => {
  resetState();
  seedProperty('Azura:H1', 500);
  fund('owner', 1000);
  simPrimaryBuy('owner', 'Azura:H1');

  assertEquals(simList('stranger', 'Azura:H1', 700).ok, false, 'non-owner cannot list');
  assertEquals(simResaleBuy('owner', 'Azura:H1').ok, false, 'cannot buy own (also not listed)');
  assertEquals(simList('owner', 'Azura:H1', 0).ok, false, 'price 0 invalid');
  assertEquals(simList('owner', 'Azura:H1', 2_000_000).ok, false, 'price over bound invalid');
  assertEquals(simList('owner', 'Azura:H1', 1.5).ok, false, 'non-integer price invalid');
});

test('P-H4: a standard plot is buyable by an ungated player (no capability gate)', () => {
  resetState();
  seedProperty('Azura:H1', 500);
  fund('rando', 600); // no badge, no capability — must still succeed
  assertEquals(simPrimaryBuy('rando', 'Azura:H1').ok, true, 'ungated player buys standard plot');
  assertEquals(getProperty('Azura:H1')!.owner_player_id, 'rando');
});

test('P-H3 + P-H5: state is receipt-derived and replay-deterministic', () => {
  resetState();
  seedProperty('Azura:H1', 500);
  fund('a', 5000);
  fund('b', 5000);
  simPrimaryBuy('a', 'Azura:H1');
  simList('a', 'Azura:H1', 800);
  simResaleBuy('b', 'Azura:H1');
  simList('b', 'Azura:H1', 1200);

  const snapshot = JSON.stringify(getAllProperties());
  const balA = getGoldBalance('a');
  const balB = getGoldBalance('b');
  const captured = receipts.slice();

  // Replay from scratch
  clearPropertyProjection();
  clearTreasuryProjection();
  for (const r of captured) {
    applyReceiptToProperty(r);
    applyReceiptToTreasury(r);
  }
  assertEquals(JSON.stringify(getAllProperties()), snapshot, 'projection identical after replay');
  assertEquals(getGoldBalance('a'), balA, 'balance a identical after replay');
  assertEquals(getGoldBalance('b'), balB, 'balance b identical after replay');
});

test('P-H7: shared observer sees owner and provenance without raw owner id', () => {
  resetState();
  seedProperty('Azura:H1', 500);
  fund('player-a', 1000);
  assertEquals(simPrimaryBuy('player-a', 'Azura:H1').ok, true, 'purchase should succeed');

  const purchaseReceipt = receipts.findLast((r) => r.action === PROPERTY_PURCHASED_ACTION)!;
  const publicView = propertyPublicFromProjection(getProperty('Azura:H1')!, (playerId) =>
    playerId === 'player-a' ? 'Sovereign' : null
  );

  assertEquals(publicView.status, 'owned');
  assertEquals(publicView.owner_name, 'Sovereign');
  assertEquals(publicView.provenance_receipt_hash, purchaseReceipt.event_hash);
  assert(!('owner_player_id' in publicView), 'public view must not expose raw owner id');
  assert(!JSON.stringify(publicView).includes('player-a'), 'public view must not leak raw owner id');

  const captured = receipts.slice();
  clearPropertyProjection();
  clearTreasuryProjection();
  for (const r of captured) {
    applyReceiptToProperty(r);
    applyReceiptToTreasury(r);
  }
  const replayedView = propertyPublicFromProjection(getProperty('Azura:H1')!, (playerId) =>
    playerId === 'player-a' ? 'Sovereign' : null
  );
  assertEquals(replayedView.owner_name, publicView.owner_name, 'replay preserves public owner');
  assertEquals(replayedView.provenance_receipt_hash, publicView.provenance_receipt_hash, 'replay preserves provenance');
});

test('P-H6: durable DB materialization equals in-memory projection (incl. no double sale_count on re-materialize)', () => {
  resetState();
  seedProperty('Azura:H1', 500);
  fund('a', 5000);
  fund('b', 5000);
  simPrimaryBuy('a', 'Azura:H1');
  simList('a', 'Azura:H1', 800);
  simResaleBuy('b', 'Azura:H1');

  const captured = receipts.slice();

  const db = new Database(':memory:');
  initSchema(db); // migrates to current schema (v13)
  // Satisfy chronicle FK without coupling to player_created in this economic scenario.
  const insPlayer = db.prepare(
    `INSERT OR IGNORE INTO players (player_id, name, created_at, created_receipt, auth_method, name_lower) VALUES (?, ?, ?, ?, 'guest', ?)`
  );
  for (const pid of ['a', 'b']) insPlayer.run(pid, pid, new Date().toISOString(), `seed:${pid}`, pid);

  // Materialize twice to prove idempotency (sale_count must not double-count).
  for (const r of captured) materialize(db, r);
  for (const r of captured) materialize(db, r);

  const row = db.prepare(`SELECT * FROM properties WHERE property_id = ?`).get('Azura:H1') as {
    owner_player_id: string | null;
    status: string;
    sale_count: number;
    listed_price_gold: number | null;
    owner_history: string;
  };
  const proj = getProperty('Azura:H1')!;

  assertEquals(row.owner_player_id, proj.owner_player_id, 'owner matches');
  assertEquals(row.status, proj.status, 'status matches');
  assertEquals(row.sale_count, proj.sale_count, 'sale_count matches (no double-count on re-materialize)');
  assertEquals(row.sale_count, 2, 'sale_count is exactly 2 (primary + resale)');
  assertEquals(row.listed_price_gold, proj.listed_price_gold, 'listed price matches');
  const dbHistory = JSON.parse(row.owner_history) as Array<{ from: string | null; to: string; action: string; receipt_hash: string }>;
  assertEquals(
    dbHistory.map((h) => `${h.from}->${h.to}:${h.action}`),
    proj.owner_history.map((h) => `${h.from}->${h.to}:${h.action}`),
    'owner_history matches'
  );
  assertEquals(
    dbHistory.map((h) => h.receipt_hash),
    proj.owner_history.map((h) => h.receipt_hash),
    'owner_history provenance matches'
  );
  db.close();
});

console.log('\n✓ All property registry tests passed');
