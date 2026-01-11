// Akalynth Evidence Handler (Phase 4.4)
// Reconstructs forensic explanations for chronicle events.
//
// Design constraints:
//   G11 - Explainability: Every drop must be traceable to deterministic policy.
//   G14 - Chronicle Stability: Evidence must be reproducible across restarts.
//   G15 - External Auditability: Receipt hashes anchor all outputs.
//
// Read-only. No new receipts. No state mutation.

import type { EvidenceStatus, EvidenceSnapshotMessage, DropExplanationWire } from '../../../../packages/shared/protocol.js';
import type { PersistenceLayer, ChronicleEventRow, DeathRow } from '../persist/index.js';
import type { ItemForDrop, DropExplanation } from '../world/drop-policy.js';
import { explainDeathDrops } from '../world/drop-policy.js';
import type { MapName } from '../../../../packages/shared/http.js';

// ============================================================================
// Types
// ============================================================================

export interface EvidenceContext {
  persist: PersistenceLayer;
  getPlayerInventorySnapshot: (playerId: string, timestamp: string) => ItemForDrop[];
  getReputationAt: (playerId: string, timestamp: string) => number;
  getLegendaryHeatAt: (itemId: string, timestamp: string) => number;
}

export interface EvidenceRequest {
  playerId: string;
  chronicleEventId?: number;
  receiptHash?: string;
  kind?: string; // optional sanity guard
}

export interface EvidenceResult {
  status: EvidenceStatus;
  chronicleEvent?: ChronicleEventRow;
  evidence?: EvidenceSnapshotMessage['evidence'];
  errorCode?: string;
}

// ============================================================================
// Evidence Kind Registry
// ============================================================================

// Kinds that support evidence reconstruction
const EVIDENCE_SUPPORTED_KINDS = new Set([
  'item_lost',
  'legendary_lost',
  'death',
]);

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Reconstruct evidence for a chronicle event.
 *
 * Anchoring:
 *   1. Prefer chronicle_event_id (stable SQLite rowid)
 *   2. Fall back to receipt_hash (direct receipt lookup)
 *
 * Authorization:
 *   - Player can only query their own chronicle events.
 *   - This is enforced by the caller (index.ts).
 */
export function getEvidence(
  ctx: EvidenceContext,
  req: EvidenceRequest
): EvidenceResult {
  // Step 1: Resolve chronicle event
  let event: ChronicleEventRow | null = null;

  if (req.chronicleEventId !== undefined) {
    event = ctx.persist.getChronicleEventById(req.chronicleEventId);
    if (event && event.player_id !== req.playerId) {
      // Ownership violation - treat as not found
      return { status: 'not_found', errorCode: 'not_owner' };
    }
  } else if (req.receiptHash) {
    event = ctx.persist.getChronicleEventByReceiptHash(req.receiptHash, req.playerId);
  }

  if (!event) {
    return { status: 'not_found', errorCode: 'event_not_found' };
  }

  // Step 2: Kind sanity check (if provided)
  if (req.kind && event.kind !== req.kind) {
    return {
      status: 'not_found',
      chronicleEvent: event,
      errorCode: 'kind_mismatch',
    };
  }

  // Step 3: Check if evidence is supported for this kind
  if (!EVIDENCE_SUPPORTED_KINDS.has(event.kind)) {
    return {
      status: 'not_applicable',
      chronicleEvent: event,
      errorCode: 'evidence_not_supported_for_kind',
    };
  }

  // Step 4: Dispatch to kind-specific handler
  switch (event.kind) {
    case 'item_lost':
    case 'legendary_lost':
      return reconstructItemLostEvidence(ctx, event);

    case 'death':
      return reconstructDeathEvidence(ctx, event);

    default:
      return {
        status: 'not_applicable',
        chronicleEvent: event,
        errorCode: 'unhandled_kind',
      };
  }
}

// ============================================================================
// Kind-Specific Handlers
// ============================================================================

