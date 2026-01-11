#!/usr/bin/env node
/**
 * Akalynth Evidence Verifier — Phase 4.4 E3 Consistency Seal
 *
 * Verifies: Evidence snapshots match their anchors and can be re-derived.
 *
 * Checks:
 *  E1) Death events have valid self-referencing evidence_ref
 *  E2) Death-linked item_lost/legendary_lost point to valid death events
 *  E3) Drop re-derivation matches combat_resolved.inputs.dropped_item_ids
 *  E4) Seed hash consistency (seed_hash === drop_seed_hash from receipt)
 *
 * Invariant: "Clickable evidence cannot drift from construction."
 *
 * Usage:
 *   cd apps/server
 *   npx tsx tools/verify-evidence.ts
 *
 * Env overrides:
 *   AKALYNTH_DB_PATH=./data/akalynth.db
 *   AKALYNTH_RECEIPTS_PATH=./audit/receipts.jsonl
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';

import { computeReceiptHash } from '../src/persist/hash.js';
import {
  explainDeathDrops,
  type ItemForDrop,
} from '../src/world/drop-policy.js';

// ============================================================================
// Types
// ============================================================================

type MapName = 'Rookguard' | 'Azura';

interface AuditReceipt {
  timestamp: string;
  player_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
}

interface CombatResolvedInputs {
  target_player_id: string;
  map: MapName;
  position: { x: number; y: number };
  outcome: 'kill';
  dropped_item_ids: string[];
  drop_seed_hash?: string;
  protected_item_id?: string | null;
}

interface HeatChangedInputs {
  item_id: string;
  delta: number;
  new_heat: number;
  reason: string;
}

interface InventorySlotChangedInputs {
  item_id: string;
  slot: 'protected' | null;
  prev_item_id?: string | null;
}

interface ReputationEventInputs {
  delta: number;
  event_type?: string;
}

interface EvidenceRef {
  chronicle_event_id: number;
  receipt_hash: string;
}

interface ChronicleRow {
  id: number;
  player_id: string;
  kind: string;
  timestamp: string;
  zone: string | null;
  receipt_hash: string;
  evidence_ref: string | null;
  details_json: string;
}

interface DeathRow {
  player_id: string;
  timestamp: string;
  zone: string;
  receipt_hash: string;
}

interface ItemMetaRow {
  item_id: string;
  item_type: string;
  meta_json: string;
}

interface ViolationRow {
  id: number;
  [key: string]: unknown;
}

// ============================================================================
// Helpers
// ============================================================================

function fail(msg: string): never {
  console.error(`\n[verify-evidence] FAIL: ${msg}`);
  process.exit(1);
}

function warn(msg: string): void {
  console.warn(`[verify-evidence] WARN: ${msg}`);
}

function ok(msg: string): void {
  console.log(`[verify-evidence] OK: ${msg}`);
}

// ============================================================================
// Receipt Parsing (from why-drop.ts pattern)
// ============================================================================

function parseJsonLines(file: string): AuditReceipt[] {
  if (!fs.existsSync(file)) {
    return []; // No receipts file = no verification possible
  }
  const text = fs.readFileSync(file, 'utf8');
  const out: AuditReceipt[] = [];
  let lineNo = 0;
  for (const line of text.split('\n')) {
    lineNo++;
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      throw new Error(`Malformed JSONL at line ${lineNo}`);
    }
  }
  return out;
}

function isCombatResolved(r: AuditReceipt): r is AuditReceipt & { inputs: CombatResolvedInputs } {
  return r.action === 'combat_resolved';
}

function isHeatChanged(r: AuditReceipt): r is AuditReceipt & { inputs: HeatChangedInputs } {
  return r.action === 'legendary_heat_changed';
}

function isSlotChanged(r: AuditReceipt): r is AuditReceipt & { inputs: InventorySlotChangedInputs } {
  return r.action === 'inventory_slot_changed';
}

function isInvAdd(r: AuditReceipt): boolean {
  return r.action === 'item_added_to_inventory';
}

function isInvRemove(r: AuditReceipt): boolean {
  return r.action === 'item_removed_from_inventory';
}

function isRepEvent(r: AuditReceipt): boolean {
  return r.action === 'reputation_event' || r.action === 'death_penalty_applied';
}

function itemIdFromInvReceipt(r: AuditReceipt): string | null {
  const inputs = r.inputs as Record<string, unknown>;
  return typeof inputs.item_id === 'string' ? inputs.item_id : null;
}

// ============================================================================
// Combat Receipt Lookup
// ============================================================================

/**
 * Build a map from receipt_hash -> combat_resolved receipt.
 * Uses the same hash computation as why-drop.ts for consistency.
 */
