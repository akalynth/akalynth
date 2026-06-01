// Akalynth Drop Policy v0.2 — Weighted, Deterministic, Receipts Unchanged
// Pure server policy for death drops.
//
// SINGLE-SOURCING (F1/#100): the PURE selection logic now lives VERBATIM in
// packages/shared/dropPolicy.ts so the offline outcome verifier can recompute
// dropped_item_ids from a receipt artifact alone. This module RE-EXPORTS those
// functions so the server stays byte-identical. Only the forensic
// explainDeathDrops() path (server/tooling only, never needed offline) remains
// here, since it carries heavier forensic types and an explicit heatLookup.
//
// Determinism: Selection is seeded by death receipt hash (BLAKE3 hex)
// Replay-safe: Same receipts → same drop selection

import type { MapName } from '../../../../packages/shared/http.js';
import { rngDrawU32Legacy } from './rng.js';
import {
  DROP_POLICY,
  getLegendaryHeat,
  type DropPolicy,
  type ItemForDrop,
} from '../../../../packages/shared/dropPolicy.js';

// Re-export the PURE single-sourced policy surface (byte-identical to shared).
export {
  DROP_POLICY,
  LEGENDARY_HEAT_DECAY_PER_MINUTE,
  computeDeathDrops,
  computeDropCount,
  selectItemsToDrop,
  getDeathDropDecayMs,
  getLegendaryHeat,
  setLegendaryHeat,
  addLegendaryHeat,
  decayLegendaryHeat,
  decayHeatForCarriedItems,
} from '../../../../packages/shared/dropPolicy.js';
export type {
  DropPolicy,
  ItemForDrop,
  DropSelectionResult,
} from '../../../../packages/shared/dropPolicy.js';

// ============================================================================
// Item Base Weights (forensic copy — must match shared dropPolicy.ts)
// ============================================================================

const ITEM_BASE_WEIGHT: Record<string, number> = {
  torch: 1.0,
  ration: 1.0,
  mark_token: 0.5, // slightly safer
  slime: 1.0, // Training Slime trophy drop
  unknown: 1.0,
};

// Legendary multiplier constants (forensic copy — must match shared dropPolicy.ts)
const LEGENDARY_ALPHA = 1.25; // Base tier multiplier
const LEGENDARY_BETA = 3.0; // Max heat contribution
const LEGENDARY_KAPPA = 6; // Heat scaling factor

/**
 * Deterministic float in (0,1], derived from seed + index.
 * Uses BLAKE3 as PRF: hash(seed + ":" + index) → u32 → (0,1].
 */
function deterministicRandom(seed: string, index: number): { u: number; u32: number } {
  const u32 = rngDrawU32Legacy(seed, index);
  const u = u32 / 0xffffffff;
  return { u: u === 0 ? 1 / 0xffffffff : u, u32 };
}

// ============================================================================
// Forensic Explanation (Phase 4.3)
// ============================================================================

export interface ItemWeightBreakdown {
  item_id: string;
  item_type: string;
  base_weight: number;
  legendary: boolean;
  legendary_tier: number | null;
  heat: number;
  legendary_multiplier: number | null;
  final_weight: number;
  deterministic_u: number;
  selection_key: number;
  rank: number;
  dropped: boolean;
  exclusion_reason: 'none' | 'player_protected' | 'policy_protected' | 'below_cutoff';
}

export interface DropRatioBreakdown {
  base_drop_ratio: number;
  reputation: number;
  neg_rep: number;
  inventory_size: number;
  stack_excess: number;
  rep_contribution: number;
  stack_contribution: number;
  final_ratio: number;
  K_raw: number;
  K_bounded: number;
  K_final: number;
}

export interface DropExplanation {
  policy: DropPolicy;
  ratio_breakdown: DropRatioBreakdown;
  player_protected_ids: string[];
  policy_protected_ids: string[];
  candidates: ItemWeightBreakdown[];
  dropped_item_ids: string[];
  kept_item_ids: string[];
  seed_hash: string;
}

/**
 * Explain death drops with full transparency into weight calculations and ranking.
 * For forensic/debugging use only - more expensive than computeDeathDrops().
 */
