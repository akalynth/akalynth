// Bounded Resolution Quorum Logic
// Time-bounded, deterministic dispute resolution
// ============================================================================
// Resolution Actions
// ============================================================================
export const RESOLUTION_REQUESTED_ACTION = 'resolution_requested';
export const RESOLUTION_RESPONSE_ACTION = 'resolution_response';
export const RESOLUTION_COMPLETED_ACTION = 'resolution_completed';
export const RESOLUTION_EXPIRED_ACTION = 'resolution_expired';
// ============================================================================
// In-Memory State
// ============================================================================
const pendingResolutions = new Map();
const participantCooldowns = new Map();
const targetCooldowns = new Map();
// ============================================================================
// Resolution Management
// ============================================================================
/**
 * Create a new resolution request
 */
export async function createResolutionRequest(requestId, targetId, participants, triggerKind, config, audit, now = Date.now(), metadata) {
    const expiresAt = now + config.requestTtlMs;
    const resolution = {
        id: requestId,
        target_id: targetId,
        participants,
        created_at: now,
        expires_at: expiresAt,
        responses: new Map(),
        resolved: false,
        trigger_kind: triggerKind,
    };
    pendingResolutions.set(requestId, resolution);
    // Set cooldowns
    for (const participantId of participants) {
        participantCooldowns.set(participantId, now + config.participantCooldownMs);
    }
    targetCooldowns.set(targetId, now + config.targetCooldownMs);
    await audit.write({
        actor_id: 'system',
        action: RESOLUTION_REQUESTED_ACTION,
        inputs: {
            request_id: requestId,
            target_id: targetId,
            participants,
            trigger_kind: triggerKind,
            expires_at: expiresAt,
            participant_count: participants.length,
            ...metadata
        },
        result: 'ok',
    });
    return resolution;
}
/**
 * Submit a response to a resolution request
 */
export async function submitResolutionResponse(requestId, participantId, response, audit, now = Date.now()) {
    const resolution = pendingResolutions.get(requestId);
    if (!resolution) {
        return { accepted: false, reason: 'request_not_found' };
    }
    if (resolution.resolved) {
        return { accepted: false, reason: 'already_resolved' };
    }
    if (now >= resolution.expires_at) {
        return { accepted: false, reason: 'request_expired' };
    }
    if (!resolution.participants.includes(participantId)) {
        return { accepted: false, reason: 'not_participant' };
    }
    if (resolution.responses.has(participantId)) {
        return { accepted: false, reason: 'already_responded' };
    }
    // Accept the response
    resolution.responses.set(participantId, response);
    await audit.write({
        actor_id: participantId,
        action: RESOLUTION_RESPONSE_ACTION,
        inputs: {
            request_id: requestId,
            response,
            response_count: resolution.responses.size,
            participant_count: resolution.participants.length
        },
        result: 'ok',
    });
    return { accepted: true, resolution };
}
/**
 * Try to resolve a request based on current responses
 */
export async function tryResolveRequest(requestId, config, audit, now = Date.now()) {
    const resolution = pendingResolutions.get(requestId);
    if (!resolution || resolution.resolved) {
        return null;
    }
    const allResponded = resolution.responses.size === resolution.participants.length;
    const expired = now >= resolution.expires_at;
    if (!allResponded && !expired) {
        return null; // Not ready to resolve
    }
    // Count responses
    const counts = {
        confirm: 0,
        deny: 0,
        uncertain: 0,
    };
    for (const response of resolution.responses.values()) {
        counts[response]++;
    }
    // Determine outcome
    let result;
    let triggeredBy = allResponded ? 'all_responded' : 'ttl_expired';
    if (expired && resolution.responses.size === 0) {
        result = 'expired';
    }
    else if (config.requireMajority) {
        // Majority rule
        const threshold = Math.ceil(resolution.participants.length / 2);
        if (counts.confirm >= threshold) {
            result = 'confirmed';
        }
        else if (counts.deny >= threshold) {
            result = 'denied';
        }
        else if (counts.confirm + counts.deny + counts.uncertain < threshold) {
            result = 'insufficient';
        }
        else {
            result = 'contested';
        }
    }
    else {
        // Unanimous rule (stricter)
        if (counts.confirm === resolution.responses.size && resolution.responses.size > 0) {
            result = 'confirmed';
        }
        else if (counts.deny > 0) {
            result = 'denied';
        }
        else if (counts.uncertain > 0) {
            result = 'contested';
        }
        else {
            result = 'insufficient';
        }
    }
    // Mark as resolved
    resolution.resolved = true;
    resolution.resolved_at = now;
    resolution.resolved_by = triggeredBy;
    resolution.resolution_result = result;
    resolution.counts = counts;
    const outcome = {
        result,
        participant_count: resolution.participants.length,
        response_count: resolution.responses.size,
        resolution_time: now - resolution.created_at,
    };
    await audit.write({
        actor_id: 'system',
        action: RESOLUTION_COMPLETED_ACTION,
        inputs: {
            request_id: requestId,
            result,
            triggered_by: triggeredBy,
            counts,
            participant_count: outcome.participant_count,
            response_count: outcome.response_count,
            resolution_time: outcome.resolution_time
        },
        result: 'ok',
    });
    return outcome;
}
/**
 * Clean up expired requests
 */
export async function cleanupExpiredRequests(config, audit, now = Date.now()) {
    const expiredRequests = [];
    for (const [requestId, resolution] of pendingResolutions.entries()) {
        if (!resolution.resolved && now >= resolution.expires_at) {
            // Try to resolve as expired
            const outcome = await tryResolveRequest(requestId, config, audit, now);
            if (outcome) {
                expiredRequests.push(requestId);
            }
        }
    }
    return {
        cleaned: expiredRequests.length,
        expired_requests: expiredRequests
    };
}
/**
 * Check if a participant is on cooldown
 */
export function isParticipantOnCooldown(participantId, now = Date.now()) {
    const cooldownUntil = participantCooldowns.get(participantId);
    return cooldownUntil !== undefined && cooldownUntil > now;
}
/**
 * Check if a target is on cooldown
 */
export function isTargetOnCooldown(targetId, now = Date.now()) {
    const cooldownUntil = targetCooldowns.get(targetId);
    return cooldownUntil !== undefined && cooldownUntil > now;
}
/**
 * Get pending resolution requests
 */
export function getPendingResolutions() {
    return Array.from(pendingResolutions.values()).filter(r => !r.resolved);
}
/**
 * Get resolution by ID
 */
export function getResolution(requestId) {
    return pendingResolutions.get(requestId) || null;
}
/**
 * Clear all resolution state (for testing)
 */
export function clearResolutionState() {
    pendingResolutions.clear();
    participantCooldowns.clear();
    targetCooldowns.clear();
}