/**
 * Reconstruct evidence for item_lost or legendary_lost events.
 *
 * Derivation chain:
 *   1. item_lost chronicle event (anchor)
 *   2. Find associated death receipt (timestamp correlation)
 *   3. Reconstruct inventory snapshot at death time
 *   4. Run explainDeathDrops() with same inputs
 *   5. Return full breakdown
 */
function reconstructItemLostEvidence(
  ctx: EvidenceContext,
  event: ChronicleEventRow
): EvidenceResult {
  // Parse details to get item_id
  let details: { item_id?: string; reason?: string };
  try {
    details = JSON.parse(event.details_json);
  } catch {
    return {
      status: 'insufficient_data',
      chronicleEvent: event,
      errorCode: 'invalid_details_json',
    };
  }

  const itemId = details.item_id;
  if (!itemId) {
    return {
      status: 'insufficient_data',
      chronicleEvent: event,
      errorCode: 'missing_item_id',
    };
  }

  // Find the death that caused this item loss
  // The death must have occurred at or just before the item_lost timestamp
  const death = ctx.persist.getDeathBeforeTimestamp(event.player_id, event.timestamp);
  if (!death) {
    return {
      status: 'insufficient_data',
      chronicleEvent: event,
      errorCode: 'no_death_found',
    };
  }

  // Validate zone is a known map
  const zone = death.zone as MapName;
  if (zone !== 'Rookguard' && zone !== 'Azura') {
    return {
      status: 'insufficient_data',
      chronicleEvent: event,
      errorCode: 'unknown_zone',
    };
  }

  // Reconstruct inputs for explainDeathDrops
  const inventorySnapshot = ctx.getPlayerInventorySnapshot(event.player_id, death.timestamp);
  if (inventorySnapshot.length === 0) {
    return {
      status: 'insufficient_data',
      chronicleEvent: event,
      errorCode: 'empty_inventory_snapshot',
    };
  }

  const reputation = ctx.getReputationAt(event.player_id, death.timestamp);

  // Build heat lookup for legendary items
  const heatLookup = new Map<string, number>();
  for (const item of inventorySnapshot) {
    if (item.meta?.legendary) {
      const heat = ctx.getLegendaryHeatAt(item.item_id, death.timestamp);
      heatLookup.set(item.item_id, heat);
    }
  }

  // Run the deterministic drop explanation
  const explanation = explainDeathDrops(
    inventorySnapshot,
    zone,
    reputation,
    death.receipt_hash,
    heatLookup
  );

  // Verify the item appears in the explanation
  const itemInExplanation = explanation.candidates.some((c) => c.item_id === itemId);
  if (!itemInExplanation) {
    return {
      status: 'insufficient_data',
      chronicleEvent: event,
      errorCode: 'item_not_in_candidates',
    };
  }

  return {
    status: 'ok',
    chronicleEvent: event,
    evidence: {
      receipt_hashes: {
        anchor: event.receipt_hash,
        death: death.receipt_hash,
      },
      drop_explanation: toDropExplanationWire(explanation),
    },
  };
}

/**
 * Reconstruct evidence for death events.
 *
 * For death events, we provide the full drop explanation showing
 * what was lost and why.
 */
