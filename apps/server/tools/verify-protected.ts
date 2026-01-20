#!/usr/bin/env node
/**
 * Akalynth Protected Slot Verifier — Phase 3.2.1 Integrity Seal
 *
 * Verifies: SQLite projection maintains protected slot invariants
 *
 * Checks:
 *  P1) At most one protected item per player
 *  P2) Protected item never active in world (exclusivity)
 *  P3) Protected items exist in items table (referential integrity)
 *
 * Usage:
 *   cd apps/server
 *   npx tsx tools/verify-protected.ts
 *
 * Env overrides:
 *   AKALYNTH_DB_PATH=./data/akalynth.db
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { resolveChainPaths } from '../../../packages/shared/paths.js';

interface MultiProtectedRow {
  owner_player_id: string;
  c: number;
}

interface ExclusivityViolationRow {
  item_id: string;
}

interface DanglingRefRow {
  item_id: string;
}

function fail(msg: string): never {
  console.error(`\n[verify-protected] FAIL: ${msg}`);
  process.exit(1);
}

function warn(msg: string): void {
  console.warn(`[verify-protected] WARN: ${msg}`);
}

function ok(msg: string): void {
  console.log(`[verify-protected] OK: ${msg}`);
}

function main(): void {
  // Canonical path resolution (single source of truth)
  const repoRoot = path.resolve(process.cwd());
  const paths = resolveChainPaths(repoRoot);

  if (!fs.existsSync(paths.dbPath)) fail(`db not found: ${paths.dbPath}`);

  const db = new Database(paths.dbPath, { readonly: true });

  // Get schema version
  const versionRow = db.prepare(`SELECT value FROM _meta WHERE key = 'schema_version'`).get() as { value: string } | undefined;
  const schemaVersion = versionRow ? parseInt(versionRow.value, 10) : 0;
  console.log(`[verify-protected] schema_version: ${schemaVersion}`);

  if (schemaVersion < 4) {
    warn(`schema_version < 4, protected slots may not be available`);
  }

  // Count total protected rows
  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM inventory_items WHERE slot = 'protected'`).get() as { count: number };
  console.log(`[verify-protected] total protected rows: ${totalRow.count}`);

  // =========================================================================
  // Check P1: At most one protected per player
  // =========================================================================
  const p1Rows = db.prepare(`
    SELECT owner_player_id, COUNT(*) AS c
    FROM inventory_items
    WHERE slot = 'protected'
    GROUP BY owner_player_id
    HAVING c > 1
  `).all() as MultiProtectedRow[];

  if (p1Rows.length > 0) {
    console.error(`\n[verify-protected] P1 VIOLATIONS (multiple protected per player):`);
    for (const row of p1Rows) {
      console.error(`  player_id=${row.owner_player_id} count=${row.c}`);
    }
    fail(`P1: ${p1Rows.length} players have multiple protected items`);
  }
  ok(`P1: no player has multiple protected items`);

  // =========================================================================
  // Check P2: Protected item never active in world (exclusivity)
  // =========================================================================
  const p2Rows = db.prepare(`
    SELECT inv.item_id
    FROM inventory_items inv
    JOIN world_objects w ON w.object_id = inv.item_id
    WHERE inv.slot = 'protected' AND w.status = 'active'
  `).all() as ExclusivityViolationRow[];

  if (p2Rows.length > 0) {
    console.error(`\n[verify-protected] P2 VIOLATIONS (protected item active in world):`);
    for (const row of p2Rows) {
      console.error(`  item_id=${row.item_id}`);
    }
    fail(`P2: ${p2Rows.length} protected items are also active in world`);
  }
  ok(`P2: no protected item is active in world`);

  // =========================================================================
  // Check P3: Protected items exist in items table
  // =========================================================================
  const p3Rows = db.prepare(`
    SELECT inv.item_id
    FROM inventory_items inv
    LEFT JOIN items i ON i.item_id = inv.item_id
    WHERE inv.slot = 'protected' AND i.item_id IS NULL
  `).all() as DanglingRefRow[];

  if (p3Rows.length > 0) {
    console.error(`\n[verify-protected] P3 VIOLATIONS (protected item missing from items table):`);
    for (const row of p3Rows) {
      console.error(`  item_id=${row.item_id}`);
    }
    fail(`P3: ${p3Rows.length} protected items have no backing item record`);
  }
  ok(`P3: all protected items exist in items table`);

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`\n[verify-protected] PASS`);
  console.log(`  schema_version: ${schemaVersion}`);
  console.log(`  protected_rows: ${totalRow.count}`);
  console.log(`  P1_violations: 0`);
  console.log(`  P2_violations: 0`);
  console.log(`  P3_violations: 0`);
}

main();
