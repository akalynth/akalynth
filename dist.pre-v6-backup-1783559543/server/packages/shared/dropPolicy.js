// Akalynth Drop Policy v0.2 — Weighted, Deterministic, Receipts Unchanged
// SINGLE SOURCE OF TRUTH for the PURE death-drop selection logic.
//
// These functions were moved here VERBATIM from
// apps/server/src/world/drop-policy.ts so the offline outcome verifier
// (tools/verify-outcome) can recompute dropped_item_ids from a receipt artifact
// alone, with NO server state, NO SQLite, and NO network. The server re-exports
// from this module so its outputs stay byte-identical.
//
// Determinism: Selection is seeded by death receipt hash (BLAKE3 hex).
// Replay-safe: Same inputs → same drop selection.
//
// PURITY NOTE: getItemWeight() can read legendary "heat". On the server the heat
// lives in an in-memory map (legendaryHeatByItemId). To stay byte-identical AND
// be reproducible offline, callers may pass an explicit `heatLookup` map. When
// omitted, the global map is consulted (server runtime behavior, unchanged). The
// offline verifier ALWAYS passes an explicit heatLookup reconstructed from the
// receipt's rng_proof snapshot, so it never depends on live server state.
import { rngDrawU32Legacy, rngU32ToUnitFloat } from './rng.js';
// ============================================================================
// Zone Drop Policies
// ============================================================================
export const DROP_POLICY = {
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
const ITEM_BASE_WEIGHT = {
    torch: 1.0,
    ration: 1.0,
    mark_token: 0.5, // slightly safer
    slime: 1.0, // Training Slime trophy drop
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
// Heat increases from combat, decreases in safe zones.
// SERVER-ONLY mutable state. The offline verifier never reads/writes this; it
// passes an explicit heatLookup reconstructed from the receipt instead.
const legendaryHeatByItemId = new Map();
/**
 * Get current heat for an item (0 if not tracked)
 */
export function getLegendaryHeat(itemId) {
    return legendaryHeatByItemId.get(itemId) ?? 0;
}
/**
 * Set heat for an item
 */
export function setLegendaryHeat(itemId, heat) {
    legendaryHeatByItemId.set(itemId, Math.max(0, heat));
}
/**
 * Add heat to an item
 */
export function addLegendaryHeat(itemId, delta) {
    const current = getLegendaryHeat(itemId);
    setLegendaryHeat(itemId, current + delta);
}
/**
 * Decay heat for a single item
 * Call this periodically (e.g., once per minute)
 */
export function decayLegendaryHeat(itemId, decayAmount) {
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
export function decayHeatForCarriedItems(itemIds, getItemMeta) {
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
function computeLegendaryMultiplier(tier, heat) {
    const tierContrib = LEGENDARY_ALPHA * tier;
    const heatContrib = LEGENDARY_BETA * (1 - Math.exp(-heat / LEGENDARY_KAPPA));
    return 1 + tierContrib + heatContrib;
}
function getItemWeight(item, heatLookup) {
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
function deterministicRandom(seed, index) {
    const u32 = rngDrawU32Legacy(seed, index);
    return { u: rngU32ToUnitFloat(u32), u32 };
}
// ============================================================================
// Drop Count Computation
// ============================================================================
function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}
function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
}
/**
 * Compute how many items should drop based on policy and victim state.
 */
export function computeDropCount(inventorySize, reputation, policy) {
    if (inventorySize <= 0)
        return 0;
    const N = inventorySize;
    // Only punish negative reputation
    const neg = Math.max(0, -reputation);
    // Carrying beyond "starter comfort" (3 items)
    const stack = Math.max(0, N - 3);
    // Smooth scaling curves
    const ratio = clamp01(policy.base_drop_ratio +
        policy.rep_bias * (1 - Math.exp(-neg / 5)) +
        policy.stack_bias * (1 - Math.exp(-stack / 4)));
    const K_raw = Math.round(ratio * N);
    const K_bounded = clamp(K_raw, policy.min_drop, policy.max_drop ?? N);
    // Respect protected slots
    const K_final = Math.min(K_bounded, Math.max(0, N - policy.protected_slots));
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
 *
 * @param heatLookup - optional explicit per-item heat. When omitted, the global
 *   server heat map is consulted (runtime behavior, unchanged). Offline callers
 *   MUST pass this so they never depend on live server state.
 */
export function selectItemsToDrop(items, K, seed, policy, rngOut, heatLookup) {
    if (K <= 0 || items.length === 0)
        return [];
    // Step 0: Exclude player-protected items (Phase 3.2)
    // Items with slot === 'protected' are never dropped
    const playerProtectedIds = new Set(items.filter((i) => i.slot === 'protected').map((i) => i.item_id));
    let candidates = items.filter((i) => !playerProtectedIds.has(i.item_id));
    if (candidates.length === 0)
        return [];
    if (K >= candidates.length)
        return candidates.map((i) => i.item_id);
    // Step 1: optional policy protected slots = keep N lowest-weight items
    if (policy.protected_slots > 0 && policy.protected_slots < candidates.length) {
        const sorted = [...candidates].sort((a, b) => getItemWeight(a, heatLookup) - getItemWeight(b, heatLookup));
        const policyProtectedIds = new Set(sorted.slice(0, policy.protected_slots).map((i) => i.item_id));
        candidates = candidates.filter((i) => !policyProtectedIds.has(i.item_id));
    }
    if (candidates.length === 0)
        return [];
    if (K >= candidates.length)
        return candidates.map((i) => i.item_id);
    // Step 2: compute keys
    const keyed = [];
    for (let i = 0; i < candidates.length; i++) {
        const item = candidates[i];
        const w = getItemWeight(item, heatLookup);
        const { u, u32 } = deterministicRandom(seed, i);
        if (rngOut)
            rngOut.push(u32);
        const key = Math.pow(u, 1 / w);
        keyed.push({ item_id: item.item_id, key });
    }
    keyed.sort((a, b) => b.key - a.key);
    return keyed.slice(0, K).map((k) => k.item_id);
}
/**
 * Determine which items to drop on death.
 *
 * @param items - full inventory snapshot (item_id + item_type [+ meta])
 * @param map - where death occurred
 * @param reputation - victim reputation score
 * @param deathReceiptHash - BLAKE3 hash of death receipt (string, e.g. "blake3:<hex>")
 * @param rngOut - optional sink that captures the raw u32 draws in order
 * @param heatLookup - optional explicit per-item heat (offline reproducibility)
 */
export function computeDeathDrops(items, map, reputation, deathReceiptHash, rngOut, heatLookup) {
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
    const droppedItemIds = selectItemsToDrop(items, dropCount, deathReceiptHash, policy, rngOut, heatLookup);
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
export function getDeathDropDecayMs(map) {
    return DROP_POLICY[map].decay_minutes * 60_000;
}