function reconstructDeathEvidence(
  ctx: EvidenceContext,
  event: ChronicleEventRow
): EvidenceResult {
  // Parse details to get cause and killer_id
  let details: { cause?: string; killer_id?: string | null };
  try {
    details = JSON.parse(event.details_json);
  } catch {
    return {
      status: 'insufficient_data',
      chronicleEvent: event,
      errorCode: 'invalid_details_json',
    };
  }

  // Get death row directly from receipt hash
  const death = ctx.persist.getDeathByReceiptHash(event.receipt_hash);
  if (!death) {
    return {
      status: 'insufficient_data',
      chronicleEvent: event,
      errorCode: 'death_row_not_found',
    };
  }

  // Validate zone
  const zone = death.zone as MapName;
  if (zone !== 'Rookguard' && zone !== 'Azura') {
    return {
      status: 'insufficient_data',
      chronicleEvent: event,
      errorCode: 'unknown_zone',
    };
  }

  // Reconstruct inventory at death time
  const inventorySnapshot = ctx.getPlayerInventorySnapshot(event.player_id, death.timestamp);

  // Even empty inventory is valid for death evidence
  const reputation = ctx.getReputationAt(event.player_id, death.timestamp);

  // Build heat lookup
  const heatLookup = new Map<string, number>();
  for (const item of inventorySnapshot) {
    if (item.meta?.legendary) {
      const heat = ctx.getLegendaryHeatAt(item.item_id, death.timestamp);
      heatLookup.set(item.item_id, heat);
    }
  }

  // Run deterministic drop explanation
  const explanation = explainDeathDrops(
    inventorySnapshot,
    zone,
    reputation,
    death.receipt_hash,
    heatLookup
  );

  // Build receipt hashes including combat if PvP
  const receiptHashes: {
    anchor: string;
    combat_resolved?: string;
    death?: string;
  } = {
    anchor: event.receipt_hash,
    death: death.receipt_hash,
  };

  // Note: combat_resolved receipt hash could be added here if we track killer attribution
  // For now, we include killer_id in details but not the combat receipt hash

  return {
    status: 'ok',
    chronicleEvent: event,
    evidence: {
      receipt_hashes: receiptHashes,
      drop_explanation: toDropExplanationWire(explanation),
    },
  };
}

// ============================================================================
// Wire Format Conversion
// ============================================================================

/**
 * Convert internal DropExplanation to wire format.
 * Preserves all fields for external auditability (G15).
 */
function toDropExplanationWire(explanation: DropExplanation): DropExplanationWire {
  return {
    policy: {
      base_drop_ratio: explanation.policy.base_drop_ratio,
      min_drop: explanation.policy.min_drop,
      max_drop: explanation.policy.max_drop,
      rep_bias: explanation.policy.rep_bias,
      stack_bias: explanation.policy.stack_bias,
      protected_slots: explanation.policy.protected_slots,
      decay_minutes: explanation.policy.decay_minutes,
    },
    ratio_breakdown: {
      base_drop_ratio: explanation.ratio_breakdown.base_drop_ratio,
      reputation: explanation.ratio_breakdown.reputation,
      neg_rep: explanation.ratio_breakdown.neg_rep,
      inventory_size: explanation.ratio_breakdown.inventory_size,
      stack_excess: explanation.ratio_breakdown.stack_excess,
      rep_contribution: explanation.ratio_breakdown.rep_contribution,
      stack_contribution: explanation.ratio_breakdown.stack_contribution,
      final_ratio: explanation.ratio_breakdown.final_ratio,
      K_raw: explanation.ratio_breakdown.K_raw,
      K_bounded: explanation.ratio_breakdown.K_bounded,
      K_final: explanation.ratio_breakdown.K_final,
    },
    player_protected_ids: explanation.player_protected_ids,
    policy_protected_ids: explanation.policy_protected_ids,
    candidates: explanation.candidates.map((c) => ({
      item_id: c.item_id,
      item_type: c.item_type,
      base_weight: c.base_weight,
      legendary: c.legendary,
      legendary_tier: c.legendary_tier,
      heat: c.heat,
      legendary_multiplier: c.legendary_multiplier,
      final_weight: c.final_weight,
      deterministic_u: c.deterministic_u,
      selection_key: c.selection_key,
      rank: c.rank,
      dropped: c.dropped,
      exclusion_reason: c.exclusion_reason,
    })),
    dropped_item_ids: explanation.dropped_item_ids,
    kept_item_ids: explanation.kept_item_ids,
    seed_hash: explanation.seed_hash,
  };
}
