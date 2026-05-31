// RNG helpers (Seal 3)
//
// The pure RNG primitives are single-sourced in packages/shared/rng.ts so the
// offline outcome verifier (tools/verify-outcome) can reuse the exact same math
// without pulling in server state. Outputs are byte-identical to before.

import { randomBytes } from 'node:crypto';

// Re-export the pure primitives from the shared single source of truth.
export {
  RNG_COMMIT_DOMAIN_V0,
  RNG_COMMIT_DOMAIN_V1,
  stableJson,
  rngCommit,
  rngCommitV1,
  rngDrawU32Legacy,
  rngU32ToUnitFloat,
  rngDeriveSeedV2,
  RNG_DERIVE_DOMAIN_V2,
  computeInventoryCommit,
  RNG_INV_COMMIT_DOMAIN,
} from '../../../../packages/shared/rng.js';

/**
 * Generate a cryptographically random 32-byte reveal (hex-encoded).
 * Stays local to the server: uses node crypto and is NOT pure.
 */
export function rngRevealHex32(): string {
  return randomBytes(32).toString('hex');
}
