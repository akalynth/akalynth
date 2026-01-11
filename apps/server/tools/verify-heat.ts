#!/usr/bin/env node
/**
 * Akalynth Heat Verifier — Phase 3.1 Integrity Seal
 *
 * Verifies: SQLite projection (legendary_heat) matches canonical receipts.jsonl
 *
 * Checks:
 *  1) For each item_id, DB heat == last seen inputs.new_heat from receipts
 *  2) For each item_id, per-receipt delta consistency: prev + delta == new_heat
 *  3) new_heat >= 0 always
 *  4) Optional: DB has no rows for items never mentioned in heat receipts (warn)
 *
 * Usage:
 *   cd apps/server
 *   npx tsx tools/verify-heat.ts
 *
 * Env overrides:
 *   AKALYNTH_DB_PATH=./data/akalynth.db
 *   AKALYNTH_RECEIPTS_PATH=./audit/receipts.jsonl
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';

type HeatReason = 'combat_kill' | 'combat_death' | 'decay' | string;

interface LegendaryHeatChangedReceipt {
  timestamp: string;
  player_id: string;
  action: 'legendary_heat_changed';
  inputs: {
    item_id: string;
    delta: number;
    new_heat: number;
    reason: HeatReason;
    context?: Record<string, unknown>;
  };
  result: string;
  evidence_hash?: string;
}

interface DbHeatRow {
  item_id: string;
  heat: number;
  updated_at: string;
  last_receipt: string;
}

function fail(msg: string): never {
  console.error(`\n[verify-heat] FAIL: ${msg}`);
  process.exit(1);
}

function warn(msg: string): void {
  console.warn(`[verify-heat] WARN: ${msg}`);
}

function ok(msg: string): void {
  console.log(`[verify-heat] OK: ${msg}`);
}

function isLegendaryHeatReceipt(obj: unknown): obj is LegendaryHeatChangedReceipt {
  if (typeof obj !== 'object' || obj === null) return false;
  const r = obj as Record<string, unknown>;
  return (
    r.action === 'legendary_heat_changed' &&
    typeof r.inputs === 'object' &&
    r.inputs !== null &&
    typeof (r.inputs as Record<string, unknown>).item_id === 'string' &&
    typeof (r.inputs as Record<string, unknown>).delta === 'number' &&
    typeof (r.inputs as Record<string, unknown>).new_heat === 'number'
  );
}

function readJsonLines(filePath: string): unknown[] {
  if (!fs.existsSync(filePath)) fail(`receipts file not found: ${filePath}`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);

  const out: unknown[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    try {
      out.push(JSON.parse(line));
    } catch (e) {
      fail(`malformed JSONL at line ${i + 1}: ${String(e)}\n${line.slice(0, 200)}`);
    }
  }
  return out;
}

function main(): void {
  const dbPath = process.env.AKALYNTH_DB_PATH ?? './data/akalynth.db';
  const receiptsPath = process.env.AKALYNTH_RECEIPTS_PATH ?? './audit/receipts.jsonl';

  const absDb = path.resolve(process.cwd(), dbPath);
  const absReceipts = path.resolve(process.cwd(), receiptsPath);

  if (!fs.existsSync(absDb)) fail(`db not found: ${absDb}`);

  const db = new Database(absDb, { readonly: true });

  // Ensure table exists
  const tableExists = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='legendary_heat'`
    )
    .get();
  if (!tableExists) fail(`legendary_heat table not found (schema v3 not applied?)`);

  // Read projection
  const dbRows = db
    .prepare(`SELECT item_id, heat, updated_at, last_receipt FROM legendary_heat`)
    .all() as DbHeatRow[];

  const dbMap = new Map<string, DbHeatRow>();
  for (const r of dbRows) dbMap.set(r.item_id, r);

  // Read receipts and compute last new_heat per item, plus delta consistency checks
  const all = readJsonLines(absReceipts);

  const lastHeatByItem = new Map<string, { new_heat: number; lineNo: number; ts?: string }>();
  const prevHeatByItem = new Map<string, number>();

  let heatReceiptCount = 0;

  for (let i = 0; i < all.length; i++) {
    const obj = all[i];
    if (!isLegendaryHeatReceipt(obj)) continue;

    heatReceiptCount++;

    const itemId = obj.inputs.item_id;
    const delta = obj.inputs.delta;
    const newHeat = obj.inputs.new_heat;

    if (!Number.isFinite(delta) || !Number.isFinite(newHeat)) {
      fail(`non-finite delta/new_heat for item ${itemId} at line ${i + 1}`);
    }
    if (newHeat < 0) {
      fail(`new_heat < 0 for item ${itemId} at line ${i + 1}`);
    }

    const prev = prevHeatByItem.get(itemId);
    if (prev !== undefined) {
      const expected = Math.max(0, prev + delta);
      // Allow small floating-point tolerance for decay
      if (Math.abs(expected - newHeat) > 0.001) {
        fail(
          `delta mismatch for item ${itemId} at line ${i + 1}: prev(${prev}) + delta(${delta}) = ${expected}, but new_heat=${newHeat}`
        );
      }
    }
    // Update state
    prevHeatByItem.set(itemId, newHeat);
    lastHeatByItem.set(itemId, { new_heat: newHeat, lineNo: i + 1, ts: obj.timestamp });
  }

  ok(`parsed receipts: ${all.length} lines`);
  ok(`found legendary_heat_changed receipts: ${heatReceiptCount}`);
  ok(`unique heated items in receipts: ${lastHeatByItem.size}`);
  ok(`rows in DB legendary_heat: ${dbRows.length}`);

  // Compare DB projection against last receipt heat
  let mismatches = 0;
  let missingInDb = 0;

  for (const [itemId, last] of lastHeatByItem) {
    const row = dbMap.get(itemId);
    if (!row) {
      missingInDb++;
      console.error(
        `[verify-heat] MISSING_DB: item_id=${itemId} last_new_heat=${last.new_heat} (receipts line ${last.lineNo})`
      );
      continue;
    }
    // Allow small floating-point tolerance
    if (Math.abs(row.heat - last.new_heat) > 0.001) {
      mismatches++;
      console.error(
        `[verify-heat] MISMATCH: item_id=${itemId} db_heat=${row.heat} receipts_heat=${last.new_heat} (last receipt line ${last.lineNo})`
      );
    }
    if (row.heat < 0) {
      fail(`DB heat < 0 for item ${itemId}: ${row.heat}`);
    }
  }

  // Warn if DB has rows that never appear in receipts (can happen if receipts truncated / rotated)
  let dbOnly = 0;
  for (const [itemId, row] of dbMap) {
    if (!lastHeatByItem.has(itemId)) {
      dbOnly++;
      warn(`DB has heat row but receipts contain no heat receipts for item_id=${itemId} (db_heat=${row.heat})`);
    }
  }

  if (missingInDb > 0) fail(`DB missing ${missingInDb} heated items present in receipts`);
  if (mismatches > 0) fail(`found ${mismatches} heat mismatches between DB and receipts`);

  ok(`projection matches receipts for all heated items`);
  if (dbOnly > 0) warn(`DB contains ${dbOnly} heat rows not found in receipts (check receipts retention/rotation)`);

  console.log('\n[verify-heat] PASS');
}

main();
