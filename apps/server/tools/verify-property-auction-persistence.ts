// Verify Property Auction PERSISTENCE (Step 5).
//
// Proves the durable mirror matches receipt truth. DB is a MATERIALIZED MIRROR
// of receipts (receipts remain authority):
//   P-AP1 auction projection == DB (replay projection equals materialized rows)
//   P-AP2 re-materialize is idempotent (apply the log twice == once)
//   P-AP3 rebuild-from-DB == rebuild-from-replay (open-auction hydration matches)
//
// Receipts are applied to the in-memory reducers AND materialized into a fresh
// in-memory SQLite DB; the two are then compared.

import Database from 'better-sqlite3';
import {
  clearPropertyProjection,
  applyReceiptToProperty,
  getProperty,
  getAuction,
  getOpenAuctions,
  hydrateAuction,
  type AuctionProjection,
} from '../src/world/property.js';
import { clearTreasuryProjection, applyReceiptToTreasury } from '../src/world/treasury.js';
import { initSchema } from '../src/persist/schema.js';
import { materialize } from '../src/persist/materializers.js';
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

const PID = 'Azura:H1';
let seq = 0;
function rc(actor: string, action: string, inputs: Record<string, unknown>): AuditReceipt {
  seq += 1;
  return {
    sequence: seq, timestamp: new Date(0).toISOString(),
    prev_hash: `prev-${seq}`, event_hash: `evt-${seq}`,
    actor_id: actor, action, inputs, result: 'ok',
    inputs_hash: `ih-${seq}`, outputs_hash: `oh-${seq}`, signature: 'sig',
  } as AuditReceipt;
}

// A resale auction that opens, takes two bids, and SETTLES to B (close=1000).
function settledLog(): AuditReceipt[] {
  seq = 0;
  return [
    rc('S', WALLET_CREDIT_ACTION, { amount: 10000, reason: 'debug_grant' }),
    rc('A', WALLET_CREDIT_ACTION, { amount: 10000, reason: 'debug_grant' }),
    rc('B', WALLET_CREDIT_ACTION, { amount: 10000, reason: 'debug_grant' }),
    rc('system', PROPERTY_CREATED_ACTION, { property_id: PID, zone: 'Azura', plot_id: 'H1', x: 10, y: 32, width: 2, height: 2, district: 'Harbor Edge', primary_price_gold: 500 }),
    rc('system', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'primary', min_bid: 500, min_increment_gold: 100 }),
    rc('S', WALLET_DEBIT_ACTION, { amount: 500, reason: `auction_escrow:${PID}` }),
    rc('S', PROPERTY_BID_ACTION, { property_id: PID, amount: 500 }),
    rc('S', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, winner_id: 'S', price: 500, kind: 'primary' }),
    rc('S', PROPERTY_AUCTION_OPENED_ACTION, { property_id: PID, kind: 'resale', seller_id: 'S', min_bid: 1000, min_increment_gold: 100, duration_s: 3600, scheduled_close_ms: 1000 }),
    rc('A', WALLET_DEBIT_ACTION, { amount: 1500, reason: `auction_escrow:${PID}` }),
    rc('A', PROPERTY_BID_ACTION, { property_id: PID, amount: 1500 }),
    rc('B', WALLET_DEBIT_ACTION, { amount: 1700, reason: `auction_escrow:${PID}` }),
    rc('A', WALLET_CREDIT_ACTION, { amount: 1500, reason: `auction_refund:${PID}` }),
    rc('system', PROPERTY_BID_REFUNDED_ACTION, { property_id: PID, refunded_player_id: 'A', amount: 1500 }),
    rc('B', PROPERTY_BID_ACTION, { property_id: PID, amount: 1700 }),
    rc('B', WALLET_CREDIT_ACTION, { amount: 1700, reason: `auction_sale:${PID}` }),
    rc('B', PROPERTY_AUCTION_SETTLED_ACTION, { property_id: PID, plot_id: 'H1', winner_id: 'B', price: 1700, seller_id: 'S', kind: 'resale', scheduled_close_ms: 1000 }),
  ];
}

// An OPEN resale auction (no settle) — for hydration parity.
function openLog(): AuditReceipt[] {
  const base = settledLog();
  // Drop the final resale settle so the auction stays open.
  return base.filter((r) => !(r.action === PROPERTY_AUCTION_SETTLED_ACTION && (r.inputs as Record<string, unknown>).kind === 'resale'));
}

