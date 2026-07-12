// Akalynth Treasury Kernel v0 (Gold)
// In-memory projection — source of truth is receipts
// No DB schema; rebuilt purely from receipt replay on startup
import { WALLET_CREDIT_ACTION, WALLET_DEBIT_ACTION, MAX_GOLD_AMOUNT, ACTION_GOLD_COST, } from '../../../../packages/shared/types.js';
// ============================================================================
// In-Memory Projection (receipt-derived)
// ============================================================================
const goldBalanceByPlayer = new Map();
/**
 * Get Gold balance for a player (returns 0 if not set).
 */
export function getGoldBalance(playerId) {
    return goldBalanceByPlayer.get(playerId) ?? 0;
}
/**
 * Set Gold balance for a player.
 * NOTE: Only call from reducer — no direct mutations allowed.
 */
function setGoldBalance(playerId, balance) {
    goldBalanceByPlayer.set(playerId, balance);
}
/**
 * Clear all treasury state (for testing / fresh replay).
 */
export function clearTreasuryProjection() {
    goldBalanceByPlayer.clear();
}
// ============================================================================
// Validation
// ============================================================================
/**
 * Validate amount is positive integer within bounds.
 */
function isValidAmount(amount) {
    return (typeof amount === 'number' &&
        Number.isInteger(amount) &&
        amount > 0 &&
        amount <= MAX_GOLD_AMOUNT);
}
/**
 * Check if player can afford a debit.
 * Call BEFORE writing wallet_debit receipt.
 */
export function canAfford(playerId, amount) {
    return isValidAmount(amount) && getGoldBalance(playerId) >= amount;
}
// ============================================================================
// Per-Player Mutex (Double-Spend Guard)
// ============================================================================
const treasuryLocks = new Map();
/**
 * Execute a function with exclusive access to a player's treasury.
 * Prevents double-spend race conditions from rapid message spam.
 */
export async function withTreasuryLock(playerId, fn) {
    const prev = treasuryLocks.get(playerId) ?? Promise.resolve();
    let release;
    const next = new Promise((r) => (release = r));
    treasuryLocks.set(playerId, prev.then(() => next));
    try {
        await prev;
        return await fn();
    }
    finally {
        release();
        // Cleanup if nobody chained after us
        if (treasuryLocks.get(playerId) === prev.then(() => next)) {
            treasuryLocks.delete(playerId);
        }
    }
}
/**
 * Debit Gold for a costed action.
 * Looks up cost from ACTION_GOLD_COST, validates, and writes receipt.
 * Returns { ok: true, cost } on success, { ok: false, error } on failure.
 *
 * @param playerId - The player being debited
 * @param actionType - The action type (must match protocol message `type`)
 * @param writeReceipt - Callback to write the debit receipt
 */
export function debitForAction(playerId, actionType, writeReceipt) {
    // Look up cost from schedule
    const cost = ACTION_GOLD_COST[actionType];
    if (cost === undefined) {
        return { ok: false, error: 'unknown_action' };
    }
    // Validate cost is within bounds (should always be true for schedule constants)
    if (!isValidAmount(cost)) {
        return { ok: false, error: 'unknown_action' };
    }
    // Check if player can afford
    if (!canAfford(playerId, cost)) {
        return { ok: false, error: 'insufficient_gold' };
    }
    // Write debit receipt (reducer updates balance via logger hook)
    writeReceipt({
        actor_id: playerId,
        action: WALLET_DEBIT_ACTION,
        inputs: { amount: cost, reason: `action_cost:${actionType}` },
        result: 'ok',
    });
    return { ok: true, cost };
}
// ============================================================================
// Receipt Reducer (Deterministic)
// ============================================================================
/**
 * Receipt reducer — call during replay loop and on new receipt write.
 * Idempotent: replay order determines truth (no timestamp reliance).
 */
export function applyReceiptToTreasury(receipt) {
    const playerId = receipt.actor_id;
    if (!playerId)
        return;
    const current = getGoldBalance(playerId);
    switch (receipt.action) {
        case WALLET_CREDIT_ACTION: {
            const amount = receipt.inputs?.amount;
            if (isValidAmount(amount)) {
                setGoldBalance(playerId, current + amount);
            }
            break;
        }
        case WALLET_DEBIT_ACTION: {
            const amount = receipt.inputs?.amount;
            if (isValidAmount(amount)) {
                const next = current - amount;
                if (next >= 0) {
                    setGoldBalance(playerId, next);
                }
                else {
                    // Corruption evidence or old bug — do not apply silently.
                    console.warn(`[treasury] INVALID debit on replay/apply: player=${playerId} amount=${amount} balance=${current}`);
                }
            }
            break;
        }
        default:
            break;
    }
}
