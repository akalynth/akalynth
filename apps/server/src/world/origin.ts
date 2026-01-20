// Akalynth Origin Act
// The Soul of Akalynth: A player's first meaningful action, sealed permanently.
//
// Your first act is not a choice — it is a revelation.
//
// The Origin Act is:
// - Witnessed, receipted, immutable
// - Discovered, not selected
// - Cannot be optimized
// - Remembered forever
//
// No UI. No announcement. No fireworks. Just permanence.

import type { AuditReceipt } from '../../../../packages/shared/types.js';
import type { PersistenceLayer } from '../persist/types.js';
import { computeReceiptHash } from '../persist/hash.js';
import { hasOriginActSealed } from '../persist/queries.js';

// ============================================================================
// Origin-Worthy Actions
// ============================================================================

/**
 * Actions that qualify as origin-worthy: resolved consequences, not intents.
 *
 * - combat_resolved: Killed another player (consequence, not attack_intent)
 * - tem_witness_response: Affected another player's reputation
 * - drop_item: Placed item in world for others
 *
 * These represent the purest forms of consequence: violence, judgment, generosity.
 *
 * CRITICAL: We key on combat_resolved, NOT attack_intent.
 * Intent ≠ consequence. A misclick or lag-spike must never seal someone's soul.
 */
export const ORIGIN_WORTHY_ACTIONS = new Set([
  'combat_resolved',      // Killed another player (consequence, not intent)
  'tem_witness_response', // Social judgment - affected another's reputation
  'drop_item',            // World alteration - placed item for others
]);

/**
 * Check if an action is origin-worthy.
 */
export function isOriginWorthy(action: string): boolean {
  return ORIGIN_WORTHY_ACTIONS.has(action);
}

// ============================================================================
// Origin Sealing
// ============================================================================

/**
 * AuditLogger interface (minimal subset needed here).
 */
interface AuditLoggerLike {
  write: (receipt: {
    actor_id?: string;
    player_id?: string;
    action: string;
    inputs: Record<string, unknown>;
    result: string;
  }) => void;
}

/**
 * Called after every receipt is written to the audit log.
 * If the receipt is origin-worthy and player has no origin yet, seal it.
 *
 * This is the ONLY place origin sealing is triggered during live operation.
 * The materializer enforces timestamp-ordered write (earliest wins) for replay safety.
 *
 * @param audit - The audit logger (to emit origin_act_sealed receipt)
 * @param persist - The persistence layer (to check if origin already sealed)
 * @param receipt - The receipt that was just written
 * @param receiptHash - The computed hash of the receipt (for reference)
 */
export function maybeSealOriginFromReceipt(
  audit: AuditLoggerLike,
  persist: PersistenceLayer,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  // Only origin-worthy actions can trigger sealing
  if (!isOriginWorthy(receipt.action)) return;

  // Check if player already has an origin (idempotency check)
  if (hasOriginActSealed(persist.db, receipt.actor_id)) return;

  // Emit sealing receipt
  // The materializer will handle idempotency with timestamp ordering
  audit.write({
    player_id: receipt.actor_id,
    action: 'origin_act_sealed',
    inputs: {
      trigger_action: receipt.action,
      trigger_receipt_hash: receiptHash,
    },
    result: 'ok',
  });
}
