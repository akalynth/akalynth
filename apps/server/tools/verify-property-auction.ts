// Verify Property Auction projection/reducer (Step 2 — pure, no wallet/IO).
// Invariants exercised here (transition/determinism only — NO gold conservation,
// which belongs to a later wallet/escrow step):
//   A-R1 open/bid/refund/settle transitions update the projection deterministically
//   A-R2 settlement is receipt-sourced (winner/price come from the settle receipt;
//        a fixed epoch-0 timestamp is used to prove no wall-clock dependence)
//   A-R3 replay determinism (clear + replay → identical projection + auction)
//   A-R4 guard rails (bid below min rejected; bid on closed auction rejected;
//        cancel only with zero bids; resale seller cannot bid)
//
// Tests apply receipts DIRECTLY to the reducer (no server handlers).

import {
  clearPropertyProjection,
  applyReceiptToProperty,
  getProperty,
  getAuction,
  makePropertyId,
} from '../src/world/property.js';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import {
  PROPERTY_CREATED_ACTION,
  PROPERTY_AUCTION_OPENED_ACTION,
  PROPERTY_BID_ACTION,
  PROPERTY_BID_REFUNDED_ACTION,
  PROPERTY_AUCTION_SETTLED_ACTION,
  PROPERTY_AUCTION_CANCELLED_ACTION,
} from '../../../packages/shared/types.js';

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

// Synthetic receipt builder. A FIXED epoch-0 timestamp is used on purpose: the
// reducer must produce identical truth regardless of wall-clock.
let seq = 0;
function rcpt(actor: string, action: string, inputs: Record<string, unknown>): AuditReceipt {
  seq += 1;
  return {
    sequence: seq,
    timestamp: new Date(0).toISOString(),
    prev_hash: `prev-${seq}`,
    event_hash: `evt-${seq}`,
    actor_id: actor,
    action,
    inputs,
    result: 'ok',
    inputs_hash: `ih-${seq}`,
    outputs_hash: `oh-${seq}`,
    signature: 'sig',
  } as AuditReceipt;
}

const PID = makePropertyId('Azura', 'H9');

function seed(): AuditReceipt {
  return rcpt('system', PROPERTY_CREATED_ACTION, {
    property_id: PID,
    zone: 'Azura',
    plot_id: 'H9',
    x: 10,
    y: 32,
    width: 2,
    height: 2,
    district: 'Harbor Edge',
    primary_price_gold: 500,
  });
}

function replay(receipts: AuditReceipt[]) {
  clearPropertyProjection();
  for (const r of receipts) applyReceiptToProperty(r);
}

// ---------------------------------------------------------------------------
// A-R1 / A-R2: primary auction open → bid → higher bid → refund → settle
// ---------------------------------------------------------------------------
test('A-R1/A-R2: primary auction opened→bid→higher→refunded→settled', () => {
  seq = 0;
  const receipts = [
    seed(),
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rcpt('p1', PROPERTY_BID_ACTION, { property_id: PID, amount: 500 }),
    rcpt('p2', PROPERTY_BID_ACTION, { property_id: PID, amount: 600 }),
    rcpt('system', PROPERTY_BID_REFUNDED_ACTION, { property_id: PID, refunded_player_id: 'p1', amount: 500 }),
    rcpt('p2', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'p2', price: 600, kind: 'primary' }),
  ];
  replay(receipts);

  const prop = getProperty(PID)!;
  assertEquals(prop.owner_player_id, 'p2', 'owner = winning bidder');
  assertEquals(prop.status, 'owned', 'status owned after settle');
  assertEquals(prop.sale_count, 1, 'one sale');
  assertEquals(prop.owner_history.map((h) => [h.from, h.to, h.price, h.action]), [[null, 'p2', 600, 'purchased']], 'primary owner history');

  const auction = getAuction(PID)!;
  assertEquals(auction.status, 'settled', 'auction settled');
  assertEquals(auction.current_high, 600, 'high bid recorded');
  assertEquals(auction.high_bidder_id, 'p2', 'high bidder recorded');
});

// ---------------------------------------------------------------------------
// A-R2: settlement is receipt-sourced — reducer applies the receipt's winner,
// not a recomputation. Fixed epoch-0 timestamps prove no wall-clock dependence.
// ---------------------------------------------------------------------------
test('A-R2: settlement winner comes from the settle receipt', () => {
  seq = 0;
  const receipts = [
    seed(),
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rcpt('p1', PROPERTY_BID_ACTION, { property_id: PID, amount: 700 }),
    // Settle receipt names p1 + the recorded price; reducer applies it verbatim.
    rcpt('p1', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'p1', price: 700, kind: 'primary' }),
  ];
  replay(receipts);
  const prop = getProperty(PID)!;
  assertEquals(prop.owner_player_id, 'p1', 'winner from settle receipt');
  assertEquals(prop.owner_history[0].price, 700, 'price from settle receipt');
});

