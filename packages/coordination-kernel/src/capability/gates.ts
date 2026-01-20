// Capability Gates - Constraint-based Access Control
// Domain-agnostic capability enforcement with temporal constraints

import type { Actor, AuditWriter, CoordinationError } from '../types.js';

// ============================================================================
// Core Capability Actions
// ============================================================================

export const CAPABILITY_GRANTED_ACTION = 'capability_granted' as const;
export const CAPABILITY_REVOKED_ACTION = 'capability_revoked' as const;
export const CAPABILITY_GATED_ACTION = 'capability_gated' as const;
export const CAPABILITY_EXPIRED_ACTION = 'capability_expired' as const;

// ============================================================================
// Capability Management
// ============================================================================

/**
 * Check if an actor has a specific capability
 */
export function hasCap(actor: Actor, capability: string): boolean {
  return actor.capabilities?.includes(capability) ?? false;
}

/**
 * Check if a capability is temporal (has expiration)
 */
export function isTemporalCapability(capability: string): boolean {
  return capability.includes('_until_');
}

/**
 * Extract expiration date from temporal capability
 * Example: "approve_high_risk_until_2026_06_30" → Date object
 */
export function extractCapabilityExpiration(capability: string): Date | null {
  const match = capability.match(/_until_(\d{4}_\d{2}_\d{2})$/);
  if (!match) return null;

  const [year, month, day] = match[1].split('_');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

/**
 * Check if a temporal capability has expired
 */
export function hasCapabilityExpired(capability: string, now: Date = new Date()): boolean {
  const expiration = extractCapabilityExpiration(capability);
  return expiration ? now > expiration : false;
}

/**
 * Grant a capability to an actor
 * Returns { granted: true } if newly added, { granted: false } if already exists
 * Emits capability_granted receipt if newly granted
 */
export async function grantCap(
  actor: Actor,
  capability: string,
  granted_by: string,
  audit: AuditWriter,
  source: 'rule' | 'constraint' | 'temporal' = 'rule',
  metadata?: Record<string, unknown>
): Promise<{ granted: boolean }> {
  if (!actor.capabilities) actor.capabilities = [];
  if (actor.capabilities.includes(capability)) return { granted: false };

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
export async function revokeCap(
  actor: Actor,
  capability: string,
  revoked_by: string,
  audit: AuditWriter,
  reason: 'expired' | 'violation' | 'administrative' = 'administrative',
  metadata?: Record<string, unknown>
): Promise<{ revoked: boolean }> {
  if (!actor.capabilities) return { revoked: false };

  const idx = actor.capabilities.indexOf(capability);
  if (idx === -1) return { revoked: false };

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
export async function checkCapGate(
  actor: Actor,
  required_capability: string,
  attempted_action: string,
  audit: AuditWriter,
  additional_checks?: (actor: Actor, capability: string) => Promise<boolean>
): Promise<{ allowed: boolean; reason?: string }> {
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
export async function cleanExpiredCapabilities(
  actor: Actor,
  audit: AuditWriter,
  now: Date = new Date()
): Promise<string[]> {
  if (!actor.capabilities) return [];

  const expiredCaps: string[] = [];

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