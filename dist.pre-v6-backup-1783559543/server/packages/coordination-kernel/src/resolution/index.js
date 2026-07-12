// Bounded Resolution System Index
// Export all resolution-related functionality
export * from './quorum.js';
export * from './witnesses.js';
export * from './timeouts.js';
import { createResolutionRequest, submitResolutionResponse, tryResolveRequest, getResolution } from './quorum.js';
import { selectParticipants, randomSelector } from './witnesses.js';
import { createTimeoutManager } from './timeouts.js';
/**
 * High-level resolution orchestrator
 * Combines participant selection, request creation, and timeout management
 */
export class BoundedResolutionOrchestrator {
    config;
    audit;
    timeoutManager;
    defaultSelector;
    constructor(config, audit, defaultSelector = randomSelector) {
        this.config = config;
        this.audit = audit;
        this.timeoutManager = createTimeoutManager(config, audit);
        this.defaultSelector = defaultSelector;
    }
    /**
     * Initiate a new resolution request with automatic participant selection
     */
    async initiateResolution(requestId, targetId, triggerKind, availableActors, selector, selectionOverrides, metadata) {
        const selectionCriteria = {
            target_id: targetId,
            max_participants: this.config.maxParticipants,
            ...selectionOverrides
        };
        // Select participants
        const selection = await selectParticipants(availableActors, selectionCriteria, selector || this.defaultSelector, this.audit);
        if (selection.selected.length === 0) {
            throw new Error('No eligible participants found for resolution request');
        }
        // Create resolution request
        const participantIds = selection.selected.map(p => p.actor_id);
        const resolution = await createResolutionRequest(requestId, targetId, participantIds, triggerKind, this.config, this.audit, Date.now(), {
            ...metadata,
            selection_strategy: selection.selection_strategy,
            total_candidates: selection.total_candidates,
            eligible_candidates: selection.eligible_candidates
        });
        return {
            resolution,
            selected_participants: selection.selected
        };
    }
    /**
     * Process a participant response and check for resolution
     */
    async processResponse(requestId, participantId, response) {
        // Submit response
        const responseResult = await submitResolutionResponse(requestId, participantId, response, this.audit);
        if (!responseResult.accepted) {
            return { response_accepted: false, reason: responseResult.reason };
        }
        // Try to resolve if we have enough responses
        const outcome = await tryResolveRequest(requestId, this.config, this.audit);
        return {
            response_accepted: true,
            resolution: responseResult.resolution,
            outcome
        };
    }
    /**
     * Process all pending timeouts
     */
    async processTimeouts() {
        return await this.timeoutManager.processTimeouts();
    }
    /**
     * Get resolution status
     */
    getResolutionStatus(requestId) {
        const resolution = getResolution(requestId);
        if (!resolution)
            return null;
        const stats = this.timeoutManager.getTimeoutStats();
        const now = Date.now();
        return {
            resolution,
            time_remaining_ms: Math.max(0, resolution.expires_at - now),
            response_progress: `${resolution.responses.size}/${resolution.participants.length}`,
            is_urgent: (resolution.expires_at - now) <= 60000, // 1 minute
            timeout_stats: stats
        };
    }
}
// ============================================================================
// DARP Compliance Resolution Examples
// ============================================================================
/**
 * Create a DARP-specific resolution orchestrator
 */
export function createDARPResolutionOrchestrator(audit) {
    const config = {
        enabled: true,
        maxParticipants: 2, // DARP requires at least 2 compliance officers for disputes
        requestTtlMs: 48 * 60 * 60 * 1000, // 48 hours per DARP requirement
        participantCooldownMs: 24 * 60 * 60 * 1000, // 24 hour cooldown
        targetCooldownMs: 48 * 60 * 60 * 1000, // 48 hour cooldown
        requireMajority: true // Majority wins for compliance disputes
    };
    // Use DARP-specific participant selection
    const { darpComplianceSelector } = require('./witnesses.js');
    return new BoundedResolutionOrchestrator(config, audit, darpComplianceSelector);
}
/**
 * Example: Late filing dispute resolution
 */
export async function resolveLateFilingDispute(orchestrator, disputeId, actorId, hoursLate, availableComplianceOfficers) {
    const result = await orchestrator.initiateResolution(disputeId, actorId, 'dispute', availableComplianceOfficers, undefined, // Use default DARP selector
    {
        required_capabilities: ['compliance_officer', 'dispute_resolution']
    }, {
        dispute_type: 'late_filing',
        hours_late: hoursLate,
        severity: hoursLate > 24 ? 'high' : 'medium'
    });
    return result;
}
/**
 * Receipt replay integration for resolution state
 */
export function applyResolutionReceipt(receipt) {
    // Import necessary functions for state management
    // This would be called during receipt replay to reconstruct resolution state
    // Implementation depends on whether we maintain resolution history vs just current state
}