function replayProjection(log: AuditReceipt[]) {
  clearPropertyProjection(); clearTreasuryProjection();
  for (const r of log) { applyReceiptToProperty(r); applyReceiptToTreasury(r); }
}

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  initSchema(db); // migrates to v14
  const insPlayer = db.prepare(
    `INSERT OR IGNORE INTO players (player_id, name, created_at, created_receipt, auth_method, name_lower) VALUES (?, ?, ?, ?, 'guest', ?)`
  );
  for (const pid of ['S', 'A', 'B', 'system']) insPlayer.run(pid, pid, new Date().toISOString(), `seed:${pid}`, pid);
  return db;
}

function auctionFields(a: { kind: string; seller_id: string | null; min_bid: number; min_increment_gold: number; current_high: number | null; high_bidder_id: string | null; status: string; scheduled_close_ms: number | null }) {
  return [a.kind, a.seller_id, a.min_bid, a.min_increment_gold, a.current_high, a.high_bidder_id, a.status, a.scheduled_close_ms];
}

test('P-AP1: auction projection == DB after materialize', () => {
  const log = settledLog();
  replayProjection(log);
  const db = freshDb();
  for (const r of log) materialize(db, r);

  const proj = getAuction(PID)!;
  const row = db.prepare(`SELECT * FROM property_auctions WHERE property_id = ?`).get(PID) as any;
  assertEquals(auctionFields(row), auctionFields(proj), 'auction row equals projection');

  const projProp = getProperty(PID)!;
  const propRow = db.prepare(`SELECT * FROM properties WHERE property_id = ?`).get(PID) as any;
  assertEquals(propRow.owner_player_id, projProp.owner_player_id, 'owner matches');
  assertEquals(propRow.status, projProp.status, 'status matches');
  assertEquals(propRow.sale_count, projProp.sale_count, 'sale_count matches');
  assertEquals(propRow.sale_count, 2, 'sale_count = primary + resale');
  db.close();
});

test('P-AP2: re-materialize is idempotent (twice == once)', () => {
  const log = settledLog();
  replayProjection(log);
  const db = freshDb();
  for (const r of log) materialize(db, r);
  for (const r of log) materialize(db, r); // second pass

  const proj = getAuction(PID)!;
  const row = db.prepare(`SELECT * FROM property_auctions WHERE property_id = ?`).get(PID) as any;
  assertEquals(auctionFields(row), auctionFields(proj), 'auction row still equals projection after 2x');

  const projProp = getProperty(PID)!;
  const propRow = db.prepare(`SELECT * FROM properties WHERE property_id = ?`).get(PID) as any;
  assertEquals(propRow.status, projProp.status, 'property status stable after 2x');
  assertEquals(propRow.sale_count, 2, 'sale_count not double-counted on re-materialize');
  const dbHist = JSON.parse(propRow.owner_history).map((h: any) => `${h.from}->${h.to}:${h.action}`);
  assertEquals(dbHist, projProp.owner_history.map((h) => `${h.from}->${h.to}:${h.action}`), 'owner_history not duplicated');
  db.close();
});

test('P-AP3: rebuild-from-DB == rebuild-from-replay (open-auction hydration)', () => {
  const log = openLog();
  // Replay path → projection's open auctions.
  replayProjection(log);
  const replayOpen = getOpenAuctions().map(auctionFields);

  // Materialize → DB → hydrate open auctions into a FRESH projection.
  const db = freshDb();
  for (const r of log) materialize(db, r);
  const dbRows = db.prepare(`SELECT * FROM property_auctions WHERE status = 'open'`).all() as any[];
  clearPropertyProjection(); clearTreasuryProjection();
  for (const a of dbRows) {
    hydrateAuction({
      property_id: a.property_id, kind: a.kind, seller_id: a.seller_id,
      min_bid: a.min_bid, min_increment_gold: a.min_increment_gold,
      current_high: a.current_high, high_bidder_id: a.high_bidder_id,
      status: a.status, scheduled_close_ms: a.scheduled_close_ms,
      opened_receipt: a.opened_receipt, last_receipt: a.last_receipt,
    } as AuctionProjection);
  }
  const hydratedOpen = getOpenAuctions().map(auctionFields);

  assertEquals(hydratedOpen, replayOpen, 'DB-hydrated open auctions equal replay-projection open auctions');
  assertEquals(hydratedOpen.length, 1, 'one open auction');
  // close metadata survives the DB round-trip (re-arm).
  assertEquals(getAuction(PID)!.scheduled_close_ms, 1000, 'scheduled_close_ms survived DB round-trip');
  db.close();
});

console.log('\n✅ Property auction persistence verified: projection == DB, idempotent, DB hydration == replay (DB is a materialized mirror of receipts).');
