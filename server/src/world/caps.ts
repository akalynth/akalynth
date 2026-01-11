// Capability Binding v0 - Server-only enforcement gates
//
// Badges are cosmetic labels; capabilities are enforcement gates.
// Server is the only source of truth. Caps are never exposed to clients.

import type { Player } from '../../../shared/types.js';
import {
  CAPABILITY_GRANTED_ACTION,
  CAPABILITY_REVOKED_ACTION,
  CAPABILITY_GATED_ACTION,
  CAP_HOUSE_BUY,
  CAP_ECHO_SPAWN,
} from '../../../shared/types.js';

// Badge-to-capability derivation map (only active when CAPS_DEBUG_GRANT_SOVEREIGN=1)
const BADGE_DERIVED_CAPS: Record<string, string[]> = {
  sovereign: [CAP_HOUSE_BUY, CAP_ECHO_SPAWN],
};

// Minimal audit interface to avoid circular dependency
type AuditWriter = {
  write: (r: { player_id: string; action: string; inputs: Record<string, unknown>; result: string }) => void;
};

/**
 * Check if a player has a specific capability.
 */
export function hasCap(player: Player, cap: string): boolean {
  return player.caps?.includes(cap) ?? false;
}

/**
 * Grant a capability to a player.
 * Returns { granted: true } if newly added, { granted: false } if already had.
 * Emits capability_granted receipt if newly granted.
 */
export function grantCap(
  player: Player,
  cap: string,
  source: 'badge' | 'env' | 'debug',
  audit: AuditWriter,
  badge?: string
): { granted: boolean } {
  if (!player.caps) player.caps = [];
  if (player.caps.includes(cap)) return { granted: false };

  player.caps.push(cap);
  audit.write({
    player_id: player.id,
    action: CAPABILITY_GRANTED_ACTION,
    inputs: { cap, source, ...(badge ? { badge } : {}) },
    result: 'ok',
  });
  return { granted: true };
}

/**
 * Revoke a capability from a player.
 * Returns { revoked: true } if removed, { revoked: false } if didn't have.
 * Emits capability_revoked receipt if removed.
 */
export function revokeCap(
  player: Player,
  cap: string,
  source: 'badge' | 'env' | 'debug',
  audit: AuditWriter
): { revoked: boolean } {
  if (!player.caps) return { revoked: false };
  const idx = player.caps.indexOf(cap);
  if (idx === -1) return { revoked: false };

  player.caps.splice(idx, 1);
  audit.write({
    player_id: player.id,
    action: CAPABILITY_REVOKED_ACTION,
    inputs: { cap, source },
    result: 'ok',
  });
  return { revoked: true };
}

/**
 * Apply badge-derived capabilities to a player.
 * Only grants caps that the player doesn't already have.
 * Used when CAPS_DEBUG_GRANT_SOVEREIGN is enabled.
 */
export function applyBadgeDerivedCaps(
  player: Player,
  audit: AuditWriter
): { grantedCaps: string[] } {
  const grantedCaps: string[] = [];
  if (!player.badges) return { grantedCaps };

  for (const badge of player.badges) {
    const caps = BADGE_DERIVED_CAPS[badge];
    if (!caps) continue;
    for (const cap of caps) {
      if (grantCap(player, cap, 'badge', audit, badge).granted) {
        grantedCaps.push(cap);
      }
    }
  }
  return { grantedCaps };
}

/**
 * Check if a player has the capability to perform an action.
 * Emits capability_gated receipt if blocked.
 * Returns { allowed: true } if has cap, { allowed: false } if blocked.
 */
export function checkCapGate(
  player: Player,
  requiredCap: string,
  attemptedAction: string,
  audit: AuditWriter
): { allowed: boolean } {
  if (hasCap(player, requiredCap)) return { allowed: true };

  audit.write({
    player_id: player.id,
    action: CAPABILITY_GATED_ACTION,
    inputs: { cap: requiredCap, action: attemptedAction, reason: 'missing_cap' },
    result: 'blocked',
  });
  return { allowed: false };
}