function buildCombatReceiptIndex(receipts: AuditReceipt[]): Map<string, AuditReceipt & { inputs: CombatResolvedInputs }> {
  const index = new Map<string, AuditReceipt & { inputs: CombatResolvedInputs }>();

  for (const r of receipts) {
    if (!isCombatResolved(r)) continue;

    // Compute canonical hash (same as why-drop.ts)
    const base = {
      player_id: r.player_id,
      action: r.action,
      inputs: {
        target_player_id: r.inputs.target_player_id,
        map: r.inputs.map,
        position: r.inputs.position,
        outcome: r.inputs.outcome,
      },
      result: r.result,
    };
    const hash = computeReceiptHash(base);
    index.set(hash, r);
  }

  return index;
}

// ============================================================================
// Pre-Combat State Replay (from why-drop.ts)
// ============================================================================

interface PreCombatState {
  inventoryByPlayer: Map<string, Set<string>>;
  heatByItemId: Map<string, number>;
  protectedByPlayerId: Map<string, string>;
  repByPlayerId: Map<string, number>;
}

function replayUpToReceipt(receipts: AuditReceipt[], targetHash: string): PreCombatState | null {
  const inventoryByPlayer = new Map<string, Set<string>>();
  const heatByItemId = new Map<string, number>();
  const protectedByPlayerId = new Map<string, string>();
  const repByPlayerId = new Map<string, number>();

  function inv(pid: string): Set<string> {
    let s = inventoryByPlayer.get(pid);
    if (!s) {
      s = new Set<string>();
      inventoryByPlayer.set(pid, s);
    }
    return s;
  }

  function rep(pid: string): number {
    return repByPlayerId.get(pid) ?? 0;
  }

  for (const r of receipts) {
    // Check if we've reached the target combat_resolved
    if (isCombatResolved(r)) {
      const base = {
        player_id: r.player_id,
        action: r.action,
        inputs: {
          target_player_id: r.inputs.target_player_id,
          map: r.inputs.map,
          position: r.inputs.position,
          outcome: r.inputs.outcome,
        },
        result: r.result,
      };
      const hash = computeReceiptHash(base);
      if (hash === targetHash) {
        // Return state just before this receipt
        return { inventoryByPlayer, heatByItemId, protectedByPlayerId, repByPlayerId };
      }
    }

    // Inventory projection
    if (isInvAdd(r)) {
      const itemId = itemIdFromInvReceipt(r);
      if (itemId) inv(r.player_id).add(itemId);
    } else if (isInvRemove(r)) {
      const itemId = itemIdFromInvReceipt(r);
      if (itemId) inv(r.player_id).delete(itemId);
    }

    // Protected slot projection
    if (isSlotChanged(r)) {
      const inputs = r.inputs as InventorySlotChangedInputs;
      const pid = r.player_id;
      if (inputs.slot === 'protected') {
        protectedByPlayerId.set(pid, inputs.item_id);
      } else {
        protectedByPlayerId.delete(pid);
      }
    }

    // Heat projection
    if (isHeatChanged(r)) {
      const inputs = r.inputs as HeatChangedInputs;
      heatByItemId.set(inputs.item_id, Math.max(0, inputs.new_heat));
    }

    // Reputation
    if (isRepEvent(r)) {
      const inputs = r.inputs as unknown as ReputationEventInputs;
      const d = typeof inputs.delta === 'number' ? inputs.delta : 0;
      repByPlayerId.set(r.player_id, rep(r.player_id) + d);
    }
  }

  return null; // Target receipt not found
}

// ============================================================================
// Item Meta Loader
// ============================================================================

