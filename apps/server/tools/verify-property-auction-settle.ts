// Verify Property Auction close→settle (Step 4b).
//
// settleDueAuctions(nowMs, writeReceipt) is driven with an INJECTED `nowMs` and a
// writeReceipt that fills + applies receipts to BOTH reducers (simulating the
// live audit write-hook). No Date.now() is used anywhere in this test's truth.
//
// Assertions:
//   due resale + bidder   → settlement + seller credit (winner escrow → seller)
//   due resale + no bids   → settlement winner_id null, NO wallet movement, revert
//   not-yet-due           → nothing emitted
//   replay after settle    → projection matches WITHOUT any clock
//   restart re-arm         → due-but-unsettled auction settles after replay+scan
//   idempotency            → a repeated scan does not double-settle

import {
  clearPropertyProjection,
  applyReceiptToProperty,
  getProperty,
  getAuction,
  makePropertyId,
} from '../src/world/property.js';
import {
  clearTreasuryProjection,
  applyReceiptToTreasury,
  getGoldBalance,
} from '../src/world/treasury.js';
import { settleDueAuctions } from '../src/world/auction-loop.js';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import {
  WALLET_CREDIT_ACTION,
  WALLET_DEBIT_ACTION,
  PROPERTY_CREATED_ACTION,
  PROPERTY_AUCTION_OPENED_ACTION,
  PROPERTY_BID_ACTION,
  PROPERTY_BID_REFUNDED_ACTION,
  PROPERTY_AUCTION_SETTLED_ACTION,
} from '../../../packages/shared/types.js';

