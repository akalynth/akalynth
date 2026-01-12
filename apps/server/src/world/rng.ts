// RNG helpers (Seal 3)

import { blake3 } from '@noble/hashes/blake3';
import { randomBytes } from 'node:crypto';

// Domain separators
const RNG_COMMIT_DOMAIN_V0 = 'akalynth:rng:commit:v1\0';
const RNG_COMMIT_DOMAIN_V1 = 'akalynth:rng:commit:v1\0';

function stableJson(value: unknown): string {
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

/**
 * Generate a cryptographically random 32-byte reveal (hex-encoded)
 */
export function rngRevealHex32(): string {
  return randomBytes(32).toString('hex');
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
