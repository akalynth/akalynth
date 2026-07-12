// Akalynth Identity Projection (Sovereign Vocations v0)
// In-memory projection — source of truth is receipts
// No DB schema; rebuilt purely from receipt replay on startup
import { VOCATION_DECLARED_ACTION, SOVEREIGN_PREFIX_GRANTED_ACTION, SOVEREIGN_PREFIX_REVOKED_ACTION, } from '../../../../packages/shared/types.js';
// ============================================================================
// In-Memory Projection
// ============================================================================
const identityByPlayerId = new Map();
/**
 * Get identity for a player (returns default if not set).
 */
export function getIdentity(playerId) {
    return identityByPlayerId.get(playerId) ?? { vocation: null, sovereign_prefix: false };
}
/**
 * Set identity for a player.
 */
export function setIdentity(playerId, identity) {
    identityByPlayerId.set(playerId, identity);
}
/**
 * Clear all identity state (for testing / fresh replay).
 */
export function clearIdentityProjection() {
    identityByPlayerId.clear();
}
// ============================================================================
// Receipt Reducer
// ============================================================================
/**
 * Receipt reducer — call during replay loop and on new receipt write.
 * Idempotent: last-write-wins semantics.
 * NOTE: Does NOT rely on receipt.timestamp — replay order determines "last".
 */
export function applyReceiptToIdentity(receipt) {
    const playerId = receipt.actor_id;
    if (!playerId)
        return;
    const current = getIdentity(playerId);
    switch (receipt.action) {
        case VOCATION_DECLARED_ACTION: {
            const vocation = receipt.inputs?.vocation;
            if (vocation) {
                setIdentity(playerId, { ...current, vocation });
            }
            break;
        }
        case SOVEREIGN_PREFIX_GRANTED_ACTION: {
            setIdentity(playerId, { ...current, sovereign_prefix: true });
            break;
        }
        case SOVEREIGN_PREFIX_REVOKED_ACTION: {
            setIdentity(playerId, { ...current, sovereign_prefix: false });
            break;
        }
        // Other actions — ignore
    }
}
