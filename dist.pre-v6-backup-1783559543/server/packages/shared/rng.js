// Shared pure RNG primitives (single source of truth)
//
// These are the byte-identical pure functions extracted VERBATIM from
// apps/server/src/world/rng.ts so they can be reused by offline verifiers
// (tools/verify-outcome) without pulling in node:crypto or server state.
//
// Outputs MUST remain byte-identical to the server. Do NOT change semantics.
import { blake3Bytes, blake3Prefixed, canonicalJson } from './hashPrimitive.js';
// Domain separators
export const RNG_COMMIT_DOMAIN_V0 = 'akalynth:rng:commit:v1\0';
export const RNG_COMMIT_DOMAIN_V1 = 'akalynth:rng:commit:v1\0';
export function stableJson(value) {
    return canonicalJson(value);
}
/**
 * rngCommit (v0): Simple seed-only commitment
 * Used for death_drop:v0 (immediate reveal)
 */
export function rngCommit(seed) {
    return blake3Prefixed(RNG_COMMIT_DOMAIN_V0 + seed);
}
/**
 * rngCommitV1: Domain-separated commitment binding (domain, actor, reveal)
 * Prevents replay across actors/domains.
 * Preimage: { v: 1, domain, actor, reveal }
 */
export function rngCommitV1(domain, actor, revealHex) {
    const preimage = { v: 1, domain, actor, reveal: revealHex };
    return blake3Prefixed(RNG_COMMIT_DOMAIN_V1 + stableJson(preimage));
}
// Legacy drop RNG (v0): blake3(seed + ":" + index) -> u32
export function rngDrawU32Legacy(seed, index) {
    const input = `${seed}:${index}`;
    const h = blake3Bytes(Buffer.from(input, 'utf8'));
    return ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
}
export function rngU32ToUnitFloat(u32) {
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
// ---------------------------------------------------------------------------
// Inventory commitment (#103)
// ---------------------------------------------------------------------------
//
// Replaces the plaintext `items` array in `rng_proof.derivation.inputs` with a
// salted BLAKE3 commitment so the public receipt no longer reveals the victim's
// full inventory. The opening (salt + items) is held by the player / operator
// and supplied to the verifier separately; WITHOUT the opening the verifier
// produces `outcome_derivation: 'unsupported'` (reason COMMITTED_NOT_OPENED).
//
// Domain separator: "akalynth:rng:inv:v1" (no NUL — matches the convention of
// a plain string prefix, same as rngCommit's domain separator).
// Preimage:  domain || salt || canonicalJson(items)
// Output:    "blake3:<hex>"
export const RNG_INV_COMMIT_DOMAIN = 'akalynth:rng:inv:v1';
/**
 * computeInventoryCommit — salted BLAKE3 commitment over a canonical item list.
 *
 * @param salt  16-byte random salt, hex-encoded (32 hex chars). Server-generated
 *              at kill time; never persisted to the receipt.
 * @param items Full ItemForDrop snapshot as passed to computeDeathDrops.
 *              Using `object[]` to avoid a circular import (dropPolicy → rng → dropPolicy).
 *              In practice callers pass `ItemForDrop[]`; the commitment is over
 *              canonicalJson(items), so any JSON-serializable array works.
 * @returns     `"blake3:<hex>"` — the commitment stored in the receipt.
 */
export function computeInventoryCommit(salt, items) {
    const preimage = RNG_INV_COMMIT_DOMAIN + salt + canonicalJson(items);
    return blake3Prefixed(preimage);
}
export function rngDeriveSeedV2(reveal, worldId, eventDomain, eventPreimageHash) {
    const preimage = RNG_DERIVE_DOMAIN_V2 + reveal + worldId + eventDomain + eventPreimageHash;
    return blake3Prefixed(preimage);
}
