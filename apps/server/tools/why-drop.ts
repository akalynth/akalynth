#!/usr/bin/env node
/**
 * Phase 4.3 — why-did-this-drop
 * Receipts-first reconstruction + deterministic drop-policy verification.
 *
 * Answers:
 *   - What inventory + heat + protection existed right before combat_resolved
 *   - What the drop-policy computed (ratio → K → weighted selection)
 *   - Why specific items dropped / were kept
 *   - Whether computed selection matches combat_resolved.inputs.dropped_item_ids
 *   - Whether subsequent item_removed_from_inventory receipts match
 *
 * Usage:
 *   npx tsx tools/why-drop.ts --combat-hash blake3:... --receipts audit/receipts.jsonl --db data/akalynth.db
 *   npx tsx tools/why-drop.ts --victim <player_id> --receipts audit/receipts.jsonl --db data/akalynth.db
 *
 * Failure conditions:
 *   F1: recomputedDropped != combat_resolved.inputs.dropped_item_ids
 *   F2: protected_item_id mismatch between precombat reconstruction and receipt
 *   F3: item_removed_from_inventory set != recomputedDropped
 *   F4: Any dropped item was protected (should never happen)
 *   F5: Any dropped item lacks item metadata in items table
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { resolveChainPaths } from '../../../packages/shared/paths.js';

import { computeReceiptHash } from '../src/persist/hash.js';
import {
  explainDeathDrops,
  type ItemForDrop,
  type DropExplanation,
} from '../src/world/drop-policy.js';

// ----------------------------
// Types (match your receipts)
// ----------------------------
type MapName = 'Rookguard' | 'Azura';

interface AuditReceipt {
  sequence: number;
  timestamp: string;
  prev_hash: string;
  event_hash: string;
  signature: string;
  actor_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
  inputs_hash: string;
  outputs_hash: string;
}

type CombatResolvedInputs = {
  target_player_id: string;
  map: MapName;
  position: { x: number; y: number };
  outcome: 'kill';
  dropped_item_ids: string[];
  protected_item_id?: string | null;
};

type HeatChangedInputs = {
  item_id: string;
  delta: number;
  new_heat: number;
  reason: 'combat_kill' | 'combat_death' | 'decay';
};

type InventorySlotChangedInputs = {
  item_id: string;
  slot: 'protected' | null;
  prev_item_id?: string | null;
};

type ReputationEventInputs = {
  delta: number;
  event_type?: string;
};

// ----------------------------
// CLI parsing
// ----------------------------
function getArg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

// Canonical path resolution (single source of truth), with CLI override support
const chainPaths = resolveChainPaths(path.resolve(process.cwd()));
const receiptsPath = getArg('--receipts')
  ? path.resolve(process.cwd(), getArg('--receipts')!)
  : chainPaths.receiptsPath;
const dbPath = getArg('--db')
  ? path.resolve(process.cwd(), getArg('--db')!)
  : chainPaths.dbPath;
const combatHashArg = getArg('--combat-hash');
const victimArg = getArg('--victim');

// ----------------------------
// Helpers
// ----------------------------
function parseJsonLines(file: string): AuditReceipt[] {
  if (!fs.existsSync(file)) {
    throw new Error(`Receipts file not found: ${file}`);
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

// ----------------------------
// Item metadata from SQLite
// ----------------------------
interface ItemMetaRow {
  item_id: string;
  item_type: string;
  meta_json: string;
}

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

// ----------------------------
// Anchor finding
// ----------------------------
function findCombatResolvedByHash(receipts: AuditReceipt[], hash: string): { idx: number; r: AuditReceipt } | null {
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    if (!isCombatResolved(r)) continue;

    // Canon seed is computeReceiptHash({ actor_id, action, inputs, result }) — no timestamp
    const base = {
      actor_id: r.actor_id,
      action: r.action,
      inputs: {
        target_player_id: r.inputs.target_player_id,
        map: r.inputs.map,
        position: r.inputs.position,
        outcome: r.inputs.outcome,
      },
      result: r.result,
    };
    const computed = computeReceiptHash(base);

    if (computed === hash) return { idx: i, r };
  }
  return null;
}

function findLatestCombatResolvedForVictim(receipts: AuditReceipt[], victimId: string): { idx: number; r: AuditReceipt } | null {
  for (let i = receipts.length - 1; i >= 0; i--) {
    const r = receipts[i];
    if (!isCombatResolved(r)) continue;
    const inputs = r.inputs as CombatResolvedInputs;
    if (inputs.target_player_id === victimId) return { idx: i, r };
  }
  return null;
}

// ----------------------------
// Receipt replay up to anchor (pre-combat state)
// ----------------------------
interface PreCombatState {
  inventoryByPlayer: Map<string, Set<string>>;
  heatByItemId: Map<string, number>;
  protectedByPlayerId: Map<string, string>;
  repByPlayerId: Map<string, number>;
}

function replayUpTo(receipts: AuditReceipt[], stopExclusiveIdx: number): PreCombatState {
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

  for (let i = 0; i < stopExclusiveIdx; i++) {
    const r = receipts[i];

    // Inventory projection
    if (isInvAdd(r)) {
      const itemId = itemIdFromInvReceipt(r);
      if (itemId) inv(r.actor_id).add(itemId);
    } else if (isInvRemove(r)) {
      const itemId = itemIdFromInvReceipt(r);
      if (itemId) inv(r.actor_id).delete(itemId);
    }

    // Protected slot projection
    if (isSlotChanged(r)) {
      const inputs = r.inputs as InventorySlotChangedInputs;
      const pid = r.actor_id;
      if (inputs.slot === 'protected') {
        protectedByPlayerId.set(pid, inputs.item_id);
      } else {
        protectedByPlayerId.delete(pid);
      }
    }

    // Heat projection (absolute new_heat is replay-proof)
    if (isHeatChanged(r)) {
      const inputs = r.inputs as HeatChangedInputs;
      heatByItemId.set(inputs.item_id, Math.max(0, inputs.new_heat));
    }

    // Reputation
    if (isRepEvent(r)) {
      const inputs = r.inputs as unknown as ReputationEventInputs;
      const d = typeof inputs.delta === 'number' ? inputs.delta : 0;
      repByPlayerId.set(r.actor_id, rep(r.actor_id) + d);
    }
  }

  return {
    inventoryByPlayer,
    heatByItemId,
    protectedByPlayerId,
    repByPlayerId,
  };
}

// ----------------------------
// Failure detection
// ----------------------------
interface VerificationResult {
  F1_dropped_mismatch: boolean;
  F2_protected_mismatch: boolean;
  F3_removed_mismatch: boolean;
  F4_dropped_was_protected: boolean;
  F5_missing_item_meta: boolean;
  all_pass: boolean;
  details: Record<string, unknown>;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const A = new Set(a);
  for (const x of b) if (!A.has(x)) return false;
  return true;
}

function safeJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}

// ----------------------------
// Report generation
// ----------------------------
interface WhyDropReport {
  anchor: {
    combat_resolved_hash: string;
    timestamp: string;
    attacker_id: string;
    victim_id: string;
    map: MapName;
    position: { x: number; y: number };
    protected_item_id_precombat: string | null;
    protected_item_id_in_receipt: string | null;
  };
  precombat: {
    inventory_size: number;
    reputation: number;
    items: Array<{
      item_id: string;
      item_type: string;
      heat: number;
      legendary: boolean;
      legendary_tier: number | null;
      meta: Record<string, unknown>;
    }>;
  };
  explanation: DropExplanation;
  receipt_comparison: {
    receipt_dropped_item_ids: string[];
    removed_from_inventory_item_ids: string[];
  };
  verification: VerificationResult;
}

function main() {
  // Validate inputs
  if (!combatHashArg && !victimArg) {
    console.error('Usage: npx tsx tools/why-drop.ts --combat-hash <hash> | --victim <player_id>');
    console.error('Options:');
    console.error('  --receipts <path>  Path to receipts.jsonl (default: audit/receipts.jsonl)');
    console.error('  --db <path>        Path to SQLite database (default: data/akalynth.db)');
    process.exit(1);
  }

  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
  }

  const receipts = parseJsonLines(receiptsPath);
  const db = new Database(dbPath, { readonly: true });

  console.error(`[why-drop] Loaded ${receipts.length} receipts from ${receiptsPath}`);

  // Find anchor
  let anchor: { idx: number; r: AuditReceipt } | null = null;

  if (combatHashArg) {
    anchor = findCombatResolvedByHash(receipts, combatHashArg);
    if (!anchor) {
      console.error(`[why-drop] FAIL: combat_resolved with hash ${combatHashArg} not found`);
      process.exit(1);
    }
  } else if (victimArg) {
    anchor = findLatestCombatResolvedForVictim(receipts, victimArg);
    if (!anchor) {
      console.error(`[why-drop] FAIL: no combat_resolved found for victim ${victimArg}`);
      process.exit(1);
    }
  }

  const { idx, r } = anchor!;
  const inputs = r.inputs as CombatResolvedInputs;

  const attackerId = r.actor_id;
  const victimId = inputs.target_player_id;
  const map = inputs.map;

  // Compute the canonical seed hash (same as used by drop-policy)
  const combatResolvedBase = {
    actor_id: r.actor_id,
    action: r.action,
    inputs: {
      target_player_id: inputs.target_player_id,
      map: inputs.map,
      position: inputs.position,
      outcome: inputs.outcome,
    },
    result: r.result,
  };
  const combatResolvedHash = computeReceiptHash(combatResolvedBase);

  console.error(`[why-drop] Found combat_resolved at receipt #${idx + 1}`);
  console.error(`[why-drop] Hash: ${combatResolvedHash}`);
  console.error(`[why-drop] Attacker: ${attackerId}, Victim: ${victimId}`);

  // Pre-combat state from receipt replay
  const state = replayUpTo(receipts, idx);
  const victimInventory = state.inventoryByPlayer.get(victimId) ?? new Set<string>();
  const protectedItemId = state.protectedByPlayerId.get(victimId) ?? null;
  const rep = state.repByPlayerId.get(victimId) ?? 0;

  console.error(`[why-drop] Pre-combat inventory: ${victimInventory.size} items`);
  console.error(`[why-drop] Pre-combat reputation: ${rep}`);
  console.error(`[why-drop] Protected item: ${protectedItemId ?? 'none'}`);

  // Load item metadata from SQLite
  const allItemIds = Array.from(victimInventory);
  const metaMap = loadItemMeta(db, allItemIds);

  // Check F5: missing item meta
  const missingMeta: string[] = [];
  for (const id of allItemIds) {
    if (!metaMap.has(id)) missingMeta.push(id);
  }

  // Build items for drop policy
  const itemsForDrop: ItemForDrop[] = allItemIds.map((id) => {
    const row = metaMap.get(id);
    const meta = row?.meta_json ? safeJson(row.meta_json) : {};
    return {
      item_id: id,
      item_type: row?.item_type ?? 'unknown',
      meta,
      slot: id === protectedItemId ? 'protected' : null,
    };
  });

  // Run the full explainer
  const explanation = explainDeathDrops(
    itemsForDrop,
    map,
    rep,
    combatResolvedHash,
    state.heatByItemId
  );

  // Receipt values
  const receiptDropped = inputs.dropped_item_ids ?? [];
  const receiptProtected = inputs.protected_item_id ?? null;

  // Find subsequent item_removed_from_inventory receipts
  const removedItemIds: string[] = [];
  for (let j = idx + 1; j < receipts.length; j++) {
    const rr = receipts[j];
    // Stop at next combat event for this victim
    if (isCombatResolved(rr) && (rr.inputs as CombatResolvedInputs).target_player_id === victimId) break;
    if (rr.action === 'death' && rr.actor_id === victimId) break;

    if (rr.actor_id === victimId && rr.action === 'item_removed_from_inventory') {
      const itemId = itemIdFromInvReceipt(rr);
      if (itemId) removedItemIds.push(itemId);
    }
  }

  // Verification
  const F1 = !sameSet(explanation.dropped_item_ids, receiptDropped);
  const F2 = receiptProtected !== protectedItemId;
  const F3 = !sameSet(removedItemIds, explanation.dropped_item_ids);
  const F4 = explanation.dropped_item_ids.some((id) => id === protectedItemId);
  const F5 = missingMeta.length > 0;

  const verification: VerificationResult = {
    F1_dropped_mismatch: F1,
    F2_protected_mismatch: F2,
    F3_removed_mismatch: F3,
    F4_dropped_was_protected: F4,
    F5_missing_item_meta: F5,
    all_pass: !F1 && !F2 && !F3 && !F4 && !F5,
    details: {
      recomputed_dropped: explanation.dropped_item_ids,
      receipt_dropped: receiptDropped,
      removed_from_inventory: removedItemIds,
      missing_item_meta: missingMeta,
    },
  };

  // Build precombat items list
  const precombatItems = itemsForDrop.map((it) => {
    const heat = state.heatByItemId.get(it.item_id) ?? 0;
    const meta = it.meta ?? {};
    const legendary = !!(meta as Record<string, unknown>).legendary;
    const tier = (meta as Record<string, unknown>).legendary_tier;
    return {
      item_id: it.item_id,
      item_type: it.item_type,
      heat,
      legendary,
      legendary_tier: legendary && typeof tier === 'number' ? tier : null,
      meta,
    };
  });

  // Build report
  const report: WhyDropReport = {
    anchor: {
      combat_resolved_hash: combatResolvedHash,
      timestamp: r.timestamp,
      attacker_id: attackerId,
      victim_id: victimId,
      map,
      position: inputs.position,
      protected_item_id_precombat: protectedItemId,
      protected_item_id_in_receipt: receiptProtected,
    },
    precombat: {
      inventory_size: itemsForDrop.length,
      reputation: rep,
      items: precombatItems,
    },
    explanation,
    receipt_comparison: {
      receipt_dropped_item_ids: receiptDropped,
      removed_from_inventory_item_ids: removedItemIds,
    },
    verification,
  };

  // Output JSON report
  console.log(JSON.stringify(report, null, 2));

  // Exit with error code if verification failed
  if (!verification.all_pass) {
    console.error(`\n[why-drop] VERIFICATION FAILED:`);
    if (F1) console.error(`  F1: recomputed dropped != receipt dropped`);
    if (F2) console.error(`  F2: protected_item_id mismatch`);
    if (F3) console.error(`  F3: removed_from_inventory != recomputed dropped`);
    if (F4) console.error(`  F4: dropped item was protected`);
    if (F5) console.error(`  F5: missing item metadata: ${missingMeta.join(', ')}`);
    process.exit(1);
  }

  console.error(`\n[why-drop] VERIFICATION PASSED`);
}

main();