// ---------------------------------------------------------------------------
// A-R3: replay determinism — clear + replay twice yields identical state.
// ---------------------------------------------------------------------------
test('A-R3: replay is deterministic (and clock-independent)', () => {
  seq = 0;
  const receipts = [
    seed(),
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rcpt('p1', PROPERTY_BID_ACTION, { property_id: PID, amount: 500 }),
    rcpt('p2', PROPERTY_BID_ACTION, { property_id: PID, amount: 900 }),
    rcpt('system', PROPERTY_BID_REFUNDED_ACTION, { property_id: PID, refunded_player_id: 'p1', amount: 500 }),
    rcpt('p2', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'p2', price: 900, kind: 'primary' }),
  ];
  replay(receipts);
  const a = JSON.stringify([getProperty(PID), getAuction(PID)]);
  replay(receipts);
  const b = JSON.stringify([getProperty(PID), getAuction(PID)]);
  assertEquals(a, b, 'identical projection after re-replay');
});

// ---------------------------------------------------------------------------
// A-R1: resale auction transfers ownership (seller → winner).
// ---------------------------------------------------------------------------
test('A-R1: resale auction transfers ownership', () => {
  seq = 0;
  const receipts = [
    seed(),
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rcpt('p2', PROPERTY_BID_ACTION, { property_id: PID, amount: 500 }),
    rcpt('p2', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'p2', price: 500, kind: 'primary' }),
    // p2 now owns it; open a resale auction.
    rcpt('p2', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'resale', min_bid: 1000, min_increment_gold: 100 }),
    rcpt('p3', PROPERTY_BID_ACTION, { property_id: PID, amount: 1000 }),
    rcpt('p3', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'p3', price: 1000, seller_id: 'p2', kind: 'resale' }),
  ];
  replay(receipts);
  const prop = getProperty(PID)!;
  assertEquals(prop.owner_player_id, 'p3', 'owner transferred to p3');
  assertEquals(prop.sale_count, 2, 'primary + resale');
  assertEquals(prop.owner_history.map((h) => h.to), ['p2', 'p3'], 'ownership trail');
  assertEquals(prop.owner_history[1].action, 'transferred', 'resale = transferred');
  assertEquals(prop.owner_history[1].from, 'p2', 'resale seller recorded');
});

// ---------------------------------------------------------------------------
// A-R4: guard rails.
// ---------------------------------------------------------------------------
test('A-R4: bid below min_next is rejected (no state change)', () => {
  seq = 0;
  const receipts = [
    seed(),
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rcpt('p1', PROPERTY_BID_ACTION, { property_id: PID, amount: 600 }),
    rcpt('p2', PROPERTY_BID_ACTION, { property_id: PID, amount: 650 }), // < 700 min_next → rejected
  ];
  replay(receipts);
  const auction = getAuction(PID)!;
  assertEquals(auction.current_high, 600, 'low bid ignored');
  assertEquals(auction.high_bidder_id, 'p1', 'high bidder unchanged');
});

test('A-R4: resale seller cannot bid on own auction', () => {
  seq = 0;
  const receipts = [
    seed(),
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rcpt('p2', PROPERTY_BID_ACTION, { property_id: PID, amount: 500 }),
    rcpt('p2', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'p2', price: 500, kind: 'primary' }),
    rcpt('p2', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'resale', min_bid: 1000, min_increment_gold: 100 }),
    rcpt('p2', PROPERTY_BID_ACTION, { property_id: PID, amount: 1000 }), // seller bids → rejected
  ];
  replay(receipts);
  const auction = getAuction(PID)!;
  assertEquals(auction.current_high, null, 'seller self-bid ignored');
});

test('A-R4: cancel allowed only with zero bids', () => {
  // zero bids → cancel succeeds, plot returns to owned
  seq = 0;
  replay([
    seed(),
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rcpt('p2', PROPERTY_BID_ACTION, { property_id: PID, amount: 500 }),
    rcpt('p2', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'p2', price: 500, kind: 'primary' }),
    rcpt('p2', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'resale', min_bid: 1000, min_increment_gold: 100 }),
    rcpt('p2', PROPERTY_AUCTION_CANCELLED_ACTION, { property_id: PID }),
  ]);
  assertEquals(getProperty(PID)!.status, 'owned', 'cancel returns to owned');
  assertEquals(getAuction(PID)!.status, 'cancelled', 'auction cancelled');

  // with a bid → cancel rejected, auction stays open
  seq = 0;
  replay([
    seed(),
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rcpt('p2', PROPERTY_BID_ACTION, { property_id: PID, amount: 500 }),
    rcpt('p2', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'p2', price: 500, kind: 'primary' }),
    rcpt('p2', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'resale', min_bid: 1000, min_increment_gold: 100 }),
    rcpt('p3', PROPERTY_BID_ACTION, { property_id: PID, amount: 1000 }),
    rcpt('p2', PROPERTY_AUCTION_CANCELLED_ACTION, { property_id: PID }), // has a bid → rejected
  ]);
  assertEquals(getProperty(PID)!.status, 'auctioning', 'cancel with bids ignored');
  assertEquals(getAuction(PID)!.status, 'open', 'auction still open');
});

console.log('\n✅ Property auction projection/reducer checks passed (pure; no wallet/IO).');
