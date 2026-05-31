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
import stableStringify from 'fast-json-stable-stringify';
import { rngCommit, rngDrawU32Legacy } from './rng.js';

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

export function verifyOutcomeFromReceipt(receipt: unknown): OutcomeVerificationResult {
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
    return verifyCombatResolved(receipt);
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

function verifyCombatResolved(receipt: Record<string, unknown>): OutcomeVerificationResult {
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
