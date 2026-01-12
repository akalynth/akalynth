#!/usr/bin/env node
/**
 * Akalynth Chronicle Verifier — Phase 4.1 Integrity Seal
 *
 * Verifies: SQLite projection maintains chronicle invariants
 *
 * Checks:
 *  C1) All chronicle events reference valid players
 *  C2) Chronicle events have valid kind values
 *  C3) Chronicle timestamps are valid ISO8601
 *  C4) Event IDs are unique (PK sanity check)
 *  C5) Receipt hashes are non-empty and well-formed (blake3:<hex>)
 *  C6) Item-referencing kinds have valid item references
 *  C7) Legendary kinds match item meta (legendary=true)
 *  C8) Dedup index holds (no collisions in historical migrations)
 *
 * Usage:
 *   cd apps/server
 *   npx tsx tools/verify-chronicle.ts
 *
 * Env overrides:
 *   AKALYNTH_DB_PATH=./data/akalynth.db
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';

// Valid chronicle event kinds (must match ChronicleEventKind type)
const VALID_KINDS = new Set([
  'player_created',
  'death',
  'kill',
  'item_acquired',
  'item_lost',
  'reputation_change',
  'legendary_obtained',
  'legendary_lost',
]);

// Kinds that require a valid item reference in details_json
const ITEM_KINDS = new Set([
  'item_acquired',
  'item_lost',
  'legendary_obtained',
  'legendary_lost',
]);

// Kinds that must reference a legendary item
const LEGENDARY_KINDS = new Set([
  'legendary_obtained',
  'legendary_lost',
]);

// Phase 4.4 E2: Kinds eligible for evidence_ref
const EVIDENCE_ELIGIBLE_KINDS = new Set([
  'death',
  'item_lost',
  'legendary_lost',
]);

// Receipt hash format: blake3:<64 hex chars> or modified forms like blake3:<hex>:kill
const RECEIPT_HASH_PATTERN = /^blake3:[0-9a-f]+(:[a-z_]+)?$/;

interface ViolationRow {
  id: number;
  [key: string]: unknown;
}

function fail(msg: string): never {
  console.error(`\n[verify-chronicle] FAIL: ${msg}`);
  process.exit(1);
}

function warn(msg: string): void {
  console.warn(`[verify-chronicle] WARN: ${msg}`);
}

function ok(msg: string): void {
  console.log(`[verify-chronicle] OK: ${msg}`);
}

function isValidISO8601(timestamp: string): boolean {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

function main(): void {
  const dbPath = process.env.AKALYNTH_DB_PATH ?? './data/akalynth.db';
  const absDb = path.resolve(process.cwd(), dbPath);

  if (!fs.existsSync(absDb)) fail(`db not found: ${absDb}`);

  const db = new Database(absDb, { readonly: true });

  // Get schema version
  const versionRow = db.prepare(`SELECT value FROM _meta WHERE key = 'schema_version'`).get() as { value: string } | undefined;
  const schemaVersion = versionRow ? parseInt(versionRow.value, 10) : 0;
  console.log(`[verify-chronicle] schema_version: ${schemaVersion}`);

  if (schemaVersion < 5) {
    warn(`schema_version < 5, chronicle may not be available`);
    console.log(`\n[verify-chronicle] SKIP: schema < 5`);
    process.exit(0);
  }

  // Count total chronicle rows
  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM chronicle_events`).get() as { count: number };
  console.log(`[verify-chronicle] total chronicle events: ${totalRow.count}`);

  const violations: Record<string, number> = {
    C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0, C7: 0, C8: 0, C9: 0,
  };

  // =========================================================================
  // Check C1: All chronicle events reference valid players
  // =========================================================================
  const c1Rows = db.prepare(`
    SELECT ce.id, ce.player_id
    FROM chronicle_events ce
    LEFT JOIN players p ON p.player_id = ce.player_id
    WHERE p.player_id IS NULL
  `).all() as ViolationRow[];

  if (c1Rows.length > 0) {
    console.error(`\n[verify-chronicle] C1 VIOLATIONS (dangling player_id):`);
    for (const row of c1Rows.slice(0, 10)) {
      console.error(`  id=${row.id} player_id=${row.player_id}`);
    }
    if (c1Rows.length > 10) console.error(`  ... and ${c1Rows.length - 10} more`);
    violations.C1 = c1Rows.length;
  } else {
    ok(`C1: all chronicle events reference valid players`);
  }

  // =========================================================================
  // Check C2: Chronicle events have valid kind values
  // =========================================================================
  const allEvents = db.prepare(`
    SELECT id, kind FROM chronicle_events
  `).all() as Array<{ id: number; kind: string }>;

  const invalidKinds: ViolationRow[] = [];
  for (const row of allEvents) {
    if (!VALID_KINDS.has(row.kind)) {
      invalidKinds.push(row);
    }
  }

  if (invalidKinds.length > 0) {
    console.error(`\n[verify-chronicle] C2 VIOLATIONS (invalid kind):`);
    for (const row of invalidKinds.slice(0, 10)) {
      console.error(`  id=${row.id} kind=${row.kind}`);
    }
    if (invalidKinds.length > 10) console.error(`  ... and ${invalidKinds.length - 10} more`);
    violations.C2 = invalidKinds.length;
  } else {
    ok(`C2: all chronicle events have valid kind values`);
  }

  // =========================================================================
  // Check C3: Chronicle timestamps are valid ISO8601
  // =========================================================================
  const timestampRows = db.prepare(`
    SELECT id, timestamp FROM chronicle_events
  `).all() as Array<{ id: number; timestamp: string }>;

  const invalidTimestamps: ViolationRow[] = [];
  for (const row of timestampRows) {
    if (!isValidISO8601(row.timestamp)) {
      invalidTimestamps.push(row);
    }
  }

  if (invalidTimestamps.length > 0) {
    console.error(`\n[verify-chronicle] C3 VIOLATIONS (invalid timestamp):`);
    for (const row of invalidTimestamps.slice(0, 10)) {
      console.error(`  id=${row.id} timestamp=${row.timestamp}`);
    }
    if (invalidTimestamps.length > 10) console.error(`  ... and ${invalidTimestamps.length - 10} more`);
    violations.C3 = invalidTimestamps.length;
  } else {
    ok(`C3: all chronicle timestamps are valid ISO8601`);
  }

  // =========================================================================
  // Check C4: Event IDs are unique (sanity check - PK enforces this)
  // =========================================================================
  const duplicateIds = db.prepare(`
    SELECT id, COUNT(*) as count
    FROM chronicle_events
    GROUP BY id
    HAVING count > 1
  `).all() as Array<{ id: number; count: number }>;

  if (duplicateIds.length > 0) {
    console.error(`\n[verify-chronicle] C4 VIOLATIONS (duplicate event_id):`);
    for (const row of duplicateIds) {
      console.error(`  id=${row.id} count=${row.count}`);
    }
    violations.C4 = duplicateIds.length;
  } else {
    ok(`C4: all event IDs are unique`);
  }

  // =========================================================================
  // Check C5: Receipt hashes are non-empty and well-formed
  // =========================================================================
  const receiptHashRows = db.prepare(`
    SELECT id, receipt_hash FROM chronicle_events
  `).all() as Array<{ id: number; receipt_hash: string }>;

  const invalidHashes: ViolationRow[] = [];
  for (const row of receiptHashRows) {
    if (!row.receipt_hash || !RECEIPT_HASH_PATTERN.test(row.receipt_hash)) {
      invalidHashes.push(row);
    }
  }

  if (invalidHashes.length > 0) {
    console.error(`\n[verify-chronicle] C5 VIOLATIONS (malformed receipt_hash):`);
    for (const row of invalidHashes.slice(0, 10)) {
      console.error(`  id=${row.id} receipt_hash=${row.receipt_hash}`);
    }
    if (invalidHashes.length > 10) console.error(`  ... and ${invalidHashes.length - 10} more`);
    violations.C5 = invalidHashes.length;
  } else {
    ok(`C5: all receipt hashes are well-formed`);
  }

  // =========================================================================
  // Check C6: Item-referencing kinds have valid item references
  // =========================================================================
  const itemEventRows = db.prepare(`
    SELECT id, kind, details_json FROM chronicle_events
    WHERE kind IN ('item_acquired', 'item_lost', 'legendary_obtained', 'legendary_lost')
  `).all() as Array<{ id: number; kind: string; details_json: string }>;

  const missingItems: ViolationRow[] = [];
  for (const row of itemEventRows) {
    let itemId: string | undefined;
    try {
      const details = JSON.parse(row.details_json);
      itemId = details.item_id;
    } catch {
      // Parse error counts as missing
    }

    if (!itemId) {
      missingItems.push({ id: row.id, kind: row.kind, reason: 'missing_item_id' });
      continue;
    }

    // Check if item exists
    const item = db.prepare(`SELECT item_id FROM items WHERE item_id = ?`).get(itemId);
    if (!item) {
      missingItems.push({ id: row.id, kind: row.kind, item_id: itemId, reason: 'item_not_found' });
    }
  }

  if (missingItems.length > 0) {
    console.error(`\n[verify-chronicle] C6 VIOLATIONS (invalid item reference):`);
    for (const row of missingItems.slice(0, 10)) {
      console.error(`  id=${row.id} kind=${row.kind} item_id=${row.item_id ?? 'N/A'} reason=${row.reason}`);
    }
    if (missingItems.length > 10) console.error(`  ... and ${missingItems.length - 10} more`);
    violations.C6 = missingItems.length;
  } else {
    ok(`C6: all item-referencing events have valid item references`);
  }

  // =========================================================================
  // Check C7: Legendary kinds must match item meta (legendary=true)
  // =========================================================================
  const legendaryEventRows = db.prepare(`
    SELECT id, kind, details_json FROM chronicle_events
    WHERE kind IN ('legendary_obtained', 'legendary_lost')
  `).all() as Array<{ id: number; kind: string; details_json: string }>;

  const legendaryMismatches: ViolationRow[] = [];
  for (const row of legendaryEventRows) {
    let itemId: string | undefined;
    try {
      const details = JSON.parse(row.details_json);
      itemId = details.item_id;
    } catch {
      continue; // Already caught by C6
    }

    if (!itemId) continue; // Already caught by C6

    // Check if item has legendary=true in meta
    const item = db.prepare(`SELECT meta_json FROM items WHERE item_id = ?`).get(itemId) as { meta_json: string } | undefined;
    if (!item) continue; // Already caught by C6

    try {
      const meta = JSON.parse(item.meta_json);
      if (!meta.legendary) {
        legendaryMismatches.push({ id: row.id, kind: row.kind, item_id: itemId, legendary: meta.legendary });
      }
    } catch {
      legendaryMismatches.push({ id: row.id, kind: row.kind, item_id: itemId, reason: 'invalid_meta_json' });
    }
  }

  if (legendaryMismatches.length > 0) {
    console.error(`\n[verify-chronicle] C7 VIOLATIONS (legendary kind but item not legendary):`);
    for (const row of legendaryMismatches.slice(0, 10)) {
      console.error(`  id=${row.id} kind=${row.kind} item_id=${row.item_id} legendary=${row.legendary ?? 'parse_error'}`);
    }
    if (legendaryMismatches.length > 10) console.error(`  ... and ${legendaryMismatches.length - 10} more`);
    violations.C7 = legendaryMismatches.length;
  } else {
    ok(`C7: all legendary events reference items with legendary=true`);
  }

  // =========================================================================
  // Check C8: Dedup index holds (no collisions in historical migrations)
  // =========================================================================
  const dedupCollisions = db.prepare(`
    SELECT player_id, receipt_hash, kind, entity_id, COUNT(*) AS c
    FROM chronicle_events
    GROUP BY player_id, receipt_hash, kind, COALESCE(entity_id, '')
    HAVING c > 1
  `).all() as Array<{ player_id: string; receipt_hash: string; kind: string; entity_id: string | null; c: number }>;

  if (dedupCollisions.length > 0) {
    console.error(`\n[verify-chronicle] C8 VIOLATIONS (dedup collision):`);
    for (const row of dedupCollisions.slice(0, 10)) {
      console.error(`  player_id=${row.player_id} receipt_hash=${row.receipt_hash.slice(0, 20)}... kind=${row.kind} entity_id=${row.entity_id ?? 'null'} count=${row.c}`);
    }
    if (dedupCollisions.length > 10) console.error(`  ... and ${dedupCollisions.length - 10} more`);
    violations.C8 = dedupCollisions.length;
  } else {
    ok(`C8: no dedup collisions (unique index holds)`);
  }

  // =========================================================================
  // Check C9: evidence_ref integrity (Phase 4.4 E2)
  // - death events: evidence_ref must be self-referencing (same id + receipt_hash)
  // - item_lost/legendary_lost with reason='death'/'death_drop': must have valid evidence_ref
  // - evidence_ref JSON must be well-formed { chronicle_event_id: number, receipt_hash: string }
  // =========================================================================
  // Skip entire C9 if schema < 6 (evidence_ref column doesn't exist)
  if (schemaVersion < 6) {
    ok(`C9: evidence_ref integrity (skipped, schema < 6)`);
  } else {
    const evidenceRows = db.prepare(`
      SELECT id, player_id, kind, receipt_hash, evidence_ref, details_json
      FROM chronicle_events
      WHERE kind IN ('death', 'item_lost', 'legendary_lost')
    `).all() as Array<{ id: number; player_id: string; kind: string; receipt_hash: string; evidence_ref: string | null; details_json: string }>;

    const evidenceViolations: ViolationRow[] = [];

    for (const row of evidenceRows) {
      if (row.kind === 'death') {
      // Death events: evidence_ref should be self-referencing
      if (!row.evidence_ref) {
        evidenceViolations.push({ id: row.id, kind: row.kind, reason: 'death_missing_evidence_ref' });
        continue;
      }

      try {
        const ref = JSON.parse(row.evidence_ref);
        if (typeof ref.chronicle_event_id !== 'number' || typeof ref.receipt_hash !== 'string') {
          evidenceViolations.push({ id: row.id, kind: row.kind, reason: 'malformed_evidence_ref_structure' });
          continue;
        }
        // Self-reference check: id and receipt_hash must match
        if (ref.chronicle_event_id !== row.id) {
          evidenceViolations.push({ id: row.id, kind: row.kind, reason: 'death_evidence_ref_id_mismatch', expected_id: row.id, got_id: ref.chronicle_event_id });
          continue;
        }
        if (ref.receipt_hash !== row.receipt_hash) {
          evidenceViolations.push({ id: row.id, kind: row.kind, reason: 'death_evidence_ref_hash_mismatch' });
          continue;
        }
      } catch {
        evidenceViolations.push({ id: row.id, kind: row.kind, reason: 'evidence_ref_parse_error' });
      }
    } else {
      // item_lost / legendary_lost: check if death-related
      let reason = 'unknown';
      try {
        const details = JSON.parse(row.details_json);
        reason = details.reason ?? 'unknown';
      } catch { /* ignore */ }

      const isDeathRelated = reason === 'death' || reason === 'death_drop';

      if (isDeathRelated) {
        // Must have evidence_ref pointing to a death event
        if (!row.evidence_ref) {
          evidenceViolations.push({ id: row.id, kind: row.kind, reason: 'death_related_missing_evidence_ref' });
          continue;
        }

        try {
          const ref = JSON.parse(row.evidence_ref);
          if (typeof ref.chronicle_event_id !== 'number' || typeof ref.receipt_hash !== 'string') {
            evidenceViolations.push({ id: row.id, kind: row.kind, reason: 'malformed_evidence_ref_structure' });
            continue;
          }

          // Verify referenced event exists and is a death
          const referencedEvent = db.prepare(`
            SELECT id, kind, receipt_hash FROM chronicle_events WHERE id = ?
          `).get(ref.chronicle_event_id) as { id: number; kind: string; receipt_hash: string } | undefined;

          if (!referencedEvent) {
            evidenceViolations.push({ id: row.id, kind: row.kind, reason: 'evidence_ref_target_not_found', target_id: ref.chronicle_event_id });
            continue;
          }

          if (referencedEvent.kind !== 'death') {
            evidenceViolations.push({ id: row.id, kind: row.kind, reason: 'evidence_ref_target_not_death', target_kind: referencedEvent.kind });
            continue;
          }

          if (referencedEvent.receipt_hash !== ref.receipt_hash) {
            evidenceViolations.push({ id: row.id, kind: row.kind, reason: 'evidence_ref_hash_mismatch_with_target' });
            continue;
          }
        } catch {
          evidenceViolations.push({ id: row.id, kind: row.kind, reason: 'evidence_ref_parse_error' });
        }
      } else {
        // Non-death-related item_lost: evidence_ref should be null
        if (row.evidence_ref !== null) {
          evidenceViolations.push({ id: row.id, kind: row.kind, reason: 'non_death_item_lost_has_evidence_ref' });
        }
      }
    }
  }

  if (evidenceViolations.length > 0) {
    console.error(`\n[verify-chronicle] C9 VIOLATIONS (evidence_ref integrity):`);
    for (const row of evidenceViolations.slice(0, 10)) {
      console.error(`  id=${row.id} kind=${row.kind} reason=${row.reason}`);
    }
    if (evidenceViolations.length > 10) console.error(`  ... and ${evidenceViolations.length - 10} more`);
    violations.C9 = evidenceViolations.length;
  } else {
    ok(`C9: evidence_ref integrity verified`);
  }
  } // end if (schemaVersion >= 6)

  // =========================================================================
  // Summary
  // =========================================================================
  const totalViolations = Object.values(violations).reduce((a, b) => a + b, 0);

  if (totalViolations > 0) {
    console.error(`\n[verify-chronicle] FAIL: ${totalViolations} total violations`);
    for (const [check, count] of Object.entries(violations)) {
      if (count > 0) console.error(`  ${check}_violations: ${count}`);
    }
    process.exit(1);
  }

  // Kind breakdown
  const kindCounts = db.prepare(`
    SELECT kind, COUNT(*) as count
    FROM chronicle_events
    GROUP BY kind
    ORDER BY count DESC
  `).all() as Array<{ kind: string; count: number }>;

  console.log(`\n[verify-chronicle] PASS`);
  console.log(`  schema_version: ${schemaVersion}`);
  console.log(`  total_events: ${totalRow.count}`);
  for (const [check] of Object.entries(violations)) {
    console.log(`  ${check}_violations: 0`);
  }
  console.log(`\n  Kind breakdown:`);
  for (const row of kindCounts) {
    console.log(`    ${row.kind}: ${row.count}`);
  }
}

main();
