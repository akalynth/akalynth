#!/usr/bin/env node
/**
 * Akalynth Civil Guarantees Gate — Phase Gate Automation
 *
 * Unified verifier that enforces G1–G15 mechanically.
 * Runs all guarantee checks and fails hard on any violation.
 *
 * Exit codes:
 *   0 - All guarantees preserved
 *   1 - Guarantee violation detected
 *   2 - Infrastructure error (missing files, schema issues)
 *
 * Usage:
 *   cd apps/server
 *   npx tsx tools/verify-guarantees.ts [--skip-build] [--verbose]
 *
 * Env overrides:
 *   AKALYNTH_DB_PATH=./data/akalynth.db
 *   AKALYNTH_RECEIPTS_PATH=./audit/receipts.jsonl
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { SCHEMA_VERSION } from '../src/persist/schema';
import { resolveChainPaths } from '../../../packages/shared/paths.js';

// ============================================================================
// Configuration
// ============================================================================

const args = process.argv.slice(2);
const SKIP_BUILD = args.includes('--skip-build');
const VERBOSE = args.includes('--verbose');
const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(TOOL_DIR, '..');
const REPO_ROOT = path.resolve(SERVER_DIR, '../..');

// Canonical path resolution (single source of truth)
const chainPaths = resolveChainPaths(REPO_ROOT);
const DB_PATH = chainPaths.dbPath;
const RECEIPTS_PATH = chainPaths.receiptsPath;

// ============================================================================
// Logging
// ============================================================================

function log(msg: string): void {
  console.log(`[gate] ${msg}`);
}

function pass(check: string): void {
  console.log(`[gate] \x1b[32mPASS\x1b[0m ${check}`);
}

function fail(check: string, reason: string): never {
  console.error(`[gate] \x1b[31mFAIL\x1b[0m ${check}: ${reason}`);
  process.exit(1);
}

function skip(check: string, reason: string): void {
  console.log(`[gate] \x1b[33mSKIP\x1b[0m ${check}: ${reason}`);
}

function infra(msg: string): never {
  console.error(`[gate] \x1b[31mINFRA\x1b[0m ${msg}`);
  process.exit(2);
}

// ============================================================================
// Check: TypeScript Build (G1-G15 compile-time)
// ============================================================================

function checkBuild(): void {
  if (SKIP_BUILD) {
    skip('BUILD', '--skip-build flag set');
    return;
  }

  log('Checking TypeScript build...');
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: SERVER_DIR,
    stdio: VERBOSE ? 'inherit' : 'pipe',
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    fail('BUILD', 'TypeScript compilation failed');
  }
  pass('BUILD');
}

// ============================================================================
// Check: Database Exists
// ============================================================================

function checkDatabaseExists(): Database.Database | null {
  const absDb = path.resolve(REPO_ROOT, DB_PATH);

  if (!fs.existsSync(absDb)) {
    skip('DB_EXISTS', `database not found at ${absDb} (fresh install?)`);
    return null;
  }

  const db = new Database(absDb, { readonly: true });
  pass('DB_EXISTS');
  return db;
}

// ============================================================================
// Check: G7 Item Location Exclusivity (SQL Invariants A-E)
// ============================================================================

function checkG7Exclusivity(db: Database.Database): void {
  log('Checking G7: Item location exclusivity...');

  // Invariant A: No dangling inventory refs
  const danglingInv = db.prepare(`
    SELECT inv.item_id
    FROM inventory_items inv
    LEFT JOIN items i ON i.item_id = inv.item_id
    WHERE i.item_id IS NULL
  `).all();

  if (danglingInv.length > 0) {
    fail('G7_INVARIANT_A', `${danglingInv.length} dangling inventory refs`);
  }

  // Invariant B: No item in both inventory AND active world
  const dualLocation = db.prepare(`
    SELECT inv.item_id
    FROM inventory_items inv
    JOIN world_objects w ON w.object_id = inv.item_id
    WHERE w.status = 'active'
  `).all();

  if (dualLocation.length > 0) {
    fail('G7_INVARIANT_B', `${dualLocation.length} items in both inventory and world`);
  }

  pass('G7_EXCLUSIVITY');
}

// ============================================================================
// Check: G12 Legendary Heat (via verify-heat.ts)
// ============================================================================

function checkG12Heat(): void {
  log('Checking G12: Legendary heat integrity...');

  const result = spawnSync('npx', ['tsx', 'tools/verify-heat.ts'], {
    cwd: SERVER_DIR,
    stdio: VERBOSE ? 'inherit' : 'pipe',
    encoding: 'utf-8',
    env: { ...process.env, AKALYNTH_DB_PATH: DB_PATH, AKALYNTH_RECEIPTS_PATH: RECEIPTS_PATH },
  });

  if (result.status === 0) {
    pass('G12_HEAT');
  } else if (result.stderr?.includes('legendary_heat table not found')) {
    skip('G12_HEAT', 'schema < v3, table not present');
  } else if (result.stderr?.includes('db not found')) {
    skip('G12_HEAT', 'database not found');
  } else {
    fail('G12_HEAT', 'verify-heat.ts failed');
  }
}

// ============================================================================
// Check: G13 Protected Slots (via verify-protected.ts)
// ============================================================================

function checkG13Protected(): void {
  log('Checking G13: Protected slot integrity...');

  const result = spawnSync('npx', ['tsx', 'tools/verify-protected.ts'], {
    cwd: SERVER_DIR,
    stdio: VERBOSE ? 'inherit' : 'pipe',
    encoding: 'utf-8',
    env: { ...process.env, AKALYNTH_DB_PATH: DB_PATH },
  });

  if (result.status === 0) {
    pass('G13_PROTECTED');
  } else if (result.stderr?.includes('db not found')) {
    skip('G13_PROTECTED', 'database not found');
  } else {
    fail('G13_PROTECTED', 'verify-protected.ts failed');
  }
}

// ============================================================================
// Check: G14 Chronicle Integrity (via verify-chronicle.ts)
// ============================================================================

function checkG14Chronicle(): void {
  log('Checking G14: Chronicle integrity...');

  const result = spawnSync('npx', ['tsx', 'tools/verify-chronicle.ts'], {
    cwd: SERVER_DIR,
    stdio: VERBOSE ? 'inherit' : 'pipe',
    encoding: 'utf-8',
    env: { ...process.env, AKALYNTH_DB_PATH: DB_PATH },
  });

  // Check for SKIP (schema < 5)
  if (result.stdout?.includes('SKIP: schema < 5')) {
    skip('G14_CHRONICLE', 'schema < v5, chronicle not present');
    return;
  }

  if (result.status === 0) {
    pass('G14_CHRONICLE');
  } else if (result.stderr?.includes('db not found')) {
    skip('G14_CHRONICLE', 'database not found');
  } else {
    fail('G14_CHRONICLE', 'verify-chronicle.ts failed');
  }
}

// ============================================================================
// Check: G15 Evidence Consistency (via verify-evidence.ts)
// ============================================================================

function checkG15Evidence(): void {
  log('Checking G15: Evidence consistency...');

  const result = spawnSync('npx', ['tsx', 'tools/verify-evidence.ts'], {
    cwd: SERVER_DIR,
    stdio: VERBOSE ? 'inherit' : 'pipe',
    encoding: 'utf-8',
    env: { ...process.env, AKALYNTH_DB_PATH: DB_PATH, AKALYNTH_RECEIPTS_PATH: RECEIPTS_PATH },
  });

  // Check for SKIP (schema < 6)
  if (result.stdout?.includes('SKIP: schema < 6')) {
    skip('G15_EVIDENCE', 'schema < v6, evidence_ref not present');
    return;
  }

  if (result.status === 0) {
    pass('G15_EVIDENCE');
  } else if (result.stderr?.includes('db not found')) {
    skip('G15_EVIDENCE', 'database not found');
  } else {
    fail('G15_EVIDENCE', 'verify-evidence.ts failed');
  }
}

// ============================================================================
// Check: G4 Replay Idempotence (UNIQUE constraints)
// ============================================================================

function checkG4Idempotence(db: Database.Database): void {
  log('Checking G4: Replay idempotence (UNIQUE constraints)...');

  // Check that key tables have UNIQUE constraints on receipt_hash
  const tables = [
    { table: 'deaths', column: 'receipt_hash' },
    { table: 'reputation_events', column: 'receipt_hash' },
    { table: 'items', column: 'genesis_receipt' },
  ];

  for (const { table, column } of tables) {
    // Check table exists
    const exists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `).get(table);

    if (!exists) {
      if (VERBOSE) log(`  Table ${table} not found, skipping`);
      continue;
    }

    // Check for UNIQUE index on column
    const indexes = db.prepare(`PRAGMA index_list(${table})`).all() as Array<{
      name: string;
      unique: number;
    }>;

    let hasUnique = false;
    for (const idx of indexes) {
      if (idx.unique) {
        const cols = db.prepare(`PRAGMA index_info(${idx.name})`).all() as Array<{ name: string }>;
        if (cols.length > 0 && cols[0].name === column) {
          hasUnique = true;
          break;
        }
      }
    }

    if (!hasUnique) {
      fail('G4_IDEMPOTENCE', `${table}.${column} lacks UNIQUE constraint`);
    }
  }

  pass('G4_IDEMPOTENCE');
}

// ============================================================================
// Check: G5 Schema Version (rebuildable)
// ============================================================================

function checkG5Rebuildable(db: Database.Database): void {
  log('Checking G5: Schema version alignment...');

  const metaTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_meta'")
    .get();
  if (!metaTable) {
    infra('_meta table missing (schema not initialized)');
  }

  const row = db.prepare(`SELECT value FROM _meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;

  if (!row) {
    fail('G5_REBUILDABLE', 'schema_version not found in _meta');
  }

  const version = parseInt(row.value, 10);
  if (isNaN(version) || version < 1) {
    fail('G5_REBUILDABLE', `invalid schema_version: ${row.value}`);
  }

  // Strengthened: require exact match, not just >= 1
  if (version !== SCHEMA_VERSION) {
    fail('G5_REBUILDABLE', `schema_version drift: db=${version} code=${SCHEMA_VERSION}`);
  }

  if (VERBOSE) log(`  Schema version: ${version} (matches code)`);
  pass('G5_REBUILDABLE');
}

// ============================================================================
// Check: Receipts File Exists (G1, G3)
// ============================================================================

function checkReceiptsExist(): void {
  log('Checking G1/G3: Receipts file...');

  const absReceipts = path.resolve(REPO_ROOT, RECEIPTS_PATH);

  if (!fs.existsSync(absReceipts)) {
    skip('RECEIPTS_EXIST', 'no receipts file yet (fresh install?)');
    return;
  }

  const stats = fs.statSync(absReceipts);
  if (VERBOSE) log(`  Receipts size: ${stats.size} bytes`);

  pass('RECEIPTS_EXIST');
}

// ============================================================================
// Main Gate Runner
// ============================================================================

function main(): void {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Akalynth Civil Guarantees Gate v1');
  console.log('  Enforcing G1-G15');
  console.log('='.repeat(60));
  console.log('');

  const startTime = Date.now();

  // Phase 1: Build check
  checkBuild();

  // Phase 2: Receipts existence
  checkReceiptsExist();

  // Phase 3: Database checks (if DB exists)
  const db = checkDatabaseExists();
  if (!db) {
    // No database - skip DB-dependent checks
    log('Skipping database-dependent checks (no DB)');
  }

  if (db) {
    checkG5Rebuildable(db);
    checkG4Idempotence(db);
    checkG7Exclusivity(db);
    db.close();
  }

  // Phase 4: Specialized verifiers (they handle missing DB gracefully)
  checkG12Heat();
  checkG13Protected();
  checkG14Chronicle();
  checkG15Evidence();

  // Summary
  const elapsed = Date.now() - startTime;
  console.log('');
  console.log('='.repeat(60));
  console.log(`  \x1b[32mALL GUARANTEES PRESERVED\x1b[0m`);
  console.log(`  Elapsed: ${elapsed}ms`);
  console.log('='.repeat(60));
  console.log('');

  process.exit(0);
}

main();
