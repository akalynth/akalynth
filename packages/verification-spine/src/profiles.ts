/**
 * Named verification profiles
 *
 * Profiles define stable, versioned subsets of verifiers.
 * - quick: explicit list (no drift)
 * - full: all verifiers (resolved from registry)
 * - audit: auditSafe-only (resolved from registry)
 */

import type { VerifierRegistry } from './registry.js';
import type { VerifierSpec } from './types.js';

export type ProfileName = 'quick' | 'full' | 'audit';

export interface Profile {
  name: ProfileName;
  description: string;
  /**
   * Explicit list of verifier IDs.
   * Empty means "dynamic resolution" (full/audit).
   */
  verifiers: string[];
}

export const PROFILES: Record<ProfileName, Profile> = {
  quick: {
    name: 'quick',
    description: 'Fast check: Prerequisites + Core Guarantees (Phase 0-1)',
    verifiers: [
      // Phase 0
      'build',
      'db-exists',
      'receipts-exist',
      // Phase 1
      'guarantees',
      'doctrine',
      'identity',
      'receipts-chain',
    ],
  },

  full: {
    name: 'full',
    description: 'All verifiers (Phase 0-3)',
    verifiers: [], // dynamic: all from registry
  },

  audit: {
    name: 'audit',
    description: 'Read-only verifiers only (auditSafe=true)',
    verifiers: [], // dynamic: auditSafe-only from registry
  },
};

export function isProfileName(x: string): x is ProfileName {
  return x === 'quick' || x === 'full' || x === 'audit';
}

export function listProfiles(): Profile[] {
  return Object.values(PROFILES);
}

/**
 * Resolve a profile into a concrete list of verifier IDs.
 * - quick: explicit list
 * - full: all verifiers
 * - audit: auditSafe === true (strict)
 */
export function resolveProfile(
  profileName: ProfileName,
  registry: VerifierRegistry
): string[] {
  const profile = PROFILES[profileName];

  if (profile.verifiers.length > 0) {
    return profile.verifiers;
  }

  const all: VerifierSpec[] = registry.list();

  switch (profileName) {
    case 'full':
      return all.map((v) => v.id);

    case 'audit':
      // Strict: only verifiers explicitly marked auditSafe=true
      return all.filter((v) => v.auditSafe === true).map((v) => v.id);

    default:
      // should be unreachable
      throw new Error(`Unknown profile: ${profileName}`);
  }
}
