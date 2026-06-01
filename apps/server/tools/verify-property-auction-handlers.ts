// Verify Property Auction handlers (Step 4a) — protocol gate + emitted-receipt model.
//
// 4a adds server handlers that PARSE the new client messages and EMIT receipts.
// Full WebSocket integration is exercised by the server smoke/CI; here we cover
// the two newly unit-testable surfaces deterministically (no server boot):
//   H-1 parse gate: parseClientMessage accepts the 3 new messages and rejects
//       malformed ones (a message that does not parse is never handled).
//   H-2 emitted-receipt model: the exact receipt sequence the handlers emit for
//       open → bid → outbid(refund) → cancel(zero-bid), replayed through BOTH the
//       property and treasury reducers, yields correct state + gold conservation.
//
// There is NO automatic settlement in 4a (close→settle is lane 4b).

import { parseClientMessage } from '../../../packages/shared/protocol.js';
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
import type { AuditReceipt } from '../../../packages/shared/types.js';
import {
  WALLET_CREDIT_ACTION,
  WALLET_DEBIT_ACTION,
  PROPERTY_CREATED_ACTION,
  PROPERTY_AUCTION_OPENED_ACTION,
  PROPERTY_BID_ACTION,
  PROPERTY_BID_REFUNDED_ACTION,
  PROPERTY_AUCTION_SETTLED_ACTION,
  PROPERTY_AUCTION_CANCELLED_ACTION,
} from '../../../packages/shared/types.js';

function test(name: string, fn: () => void) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); console.error(`  ${err}`); process.exit(1); }
}
function assertEquals<T>(actual: T, expected: T, msg?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function assert(cond: unknown, msg: string) { if (!cond) throw new Error(msg); }

// ---------------------------------------------------------------------------
// H-1: parse gate
// ---------------------------------------------------------------------------
test('H-1 parse: open_house_auction valid + malformed', () => {
  assert(parseClientMessage({ type: 'open_house_auction', property_id: 'Azura:H1', min_bid: 500, min_increment_gold: 100, duration_s: 3600 }) !== null, 'valid open parses');
  assertEquals(parseClientMessage({ type: 'open_house_auction', property_id: 'Azura:H1', min_bid: 500, min_increment_gold: 100 }), null, 'missing duration_s → null');
  assertEquals(parseClientMessage({ type: 'open_house_auction', min_bid: 500, min_increment_gold: 100, duration_s: 3600 }), null, 'missing property_id → null');
});
test('H-1 parse: place_house_bid valid + malformed', () => {
  assert(parseClientMessage({ type: 'place_house_bid', property_id: 'Azura:H1', amount: 600 }) !== null, 'valid bid parses');
  assertEquals(parseClientMessage({ type: 'place_house_bid', property_id: 'Azura:H1' }), null, 'missing amount → null');
});
test('H-1 parse: cancel_house_auction valid + malformed', () => {
  assert(parseClientMessage({ type: 'cancel_house_auction', property_id: 'Azura:H1' }) !== null, 'valid cancel parses');
  assertEquals(parseClientMessage({ type: 'cancel_house_auction' }), null, 'missing property_id → null');
});

// ---------------------------------------------------------------------------
// H-2: emitted-receipt model (the exact sequence the handlers write)
// ---------------------------------------------------------------------------
let seq = 0;
function rcpt(actor: string, action: string, inputs: Record<string, unknown>): AuditReceipt {
  seq += 1;
  return {
    sequence: seq, timestamp: new Date(0).toISOString(),
    prev_hash: `prev-${seq}`, event_hash: `evt-${seq}`,
    actor_id: actor, action, inputs, result: 'ok',
    inputs_hash: `ih-${seq}`, outputs_hash: `oh-${seq}`, signature: 'sig',
  } as AuditReceipt;
}
const PID = makePropertyId('Azura', 'H1');
function replayBoth(receipts: AuditReceipt[]) {
  clearPropertyProjection(); clearTreasuryProjection();
  for (const r of receipts) { applyReceiptToProperty(r); applyReceiptToTreasury(r); }
}
// Seed + give S ownership via a primary auction (the existing reducer path).
function seedAndOwn(): AuditReceipt[] {
  return [
    rcpt('S', WALLET_CREDIT_ACTION, { amount: 10000, reason: 'debug_grant' }),
    rcpt('A', WALLET_CREDIT_ACTION, { amount: 10000, reason: 'debug_grant' }),
    rcpt('B', WALLET_CREDIT_ACTION, { amount: 10000, reason: 'debug_grant' }),
    rcpt('system', PROPERTY_CREATED_ACTION, { property_id: PID, zone: 'Azura', plot_id: 'H1', x: 10, y: 32, width: 2, height: 2, district: 'Harbor Edge', primary_price_gold: 500 }),
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rcpt('S', WALLET_DEBIT_ACTION, { amount: 500, reason: `auction_escrow:${PID}` }),
    rcpt('S', PROPERTY_BID_ACTION, { property_id: PID, amount: 500 }),
    rcpt('S', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'S', price: 500, kind: 'primary' }),
  ];
}

