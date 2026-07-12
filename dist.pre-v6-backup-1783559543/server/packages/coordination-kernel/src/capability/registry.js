// Capability Registry - Actor and Capability Management
// Central registry for actors and their capabilities
import { grantCap, revokeCap, checkCapGate, cleanExpiredCapabilities } from './gates.js';
import { applyFrictionConstraint, getFrictionBalance } from './constraints.js';
// ============================================================================
// Actor Registry
// ============================================================================
const actorRegistry = new Map();
// ============================================================================
// Actor Management
// ============================================================================
/**
 * Register a new actor in the system
 */
export function registerActor(actor_id, initial_capabilities = []) {
    if (actorRegistry.has(actor_id)) {
        throw new Error(`Actor ${actor_id} already exists`);
    }
    const actor = {
        id: actor_id,
        capabilities: [...initial_capabilities],
    };
    actorRegistry.set(actor_id, actor);
    return actor;
}
/**
 * Get an actor by ID
 */
export function getActor(actor_id) {
    return actorRegistry.get(actor_id) || null;
}
/**
 * Get or create an actor (lazy initialization)
 */
export function getOrCreateActor(actor_id) {
    let actor = getActor(actor_id);
    if (!actor) {
        actor = registerActor(actor_id);
    }
    return actor;
}
/**
 * List all registered actors
 */
export function listActors() {
    return Array.from(actorRegistry.values());
}
/**
 * Remove an actor from the registry
 */
export function removeActor(actor_id) {
    return actorRegistry.delete(actor_id);
}
// ============================================================================
// Capability Registry Operations
// ============================================================================
/**
 * Grant capability with full registry integration
 */
export async function grantCapabilityToActor(actor_id, capability, granted_by, audit, source = 'rule', metadata) {
    const actor = getOrCreateActor(actor_id);
    const result = await grantCap(actor, capability, granted_by, audit, source, metadata);
    return { ...result, actor };
}
/**
 * Revoke capability with full registry integration
 */
export async function revokeCapabilityFromActor(actor_id, capability, revoked_by, audit, reason = 'administrative', metadata) {
    const actor = getActor(actor_id);
    if (!actor) {
        return { revoked: false, actor: null };
    }
    const result = await revokeCap(actor, capability, revoked_by, audit, reason, metadata);
    return { ...result, actor };
}
/**
 * Check capability gate with full registry integration
 */
export async function checkActorCapability(actor_id, required_capability, attempted_action, audit, additional_checks) {
    const actor = getActor(actor_id);
    if (!actor) {
        await audit.write({
            actor_id,
            action: 'capability_gated',
            inputs: {
                required_capability,
                attempted_action,
                reason: 'actor_not_found'
            },
            result: 'blocked',
        });
        return { allowed: false, reason: 'actor_not_found', actor: null };
    }
    const result = await checkCapGate(actor, required_capability, attempted_action, audit, additional_checks);
    return { ...result, actor };
}
/**
 * Apply friction constraint to an actor action
 */
export async function applyActorFrictionConstraint(actor_id, action, inputs, audit) {
    const actor = getOrCreateActor(actor_id);
    const result = await applyFrictionConstraint(actor, action, inputs, audit);
    return { ...result, actor };
}
/**
 * Get actor status including capabilities and friction balance
 */
export function getActorStatus(actor_id) {
    const actor = getActor(actor_id);
    if (!actor) {
        return {
            actor: null,
            friction_balance: 0,
            capabilities_count: 0,
            temporal_capabilities: [],
            expired_capabilities: []
        };
    }
    const now = new Date();
    const temporalCaps = actor.capabilities.filter(cap => cap.includes('_until_'));
    const expiredCaps = temporalCaps.filter(cap => {
        const match = cap.match(/_until_(\d{4}_\d{2}_\d{2})$/);
        if (!match)
            return false;
        const [year, month, day] = match[1].split('_');
        const expiration = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return now > expiration;
    });
    return {
        actor,
        friction_balance: getFrictionBalance(actor_id),
        capabilities_count: actor.capabilities.length,
        temporal_capabilities: temporalCaps,
        expired_capabilities: expiredCaps
    };
}
/**
 * Clean expired capabilities from all actors
 */
export async function cleanAllExpiredCapabilities(audit) {
    const actors = listActors();
    let totalRemoved = 0;
    const details = [];
    for (const actor of actors) {
        const removed = await cleanExpiredCapabilities(actor, audit);
        if (removed.length > 0) {
            details.push({ actor_id: actor.id, removed_capabilities: removed });
            totalRemoved += removed.length;
        }
    }
    return {
        actors_processed: actors.length,
        capabilities_removed: totalRemoved,
        details
    };
}
/**
 * Clear all registry state (for testing/replay)
 */
export function clearRegistry() {
    actorRegistry.clear();
}
// ============================================================================
// Receipt Replay Integration
// ============================================================================
/**
 * Apply receipt to registry state (for replay/reconstruction)
 */
export function applyRegistryReceipt(receipt) {
    switch (receipt.action) {
        case 'capability_granted': {
            const actor = getOrCreateActor(receipt.actor_id);
            const capability = receipt.inputs.capability;
            if (capability && !actor.capabilities.includes(capability)) {
                actor.capabilities.push(capability);
            }
            break;
        }
        case 'capability_revoked': {
            const actor = getActor(receipt.actor_id);
            if (actor) {
                const capability = receipt.inputs.capability;
                const idx = actor.capabilities.indexOf(capability);
                if (idx !== -1) {
                    actor.capabilities.splice(idx, 1);
                }
            }
            break;
        }
    }
}
