// Offline RNG outcome verifier (pure, deterministic — no network/SQLite/server state).
//
// This verifier checks whether a recorded RNG-backed outcome can be recomputed
// from its receipt fields. It does NOT prove that the server committed to the
// seed before the outcome unless the receipt or chronicle provides a prior
// commitment anchor (see docs/RNG_OUTCOME_VERIFICATION.md, finding F1/F2).
//
// LABELING RULE: this module NEVER returns final_status="verified" for the
// death-drop outcome. "verified" would require receipt authenticity +
// rng_commit_reveal + outcome_derivation + precommit_anchoring to ALL pass,
// which cannot happen with the current persisted receipt shape.

import { blake3 } from '@noble/hashes/blake3';
import * as nodeCrypto from 'node:crypto';
import stableStringify from 'fast-json-stable-stringify';
import { rngCommit, rngCommitV1, rngDrawU32Legacy, rngDeriveSeedV2 } from './rng.js';
import { computeDeathDrops, type ItemForDrop } from './dropPolicy.js';
import type { MapName } from './http.js';

export type CheckStatus = 'pass' | 'fail' | 'not_checked' | 'unsupported';

export type FinalStatus =
  | 'verified'
  | 'rng_consistent'
  | 'replay_consistent'
  | 'failed'
  | 'unsupported';

export type OutcomeVerificationResult = {
  receipt_shape_valid: boolean;
  receipt_authenticity: CheckStatus;
  chronicle_inclusion: CheckStatus;
  rng_commit_reveal: CheckStatus;
  outcome_derivation: CheckStatus;
  precommit_anchoring: CheckStatus;
  final_status: FinalStatus;
  reason_codes: string[];
};

// ---------------------------------------------------------------------------
// Chronicle context (#101): optional out-of-band material the verifier needs to
// reach "verified" for a v2 precommit-anchored proof. Supplied by the caller
// (CLI/sidecar), NEVER read from live server state.
// ---------------------------------------------------------------------------

export type ChronicleEventRef = {
  // Position in the chronicle ordering space (commit < outcome < reveal).
  seq: number;
  // rng_commit event payload fields (commit binds domain+actor+reveal).
  rng_commit?: string;
  // rng_reveal event payload fields (the published secret).
  rng_reveal?: string;
  // actor DID the commit/reveal belong to (for rngCommitV1 recomputation).
  actor?: string;
};

export type OutcomeVerificationContext = {
  // The spawn rng_commit chronicle event.
  commitEvent?: ChronicleEventRef;
  // The disconnect rng_reveal chronicle event (absent until session ends).
  revealEvent?: ChronicleEventRef;
  // Ordering position of THIS outcome in the same chronicle space. Defaults to
  // the receipt's own `sequence` field. See the seq-space caveat in
  // docs/RNG_OUTCOME_VERIFICATION.md (#101).
  outcomeSeq?: number;
  // Raw 32-byte Ed25519 public key (hex) used to verify the receipt signature.
  // When absent, receipt_authenticity stays "not_checked".
  authPublicKeyHex?: string;
};

// ---------------------------------------------------------------------------
// Canonical hashing — MUST stay byte-identical to apps/server/src/persist/hash.ts.
// We use the exact same library (fast-json-stable-stringify) + blake3 + the same
// event_hash/signature exclusion, rather than reimplementing canonicalization,
// so seed-binding cannot diverge from the server's drop_seed_hash.
// ---------------------------------------------------------------------------

function computeReceiptHash(receipt: object): string {
  const { event_hash: _eh, signature: _sig, ...contentFields } = receipt as Record<
    string,
    unknown
  >;
  const canonical = stableStringify(contentFields);
  const hashBytes = blake3(new TextEncoder().encode(canonical));
  const hex = Buffer.from(hashBytes).toString('hex');
  return `blake3:${hex}`;
}

// ---------------------------------------------------------------------------
// Receipt signature verification (#101) — byte-identical to the coordination
// kernel's verifyEventSignature: Ed25519 over the UTF-8 message
// `${prev_hash}|${event_hash}`, with a raw 32-byte Ed25519 public key.
//
// We rebuild the SPKI DER wrapper for the raw key so node:crypto can verify it,
// rather than depending on the kernel build (shared stays standalone). This is
// the SAME verification the server applies when signing receipts.
// ---------------------------------------------------------------------------

