// Shared pure RNG primitives (single source of truth)
//
// These are the byte-identical pure functions extracted VERBATIM from
// apps/server/src/world/rng.ts so they can be reused by offline verifiers
// (tools/verify-outcome) without pulling in node:crypto or server state.
//
// Outputs MUST remain byte-identical to the server. Do NOT change semantics.

import { blake3 } from '@noble/hashes/blake3';

// Domain separators
export const RNG_COMMIT_DOMAIN_V0 = 'akalynth:rng:commit:v1\0';
export const RNG_COMMIT_DOMAIN_V1 = 'akalynth:rng:commit:v1\0';

export function stableJson(value: unknown): string {
  // Inline stable stringify for commitment preimage
  return JSON.stringify(value, Object.keys(value as object).sort());
}

/**
 * rngCommit (v0): Simple seed-only commitment
 * Used for death_drop:v0 (immediate reveal)
 */
export function rngCommit(seed: string): string {
  const hashBytes = blake3(new TextEncoder().encode(RNG_COMMIT_DOMAIN_V0 + seed));
  return `blake3:${Buffer.from(hashBytes).toString('hex')}`;
}

/**
 * rngCommitV1: Domain-separated commitment binding (domain, actor, reveal)
 * Prevents replay across actors/domains.
 * Preimage: { v: 1, domain, actor, reveal }
 */
export function rngCommitV1(domain: string, actor: string, revealHex: string): string {
  const preimage = { v: 1, domain, actor, reveal: revealHex };
  const hashBytes = blake3(new TextEncoder().encode(RNG_COMMIT_DOMAIN_V1 + stableJson(preimage)));
  return `blake3:${Buffer.from(hashBytes).toString('hex')}`;
}

// Legacy drop RNG (v0): blake3(seed + ":" + index) -> u32
export function rngDrawU32Legacy(seed: string, index: number): number {
  const input = `${seed}:${index}`;
  const h = blake3(new TextEncoder().encode(input));

  return ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
}

export function rngU32ToUnitFloat(u32: number): number {
  const u = u32 / 0xffffffff;
  return u === 0 ? 1 / 0xffffffff : u;
}

// ---------------------------------------------------------------------------
// v2 precommit-anchored seed derivation (#101)
// ---------------------------------------------------------------------------
//
// Binds a loot-drop seed to a chronicle-ordered, pre-published commitment.
// The reveal secret was committed BEFORE the outcome (rng_commit chronicle
// event on spawn) and is published only AFTER the outcome (rng_reveal on
// disconnect). The derived seed mixes the reveal with the event context so the
// outcome is provably a function of the committed secret + the specific event.
//
// Domain-separated + versioned so it can never collide with the legacy v0/v1
// receipt-hash seed (rngDrawU32Legacy still consumes the RESULT of this).
//
// Preimage layout (NUL-delimited domain tag, then raw string concatenation):
//   "akalynth:rng:v2:derive\0" || reveal || worldId || eventDomain || eventPreimageHash
//
// IMPORTANT: this proves the server committed to the seed before the outcome
// and derived the outcome from it. It does NOT prove the seed was unbiased,
// that the server could not choose among multiple precommits, or that any
// client entropy was mixed in. See docs/RNG_OUTCOME_VERIFICATION.md.
export const RNG_DERIVE_DOMAIN_V2 = 'akalynth:rng:v2:derive\0';

export function rngDeriveSeedV2(
  reveal: string,
  worldId: string,
  eventDomain: string,
  eventPreimageHash: string
): string {
  const preimage = RNG_DERIVE_DOMAIN_V2 + reveal + worldId + eventDomain + eventPreimageHash;
  const hashBytes = blake3(new TextEncoder().encode(preimage));
  return `blake3:${Buffer.from(hashBytes).toString('hex')}`;
}
