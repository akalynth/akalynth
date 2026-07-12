const pendingRequests = new Map();
const witnessCooldownByPlayer = new Map();
const targetCooldownByPlayer = new Map();
export function getWitnessPromptText(kind) {
    if (kind === 'heat_penalty') {
        return 'Did the nearby player move like a human, not a bot?';
    }
    return 'Did the recent action nearby look human to you?';
}
export function selectWitnesses(target, targetMap, allSessions, config, now) {
    const candidates = [];
    for (const session of allSessions) {
        if (!session.player)
            continue;
        if (!session.inWorld)
            continue;
        if (session.currentMap !== targetMap)
            continue;
        if (session.player.id === target.id)
            continue;
        const cooldownUntil = witnessCooldownByPlayer.get(session.player.id);
        if (cooldownUntil !== undefined && cooldownUntil > now)
            continue;
        const dx = Math.abs(session.player.x - target.x);
        const dy = Math.abs(session.player.y - target.y);
        const distance = Math.max(dx, dy);
        if (distance <= config.radiusTiles) {
            candidates.push({
                playerId: session.player.id,
                sessionId: session.connId,
                distance,
            });
        }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const selected = candidates.slice(0, config.maxWitnesses);
    return selected;
}
export function createWitnessRequest(requestId, targetPlayerId, targetActorRedacted, triggerKind, map, witnessIds, config, now) {
    const expiresAtMs = now + config.requestTtlMs;
    const request = {
        id: requestId,
        targetPlayerId,
        targetActorRedacted,
        triggerKind,
        map,
        createdAtMs: now,
        expiresAtMs,
        witnessIds,
        responses: new Map(),
        resolved: false,
        resolved_at_ms: null,
        resolved_by: null,
    };
    pendingRequests.set(requestId, request);
    for (const witnessId of witnessIds) {
        witnessCooldownByPlayer.set(witnessId, now + config.witnessCooldownMs);
    }
    targetCooldownByPlayer.set(targetPlayerId, now + config.targetCooldownMs);
    return request;
}
export function getWitnessRequest(requestId) {
    return pendingRequests.get(requestId) ?? null;
}
export function isWitnessRequestExpired(request, now) {
    return now >= request.expiresAtMs;
}
export function isWitnessInRequest(request, witnessPlayerId) {
    return request.witnessIds.includes(witnessPlayerId);
}
export function hasWitnessResponded(request, witnessPlayerId) {
    return request.responses.has(witnessPlayerId);
}
export function cleanupExpiredRequests(now) {
    const GRACE_PERIOD_MS = 1000; // 1s grace after expiry for TTL resolution
    for (const [id, request] of pendingRequests) {
        // Only delete if resolved AND past grace period
        if (request.resolved && now > request.expiresAtMs + GRACE_PERIOD_MS) {
            pendingRequests.delete(id);
        }
    }
}
// Heat nudge removed in v0 per spec
export function isTargetOnCooldown(targetPlayerId, now) {
    const cooldownUntil = targetCooldownByPlayer.get(targetPlayerId);
    return cooldownUntil !== undefined && cooldownUntil > now;
}
export function resetWitnessState() {
    pendingRequests.clear();
    witnessCooldownByPlayer.clear();
    targetCooldownByPlayer.clear();
}
// ============================================================================
// Witness Quorum v0
// ============================================================================
/**
 * Record a witness response. Returns whether it was recorded and if all expected
 * witnesses have now responded.
 */
export function recordWitnessResponse(request, witnessId, response) {
    if (request.resolved) {
        return { recorded: false, allResponded: false };
    }
    if (request.responses.has(witnessId)) {
        return { recorded: false, allResponded: false };
    }
    request.responses.set(witnessId, response);
    const allResponded = request.responses.size === request.witnessIds.length;
    return { recorded: true, allResponded };
}
/**
 * Compute quorum outcome from responses.
 * Rules (order-independent):
 * - All confirm -> "confirmed"
 * - All deny -> "denied"
 * - Any mix of confirm + deny -> "contested" (even with uncertains)
 * - Otherwise -> "insufficient"
 */
export function computeQuorumOutcome(responses, expectedCount) {
    let confirm = 0;
    let deny = 0;
    let uncertain = 0;
    for (const r of responses.values()) {
        if (r === 'confirm')
            confirm++;
        else if (r === 'deny')
            deny++;
        else
            uncertain++;
    }
    const counts = { confirm, deny, uncertain };
    const total = confirm + deny + uncertain;
    // Not all responded yet = insufficient
    if (total < expectedCount) {
        return { outcome: 'insufficient', counts };
    }
    // Any mix of confirm + deny = contested (even if uncertains exist)
    if (confirm > 0 && deny > 0) {
        return { outcome: 'contested', counts };
    }
    // All confirm = confirmed
    if (confirm === expectedCount) {
        return { outcome: 'confirmed', counts };
    }
    // All deny = denied
    if (deny === expectedCount) {
        return { outcome: 'denied', counts };
    }
    // Otherwise (only uncertain, or confirm+uncertain, or deny+uncertain without conflict)
    return { outcome: 'insufficient', counts };
}
/**
 * Try to resolve a quorum. Idempotent - returns null if already resolved or
 * conditions not met. Returns resolution object if resolved.
 */
export function tryResolveQuorum(request, triggeredBy, now) {
    if (request.resolved) {
        return null;
    }
    const allResponded = request.responses.size === request.witnessIds.length;
    const expired = now >= request.expiresAtMs;
    // Check trigger conditions
    if (triggeredBy === 'all_responded' && !allResponded) {
        return null;
    }
    if (triggeredBy === 'ttl_expired' && !expired) {
        return null;
    }
    // Compute outcome
    const { outcome, counts } = computeQuorumOutcome(request.responses, request.witnessIds.length);
    // Mark resolved (idempotency)
    request.resolved = true;
    request.resolved_at_ms = now;
    request.resolved_by = triggeredBy;
    return {
        outcome,
        counts,
        response_count: request.responses.size,
        expected_count: request.witnessIds.length,
        triggered_by: triggeredBy,
    };
}
/**
 * Get all unresolved requests that have expired (need TTL resolution).
 */
export function getUnresolvedExpiredRequests(now) {
    const result = [];
    for (const request of pendingRequests.values()) {
        if (!request.resolved && now >= request.expiresAtMs) {
            result.push(request);
        }
    }
    return result;
}
export function getAllPendingRequests() {
    return Array.from(pendingRequests.values());
}
