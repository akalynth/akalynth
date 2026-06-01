// Verify Property Auction GOLD CONSERVATION (Step 3 — synthetic receipts only).
//
// P-A-WALLET: proves the auction gold model conserves by composing synthetic
// receipt sequences and replaying them through BOTH reducers:
//   - applyReceiptToProperty  (auction projection)
//   - applyReceiptToTreasury  (gold balances)
//
// Escrow is represented by RECEIPT SEQUENCE + derived balance state, NOT a
// treasury escrow table or runtime hold account. There is no runtime emission
// and no server handler here — the wallet receipts are synthetic, exactly as a
// future handler WOULD emit them.
//
// Invariants:
//   primary auction  → winning gold is a pure SINK (leaves circulation)
//   resale auction   → NET-ZERO (winner debit == seller credit)
//   outbid refund    → matches the prior high bid EXACTLY
//   no mint          → gold is never created across the lifecycle
//   replay           → same synthetic receipts → same property + treasury state

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
function assertEquals<T>(actual: T, expected: T, msg?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

let seq = 0;
function rcpt(actor: string, action: string, inputs: Record<string, unknown>): AuditReceipt {
  seq += 1;
  return {
    sequence: seq,
    timestamp: new Date(0).toISOString(), // fixed: conservation must not depend on a clock
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

function grant(player: string, amount: number): AuditReceipt {
  return rcpt(player, WALLET_CREDIT_ACTION, { amount, reason: 'debug_grant' });
}
function seed(): AuditReceipt {
  return rcpt('system', PROPERTY_CREATED_ACTION, {
    property_id: PID, zone: 'Azura', plot_id: 'H9', x: 10, y: 32, width: 2, height: 2,
    district: 'Harbor Edge', primary_price_gold: 500,
  });
}
function replayBoth(receipts: AuditReceipt[]) {
  clearPropertyProjection();
  clearTreasuryProjection();
  for (const r of receipts) {
    applyReceiptToProperty(r);
    applyReceiptToTreasury(r);
  }
}
function total(players: string[]): number {
  return players.reduce((s, p) => s + getGoldBalance(p), 0);
}

// ---------------------------------------------------------------------------
// PRIMARY auction: winning gold is a pure SINK; outbid bidder fully refunded.
// A escrows 600 → B escrows 900 → A refunded 600 → settle winner B (sink 900).
// ---------------------------------------------------------------------------
test('P-A-WALLET primary: winning gold is a sink; loser made whole; no mint', () => {
  seq = 0;
  const receipts = [
    grant('A', 10000),
    grant('B', 10000),
    seed(),
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    // A bids 600 (escrow debit)
    rcpt('A', WALLET_DEBIT_ACTION, { amount: 600, reason: `auction_escrow:${PID}` }),
    rcpt('A', PROPERTY_BID_ACTION, { property_id: PID, amount: 600 }),
    // B outbids 900 (escrow debit) + A refunded exactly 600
    rcpt('B', WALLET_DEBIT_ACTION, { amount: 900, reason: `auction_escrow:${PID}` }),
    rcpt('A', WALLET_CREDIT_ACTION, { amount: 600, reason: `auction_refund:${PID}` }),
    rcpt('system', PROPERTY_BID_REFUNDED_ACTION, { property_id: PID, refunded_player_id: 'A', amount: 600 }),
    rcpt('B', PROPERTY_BID_ACTION, { property_id: PID, amount: 900 }),
    // Settle: primary → no wallet receipt; B's escrowed 900 stays out (sink).
    rcpt('B', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'B', price: 900, kind: 'primary' }),
  ];
  replayBoth(receipts);

  assertEquals(getGoldBalance('A'), 10000, 'A: debited 600, refunded 600 → net 0');
  assertEquals(getGoldBalance('B'), 9100, 'B: paid the winning 900 (sink)');
  assertEquals(total(['A', 'B']), 20000 - 900, 'total dropped by exactly the winning bid (sink, no mint)');
  assertEquals(getProperty(PID)!.owner_player_id, 'B', 'B owns');
  assertEquals(getAuction(PID)!.status, 'settled', 'auction settled');
});

// ---------------------------------------------------------------------------
// RESALE auction: NET-ZERO (winner debit == seller credit). S already owns.
// ---------------------------------------------------------------------------
test('P-A-WALLET resale: net-zero (winner debit == seller credit); no mint', () => {
  seq = 0;
  const preResale = [
    grant('S', 5000),
    grant('A', 10000),
    grant('B', 10000),
    seed(),
    // S acquires the plot via a primary auction (sink 500), so S is the owner.
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rcpt('S', WALLET_DEBIT_ACTION, { amount: 500, reason: `auction_escrow:${PID}` }),
    rcpt('S', PROPERTY_BID_ACTION, { property_id: PID, amount: 500 }),
    rcpt('S', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'S', price: 500, kind: 'primary' }),
  ];
  const resale = [
    rcpt('S', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'resale', min_bid: 1000, min_increment_gold: 100 }),
    rcpt('A', WALLET_DEBIT_ACTION, { amount: 1000, reason: `auction_escrow:${PID}` }),
    rcpt('A', PROPERTY_BID_ACTION, { property_id: PID, amount: 1000 }),
    rcpt('B', WALLET_DEBIT_ACTION, { amount: 1200, reason: `auction_escrow:${PID}` }),
    rcpt('A', WALLET_CREDIT_ACTION, { amount: 1000, reason: `auction_refund:${PID}` }),
    rcpt('system', PROPERTY_BID_REFUNDED_ACTION, { property_id: PID, refunded_player_id: 'A', amount: 1000 }),
    rcpt('B', PROPERTY_BID_ACTION, { property_id: PID, amount: 1200 }),
    // Settle resale → seller S credited the winning 1200 (escrow released to seller).
    rcpt('S', WALLET_CREDIT_ACTION, { amount: 1200, reason: `auction_sale:${PID}` }),
    rcpt('B', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'B', price: 1200, seller_id: 'S', kind: 'resale' }),
  ];

  // Establish ownership, snapshot, then run the resale phase.
  replayBoth(preResale);
  const sBefore = getGoldBalance('S');
  const aBefore = getGoldBalance('A');
  const bBefore = getGoldBalance('B');
  const totalBefore = total(['S', 'A', 'B']);

  replayBoth([...preResale, ...resale]);

  assertEquals(getGoldBalance('A'), aBefore, 'A: 1000 escrow + 1000 refund → net 0');
  assertEquals(getGoldBalance('B'), bBefore - 1200, 'B: paid 1200');
  assertEquals(getGoldBalance('S'), sBefore + 1200, 'S: credited the sale price');
  assertEquals(total(['S', 'A', 'B']), totalBefore, 'resale conserves total gold (net-zero, no mint)');
  assertEquals(getProperty(PID)!.owner_player_id, 'B', 'B now owns');
  assertEquals(getProperty(PID)!.sale_count, 2, 'primary + resale');
});

