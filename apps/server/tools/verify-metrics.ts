#!/usr/bin/env npx tsx
/**
 * Phase 5: Pressure Metrics Verification
 *
 * Acceptance tests:
 * - PM-A: Determinism (same inputs = same outputs)
 * - PM-B: No new receipts (receipts.jsonl unchanged)
 * - PM-C: Contributor traceability (all ids/hashes resolve)
 * - PM-D: Schema gating (schema < v6 returns not_ready)
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { computePressureMetrics } from '../src/metrics/pressure.js';
import { getSchemaVersion, getChronicleEventById } from '../src/persist/queries.js';
import { resolveChainPaths } from '../../../packages/shared/paths.js';

// ============================================================================
// Configuration
// ============================================================================

// Canonical path resolution (single source of truth)
const chainPaths = resolveChainPaths(path.resolve(process.cwd()));
const DB_PATH = chainPaths.dbPath;
const RECEIPTS_PATH = chainPaths.receiptsPath;
const FIXTURES_PATH = 'fixtures';

// ============================================================================
// Helpers
// ============================================================================

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(msg: string): void {
  console.log(`  [OK] ${msg}`);
  passed++;
}

function fail(msg: string): void {
  console.error(`  [FAIL] ${msg}`);
  failed++;
}

function skip(msg: string): void {
  console.log(`  [SKIP] ${msg}`);
  skipped++;
}

function getReceiptsSize(): number {
  try {
    const stats = fs.statSync(RECEIPTS_PATH);
    return stats.size;
  } catch {
    return 0;
  }
}

// ============================================================================
// PM-A: Determinism
// ============================================================================

function testDeterminism(db: Database.Database, playerId: string): void {
  console.log('\nPM-A: Determinism test');

  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const until = now.toISOString();

  // Run twice
  const result1 = computePressureMetrics({ db }, playerId, since, until);
  const result2 = computePressureMetrics({ db }, playerId, since, until);

  if (result1.status !== result2.status) {
    fail(`Status mismatch: ${result1.status} vs ${result2.status}`);
    return;
  }

  if (result1.status !== 'ok') {
    skip(`Status is ${result1.status}, skipping metric comparison`);
    return;
  }

  // Compare key metrics
  const m1 = result1.metrics!;
  const m2 = result2.metrics!;

  if (m1.items_lost_total !== m2.items_lost_total) {
    fail(`items_lost_total mismatch: ${m1.items_lost_total} vs ${m2.items_lost_total}`);
    return;
  }

  if (m1.deaths_total !== m2.deaths_total) {
    fail(`deaths_total mismatch: ${m1.deaths_total} vs ${m2.deaths_total}`);
    return;
  }

  if (m1.heat_now !== m2.heat_now) {
    fail(`heat_now mismatch: ${m1.heat_now} vs ${m2.heat_now}`);
    return;
  }

  if (JSON.stringify(m1.contributors) !== JSON.stringify(m2.contributors)) {
    fail('contributors mismatch');
    return;
  }

  ok('Same inputs produce identical outputs');
}

// ============================================================================
// PM-B: No New Receipts
// ============================================================================

function testNoNewReceipts(db: Database.Database, playerId: string): void {
  console.log('\nPM-B: No new receipts test');

  const sizeBefore = getReceiptsSize();

  // Run metrics computation
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const until = now.toISOString();

  computePressureMetrics({ db }, playerId, since, until);

  const sizeAfter = getReceiptsSize();

  if (sizeAfter !== sizeBefore) {
    fail(`Receipts file changed: ${sizeBefore} -> ${sizeAfter} bytes`);
    return;
  }

  ok('receipts.jsonl unchanged after metrics computation');
}

// ============================================================================
// PM-C: Contributor Traceability
// ============================================================================

function testContributorTraceability(db: Database.Database, playerId: string): void {
  console.log('\nPM-C: Contributor traceability test');

  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const until = now.toISOString();

  const result = computePressureMetrics({ db }, playerId, since, until);

  if (result.status !== 'ok') {
    skip(`Status is ${result.status}, skipping contributor check`);
    return;
  }

  const { contributors } = result.metrics!;

  // Check lost_event_ids resolve
  let lostResolved = 0;
  for (const eventId of contributors.lost_event_ids) {
    const event = getChronicleEventById(db, eventId);
    if (event) {
      lostResolved++;
    } else {
      fail(`Lost event id ${eventId} does not resolve`);
    }
  }

  // Check death_event_ids resolve
  let deathResolved = 0;
  for (const eventId of contributors.death_event_ids) {
    const event = getChronicleEventById(db, eventId);
    if (event) {
      deathResolved++;
    } else {
      fail(`Death event id ${eventId} does not resolve`);
    }
  }

  // Check evidence_receipt_hashes are non-empty strings
  let hashesValid = 0;
  for (const hash of contributors.evidence_receipt_hashes) {
    if (typeof hash === 'string' && hash.startsWith('blake3:')) {
      hashesValid++;
    } else {
      fail(`Invalid evidence receipt hash: ${hash}`);
    }
  }

  if (contributors.lost_event_ids.length > 0) {
    ok(`${lostResolved}/${contributors.lost_event_ids.length} lost_event_ids resolve`);
  }

  if (contributors.death_event_ids.length > 0) {
    ok(`${deathResolved}/${contributors.death_event_ids.length} death_event_ids resolve`);
  }

  if (contributors.evidence_receipt_hashes.length > 0) {
    ok(`${hashesValid}/${contributors.evidence_receipt_hashes.length} evidence_receipt_hashes valid`);
  }

  if (
    contributors.lost_event_ids.length === 0 &&
    contributors.death_event_ids.length === 0 &&
    contributors.evidence_receipt_hashes.length === 0
  ) {
    skip('No contributors to trace (empty window)');
  }
}

// ============================================================================
// PM-D: Schema Gating
// ============================================================================

function testSchemaGating(db: Database.Database): void {
  console.log('\nPM-D: Schema gating test');

  const schemaVersion = getSchemaVersion(db);

  if (schemaVersion < 6) {
    // Expect not_ready
    const result = computePressureMetrics({ db }, 'test-player', undefined, undefined);
    if (result.status === 'not_ready' && result.error_code === 'schema_too_old') {
      ok('Schema < 6 correctly returns not_ready with schema_too_old');
    } else {
      fail(`Expected not_ready/schema_too_old, got ${result.status}/${result.error_code}`);
    }
  } else {
    // Expect ok or not_ready (no_chronicle is acceptable for non-existent player)
    const result = computePressureMetrics({ db }, 'nonexistent-player-12345', undefined, undefined);
    if (result.status === 'ok' || result.status === 'not_ready') {
      ok(`Schema >= 6, computation returns ${result.status}`);
    } else {
      fail(`Unexpected status: ${result.status}`);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  console.log('Phase 5: Pressure Metrics Verification');
  console.log('======================================\n');

  // Check if DB exists
  if (!fs.existsSync(DB_PATH)) {
    console.log(`SKIP: Database not found at ${DB_PATH}`);
    console.log('Run server or init-db.ts first.');
    process.exit(0);
  }

  const db = new Database(DB_PATH, { readonly: true });
  const schemaVersion = getSchemaVersion(db);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Schema version: ${schemaVersion}`);

  // Find a test player (use fixtures player or first player in DB)
  let testPlayerId = 'fixture-player-001';

  // Check if fixtures exist
  const fixturesSummary = `${FIXTURES_PATH}/summary.json`;
  if (fs.existsSync(fixturesSummary)) {
    try {
      const summary = JSON.parse(fs.readFileSync(fixturesSummary, 'utf-8'));
      testPlayerId = summary.player_id || testPlayerId;
    } catch { /* ignore */ }
  }

  // Fall back to first player in DB
  const firstPlayer = db.prepare('SELECT player_id FROM players LIMIT 1').get() as { player_id: string } | undefined;
  if (firstPlayer) {
    testPlayerId = firstPlayer.player_id;
  }

  console.log(`Test player: ${testPlayerId}\n`);

  // Run tests
  testSchemaGating(db);
  testNoNewReceipts(db, testPlayerId);
  testDeterminism(db, testPlayerId);
  testContributorTraceability(db, testPlayerId);

  db.close();

  // Summary
  console.log('\n======================================');
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