function test(name: string, fn: () => void) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); console.error(`  ${err}`); process.exit(1); }
}
function assertEquals<T>(a: T, b: T, msg?: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

const PID = makePropertyId('Azura', 'H1');
let seq = 0;
let log: AuditReceipt[] = [];

function fill(p: { actor_id: string; action: string; inputs: Record<string, unknown>; result?: string }): AuditReceipt {
  seq += 1;
  return {
    sequence: seq, timestamp: new Date(0).toISOString(),
    prev_hash: `prev-${seq}`, event_hash: `evt-${seq}`,
    actor_id: p.actor_id, action: p.action, inputs: p.inputs, result: p.result ?? 'ok',
    inputs_hash: `ih-${seq}`, outputs_hash: `oh-${seq}`, signature: 'sig',
  } as AuditReceipt;
}
function applyBoth(r: AuditReceipt) { log.push(r); applyReceiptToProperty(r); applyReceiptToTreasury(r); }
function emit(p: { actor_id: string; action: string; inputs: Record<string, unknown>; result?: string }) { applyBoth(fill(p)); }
function reset() { clearPropertyProjection(); clearTreasuryProjection(); log = []; seq = 0; }
// writeReceipt for settleDueAuctions (actor_id-based Omit shape) — fills + applies.
const writeReceipt = (p: { actor_id: string; action: string; inputs: Record<string, unknown>; result: string }) => emit(p);

// Open a resale auction owned by S, with the given recorded close.
function openResale(closeMs: number) {
  emit({ actor_id: 'S', action: WALLET_CREDIT_ACTION, inputs: { amount: 10000, reason: 'debug_grant' } });
  emit({ actor_id: 'A', action: WALLET_CREDIT_ACTION, inputs: { amount: 10000, reason: 'debug_grant' } });
  emit({ actor_id: 'B', action: WALLET_CREDIT_ACTION, inputs: { amount: 10000, reason: 'debug_grant' } });
  emit({ actor_id: 'system', action: PROPERTY_CREATED_ACTION, inputs: { property_id: PID, zone: 'Azura', plot_id: 'H1', x: 10, y: 32, width: 2, height: 2, district: 'Harbor Edge', primary_price_gold: 500 } });
  // S acquires via primary (explicit settle receipt — not the loop).
  emit({ actor_id: 'system', action: PROPERTY_AUCTION_OPENED_ACTION, inputs: { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 } });
  emit({ actor_id: 'S', action: WALLET_DEBIT_ACTION, inputs: { amount: 500, reason: `auction_escrow:${PID}` } });
  emit({ actor_id: 'S', action: PROPERTY_BID_ACTION, inputs: { property_id: PID, amount: 500 } });
  emit({ actor_id: 'S', action: PROPERTY_AUCTION_SETTLED_ACTION, inputs: { property_id: PID, winner_id: 'S', price: 500, kind: 'primary' } });
  // Open the resale auction with a recorded close.
  emit({ actor_id: 'S', action: PROPERTY_AUCTION_OPENED_ACTION, inputs: { property_id: PID, kind: 'resale', seller_id: 'S', min_bid: 1000, min_increment_gold: 100, duration_s: 3600, scheduled_close_ms: closeMs } });
}
// B outbids A (mirrors the 4a handler emission).
function bidWar() {
  emit({ actor_id: 'A', action: WALLET_DEBIT_ACTION, inputs: { amount: 1500, reason: `auction_escrow:${PID}` } });
  emit({ actor_id: 'A', action: PROPERTY_BID_ACTION, inputs: { property_id: PID, amount: 1500 } });
  emit({ actor_id: 'B', action: WALLET_DEBIT_ACTION, inputs: { amount: 1700, reason: `auction_escrow:${PID}` } });
  emit({ actor_id: 'A', action: WALLET_CREDIT_ACTION, inputs: { amount: 1500, reason: `auction_refund:${PID}` } });
  emit({ actor_id: 'system', action: PROPERTY_BID_REFUNDED_ACTION, inputs: { property_id: PID, refunded_player_id: 'A', amount: 1500 } });
  emit({ actor_id: 'B', action: PROPERTY_BID_ACTION, inputs: { property_id: PID, amount: 1700 } });
}

test('4b due resale + bidder: settles + credits seller', () => {
  reset(); openResale(1000); bidWar();
  const sBefore = getGoldBalance('S'); // 9500 (paid 500 primary sink)
  const bBefore = getGoldBalance('B'); // 8300 (escrowed 1700)
  const settlements = settleDueAuctions(2000, writeReceipt);
  assertEquals(settlements.length, 1, 'one settlement');
  assertEquals(getProperty(PID)!.owner_player_id, 'B', 'B wins');
  assertEquals(getProperty(PID)!.status, 'owned', 'owned after settle');
  assertEquals(getAuction(PID)!.status, 'settled', 'auction settled');
  assertEquals(getGoldBalance('S'), sBefore + 1700, 'seller credited winning bid');
  assertEquals(getGoldBalance('B'), bBefore, 'B already escrowed; no further debit');
  assertEquals(getGoldBalance('A'), 10000, 'A was refunded earlier; net 0');
});

test('4b due resale + no bids: settles winner=null, no wallet movement, reverts', () => {
  reset(); openResale(1000);
  const sBefore = getGoldBalance('S');
  const settlements = settleDueAuctions(2000, writeReceipt);
  assertEquals(settlements.length, 1, 'one settlement');
  assertEquals(settlements[0].winner_id, null, 'no winner');
  assertEquals(getProperty(PID)!.owner_player_id, 'S', 'reverts to owner');
  assertEquals(getProperty(PID)!.status, 'owned', 'owned again');
  assertEquals(getGoldBalance('S'), sBefore, 'no wallet movement on no-bid close');
});

test('4b not-yet-due: emits nothing', () => {
  reset(); openResale(10000); bidWar();
  const settlements = settleDueAuctions(2000, writeReceipt); // now < close
  assertEquals(settlements.length, 0, 'nothing settles');
  assertEquals(getProperty(PID)!.status, 'auctioning', 'still auctioning');
});

test('4b replay after settlement: matches with no clock', () => {
  reset(); openResale(1000); bidWar();
  settleDueAuctions(2000, writeReceipt);
  const snap = JSON.stringify([getProperty(PID), getAuction(PID), getGoldBalance('S'), getGoldBalance('B'), getGoldBalance('A')]);
  const saved = [...log];
  // Pure replay — apply the receipt log to fresh projections, no clock involved.
  clearPropertyProjection(); clearTreasuryProjection();
  for (const r of saved) { applyReceiptToProperty(r); applyReceiptToTreasury(r); }
  const snap2 = JSON.stringify([getProperty(PID), getAuction(PID), getGoldBalance('S'), getGoldBalance('B'), getGoldBalance('A')]);
  assertEquals(snap2, snap, 'replay reproduces settled state without wall-clock');
});

test('4b restart re-arm: due-but-unsettled settles after replay + scan', () => {
  reset(); openResale(1000); bidWar();
  // "Downtime": no settle emitted. Capture the log and rebuild on "boot".
  const saved = [...log];
  clearPropertyProjection(); clearTreasuryProjection(); log = [...saved];
  for (const r of saved) { applyReceiptToProperty(r); applyReceiptToTreasury(r); }
  assertEquals(getAuction(PID)!.status, 'open', 'auction still open after replay');
  assertEquals(getAuction(PID)!.scheduled_close_ms, 1000, 'close metadata survives replay (re-arm)');
  // Live loop runs after boot with now past close → settles.
  const settlements = settleDueAuctions(5000, writeReceipt);
  assertEquals(settlements.length, 1, 'overdue auction settles on first post-boot scan');
  assertEquals(getProperty(PID)!.owner_player_id, 'B', 'B wins after re-arm');
});

test('4b idempotency: a repeated scan does not double-settle', () => {
  reset(); openResale(1000); bidWar();
  const first = settleDueAuctions(2000, writeReceipt);
  const saleCountAfter = getProperty(PID)!.sale_count;
  const sAfter = getGoldBalance('S');
  const second = settleDueAuctions(3000, writeReceipt); // scan again
  assertEquals(first.length, 1, 'first scan settles once');
  assertEquals(second.length, 0, 'second scan settles nothing');
  assertEquals(getProperty(PID)!.sale_count, saleCountAfter, 'sale_count unchanged');
  assertEquals(getGoldBalance('S'), sAfter, 'no extra seller credit');
});

console.log('\n✅ Property auction close→settle verified (clock injected; receipt-sourced; idempotent; re-arm).');