test('H-2 open → bid → outbid(refund): exactly the handler emission', () => {
  seq = 0;
  const receipts = [
    ...seedAndOwn(),
    // open_house_auction handler emits:
    rcpt('S', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'resale', seller_id: 'S', min_bid: 1000, min_increment_gold: 100, duration_s: 3600 }),
    // place_house_bid (A 1000): escrow debit + property_bid
    rcpt('A', WALLET_DEBIT_ACTION, { amount: 1000, reason: `auction_escrow:${PID}` }),
    rcpt('A', PROPERTY_BID_ACTION, { property_id: PID, amount: 1000 }),
    // place_house_bid (B 1200, outbids A): escrow B + refund A exactly + property_bid B
    rcpt('B', WALLET_DEBIT_ACTION, { amount: 1200, reason: `auction_escrow:${PID}` }),
    rcpt('A', WALLET_CREDIT_ACTION, { amount: 1000, reason: `auction_refund:${PID}` }),
    rcpt('system', PROPERTY_BID_REFUNDED_ACTION, { property_id: PID, refunded_player_id: 'A', amount: 1000 }),
    rcpt('B', PROPERTY_BID_ACTION, { property_id: PID, amount: 1200 }),
  ];
  replayBoth(receipts);
  const auction = getAuction(PID)!;
  assertEquals(auction.status, 'open', 'auction open (no settlement in 4a)');
  assertEquals(auction.current_high, 1200, 'B is high');
  assertEquals(auction.high_bidder_id, 'B', 'B high bidder');
  assertEquals(getGoldBalance('A'), 10000, 'A escrow 1000 then refunded 1000 → net 0');
  assertEquals(getGoldBalance('B'), 10000 - 1200, 'B escrowed 1200');
  assertEquals(getProperty(PID)!.status, 'auctioning', 'plot auctioning, not settled');
});

test('H-2 cancel zero-bid: returns plot to owned', () => {
  seq = 0;
  replayBoth([
    ...seedAndOwn(),
    rcpt('S', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'resale', seller_id: 'S', min_bid: 1000, min_increment_gold: 100, duration_s: 3600 }),
    rcpt('S', PROPERTY_AUCTION_CANCELLED_ACTION, { property_id: PID }),
  ]);
  assertEquals(getProperty(PID)!.status, 'owned', 'cancel returns to owned');
  assertEquals(getAuction(PID)!.status, 'cancelled', 'auction cancelled');
  assertEquals(getProperty(PID)!.owner_player_id, 'S', 'S still owns');
});

console.log('\n✅ Property auction 4a handler surface verified (parse gate + emitted-receipt model). No settlement in 4a.');