export function explainDeathDrops(
  items: ItemForDrop[],
  map: MapName,
  reputation: number,
  deathReceiptHash: string,
  heatLookup?: Map<string, number>
): DropExplanation {
  const policy = DROP_POLICY[map];
  const inventorySize = items.length;

  // Ratio breakdown
  const N = inventorySize;
  const neg = Math.max(0, -reputation);
  const stack = Math.max(0, N - 3);

  const repContrib = policy.rep_bias * (1 - Math.exp(-neg / 5));
  const stackContrib = policy.stack_bias * (1 - Math.exp(-stack / 4));
  const finalRatio = Math.max(0, Math.min(1, policy.base_drop_ratio + repContrib + stackContrib));

  const K_raw = Math.round(finalRatio * N);
  const K_bounded = Math.max(policy.min_drop, Math.min(K_raw, policy.max_drop ?? N));
  const K_final = Math.min(K_bounded, Math.max(0, N - policy.protected_slots));

  const ratioBreakdown: DropRatioBreakdown = {
    base_drop_ratio: policy.base_drop_ratio,
    reputation,
    neg_rep: neg,
    inventory_size: N,
    stack_excess: stack,
    rep_contribution: repContrib,
    stack_contribution: stackContrib,
    final_ratio: finalRatio,
    K_raw,
    K_bounded,
    K_final,
  };

  // Player-protected items
  const playerProtectedIds = items
    .filter((i) => i.slot === 'protected')
    .map((i) => i.item_id);
  const playerProtectedSet = new Set(playerProtectedIds);

  // Policy-protected items (lowest weight kept safe)
  let policyProtectedIds: string[] = [];
  let candidates = items.filter((i) => !playerProtectedSet.has(i.item_id));

  if (policy.protected_slots > 0 && policy.protected_slots < candidates.length) {
    const sorted = [...candidates].sort((a, b) => {
      const wa = getItemWeightWithLookup(a, heatLookup);
      const wb = getItemWeightWithLookup(b, heatLookup);
      return wa - wb;
    });
    policyProtectedIds = sorted.slice(0, policy.protected_slots).map((i) => i.item_id);
  }
  const policyProtectedSet = new Set(policyProtectedIds);
  candidates = candidates.filter((i) => !policyProtectedSet.has(i.item_id));

  // Compute weights and selection keys for all items
  const allBreakdowns: ItemWeightBreakdown[] = [];
  const candidateKeyed: Array<{ item_id: string; key: number; breakdown: ItemWeightBreakdown }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isPlayerProtected = playerProtectedSet.has(item.item_id);
    const isPolicyProtected = policyProtectedSet.has(item.item_id);

    const baseWeight = ITEM_BASE_WEIGHT[item.item_type] ?? ITEM_BASE_WEIGHT.unknown;
    const isLegendary = !!(item.meta?.legendary);
    const tier = typeof item.meta?.legendary_tier === 'number' ? item.meta.legendary_tier : 1;
    const heat = heatLookup?.get(item.item_id) ?? getLegendaryHeat(item.item_id);

    let legendaryMultiplier: number | null = null;
    let finalWeight = baseWeight;
    if (isLegendary) {
      legendaryMultiplier = computeLegendaryMultiplierExposed(tier, heat);
      finalWeight = baseWeight * legendaryMultiplier;
    }

    // Find candidate index for deterministic random
    const candidateIdx = candidates.findIndex((c) => c.item_id === item.item_id);
    const isCandidate = candidateIdx >= 0;

    let u = 0;
    let key = 0;
    if (isCandidate) {
      u = deterministicRandom(deathReceiptHash, candidateIdx).u;
      key = Math.pow(u, 1 / finalWeight);
    }

    const breakdown: ItemWeightBreakdown = {
      item_id: item.item_id,
      item_type: item.item_type,
      base_weight: baseWeight,
      legendary: isLegendary,
      legendary_tier: isLegendary ? tier : null,
      heat,
      legendary_multiplier: legendaryMultiplier,
      final_weight: finalWeight,
      deterministic_u: u,
      selection_key: key,
      rank: 0, // filled after sorting
      dropped: false, // filled after selection
      exclusion_reason: isPlayerProtected ? 'player_protected' :
                        isPolicyProtected ? 'policy_protected' :
                        'none',
    };

    allBreakdowns.push(breakdown);
    if (isCandidate) {
      candidateKeyed.push({ item_id: item.item_id, key, breakdown });
    }
  }

  // Sort candidates by key descending and assign ranks
  candidateKeyed.sort((a, b) => b.key - a.key);
  for (let i = 0; i < candidateKeyed.length; i++) {
    candidateKeyed[i].breakdown.rank = i + 1;
  }

  // Select top K_final as dropped
  const droppedItemIds: string[] = [];
  for (let i = 0; i < Math.min(K_final, candidateKeyed.length); i++) {
    const item = candidateKeyed[i];
    item.breakdown.dropped = true;
    droppedItemIds.push(item.item_id);
  }

  // Mark below_cutoff for candidates not dropped
  for (let i = K_final; i < candidateKeyed.length; i++) {
    candidateKeyed[i].breakdown.exclusion_reason = 'below_cutoff';
  }

  const droppedSet = new Set(droppedItemIds);
  const keptItemIds = items
    .filter((i) => !droppedSet.has(i.item_id))
    .map((i) => i.item_id);

  // Sort breakdowns by rank for readability (candidates first, then excluded)
  allBreakdowns.sort((a, b) => {
    if (a.exclusion_reason === 'none' && b.exclusion_reason !== 'none') return -1;
    if (a.exclusion_reason !== 'none' && b.exclusion_reason === 'none') return 1;
    if (a.exclusion_reason === 'none' && b.exclusion_reason === 'none') {
      return a.rank - b.rank;
    }
    return 0;
  });

  return {
    policy,
    ratio_breakdown: ratioBreakdown,
    player_protected_ids: playerProtectedIds,
    policy_protected_ids: policyProtectedIds,
    candidates: allBreakdowns,
    dropped_item_ids: droppedItemIds,
    kept_item_ids: keptItemIds,
    seed_hash: deathReceiptHash,
  };
}

// Helper to get item weight with optional heat lookup
function getItemWeightWithLookup(item: ItemForDrop, heatLookup?: Map<string, number>): number {
  const baseWeight = ITEM_BASE_WEIGHT[item.item_type] ?? ITEM_BASE_WEIGHT.unknown;
  if (item.meta?.legendary) {
    const tier = typeof item.meta.legendary_tier === 'number' ? item.meta.legendary_tier : 1;
    const heat = heatLookup?.get(item.item_id) ?? getLegendaryHeat(item.item_id);
    const multiplier = computeLegendaryMultiplierExposed(tier, heat);
    return baseWeight * multiplier;
  }
  return baseWeight;
}

// Exposed version of computeLegendaryMultiplier for forensics
function computeLegendaryMultiplierExposed(tier: number, heat: number): number {
  const tierContrib = LEGENDARY_ALPHA * tier;
  const heatContrib = LEGENDARY_BETA * (1 - Math.exp(-heat / LEGENDARY_KAPPA));
  return 1 + tierContrib + heatContrib;
}
