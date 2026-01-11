// Akalynth Drop Policy v0.2 — Weighted, Deterministic, Receipts Unchanged
// Pure server policy for death drops.
//
// Determinism: Selection is seeded by death receipt hash (BLAKE3 hex)
// Replay-safe: Same receipts → same drop selection

import { blake3 } from '@noble/hashes/blake3';
import type { MapName } from '../../../../packages/shared/http.js';

// ============================================================================
// Types
// ============================================================================

export interface DropPolicy {
  base_drop_ratio: number; // 0..1 base probability
  min_drop: number; // floor (at least this many drop)
  max_drop: number | null; // cap (null = no cap)
  rep_bias: number; // how much bad rep increases drops
  stack_bias: number; // how much carrying more increases drops
  protected_slots: number; // keep N items with lowest weight
  decay_minutes: number; // death drops decay time
}

export interface ItemForDrop {
  item_id: string;
  item_type: string;
  meta?: Record<string, unknown>;
  slot?: string | null; // Phase 3.2: 'protected' excludes from drop
}

// ============================================================================
// Zone Drop Policies
// ============================================================================

export const DROP_POLICY: Record<MapName, DropPolicy> = {
  Rookguard: {
    base_drop_ratio: 0.0,
    min_drop: 0,
    max_drop: 0,
    rep_bias: 0,
    stack_bias: 0,
    protected_slots: 999, // effectively all protected
    decay_minutes: 60,
  },
  Azura: {
    base_drop_ratio: 0.6,
    min_drop: 1,
    max_drop: null,
    rep_bias: 0.15,
    stack_bias: 0.1,
    protected_slots: 0,
    decay_minutes: 20,
  },
};

// ============================================================================
// Item Base Weights (higher = more likely to drop)
// ============================================================================

const ITEM_BASE_WEIGHT: Record<string, number> = {
  torch: 1.0,
  ration: 1.0,
  mark_token: 0.5, // slightly safer
  unknown: 1.0,
};

// ============================================================================
// Legendary Drop-Weight Escalation ("Lit Fuse")
// ============================================================================

// Legendary multiplier constants
const LEGENDARY_ALPHA = 1.25; // Base tier multiplier
const LEGENDARY_BETA = 3.0; // Max heat contribution
const LEGENDARY_KAPPA = 6; // Heat scaling factor

// In-memory heat tracking (per item_id)
// Heat increases from combat, decreases in safe zones
const legendaryHeatByItemId = new Map<string, number>();

/**
 * Get current heat for an item (0 if not tracked)
 */
export function getLegendaryHeat(itemId: string): number {
  return legendaryHeatByItemId.get(itemId) ?? 0;
}

/**
 * Set heat for an item
 */
export function setLegendaryHeat(itemId: string, heat: number): void {
  legendaryHeatByItemId.set(itemId, Math.max(0, heat));
}

/**
 * Add heat to an item
 */
export function addLegendaryHeat(itemId: string, delta: number): void {
  const current = getLegendaryHeat(itemId);
  setLegendaryHeat(itemId, current + delta);
}

/**
 * Decay heat for a single item
 * Call this periodically (e.g., once per minute)
 */
export function decayLegendaryHeat(itemId: string, decayAmount: number): void {
  const current = getLegendaryHeat(itemId);
  if (current > 0) {
    setLegendaryHeat(itemId, current - decayAmount);
  }
}

// Heat decay rate per minute in safe zones
export const LEGENDARY_HEAT_DECAY_PER_MINUTE = 0.2;

/**
 * Decay heat for all legendary items carried by a player in a safe zone.
 * Should be called once per minute for each player in Rookguard (or safe rectangles).
 *
 * @param itemIds - item IDs the player is carrying
 * @param getItemMeta - function to fetch item meta (to check legendary status)
 */
export function decayHeatForCarriedItems(
  itemIds: string[],
  getItemMeta: (itemId: string) => { legendary?: boolean } | undefined
): void {
  for (const itemId of itemIds) {
    const meta = getItemMeta(itemId);
    if (meta?.legendary) {
      decayLegendaryHeat(itemId, LEGENDARY_HEAT_DECAY_PER_MINUTE);
    }
  }
}

/**
 * Compute legendary weight multiplier
 * M_leg = 1 + α*L + β*(1 - e^(-H/κ))
 *
 * @param tier - legendary tier (1-5, default 1)
 * @param heat - accumulated heat (0+)
 */
function computeLegendaryMultiplier(tier: number, heat: number): number {
  const tierContrib = LEGENDARY_ALPHA * tier;
  const heatContrib = LEGENDARY_BETA * (1 - Math.exp(-heat / LEGENDARY_KAPPA));
  return 1 + tierContrib + heatContrib;
}

function getItemWeight(item: ItemForDrop, heatLookup?: Map<string, number>): number {
  const baseWeight = ITEM_BASE_WEIGHT[item.item_type] ?? ITEM_BASE_WEIGHT.unknown;

  // Check for legendary item
  if (item.meta?.legendary) {
    const tier = typeof item.meta.legendary_tier === 'number' ? item.meta.legendary_tier : 1;
    // Get heat from lookup or global map
    const heat = heatLookup?.get(item.item_id) ?? getLegendaryHeat(item.item_id);
    const multiplier = computeLegendaryMultiplier(tier, heat);
    return baseWeight * multiplier;
  }

  return baseWeight;
}

