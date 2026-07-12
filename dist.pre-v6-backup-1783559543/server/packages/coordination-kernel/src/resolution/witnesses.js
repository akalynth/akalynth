// Participant Selection for Bounded Resolution
// Pluggable witness/participant selection strategies
import { isParticipantOnCooldown, isTargetOnCooldown } from './quorum.js';
// ============================================================================
// Built-in Selection Strategies
// ============================================================================
/**
 * Random selection strategy
 */
export const randomSelector = (candidates, criteria, now = Date.now()) => {
    const eligible = candidates
        .filter(actor => actor.id !== criteria.target_id &&
        !criteria.exclude_actors?.includes(actor.id) &&
        !isParticipantOnCooldown(actor.id, now) &&
        (criteria.required_capabilities?.every(cap => actor.capabilities.includes(cap)) ?? true))
        .map(actor => ({
        actor_id: actor.id,
        actor,
        score: Math.random(),
    }));
    return eligible
        .sort((a, b) => a.score - b.score)
        .slice(0, criteria.max_participants);
};
/**
 * Capability-based selection (prefer actors with more capabilities)
 */
export const capabilitySelector = (candidates, criteria, now = Date.now()) => {
    const eligible = candidates
        .filter(actor => actor.id !== criteria.target_id &&
        !criteria.exclude_actors?.includes(actor.id) &&
        !isParticipantOnCooldown(actor.id, now) &&
        (criteria.required_capabilities?.every(cap => actor.capabilities.includes(cap)) ?? true))
        .map(actor => ({
        actor_id: actor.id,
        actor,
        score: -actor.capabilities.length, // Negative to sort descending
        metadata: { capability_count: actor.capabilities.length }
    }));
    return eligible
        .sort((a, b) => a.score - b.score)
        .slice(0, criteria.max_participants);
};
/**
 * Round-robin selection (fair distribution)
 */
export const createRoundRobinSelector = () => {
    const lastSelectedIndex = new Map();
    return (candidates, criteria, now = Date.now()) => {
        const eligible = candidates.filter(actor => actor.id !== criteria.target_id &&
            !criteria.exclude_actors?.includes(actor.id) &&
            !isParticipantOnCooldown(actor.id, now) &&
            (criteria.required_capabilities?.every(cap => actor.capabilities.includes(cap)) ?? true));
        if (eligible.length === 0)
            return [];
        const key = `${criteria.target_id}:${criteria.max_participants}`;
        const lastIndex = lastSelectedIndex.get(key) ?? -1;
        const startIndex = (lastIndex + 1) % eligible.length;
        const selected = [];
        for (let i = 0; i < Math.min(criteria.max_participants, eligible.length); i++) {
            const index = (startIndex + i) % eligible.length;
            const actor = eligible[index];
            selected.push({
                actor_id: actor.id,
                actor,
                score: i, // Selection order
                metadata: { selection_order: i, round_robin_index: index }
            });
        }
        lastSelectedIndex.set(key, (startIndex + selected.length - 1) % eligible.length);
        return selected;
    };
};
/**
 * Reputation-based selection (requires reputation score in metadata)
 */
export const reputationSelector = (candidates, criteria, now = Date.now()) => {
    const eligible = candidates
        .filter(actor => actor.id !== criteria.target_id &&
        !criteria.exclude_actors?.includes(actor.id) &&
        !isParticipantOnCooldown(actor.id, now) &&
        (criteria.required_capabilities?.every(cap => actor.capabilities.includes(cap)) ?? true))
        .map(actor => {
        // Extract reputation from actor metadata (if available)
        const reputation = actor.reputation ?? 0;
        return {
            actor_id: actor.id,
            actor,
            score: -reputation, // Negative to sort descending
            metadata: { reputation }
        };
    });
    return eligible
        .sort((a, b) => a.score - b.score)
        .slice(0, criteria.max_participants);
};
// ============================================================================
// Participant Selection Orchestrator
// ============================================================================
/**
 * Select participants for a resolution request using a pluggable strategy
 */
export async function selectParticipants(availableActors, criteria, selector = randomSelector, audit, now = Date.now()) {
    // Check if target is on cooldown
    if (isTargetOnCooldown(criteria.target_id, now)) {
        await audit.write({
            actor_id: 'system',
            action: 'participant_selection_blocked',
            inputs: {
                target_id: criteria.target_id,
                reason: 'target_on_cooldown',
                max_participants: criteria.max_participants
            },
            result: 'blocked',
        });
        return {
            selected: [],
            total_candidates: availableActors.length,
            eligible_candidates: 0,
            selection_strategy: 'blocked_cooldown'
        };
    }
    // Apply selection strategy
    const selected = selector(availableActors, criteria, now);
    const eligibleCount = availableActors.filter(actor => actor.id !== criteria.target_id &&
        !criteria.exclude_actors?.includes(actor.id) &&
        !isParticipantOnCooldown(actor.id, now) &&
        (criteria.required_capabilities?.every(cap => actor.capabilities.includes(cap)) ?? true)).length;
    await audit.write({
        actor_id: 'system',
        action: 'participants_selected',
        inputs: {
            target_id: criteria.target_id,
            selected_count: selected.length,
            total_candidates: availableActors.length,
            eligible_candidates: eligibleCount,
            max_participants: criteria.max_participants,
            required_capabilities: criteria.required_capabilities,
            selection_strategy: selector.name || 'anonymous'
        },
        result: 'ok',
    });
    return {
        selected,
        total_candidates: availableActors.length,
        eligible_candidates: eligibleCount,
        selection_strategy: selector.name || 'anonymous'
    };
}
// ============================================================================
// DARP Compliance Example Selectors
// ============================================================================
/**
 * DARP-specific participant selection for compliance disputes
 * Prefers actors with compliance-related capabilities
 */
export const darpComplianceSelector = (candidates, criteria, now = Date.now()) => {
    const complianceCapabilities = [
        'compliance_officer',
        'risk_manager',
        'audit_reviewer',
        'senior_compliance'
    ];
    const eligible = candidates
        .filter(actor => actor.id !== criteria.target_id &&
        !criteria.exclude_actors?.includes(actor.id) &&
        !isParticipantOnCooldown(actor.id, now))
        .map(actor => {
        const complianceCaps = actor.capabilities.filter(cap => complianceCapabilities.some(required => cap.includes(required)));
        return {
            actor_id: actor.id,
            actor,
            score: -complianceCaps.length, // Prefer more compliance capabilities
            metadata: {
                compliance_capabilities: complianceCaps,
                total_capabilities: actor.capabilities.length
            }
        };
    });
    return eligible
        .sort((a, b) => a.score - b.score)
        .slice(0, criteria.max_participants);
};
/**
 * Get selection strategy by name
 */
export function getSelectionStrategy(name) {
    switch (name) {
        case 'random': return randomSelector;
        case 'capability': return capabilitySelector;
        case 'reputation': return reputationSelector;
        case 'darp_compliance': return darpComplianceSelector;
        case 'round_robin': return createRoundRobinSelector();
        default:
            throw new Error(`Unknown selection strategy: ${name}`);
    }
}
