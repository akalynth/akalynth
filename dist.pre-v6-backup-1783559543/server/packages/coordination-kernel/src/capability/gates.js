// Capability Gates - Constraint-based Access Control
// Domain-agnostic capability enforcement with temporal constraints
// ============================================================================
// Core Capability Actions
// ============================================================================
export const CAPABILITY_GRANTED_ACTION = 'capability_granted';
export const CAPABILITY_REVOKED_ACTION = 'capability_revoked';
export const CAPABILITY_GATED_ACTION = 'capability_gated';
export const CAPABILITY_EXPIRED_ACTION = 'capability_expired';
// ============================================================================
// Capability Management
// ============================================================================
/**
 * Check if an actor has a specific capability
 */
export function hasCap(actor, capability) {
    return actor.capabilities?.includes(capability) ?? false;
}
/**
 * Check if a capability is temporal (has expiration)
 */
export function isTemporalCapability(capability) {
    return capability.includes('_until_');
}
/**
 * Extract expiration date from temporal capability
 * Example: "approve_high_risk_until_2026_06_30" → Date object
 */
export function extractCapabilityExpiration(capability) {
    const match = capability.match(/_until_(\d{4}_\d{2}_\d{2})$/);
    if (!match)
        return null;
    const [year, month, day] = match[1].split('_');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
/**
 * Check if a temporal capability has expired
 */
export function hasCapabilityExpired(capability, now = new Date()) {
    const expiration = extractCapabilityExpiration(capability);
    return expiration ? now > expiration : false;
}
/**
 * Grant a capability to an actor
 * Returns { granted: true } if newly added, { granted: false } if already exists
 * Emits capability_granted receipt if newly granted
 */
export async function grantCap(actor, capability, granted_by, audit, source = 'rule', metadata) {
    if (!actor.capabilities)
        actor.capabilities = [];
    if (actor.capabilities.includes(capability))
        return { granted: false };
    actor.capabilities.push(capability);
    await audit.write({
        actor_id: actor.id,
        action: CAPABILITY_GRANTED_ACTION,
        inputs: {
            capability,
            source,
            granted_by,
            temporal: isTemporalCapability(capability),
            ...metadata
        },
        result: 'ok',
    });
    return { granted: true };
}
/**
 * Revoke a capability from an actor
 * Returns { revoked: true } if removed, { revoked: false } if didn't have
 * Emits capability_revoked receipt if removed
 */
export async function revokeCap(actor, capability, revoked_by, audit, reason = 'administrative', metadata) {
    if (!actor.capabilities)
        return { revoked: false };
    const idx = actor.capabilities.indexOf(capability);
    if (idx === -1)
        return { revoked: false };
    actor.capabilities.splice(idx, 1);
    await audit.write({
        actor_id: actor.id,
        action: CAPABILITY_REVOKED_ACTION,
        inputs: {
            capability,
            reason,
            revoked_by,
            temporal: isTemporalCapability(capability),
            ...metadata
        },
        result: 'ok',
    });
    return { revoked: true };
}
/**
 * Check capability gate and emit audit receipt if blocked
 * This is the core enforcement mechanism
 */
export async function checkCapGate(actor, required_capability, attempted_action, audit, additional_checks) {
    // Check basic capability existence
    if (!hasCap(actor, required_capability)) {
        await audit.write({
            actor_id: actor.id,
            action: CAPABILITY_GATED_ACTION,
            inputs: {
                required_capability,
                attempted_action,
                reason: 'missing_capability'
            },
            result: 'blocked',
        });
        return { allowed: false, reason: 'missing_capability' };
    }
    // Check temporal expiration
    if (isTemporalCapability(required_capability) && hasCapabilityExpired(required_capability)) {
        // Auto-revoke expired capability
        await revokeCap(actor, required_capability, 'system', audit, 'expired');
        await audit.write({
            actor_id: actor.id,
            action: CAPABILITY_GATED_ACTION,
            inputs: {
                required_capability,
                attempted_action,
                reason: 'capability_expired'
            },
            result: 'blocked',
        });
        return { allowed: false, reason: 'capability_expired' };
    }
    // Additional custom checks
    if (additional_checks && !(await additional_checks(actor, required_capability))) {
        await audit.write({
            actor_id: actor.id,
            action: CAPABILITY_GATED_ACTION,
            inputs: {
                required_capability,
                attempted_action,
                reason: 'additional_check_failed'
            },
            result: 'blocked',
        });
        return { allowed: false, reason: 'additional_check_failed' };
    }
    // Success - capability verified
    return { allowed: true };
}
/**
 * Clean expired capabilities from an actor
 * Returns list of capabilities that were removed
 */
export async function cleanExpiredCapabilities(actor, audit, now = new Date()) {
    if (!actor.capabilities)
        return [];
    const expiredCaps = [];
    for (const capability of [...actor.capabilities]) {
        if (isTemporalCapability(capability) && hasCapabilityExpired(capability, now)) {
            const result = await revokeCap(actor, capability, 'system', audit, 'expired');
            if (result.revoked) {
                expiredCaps.push(capability);
            }
        }
    }
    return expiredCaps;
}