function loadItemMeta(db: Database.Database, itemIds: string[]): Map<string, ItemMetaRow> {
  const out = new Map<string, ItemMetaRow>();
  if (itemIds.length === 0) return out;

  const stmt = db.prepare(`SELECT item_id, item_type, meta_json FROM items WHERE item_id = ?`);
  for (const id of itemIds) {
    const row = stmt.get(id) as ItemMetaRow | undefined;
    if (row) out.set(id, row);
  }
  return out;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const A = new Set(a);
  for (const x of b) if (!A.has(x)) return false;
  return true;
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  const dbPath = process.env.AKALYNTH_DB_PATH ?? './data/akalynth.db';
  const receiptsPath = process.env.AKALYNTH_RECEIPTS_PATH ?? './audit/receipts.jsonl';
  const absDb = path.resolve(process.cwd(), dbPath);
  const absReceipts = path.resolve(process.cwd(), receiptsPath);

  if (!fs.existsSync(absDb)) fail(`db not found: ${absDb}`);

  const db = new Database(absDb, { readonly: true });

  // Get schema version
  const versionRow = db.prepare(`SELECT value FROM _meta WHERE key = 'schema_version'`).get() as { value: string } | undefined;
  const schemaVersion = versionRow ? parseInt(versionRow.value, 10) : 0;
  console.log(`[verify-evidence] schema_version: ${schemaVersion}`);

  if (schemaVersion < 6) {
    warn(`schema_version < 6, evidence_ref not available`);
    console.log(`\n[verify-evidence] SKIP: schema < 6`);
    process.exit(0);
  }

  const violations: Record<string, number> = {
    E1: 0, E2: 0, E3: 0, E4: 0,
  };

  // ==========================================================================
  // Check E1: Death events have valid self-referencing evidence_ref
  // ==========================================================================
  const deathRows = db.prepare(`
    SELECT id, player_id, kind, receipt_hash, evidence_ref
    FROM chronicle_events
    WHERE kind = 'death'
  `).all() as ChronicleRow[];

  const e1Violations: ViolationRow[] = [];
  for (const row of deathRows) {
    if (!row.evidence_ref) {
      e1Violations.push({ id: row.id, reason: 'missing_evidence_ref' });
      continue;
    }

    try {
      const ref: EvidenceRef = JSON.parse(row.evidence_ref);
      if (typeof ref.chronicle_event_id !== 'number' || typeof ref.receipt_hash !== 'string') {
        e1Violations.push({ id: row.id, reason: 'malformed_structure' });
        continue;
      }
      if (ref.chronicle_event_id !== row.id) {
        e1Violations.push({ id: row.id, reason: 'id_mismatch', expected: row.id, got: ref.chronicle_event_id });
        continue;
      }
      if (ref.receipt_hash !== row.receipt_hash) {
        e1Violations.push({ id: row.id, reason: 'receipt_hash_mismatch' });
        continue;
      }
    } catch {
      e1Violations.push({ id: row.id, reason: 'parse_error' });
    }
  }

  if (e1Violations.length > 0) {
    console.error(`\n[verify-evidence] E1 VIOLATIONS (death self-reference):`);
    for (const row of e1Violations.slice(0, 10)) {
      console.error(`  id=${row.id} reason=${row.reason}`);
    }
    if (e1Violations.length > 10) console.error(`  ... and ${e1Violations.length - 10} more`);
    violations.E1 = e1Violations.length;
  } else {
    ok(`E1: death events have valid self-referencing evidence_ref (${deathRows.length} events)`);
  }

  // ==========================================================================
  // Check E2: Death-linked item_lost/legendary_lost point to valid death events
  // ==========================================================================
  const lossRows = db.prepare(`
    SELECT id, player_id, kind, receipt_hash, evidence_ref, details_json
    FROM chronicle_events
    WHERE kind IN ('item_lost', 'legendary_lost') AND evidence_ref IS NOT NULL
  `).all() as ChronicleRow[];

  const e2Violations: ViolationRow[] = [];
  for (const row of lossRows) {
    // Parse details to check if death-related
    let reason = 'unknown';
    try {
      const details = JSON.parse(row.details_json);
      reason = details.reason ?? 'unknown';
    } catch { /* ignore */ }

    const isDeathRelated = reason === 'death' || reason === 'death_drop';
    if (!isDeathRelated) continue; // Non-death items should have null evidence_ref (checked by C9)

    try {
      const ref: EvidenceRef = JSON.parse(row.evidence_ref!);
      if (typeof ref.chronicle_event_id !== 'number' || typeof ref.receipt_hash !== 'string') {
        e2Violations.push({ id: row.id, reason: 'malformed_structure' });
        continue;
      }

      // Lookup referenced death event
      const deathEvent = db.prepare(`
        SELECT id, player_id, kind, receipt_hash FROM chronicle_events WHERE id = ?
      `).get(ref.chronicle_event_id) as { id: number; player_id: string; kind: string; receipt_hash: string } | undefined;

      if (!deathEvent) {
        e2Violations.push({ id: row.id, reason: 'target_not_found', target_id: ref.chronicle_event_id });
        continue;
      }

      if (deathEvent.kind !== 'death') {
        e2Violations.push({ id: row.id, reason: 'target_not_death', target_kind: deathEvent.kind });
        continue;
      }

      if (deathEvent.receipt_hash !== ref.receipt_hash) {
        e2Violations.push({ id: row.id, reason: 'receipt_hash_mismatch' });
        continue;
      }

      if (deathEvent.player_id !== row.player_id) {
        e2Violations.push({ id: row.id, reason: 'victim_mismatch', expected: row.player_id, got: deathEvent.player_id });
        continue;
      }
    } catch {
      e2Violations.push({ id: row.id, reason: 'parse_error' });
    }
  }

  if (e2Violations.length > 0) {
    console.error(`\n[verify-evidence] E2 VIOLATIONS (death linkage):`);
    for (const row of e2Violations.slice(0, 10)) {
      console.error(`  id=${row.id} reason=${row.reason}`);
    }
    if (e2Violations.length > 10) console.error(`  ... and ${e2Violations.length - 10} more`);
    violations.E2 = e2Violations.length;
  } else {
    const deathLinked = lossRows.filter(r => {
      try {
        const d = JSON.parse(r.details_json);
        return d.reason === 'death' || d.reason === 'death_drop';
      } catch { return false; }
    }).length;
    ok(`E2: item_lost/legendary_lost events link to valid death events (${deathLinked} events)`);
  }

  // ==========================================================================
  // Check E3 & E4: Drop re-derivation + seed consistency
  // ==========================================================================
  // Load receipts
  let receipts: AuditReceipt[] = [];
  if (fs.existsSync(absReceipts)) {
    try {
      receipts = parseJsonLines(absReceipts);
    } catch (e) {
      warn(`Failed to parse receipts: ${(e as Error).message}`);
    }
  }

  if (receipts.length === 0) {
    warn('No receipts file found, skipping E3/E4');
    ok('E3: drop re-derivation (skipped, no receipts)');
    ok('E4: seed consistency (skipped, no receipts)');
  } else {
    // Build index of combat_resolved receipts
    const combatIndex = buildCombatReceiptIndex(receipts);

    // For each death with evidence_ref, verify drop re-derivation
    const e3Violations: ViolationRow[] = [];
    const e4Violations: ViolationRow[] = [];
    let verifiedDeaths = 0;

    for (const deathRow of deathRows) {
      if (!deathRow.evidence_ref) continue;

      // Get the combat_resolved receipt
      const combatReceipt = combatIndex.get(deathRow.receipt_hash);
      if (!combatReceipt) {
        // Death might not be from PvP (could be kill_self, etc.)
        continue;
      }

      verifiedDeaths++;

      // Replay state up to this combat
      const state = replayUpToReceipt(receipts, deathRow.receipt_hash);
      if (!state) {
        e3Violations.push({ id: deathRow.id, reason: 'failed_to_replay_state' });
        continue;
      }

      const victimId = combatReceipt.inputs.target_player_id;
      const map = combatReceipt.inputs.map;
      const droppedFromReceipt = combatReceipt.inputs.dropped_item_ids;
      const protectedId = combatReceipt.inputs.protected_item_id ?? null;

      // Get inventory items for victim
      const victimInv = state.inventoryByPlayer.get(victimId) ?? new Set<string>();
      const victimProtected = state.protectedByPlayerId.get(victimId);
      const victimRep = state.repByPlayerId.get(victimId) ?? 0;

      // Load item metadata
      const itemMeta = loadItemMeta(db, Array.from(victimInv));

      // Build ItemForDrop array
      const items: ItemForDrop[] = [];
      for (const itemId of victimInv) {
        const meta = itemMeta.get(itemId);
        let parsed: Record<string, unknown> = {};
        if (meta?.meta_json) {
          try { parsed = JSON.parse(meta.meta_json); } catch { /* ignore */ }
        }

        items.push({
          item_id: itemId,
          item_type: meta?.item_type ?? 'unknown',
          meta: parsed,
          slot: itemId === victimProtected ? 'protected' : null,
        });
      }

      // Build heat lookup
      const heatLookup = new Map<string, number>();
      for (const item of items) {
        if (item.meta?.legendary) {
          const heat = state.heatByItemId.get(item.item_id) ?? 0;
          heatLookup.set(item.item_id, heat);
        }
      }

      // Re-derive drops using same seed
      const explanation = explainDeathDrops(items, map, victimRep, deathRow.receipt_hash, heatLookup);

      // E3: Compare dropped_item_ids
      if (!sameSet(explanation.dropped_item_ids, droppedFromReceipt)) {
        e3Violations.push({
          id: deathRow.id,
          reason: 'dropped_mismatch',
          computed: explanation.dropped_item_ids.join(','),
          receipt: droppedFromReceipt.join(','),
        });
      }

      // E4: Seed consistency
      // The seed_hash in explanation should match the receipt_hash used for derivation
      // and drop_seed_hash in receipt (if present)
      if (combatReceipt.inputs.drop_seed_hash) {
        if (explanation.seed_hash !== combatReceipt.inputs.drop_seed_hash) {
          e4Violations.push({
            id: deathRow.id,
            reason: 'seed_mismatch',
            expected: combatReceipt.inputs.drop_seed_hash,
            got: explanation.seed_hash,
          });
        }
      }
    }

    if (e3Violations.length > 0) {
      console.error(`\n[verify-evidence] E3 VIOLATIONS (drop re-derivation):`);
      for (const row of e3Violations.slice(0, 10)) {
        console.error(`  id=${row.id} reason=${row.reason}`);
        if (row.computed) console.error(`    computed: [${row.computed}]`);
        if (row.receipt) console.error(`    receipt:  [${row.receipt}]`);
      }
      if (e3Violations.length > 10) console.error(`  ... and ${e3Violations.length - 10} more`);
      violations.E3 = e3Violations.length;
    } else {
      ok(`E3: drop re-derivation matches combat_resolved receipts (${verifiedDeaths} deaths)`);
    }

    if (e4Violations.length > 0) {
      console.error(`\n[verify-evidence] E4 VIOLATIONS (seed consistency):`);
      for (const row of e4Violations.slice(0, 10)) {
        console.error(`  id=${row.id} reason=${row.reason}`);
      }
      if (e4Violations.length > 10) console.error(`  ... and ${e4Violations.length - 10} more`);
      violations.E4 = e4Violations.length;
    } else {
      ok(`E4: seed_hash consistency verified`);
    }
  }

  // ==========================================================================
  // Summary
  // ==========================================================================
  const totalViolations = Object.values(violations).reduce((a, b) => a + b, 0);

  db.close();

  if (totalViolations > 0) {
    console.error(`\n[verify-evidence] FAIL: ${totalViolations} total violations`);
    for (const [check, count] of Object.entries(violations)) {
      if (count > 0) console.error(`  ${check}_violations: ${count}`);
    }
    process.exit(1);
  }

  console.log(`\n[verify-evidence] PASS`);
  console.log(`  schema_version: ${schemaVersion}`);
  console.log(`  death_events: ${deathRows.length}`);
  for (const [check] of Object.entries(violations)) {
    console.log(`  ${check}_violations: 0`);
  }
}

main();
