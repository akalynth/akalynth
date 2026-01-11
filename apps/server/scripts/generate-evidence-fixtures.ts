#!/usr/bin/env npx tsx
/**
 * Generate golden fixture files for Evidence UI acceptance tests.
 *
 * Creates:
 * - fixtures/chronicle_snapshot.json - Chronicle event with evidence_ref
 * - fixtures/evidence_snapshot.json - Full evidence response
 *
 * These fixtures are portable to client repos for E4 UI testing.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import { computeReceiptHash, canonicalize } from '../src/persist/hash.js';
import { generateItemId } from '../src/persist/materializers.js';
import { explainDeathDrops } from '../src/world/drop-policy.js';
import type { AuditReceipt } from '../../../packages/shared/types.js';

// ============================================================================
// Configuration
// ============================================================================

const DB_PATH = 'data/test-fixtures.db';
const FIXTURES_DIR = 'fixtures';
const PLAYER_ID = 'fixture-player-001';
const PLAYER_NAME = 'TestPlayer';

function createReceipt(base: Partial<AuditReceipt>): AuditReceipt {
  return {
    timestamp: new Date().toISOString(),
    player_id: PLAYER_ID,
    action: base.action ?? 'unknown',
    inputs: base.inputs ?? {},
    result: base.result ?? 'ok',
    ...base,
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  // Clean up previous test DB
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
  if (fs.existsSync(`${DB_PATH}-shm`)) fs.unlinkSync(`${DB_PATH}-shm`);
  if (fs.existsSync(`${DB_PATH}-wal`)) fs.unlinkSync(`${DB_PATH}-wal`);

  // Ensure fixtures directory exists
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR);
  }

  // Initialize DB with schema v6
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables directly (minimal schema for fixtures)
  db.exec(`
    CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO _meta (key, value) VALUES ('schema_version', '6');

    CREATE TABLE players (
      player_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_receipt TEXT NOT NULL UNIQUE,
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE items (
      item_id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      genesis_receipt TEXT NOT NULL UNIQUE,
      meta_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE inventory_items (
      item_id TEXT PRIMARY KEY,
      owner_player_id TEXT NOT NULL,
      slot TEXT DEFAULT NULL,
      updated_at TEXT NOT NULL,
      last_receipt TEXT NOT NULL,
      FOREIGN KEY(item_id) REFERENCES items(item_id),
      FOREIGN KEY(owner_player_id) REFERENCES players(player_id)
    );

    CREATE TABLE deaths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id TEXT NOT NULL,
      zone TEXT NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      cause TEXT NOT NULL,
      receipt_hash TEXT NOT NULL UNIQUE,
      witnesses TEXT DEFAULT NULL,
      FOREIGN KEY (player_id) REFERENCES players(player_id)
    );

    CREATE TABLE chronicle_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      zone TEXT DEFAULT NULL,
      x INTEGER DEFAULT NULL,
      y INTEGER DEFAULT NULL,
      entity_id TEXT DEFAULT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      source_action TEXT NOT NULL,
      receipt_hash TEXT NOT NULL,
      evidence_ref TEXT DEFAULT NULL,
      FOREIGN KEY(player_id) REFERENCES players(player_id)
    );
    CREATE INDEX idx_chronicle_receipt ON chronicle_events(receipt_hash);
  `);

  // 1. Create player
  const playerReceipt = createReceipt({
    action: 'player_created',
    inputs: { name: PLAYER_NAME },
  });
  const playerHash = computeReceiptHash(playerReceipt);

  db.prepare(`
    INSERT INTO players (player_id, name, created_at, created_receipt)
    VALUES (?, ?, ?, ?)
  `).run(PLAYER_ID, PLAYER_NAME, playerReceipt.timestamp, playerHash);

  // 2. Create items (mix of regular and legendary)
  const items: Array<{ id: string; type: string; legendary: boolean; tier: number | null }> = [];
  const itemTypes = [
    { type: 'sword', legendary: false, tier: null },
    { type: 'shield', legendary: false, tier: null },
    { type: 'potion', legendary: false, tier: null },
    { type: 'legendary_amulet', legendary: true, tier: 3 },
    { type: 'boots', legendary: false, tier: null },
    { type: 'legendary_ring', legendary: true, tier: 2 },
    { type: 'helmet', legendary: false, tier: null },
    { type: 'cloak', legendary: false, tier: null },
  ];

  for (const itemDef of itemTypes) {
    const mintReceipt = createReceipt({
      action: 'item_minted',
      inputs: {
        item_type: itemDef.type,
        meta: itemDef.legendary ? { tier: itemDef.tier } : {},
        reason: 'fixture',
      },
    });
    const mintHash = computeReceiptHash(mintReceipt);
    const itemId = generateItemId(mintHash);

    db.prepare(`
      INSERT INTO items (item_id, item_type, created_at, genesis_receipt, meta_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      itemId,
      itemDef.type,
      mintReceipt.timestamp,
      mintHash,
      JSON.stringify(itemDef.legendary ? { tier: itemDef.tier } : {})
    );

    db.prepare(`
      INSERT INTO inventory_items (item_id, owner_player_id, slot, updated_at, last_receipt)
      VALUES (?, ?, ?, ?, ?)
    `).run(itemId, PLAYER_ID, null, mintReceipt.timestamp, mintHash);

    items.push({ id: itemId, type: itemDef.type, legendary: itemDef.legendary, tier: itemDef.tier });
  }

  console.log(`Created ${items.length} items`);

  // 3. Simulate combat death with drop policy (in Azura where drops happen)
  const combatReceipt = createReceipt({
    action: 'combat_resolved',
    inputs: {
      zone: 'Azura',
      x: 10,
      y: 15,
      victim_id: PLAYER_ID,
      attacker_id: 'mob-skeleton-001',
      victim_hp_before: 50,
      victim_hp_after: 0,
      damage: 50,
      outcome: 'death',
    },
    result: 'ok',
  });
  const combatHash = computeReceiptHash(combatReceipt);

  // Build inventory for drop calculation
  const inventoryForPolicy = items.map((item) => ({
    item_id: item.id,
    item_type: item.type,
    slot: null as string | null,
    meta: item.legendary ? { tier: item.tier } : {},
  }));

  // Build heat lookup for legendaries
  const heatLookup = new Map<string, number>();
  for (const item of items) {
    if (item.legendary) {
      heatLookup.set(item.id, 50); // Give legendaries some heat
    }
  }

  // Use Azura map (has actual drops, Rookguard has 0 drop rate)
  const MAP_FOR_DROPS = 'Azura';

  // Run drop policy
  const dropExplanation = explainDeathDrops(
    inventoryForPolicy,
    MAP_FOR_DROPS,
    -50, // Negative reputation increases drops
    combatHash,
    heatLookup
  );

  console.log(`Drop policy: ${dropExplanation.dropped_item_ids.length} dropped, ${dropExplanation.kept_item_ids.length} kept`);

  // 4. Create death receipt
  const deathReceipt = createReceipt({
    action: 'death',
    inputs: {
      zone: 'Azura',
      x: 10,
      y: 15,
      cause: 'combat',
      attacker_id: 'mob-skeleton-001',
      dropped_item_ids: dropExplanation.dropped_item_ids,
      kept_item_ids: dropExplanation.kept_item_ids,
      drop_seed_hash: combatHash,
    },
    result: 'ok',
  });
  const deathHash = computeReceiptHash(deathReceipt);

  // Insert death record
  db.prepare(`
    INSERT INTO deaths (player_id, zone, x, y, timestamp, cause, receipt_hash, witnesses)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(PLAYER_ID, 'Rookguard', 10, 15, deathReceipt.timestamp, 'combat', deathHash, null);

  // 5. Create chronicle event for death (with evidence_ref)
  const evidenceRef = JSON.stringify({
    chronicle_event_id: 1, // Will be assigned
    receipt_hash: deathHash,
  });

  db.prepare(`
    INSERT INTO chronicle_events (player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    PLAYER_ID,
    'death',
    deathReceipt.timestamp,
    'Rookguard',
    10,
    15,
    null,
    JSON.stringify({ cause: 'combat', attacker_id: 'mob-skeleton-001' }),
    'death',
    deathHash,
    evidenceRef
  );

  // 6. Create item_lost chronicle events for dropped items
  for (const itemId of dropExplanation.dropped_item_ids) {
    const item = items.find((i) => i.id === itemId)!;
    const kind = item.legendary ? 'legendary_lost' : 'item_lost';

    db.prepare(`
      INSERT INTO chronicle_events (player_id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      PLAYER_ID,
      kind,
      deathReceipt.timestamp,
      'Rookguard',
      10,
      15,
      itemId,
      JSON.stringify({ reason: 'death', item_type: item.type }),
      'death',
      deathHash,
      evidenceRef // Points to death event
    );
  }

  // 7. Build chronicle_snapshot fixture
  const chronicleEvents = db.prepare(`
    SELECT id, kind, timestamp, zone, x, y, entity_id, details_json, source_action, receipt_hash, evidence_ref
    FROM chronicle_events
    WHERE player_id = ?
    ORDER BY timestamp DESC, id DESC
  `).all(PLAYER_ID) as Array<{
    id: number;
    kind: string;
    timestamp: string;
    zone: string | null;
    x: number | null;
    y: number | null;
    entity_id: string | null;
    details_json: string;
    source_action: string;
    receipt_hash: string;
    evidence_ref: string | null;
  }>;

  const chronicleSnapshot = {
    type: 'chronicle_snapshot',
    player_id: PLAYER_ID,
    events: chronicleEvents.map((e) => ({
      kind: e.kind,
      timestamp: e.timestamp,
      zone: e.zone,
      x: e.x,
      y: e.y,
      details: JSON.parse(e.details_json),
      evidence_ref: e.evidence_ref ? JSON.parse(e.evidence_ref) : null,
    })),
    cursor: null,
    has_more: false,
  };

  // 8. Build evidence_snapshot fixture
  const evidenceSnapshot = {
    type: 'evidence_snapshot',
    status: 'ok',
    player_id: PLAYER_ID,
    chronicle_event_id: 1,
    receipt_hash: deathHash,
    source_action: 'death',
    kind: 'death',
    evidence: {
      receipt_hashes: {
        anchor: deathHash,
        combat_resolved: combatHash,
        death: deathHash,
      },
      drop_explanation: dropExplanation,
    },
  };

  // 9. Write fixture files
  fs.writeFileSync(
    `${FIXTURES_DIR}/chronicle_snapshot.json`,
    JSON.stringify(chronicleSnapshot, null, 2)
  );
  console.log(`Wrote ${FIXTURES_DIR}/chronicle_snapshot.json`);

  fs.writeFileSync(
    `${FIXTURES_DIR}/evidence_snapshot.json`,
    JSON.stringify(evidenceSnapshot, null, 2)
  );
  console.log(`Wrote ${FIXTURES_DIR}/evidence_snapshot.json`);

  // 10. Write receipts for portability test
  const receipts = [playerReceipt, combatReceipt, deathReceipt];
  fs.writeFileSync(
    `${FIXTURES_DIR}/test_receipts.jsonl`,
    receipts.map((r) => canonicalize(r)).join('\n') + '\n'
  );
  console.log(`Wrote ${FIXTURES_DIR}/test_receipts.jsonl`);

  // 11. Write summary
  const summary = {
    generated_at: new Date().toISOString(),
    player_id: PLAYER_ID,
    death_receipt_hash: deathHash,
    combat_receipt_hash: combatHash,
    items_created: items.length,
    items_dropped: dropExplanation.dropped_item_ids.length,
    items_kept: dropExplanation.kept_item_ids.length,
    chronicle_events: chronicleEvents.length,
    seed_hash: dropExplanation.seed_hash,
  };
  fs.writeFileSync(`${FIXTURES_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`Wrote ${FIXTURES_DIR}/summary.json`);

  db.close();
  console.log('\nFixtures generated successfully!');
  console.log('Run portability check: npx tsx scripts/verify-portability.ts');
}

main().catch((err) => {
  console.error('Failed to generate fixtures:', err);
  process.exit(1);
});
