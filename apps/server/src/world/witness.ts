import { createHash } from 'node:crypto';
import type { MapName } from '../../../../packages/shared/http.js';
import type { Player } from '../../../../packages/shared/types.js';

export type WitnessTriggerKind = 'cadence' | 'spam' | 'legend_probe' | 'heat_penalty' | 'unknown';
export type WitnessResponse = 'confirm' | 'deny' | 'uncertain';
export type WitnessQuorumOutcome = 'confirmed' | 'denied' | 'contested' | 'insufficient';

export interface WitnessRequest {
  id: string;
  targetPlayerId: string;
  targetActorRedacted: string;
  triggerKind: WitnessTriggerKind;
  map: MapName;
  createdAtMs: number;
  expiresAtMs: number;
  witnessIds: string[];
  responses: Map<string, WitnessResponse>; // witnessId -> response
  resolved: boolean;
  resolved_at_ms: number | null;
  resolved_by: 'all_responded' | 'ttl_expired' | null;
}

export interface QuorumCounts {
  confirm: number;
  deny: number;
  uncertain: number;
}

export interface QuorumResolution {
  outcome: WitnessQuorumOutcome;
  counts: QuorumCounts;
  response_count: number;
  expected_count: number;
  triggered_by: 'all_responded' | 'ttl_expired';
}

export interface WitnessConfig {
  enabled: boolean;
  radiusTiles: number;
  maxWitnesses: number;
  requestTtlMs: number;
  witnessCooldownMs: number;
  targetCooldownMs: number;
  heatNudgeEnabled: boolean;
  heatNudgeDelta: number;
  idSalt: string; // unused in v0, kept for future
}

const pendingRequests = new Map<string, WitnessRequest>();
const witnessCooldownByPlayer = new Map<string, number>();
const targetCooldownByPlayer = new Map<string, number>();

export function getWitnessPromptText(kind: WitnessTriggerKind): string {
  if (kind === 'heat_penalty') {
    return "The Ledger stirs. Confirm what you saw.";
  }
  return "The Ledger stirs. Confirm what you saw.";
}

// Request ID generation moved to caller (uses randomUUID)

export interface WitnessCandidate {
  playerId: string;
  sessionId: string;
  distance: number;
}

export function selectWitnesses(
  target: Player,
  targetMap: MapName,
  allSessions: Array<{
    connId: string;
    player: Player | null;
    inWorld: boolean;
    currentMap: MapName;
  }>,
  config: WitnessConfig,
  now: number
): WitnessCandidate[] {
  const candidates: WitnessCandidate[] = [];

  for (const session of allSessions) {
    if (!session.player) continue;
    if (!session.inWorld) continue;
    if (session.currentMap !== targetMap) continue;
    if (session.player.id === target.id) continue;

    const cooldownUntil = witnessCooldownByPlayer.get(session.player.id);
    if (cooldownUntil !== undefined && cooldownUntil > now) continue;

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

export function createWitnessRequest(
  requestId: string,
  targetPlayerId: string,
  targetActorRedacted: string,
  triggerKind: WitnessTriggerKind,
  map: MapName,
  witnessIds: string[],
  config: WitnessConfig,
  now: number
): WitnessRequest {
  const expiresAtMs = now + config.requestTtlMs;

  const request: WitnessRequest = {
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

export function getWitnessRequest(requestId: string): WitnessRequest | null {
  return pendingRequests.get(requestId) ?? null;
}

export function isWitnessRequestExpired(request: WitnessRequest, now: number): boolean {
  return now >= request.expiresAtMs;
}

export function isWitnessInRequest(request: WitnessRequest, witnessPlayerId: string): boolean {
  return request.witnessIds.includes(witnessPlayerId);
}

export function hasWitnessResponded(request: WitnessRequest, witnessPlayerId: string): boolean {
  return request.responses.has(witnessPlayerId);
}

export function cleanupExpiredRequests(now: number): void {
  const GRACE_PERIOD_MS = 1000; // 1s grace after expiry for TTL resolution
  for (const [id, request] of pendingRequests) {
    // Only delete if resolved AND past grace period
    if (request.resolved && now > request.expiresAtMs + GRACE_PERIOD_MS) {
      pendingRequests.delete(id);
    }
  }
}

// Heat nudge removed in v0 per spec

export function isTargetOnCooldown(targetPlayerId: string, now: number): boolean {
  const cooldownUntil = targetCooldownByPlayer.get(targetPlayerId);
  return cooldownUntil !== undefined && cooldownUntil > now;
}

export function resetWitnessState(): void {
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
export function recordWitnessResponse(
  request: WitnessRequest,
  witnessId: string,
  response: WitnessResponse
): { recorded: boolean; allResponded: boolean } {
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
export function computeQuorumOutcome(
  responses: Map<string, WitnessResponse>,
  expectedCount: number
): { outcome: WitnessQuorumOutcome; counts: QuorumCounts } {
  let confirm = 0;
  let deny = 0;
  let uncertain = 0;
  for (const r of responses.values()) {
    if (r === 'confirm') confirm++;
    else if (r === 'deny') deny++;
    else uncertain++;
  }
  const counts: QuorumCounts = { confirm, deny, uncertain };
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
export function tryResolveQuorum(
  request: WitnessRequest,
  triggeredBy: 'all_responded' | 'ttl_expired',
  now: number
): QuorumResolution | null {
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
export function getUnresolvedExpiredRequests(now: number): WitnessRequest[] {
  const result: WitnessRequest[] = [];
  for (const request of pendingRequests.values()) {
    if (!request.resolved && now >= request.expiresAtMs) {
      result.push(request);
    }
  }
  return result;
}

export function getAllPendingRequests(): WitnessRequest[] {
  return Array.from(pendingRequests.values());
}