// ============================================================================
// Deterministic RNG (BLAKE3-seeded PRF)
// ============================================================================

/**
 * Deterministic float in (0,1], derived from seed + index.
 * Uses BLAKE3 as PRF: hash(seed + ":" + index) → u32 → (0,1].
 */
function deterministicRandom(seed: string, index: number): number {
  const input = `${seed}:${index}`;
  const h = blake3(new TextEncoder().encode(input));

  // Read first 4 bytes as unsigned u32 (big-endian)
  const u32 =
    ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;

  // Map to (0,1]. Avoid 0 exactly.
  const u = u32 / 0xffffffff;
  return u === 0 ? 1 / 0xffffffff : u;
}

// ============================================================================
// Drop Count Computation
// ============================================================================

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

/**
 * Compute how many items should drop based on policy and victim state.
 */
export function computeDropCount(
  inventorySize: number,
  reputation: number,
  policy: DropPolicy
): number {
  if (inventorySize <= 0) return 0;

  const N = inventorySize;

  // Only punish negative reputation
  const neg = Math.max(0, -reputation);

  // Carrying beyond "starter comfort" (3 items)
  const stack = Math.max(0, N - 3);

  // Smooth scaling curves
  const ratio = clamp01(
    policy.base_drop_ratio +
      policy.rep_bias * (1 - Math.exp(-neg / 5)) +
      policy.stack_bias * (1 - Math.exp(-stack / 4))
  );

  const K_raw = Math.round(ratio * N);
  const K_bounded = clamp(K_raw, policy.min_drop, policy.max_drop ?? N);

  // Respect protected slots
  const K_final = Math.min(
    K_bounded,
    Math.max(0, N - policy.protected_slots)
  );

  return K_final;
}

// ============================================================================
// Weighted Selection (Efraimidis–Spirakis)
// ============================================================================

/**
 * Select K items to drop using deterministic weighted sampling.
 *
 * For each item with weight w:
 *   u ∈ (0,1]
 *   key = u^(1/w)
 * Select top K keys (descending).
 *
 * Higher weight → exponent smaller → key closer to 1 → more likely selected.
 */
export function selectItemsToDrop(
  items: ItemForDrop[],
  K: number,
  seed: string,
  policy: DropPolicy
): string[] {
  if (K <= 0 || items.length === 0) return [];

  // Step 0: Exclude player-protected items (Phase 3.2)
  // Items with slot === 'protected' are never dropped
  const playerProtectedIds = new Set(
    items.filter((i) => i.slot === 'protected').map((i) => i.item_id)
  );
  let candidates = items.filter((i) => !playerProtectedIds.has(i.item_id));

  if (candidates.length === 0) return [];
  if (K >= candidates.length) return candidates.map((i) => i.item_id);

  // Step 1: optional policy protected slots = keep N lowest-weight items
  if (policy.protected_slots > 0 && policy.protected_slots < candidates.length) {
    const sorted = [...candidates].sort(
      (a, b) => getItemWeight(a) - getItemWeight(b)
    );
    const policyProtectedIds = new Set(
      sorted.slice(0, policy.protected_slots).map((i) => i.item_id)
    );
    candidates = candidates.filter((i) => !policyProtectedIds.has(i.item_id));
  }

  if (candidates.length === 0) return [];
  if (K >= candidates.length) return candidates.map((i) => i.item_id);

  // Step 2: compute keys
  const keyed: Array<{ item_id: string; key: number }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i];
    const w = getItemWeight(item);
    const u = deterministicRandom(seed, i);
    const key = Math.pow(u, 1 / w);
    keyed.push({ item_id: item.item_id, key });
  }

  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, K).map((k) => k.item_id);
}

// ============================================================================
// Main Entry Point
// ============================================================================

export interface DropSelectionResult {
  droppedItemIds: string[];
  keptItemIds: string[];
  dropCount: number;
  inventorySize: number;
}

/**
 * Determine which items to drop on death.
 *
 * @param items - full inventory snapshot (item_id + item_type [+ meta])
 * @param map - where death occurred
 * @param reputation - victim reputation score
 * @param deathReceiptHash - BLAKE3 hash of death receipt (string, e.g. "blake3:<hex>")
 */
export function computeDeathDrops(
  items: ItemForDrop[],
  map: MapName,
  reputation: number,
  deathReceiptHash: string
): DropSelectionResult {
  const policy = DROP_POLICY[map];
  const inventorySize = items.length;

  if (inventorySize === 0) {
    return {
      droppedItemIds: [],
      keptItemIds: [],
      dropCount: 0,
      inventorySize: 0,
    };
  }

  const dropCount = computeDropCount(inventorySize, reputation, policy);
  const droppedItemIds = selectItemsToDrop(
    items,
    dropCount,
    deathReceiptHash,
    policy
  );

  const droppedSet = new Set(droppedItemIds);
  const keptItemIds = items
    .filter((i) => !droppedSet.has(i.item_id))
    .map((i) => i.item_id);

  return {
    droppedItemIds,
    keptItemIds,
    dropCount,
    inventorySize,
  };
}

/**
 * Death-drop decay in ms for a given map (uses policy).
 */
export function getDeathDropDecayMs(map: MapName): number {
  return DROP_POLICY[map].decay_minutes * 60_000;
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
      u = deterministicRandom(deathReceiptHash, candidateIdx);
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