// ---------------------------------------------------------------------------
// Refund ordering: the outbid refund equals the prior high bid exactly.
// ---------------------------------------------------------------------------
test('P-A-WALLET refund matches prior high bid exactly', () => {
  seq = 0;
  const PRIOR = 777;
  const receipts = [
    grant('A', 10000),
    grant('B', 10000),
    seed(),
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rcpt('A', WALLET_DEBIT_ACTION, { amount: PRIOR, reason: `auction_escrow:${PID}` }),
    rcpt('A', PROPERTY_BID_ACTION, { property_id: PID, amount: PRIOR }),
    rcpt('B', WALLET_DEBIT_ACTION, { amount: PRIOR + 100, reason: `auction_escrow:${PID}` }),
    rcpt('A', WALLET_CREDIT_ACTION, { amount: PRIOR, reason: `auction_refund:${PID}` }), // exact
    rcpt('B', PROPERTY_BID_ACTION, { property_id: PID, amount: PRIOR + 100 }),
  ];
  replayBoth(receipts);
  // A debited PRIOR then refunded PRIOR → exactly whole.
  assertEquals(getGoldBalance('A'), 10000, 'refund exactly cancels the prior escrow debit');
});

// ---------------------------------------------------------------------------
// Replay determinism across both reducers.
// ---------------------------------------------------------------------------
test('P-A-WALLET replay determinism (property + treasury)', () => {
  seq = 0;
  const receipts = [
    grant('A', 10000), grant('B', 10000), seed(),
    rcpt('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rcpt('A', WALLET_DEBIT_ACTION, { amount: 600, reason: `auction_escrow:${PID}` }),
    rcpt('A', PROPERTY_BID_ACTION, { property_id: PID, amount: 600 }),
    rcpt('B', WALLET_DEBIT_ACTION, { amount: 900, reason: `auction_escrow:${PID}` }),
    rcpt('A', WALLET_CREDIT_ACTION, { amount: 600, reason: `auction_refund:${PID}` }),
    rcpt('B', PROPERTY_BID_ACTION, { property_id: PID, amount: 900 }),
    rcpt('B', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'B', price: 900, kind: 'primary' }),
  ];
  replayBoth(receipts);
  const a = JSON.stringify([getProperty(PID), getAuction(PID), getGoldBalance('A'), getGoldBalance('B')]);
  replayBoth(receipts);
  const b = JSON.stringify([getProperty(PID), getAuction(PID), getGoldBalance('A'), getGoldBalance('B')]);
  assertEquals(a, b, 'identical property + treasury state after re-replay');
});

console.log('\n✅ Auction gold conservation proven for synthetic receipt sequences (no handlers, no runtime emission).');