const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function verifyReceiptSignature(
  prevHash: string,
  eventHash: string,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  try {
    const rawPub = Buffer.from(publicKeyHex, 'hex');
    if (rawPub.length !== 32) return false;
    const der = Buffer.concat([SPKI_ED25519_PREFIX, rawPub]);
    const publicKey = nodeCrypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    const message = Buffer.from(`${prevHash}|${eventHash}`);
    const signatureBytes = Buffer.from(signatureHex, 'hex');
    return nodeCrypto.verify(null, message, publicKey, signatureBytes);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// RNG commit/reveal triple check
// ---------------------------------------------------------------------------

export function verifyRngCommitReveal(input: {
  commit?: unknown;
  seed?: unknown;
  rng_out?: unknown;
}): { status: 'pass' | 'fail'; reason_codes: string[] } {
  const reason_codes: string[] = [];

  const commit = input.commit;
  const seed = input.seed;
  const rngOut = input.rng_out;

  if (typeof commit !== 'string' || commit.length === 0) {
    reason_codes.push('MISSING_RNG_COMMIT');
  }
  if (typeof seed !== 'string' || seed.length === 0) {
    reason_codes.push('MISSING_RNG_SEED');
  }
  if (!Array.isArray(rngOut)) {
    reason_codes.push('MISSING_RNG_OUTPUT');
  }

  if (reason_codes.length > 0) {
    return { status: 'fail', reason_codes };
  }

  // Types narrowed by the guards above.
  const seedStr = seed as string;
  const commitStr = commit as string;
  const outs = rngOut as unknown[];

  if (rngCommit(seedStr) !== commitStr) {
    reason_codes.push('COMMIT_MISMATCH');
  }

  for (let i = 0; i < outs.length; i++) {
    const expected = rngDrawU32Legacy(seedStr, i);
    if (outs[i] !== expected) {
      reason_codes.push('RNG_OUTPUT_MISMATCH');
      break;
    }
  }

  return { status: reason_codes.length === 0 ? 'pass' : 'fail', reason_codes };
}

// ---------------------------------------------------------------------------
// Receipt-driven verification
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function verifyOutcomeFromReceipt(
  receipt: unknown,
  context?: OutcomeVerificationContext
): OutcomeVerificationResult {
  if (!isObject(receipt)) {
    return {
      receipt_shape_valid: false,
      receipt_authenticity: 'not_checked',
      chronicle_inclusion: 'not_checked',
      rng_commit_reveal: 'unsupported',
      outcome_derivation: 'unsupported',
      precommit_anchoring: 'fail',
      final_status: 'failed',
      reason_codes: ['RECEIPT_NOT_OBJECT'],
    };
  }

  const action = receipt['action'];

  if (action === 'combat_resolved') {
    return verifyCombatResolved(receipt, context);
  }

  return {
    receipt_shape_valid: false,
    receipt_authenticity: 'not_checked',
    chronicle_inclusion: 'not_checked',
    rng_commit_reveal: 'unsupported',
    outcome_derivation: 'unsupported',
    precommit_anchoring: 'fail',
    final_status: 'unsupported',
    reason_codes: ['UNSUPPORTED_OUTCOME_TYPE'],
  };
}

function verifyCombatResolved(
  receipt: Record<string, unknown>,
  context?: OutcomeVerificationContext
): OutcomeVerificationResult {
  const reason_codes: string[] = [];

  // ----- Static checks that always run -----
  const receipt_authenticity: CheckStatus = 'not_checked';
  reason_codes.push('RECEIPT_SIGNATURE_NOT_CHECKED');

  const chronicle_inclusion: CheckStatus = 'not_checked';
  reason_codes.push('CHRONICLE_INCLUSION_NOT_CHECKED');

  // Locked finding: there is NO pre-committed hidden secret binding the outcome.
  const precommit_anchoring: CheckStatus = 'fail';
  reason_codes.push('PRECOMMIT_NOT_PROVEN');

  // Full drop-SET derivation needs the inventory snapshot + reputation that the
  // receipt does not carry. We do NOT fake this.
  const outcome_derivation: CheckStatus = 'unsupported';
  reason_codes.push('MISSING_INPUTS');

  // ----- Shape validation -----
  const inputs = receipt['inputs'];
  const shapeReasons: string[] = [];

  if (!isObject(inputs)) {
    shapeReasons.push('MISSING_INPUTS_OBJECT');
  } else {
    if (!('target_player_id' in inputs)) shapeReasons.push('MISSING_TARGET_PLAYER_ID');
    if (!('map' in inputs)) shapeReasons.push('MISSING_MAP');
    if (!('position' in inputs)) shapeReasons.push('MISSING_POSITION');
    if (!('outcome' in inputs)) shapeReasons.push('MISSING_OUTCOME');
    if (!('dropped_item_ids' in inputs)) shapeReasons.push('MISSING_DROPPED_ITEM_IDS');
    if (!('drop_seed_hash' in inputs)) shapeReasons.push('MISSING_DROP_SEED_HASH');
  }

  const receipt_shape_valid = shapeReasons.length === 0;
  if (!receipt_shape_valid) {
    reason_codes.push(...shapeReasons);
    return {
      receipt_shape_valid,
      receipt_authenticity,
      chronicle_inclusion,
      rng_commit_reveal: 'unsupported',
      outcome_derivation,
      precommit_anchoring,
      final_status: 'failed',
      reason_codes,
    };
  }

  const inp = inputs as Record<string, unknown>;

  // ----- F1/#100: receipt-contained RNG proof path -----
  // When the receipt carries inputs.rng_proof, we can recompute the RNG output
  // AND the final outcome (dropped_item_ids) from the artifact alone. This
  // upgrades replay_consistent → rng_consistent. It is NEVER "verified":
  // precommit_anchoring stays "fail" because the receipt does not prove the
  // server committed to the reveal seed before the outcome (that is #101).
  if ('rng_proof' in inp) {
    const proofMaybe = inp['rng_proof'];
    // #101: v2 precommit-anchored proofs route to the chronicle-aware verifier.
    if (isObject(proofMaybe) && proofMaybe['version'] === 2) {
      return verifyReceiptRngProofV2(receipt, inp, proofMaybe, context);
    }
    return verifyReceiptRngProof(receipt, inp);
  }

  // ----- SEED BINDING (deterministic replay) -----
  // Reconstruct the base object the server hashed to produce drop_seed_hash and
  // compare against the receipt's recorded drop_seed_hash.
  const base = {
    actor_id: receipt['actor_id'],
    action: 'combat_resolved',
    inputs: {
      target_player_id: inp['target_player_id'],
      map: inp['map'],
      position: inp['position'],
      outcome: inp['outcome'],
    },
    result: 'ok',
  };
  const recomputedSeed = computeReceiptHash(base);
  const seedBindingOk = recomputedSeed === inp['drop_seed_hash'];
  if (!seedBindingOk) {
    reason_codes.push('SEED_BINDING_FAIL');
    reason_codes.push('OUTCOME_MISMATCH');
  }

  // ----- RNG commit/reveal triple (usually broadcast-only, absent here) -----
  const hasCommit = 'rng_commit' in receipt;
  const hasReveal = 'rng_reveal' in receipt;
  const hasOut = 'rng_out' in receipt;

  let rng_commit_reveal: CheckStatus;
  if (hasCommit && hasReveal && hasOut) {
    const res = verifyRngCommitReveal({
      commit: receipt['rng_commit'],
      seed: receipt['rng_reveal'],
      rng_out: receipt['rng_out'],
    });
    rng_commit_reveal = res.status;
    reason_codes.push(...res.reason_codes);
  } else {
    rng_commit_reveal = 'unsupported';
    reason_codes.push('MISSING_RNG_COMMIT');
  }

  // ----- final_status -----
  // Checked steps that can fail: shape (passed here), seed binding, and rng
  // commit/reveal when the triple was present.
  const checkedFailed =
    !seedBindingOk || (rng_commit_reveal === 'fail');

  let final_status: FinalStatus;
  if (checkedFailed) {
    final_status = 'failed';
  } else if (rng_commit_reveal === 'pass') {
    // Triple math passed AND seed binding passed: rng_consistent (still NOT
    // verified — precommit_anchoring remains fail).
    final_status = 'rng_consistent';
  } else {
    // Shape + seed binding passed; no RNG triple to check.
    final_status = 'replay_consistent';
  }

  return {
    receipt_shape_valid,
    receipt_authenticity,
    chronicle_inclusion,
    rng_commit_reveal,
    outcome_derivation,
    precommit_anchoring,
    final_status,
    reason_codes,
  };
}

// ---------------------------------------------------------------------------
// F1/#100: receipt-contained RNG proof verification (offline)
// ---------------------------------------------------------------------------
//
// Recomputes — from the receipt artifact alone — (a) the receipt body hash that
// seeded the draw, (b) the rng_commit/reveal/output triple, and (c) the final
// dropped_item_ids via the shared dropPolicy module. Precommit anchoring ALWAYS
// fails (PRECOMMIT_NOT_PROVEN): this proof does not show the server committed to
// the reveal seed before the outcome. final_status maxes out at "rng_consistent".

function reconstructItemsForDrop(raw: unknown): ItemForDrop[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ItemForDrop[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) return null;
    if (typeof entry['item_id'] !== 'string') return null;
    if (typeof entry['item_type'] !== 'string') return null;
    const item: ItemForDrop = {
      item_id: entry['item_id'] as string,
      item_type: entry['item_type'] as string,
    };
    if (isObject(entry['meta'])) item.meta = entry['meta'] as Record<string, unknown>;
    if ('slot' in entry) item.slot = (entry['slot'] as string | null) ?? null;
    out.push(item);
  }
  return out;
}

// Build the per-item heat lookup the server used at selection time. The proof
// folds each legendary item's heat into its meta.heat; we hand that to the
// shared selector so the offline recompute never needs live server state.
function buildHeatLookup(items: ItemForDrop[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const h = it.meta?.['heat'];
    if (typeof h === 'number') m.set(it.item_id, h);
  }
  return m;
}

function verifyReceiptRngProof(
  receipt: Record<string, unknown>,
  inp: Record<string, unknown>
): OutcomeVerificationResult {
  const reason_codes: string[] = [];

  const receipt_authenticity: CheckStatus = 'not_checked';
  reason_codes.push('RECEIPT_SIGNATURE_NOT_CHECKED');
  const chronicle_inclusion: CheckStatus = 'not_checked';
  reason_codes.push('CHRONICLE_INCLUSION_NOT_CHECKED');

  // Precommit anchoring is ALWAYS unproven for v1 (tracked in #101).
  const precommit_anchoring: CheckStatus = 'fail';
  reason_codes.push('PRECOMMIT_NOT_PROVEN');

  const receipt_shape_valid = true; // shape already validated by caller

  const proof = inp['rng_proof'];
  if (!isObject(proof)) {
    reason_codes.push('MISSING_RNG_PROOF');
    return {
      receipt_shape_valid,
      receipt_authenticity,
      chronicle_inclusion,
      rng_commit_reveal: 'fail',
      outcome_derivation: 'fail',
      precommit_anchoring,
      final_status: 'failed',
      reason_codes,
    };
  }

  // ----- unsupported outcome type (e.g. future non-loot proofs) -----
  if (proof['outcome_type'] !== 'loot_drop') {
    reason_codes.push('UNSUPPORTED_OUTCOME_TYPE');
    return {
      receipt_shape_valid,
      receipt_authenticity,
      chronicle_inclusion,
      rng_commit_reveal: 'unsupported',
      outcome_derivation: 'unsupported',
      precommit_anchoring,
      final_status: 'unsupported',
      reason_codes,
    };
  }

  const revealSeed = proof['reveal_seed'];
  const bodyHash = proof['receipt_body_hash'];
  const rngOut = proof['rng_out'];
  const commit = proof['rng_commit'];

  // ----- receipt_body_hash: recompute from combatResolvedBase -----
  let bodyHashOk = false;
  if (typeof bodyHash !== 'string' || bodyHash.length === 0) {
    reason_codes.push('MISSING_RECEIPT_BODY_HASH');
  } else {
    const base = {
      actor_id: receipt['actor_id'],
      action: 'combat_resolved',
      inputs: {
        target_player_id: inp['target_player_id'],
        map: inp['map'],
        position: inp['position'],
        outcome: inp['outcome'],
      },
      result: 'ok',
    };
    const recomputed = computeReceiptHash(base);
    // Body hash must equal both the recomputed base hash AND the receipt's
    // drop_seed_hash (the seed the server recorded). Either divergence is fatal.
    bodyHashOk = recomputed === bodyHash && bodyHash === inp['drop_seed_hash'];
    if (!bodyHashOk) reason_codes.push('RECEIPT_BODY_HASH_MISMATCH');
  }

  // ----- rng_commit_reveal: commit binding + per-index RNG output -----
  let rng_commit_reveal: CheckStatus = 'pass';
  if (typeof revealSeed !== 'string' || revealSeed.length === 0) {
    reason_codes.push('MISSING_RNG_REVEAL_SEED');
    rng_commit_reveal = 'fail';
  }
  if (!Array.isArray(rngOut)) {
    reason_codes.push('MISSING_RNG_OUTPUT');
    rng_commit_reveal = 'fail';
  }

  if (rng_commit_reveal !== 'fail') {
    const seedStr = revealSeed as string;
    const outs = rngOut as unknown[];

    // Commit scheme governs how rng_commit is interpreted:
    //  - v0: rng_commit === rngCommit(reveal_seed); reproducible offline, so a
    //    mismatch is genuine tampering → COMMIT_MISMATCH (fail).
    //  - v1: a deferred, domain/actor-separated precommit that CANNOT be
    //    reproduced from the receipt alone. A legitimate v1 receipt is NOT a
    //    failure — the commit binding is simply unverifiable offline. We mark
    //    rng_commit_reveal "unsupported" + LEGACY_PRECOMMIT_UNBOUND; real
    //    precommit verification is tracked in #101.
    const isV1Commit = proof['rng_commit_scheme'] === 'death_drop:v1';
    if (typeof commit === 'string' && commit.length > 0) {
      if (isV1Commit) {
        reason_codes.push('LEGACY_PRECOMMIT_UNBOUND');
        rng_commit_reveal = 'unsupported';
      } else if (rngCommit(seedStr) !== commit) {
        reason_codes.push('COMMIT_MISMATCH');
        rng_commit_reveal = 'fail';
      }
    }

    // RNG output recomputation is checked independently of the commit scheme: a
    // draw that does not derive from the revealed seed is tampering under any
    // scheme, and overrides an "unsupported" v1 commit with a hard fail.
    for (let i = 0; i < outs.length; i++) {
      if (outs[i] !== rngDrawU32Legacy(seedStr, i)) {
        reason_codes.push('RNG_OUTPUT_MISMATCH');
        rng_commit_reveal = 'fail';
        break;
      }
    }
  }

  // ----- outcome_derivation: recompute dropped_item_ids via shared dropPolicy -----
  let outcome_derivation: CheckStatus = 'pass';
  const derivation = proof['derivation'];
  const dInputs = isObject(derivation) ? derivation['inputs'] : undefined;

  if (!isObject(dInputs)) {
    reason_codes.push('OUTCOME_MISMATCH');
    outcome_derivation = 'fail';
  } else {
    const items = reconstructItemsForDrop(dInputs['items']);
    const reputation = dInputs['reputation'];
    const map = dInputs['map'];
    const dropped = inp['dropped_item_ids'];

    if (
      items === null ||
      typeof reputation !== 'number' ||
      typeof map !== 'string' ||
      typeof revealSeed !== 'string' ||
      !Array.isArray(dropped)
    ) {
      reason_codes.push('OUTCOME_MISMATCH');
      outcome_derivation = 'fail';
    } else {
      const heatLookup = buildHeatLookup(items);
      const recomputed = computeDeathDrops(
        items,
        map as MapName,
        reputation,
        revealSeed,
        [],
        heatLookup
      ).droppedItemIds;

      const expected = dropped as unknown[];
      const sameLen = recomputed.length === expected.length;
      const sameItems =
        sameLen && recomputed.every((id, i) => id === expected[i]);
      if (!sameItems) {
        reason_codes.push('OUTCOME_MISMATCH');
        outcome_derivation = 'fail';
      }
    }
  }

  // ----- final_status -----
  // Genuine integrity failures (seed binding, RNG-output recomputation, or
  // outcome derivation) → failed. Otherwise:
  //  - v0 commit verified + outcome derived → rng_consistent.
  //  - v1 commit unverifiable offline (but seed/output/outcome all checked) →
  //    replay_consistent. This is NOT a failure — it is honest about the commit
  //    being unprovable offline until #101. final_status is NEVER "verified".
  const hardFail =
    !bodyHashOk || rng_commit_reveal === 'fail' || outcome_derivation !== 'pass';
  let final_status: FinalStatus;
  if (hardFail) {
    final_status = 'failed';
  } else if (rng_commit_reveal === 'pass') {
    final_status = 'rng_consistent';
  } else {
    final_status = 'replay_consistent';
  }

  return {
    receipt_shape_valid,
    receipt_authenticity,
    chronicle_inclusion,
    rng_commit_reveal,
    outcome_derivation,
    precommit_anchoring,
    final_status,
    reason_codes,
  };
}

// ---------------------------------------------------------------------------
// #101: v2 precommit-anchored proof verification (chronicle-aware)
// ---------------------------------------------------------------------------
//
// What v2 proves: the server COMMITTED to the seed (rng_commit chronicle event)
// BEFORE the outcome and DERIVED the outcome from it (rngDeriveSeedV2). The
// reveal is published only later (rng_reveal on disconnect) and is supplied via
// context — it is NEVER in the receipt.
//
// What v2 does NOT prove: that the seed was unbiased, that the server could not
// choose among multiple precommits, that no trust in the server is required, or
// that any client entropy was mixed in.
//
// "verified" is reachable ONLY when ALL of {precommit_anchoring,
// rng_commit_reveal, outcome_derivation, receipt_authenticity,
// chronicle_inclusion} pass. Without a supplied auth pubkey, authenticity stays
// "not_checked" → capped at "rng_consistent" (+ PRECOMMIT_ANCHORED). Without a
// reveal event, precommit_anchoring is "not_checked" (+ REVEAL_NOT_PUBLISHED)
// → "replay_consistent" (NOT failed). Genuine tamper/ordering → "failed".

function isStringNonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function verifyReceiptRngProofV2(
  receipt: Record<string, unknown>,
  inp: Record<string, unknown>,
  proof: Record<string, unknown>,
  context?: OutcomeVerificationContext
): OutcomeVerificationResult {
  const reason_codes: string[] = [];
  const receipt_shape_valid = true; // base shape validated by caller

  // ----- unsupported outcome type -----
  if (proof['outcome_type'] !== 'loot_drop') {
    reason_codes.push('UNSUPPORTED_OUTCOME_TYPE');
    return {
      receipt_shape_valid,
      receipt_authenticity: 'not_checked',
      chronicle_inclusion: 'not_checked',
      rng_commit_reveal: 'unsupported',
      outcome_derivation: 'unsupported',
      precommit_anchoring: 'not_checked',
      final_status: 'unsupported',
      reason_codes,
    };
  }

  const ctx = context ?? {};
  const commitEvent = ctx.commitEvent;
  const revealEvent = ctx.revealEvent;

  const precommitRef = proof['precommit_ref'];
  const worldId = proof['world_id'];
  const eventDomain = proof['event_domain'];
  const eventPreimageHash = proof['event_preimage_hash'];
  const rngOut = proof['rng_out'];
  const derivation = proof['derivation'];

  // ----- event_preimage_hash must equal the receipt's recorded drop_seed_hash
  //       AND the recomputed combatResolvedBase hash (seed boundary unchanged). -----
  let preimageOk = false;
  if (!isStringNonEmpty(eventPreimageHash)) {
    reason_codes.push('MISSING_EVENT_PREIMAGE_HASH');
  } else {
    const base = {
      actor_id: receipt['actor_id'],
      action: 'combat_resolved',
      inputs: {
        target_player_id: inp['target_player_id'],
        map: inp['map'],
        position: inp['position'],
        outcome: inp['outcome'],
      },
      result: 'ok',
    };
    const recomputed = computeReceiptHash(base);
    preimageOk = recomputed === eventPreimageHash && eventPreimageHash === inp['drop_seed_hash'];
    if (!preimageOk) reason_codes.push('EVENT_PREIMAGE_HASH_MISMATCH');
  }

  // outcome ordinal: explicit context override, else the receipt's own sequence.
  const outcomeSeq =
    typeof ctx.outcomeSeq === 'number'
      ? ctx.outcomeSeq
      : typeof receipt['sequence'] === 'number'
        ? (receipt['sequence'] as number)
        : undefined;

  // ----- chronicle inclusion / ordering -----
  let chronicle_inclusion: CheckStatus = 'pass';
  let precommit_anchoring: CheckStatus = 'pass';

  if (!commitEvent || typeof commitEvent.seq !== 'number') {
    reason_codes.push('PRECOMMIT_MISSING');
    chronicle_inclusion = 'fail';
    precommit_anchoring = 'fail';
  } else if (typeof outcomeSeq === 'number' && commitEvent.seq >= outcomeSeq) {
    reason_codes.push('PRECOMMIT_OUT_OF_ORDER');
    chronicle_inclusion = 'fail';
    precommit_anchoring = 'fail';
  }

  // precommit_ref must carry the commit value.
  let refCommit: unknown;
  if (isObject(precommitRef)) {
    refCommit = precommitRef['commit'];
  } else {
    reason_codes.push('PRECOMMIT_MISSING');
    if (chronicle_inclusion === 'pass') chronicle_inclusion = 'fail';
    if (precommit_anchoring === 'pass') precommit_anchoring = 'fail';
  }

  // reveal must come AFTER the outcome when present.
  const haveReveal = !!revealEvent && isStringNonEmpty(revealEvent.rng_reveal);
  if (revealEvent && typeof revealEvent.seq === 'number' && typeof outcomeSeq === 'number') {
    if (revealEvent.seq <= outcomeSeq) {
      reason_codes.push('REVEAL_OUT_OF_ORDER');
      chronicle_inclusion = 'fail';
      precommit_anchoring = 'fail';
    }
  }

  // ----- precommit binding + derivation (need the reveal secret) -----
  let rng_commit_reveal: CheckStatus = 'pass';
  let outcome_derivation: CheckStatus = 'pass';

  if (!haveReveal) {
    reason_codes.push('REVEAL_NOT_PUBLISHED');
    rng_commit_reveal = 'not_checked';
    outcome_derivation = 'not_checked';
    if (precommit_anchoring === 'pass') precommit_anchoring = 'not_checked';
  } else {
    const reveal = revealEvent!.rng_reveal as string;

    // commit binding: rngCommitV1(domain, actor, reveal) === precommit_ref.commit
    //                 === commitEvent.rng_commit. The death_drop:v1 commit binds
    // the session actor (the spawner), supplied as commitEvent.actor.
    const commitActor = commitEvent?.actor;
    if (!isStringNonEmpty(commitActor)) {
      reason_codes.push('PRECOMMIT_COMMIT_MISMATCH');
      rng_commit_reveal = 'fail';
    } else {
      const expectCommit = rngCommitV1(
        isStringNonEmpty(eventDomain) ? eventDomain : 'death_drop:v1',
        commitActor,
        reveal
      );
      const commitMatches =
        expectCommit === refCommit &&
        (!isStringNonEmpty(commitEvent?.rng_commit) || expectCommit === commitEvent!.rng_commit);
      if (!commitMatches) {
        reason_codes.push('PRECOMMIT_COMMIT_MISMATCH');
        rng_commit_reveal = 'fail';
      }
    }

    // derivation: derivedSeed = rngDeriveSeedV2(...); rng_out[i] === draw(seed,i).
    let derivedSeed: string | null = null;
    if (
      isStringNonEmpty(worldId) &&
      isStringNonEmpty(eventDomain) &&
      isStringNonEmpty(eventPreimageHash)
    ) {
      derivedSeed = rngDeriveSeedV2(reveal, worldId, eventDomain, eventPreimageHash);
    }

    if (!derivedSeed || !Array.isArray(rngOut)) {
      reason_codes.push('RNG_OUTPUT_MISMATCH');
      rng_commit_reveal = 'fail';
    } else {
      for (let i = 0; i < rngOut.length; i++) {
        if (rngOut[i] !== rngDrawU32Legacy(derivedSeed, i)) {
          reason_codes.push('RNG_OUTPUT_MISMATCH');
          rng_commit_reveal = 'fail';
          break;
        }
      }
    }

    // outcome: recompute computeDeathDrops(... derivedSeed) === dropped_item_ids.
    const dInputs = isObject(derivation) ? derivation['inputs'] : undefined;
    if (!isObject(dInputs) || !derivedSeed) {
      reason_codes.push('OUTCOME_MISMATCH');
      outcome_derivation = 'fail';
    } else {
      const items = reconstructItemsForDrop(dInputs['items']);
      const reputation = dInputs['reputation'];
      const map = dInputs['map'];
      const dropped = inp['dropped_item_ids'];
      if (
        items === null ||
        typeof reputation !== 'number' ||
        typeof map !== 'string' ||
        !Array.isArray(dropped)
      ) {
        reason_codes.push('OUTCOME_MISMATCH');
        outcome_derivation = 'fail';
      } else {
        const heatLookup = buildHeatLookup(items);
        const recomputed = computeDeathDrops(
          items,
          map as MapName,
          reputation,
          derivedSeed,
          [],
          heatLookup
        ).droppedItemIds;
        const expected = dropped as unknown[];
        const same =
          recomputed.length === expected.length &&
          recomputed.every((id, i) => id === expected[i]);
        if (!same) {
          reason_codes.push('OUTCOME_MISMATCH');
          outcome_derivation = 'fail';
        }
      }
    }
  }

  // event_preimage_hash divergence is fatal under any path.
  if (!preimageOk) {
    if (outcome_derivation === 'pass') outcome_derivation = 'fail';
    if (rng_commit_reveal === 'pass') rng_commit_reveal = 'fail';
  }

  // ----- receipt authenticity (Ed25519 over prev_hash|event_hash) -----
  let receipt_authenticity: CheckStatus;
  if (!isStringNonEmpty(ctx.authPublicKeyHex)) {
    receipt_authenticity = 'not_checked';
    reason_codes.push('RECEIPT_SIGNATURE_NOT_CHECKED');
  } else if (
    !isStringNonEmpty(receipt['prev_hash']) ||
    !isStringNonEmpty(receipt['event_hash']) ||
    !isStringNonEmpty(receipt['signature'])
  ) {
    receipt_authenticity = 'fail';
    reason_codes.push('RECEIPT_SIGNATURE_FIELDS_MISSING');
  } else {
    const ok = verifyReceiptSignature(
      receipt['prev_hash'] as string,
      receipt['event_hash'] as string,
      receipt['signature'] as string,
      ctx.authPublicKeyHex
    );
    receipt_authenticity = ok ? 'pass' : 'fail';
    if (!ok) reason_codes.push('RECEIPT_SIGNATURE_INVALID');
  }

  // ----- final_status -----
  const hardFail =
    rng_commit_reveal === 'fail' ||
    outcome_derivation === 'fail' ||
    chronicle_inclusion === 'fail' ||
    receipt_authenticity === 'fail';

  let final_status: FinalStatus;
  if (hardFail) {
    final_status = 'failed';
  } else if (!haveReveal) {
    // Reveal pending: precommit cannot be anchored offline yet. NOT a failure.
    final_status = 'replay_consistent';
  } else if (
    precommit_anchoring === 'pass' &&
    rng_commit_reveal === 'pass' &&
    outcome_derivation === 'pass' &&
    chronicle_inclusion === 'pass' &&
    receipt_authenticity === 'pass'
  ) {
    final_status = 'verified';
  } else if (
    precommit_anchoring === 'pass' &&
    rng_commit_reveal === 'pass' &&
    outcome_derivation === 'pass'
  ) {
    final_status = 'rng_consistent';
    reason_codes.push('PRECOMMIT_ANCHORED');
  } else {
    final_status = 'replay_consistent';
  }

  return {
    receipt_shape_valid,
    receipt_authenticity,
    chronicle_inclusion,
    rng_commit_reveal,
    outcome_derivation,
    precommit_anchoring,
    final_status,
    reason_codes,
  };
}
