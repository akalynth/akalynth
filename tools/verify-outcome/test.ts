#!/usr/bin/env node
/**
 * Akalynth Offline RNG Outcome Verifier — fixture tests (tsx assertion script).
 *
 * Repo convention: packages/shared has no test runner and we must NOT add one.
 * This follows the apps/server/tools/verify-*.ts style: load fixtures, run the
 * verifier, assert expected final_status AND reason_codes, throw + exit(1) on
 * mismatch, print OK on success.
 *
 * Usage:
 *   npx tsx tools/verify-outcome/test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blake3 } from '@noble/hashes/blake3';
import stableStringify from 'fast-json-stable-stringify';
import {
  verifyOutcomeFromReceipt,
  type FinalStatus,
  type OutcomeVerificationContext,
} from '../../packages/shared/verifyOutcome.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../packages/shared/test/fixtures');

type Case = {
  file: string;
  expectFinal: FinalStatus;
  // reason_codes are asserted as a SET (order-independent), full equality.
  expectReasons: string[];
  // #101: optional sidecar chronicle/pubkey context file (under FIXTURES).
  contextFile?: string;
};

const cases: Case[] = [
  {
    file: 'rng-valid-loot-drop.json',
    expectFinal: 'replay_consistent',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'MISSING_INPUTS',
      'MISSING_RNG_COMMIT',
    ],
  },
  {
    file: 'rng-tampered-seed.json',
    expectFinal: 'failed',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'MISSING_INPUTS',
      'SEED_BINDING_FAIL',
      'OUTCOME_MISMATCH',
      'MISSING_RNG_COMMIT',
    ],
  },
  {
    file: 'rng-tampered-outcome.json',
    expectFinal: 'failed',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'MISSING_INPUTS',
      'SEED_BINDING_FAIL',
      'OUTCOME_MISMATCH',
      'MISSING_RNG_COMMIT',
    ],
  },
  {
    file: 'rng-tampered-commit.json',
    expectFinal: 'failed',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'MISSING_INPUTS',
      'COMMIT_MISMATCH',
    ],
  },
  {
    file: 'rng-tampered-output.json',
    expectFinal: 'failed',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'MISSING_INPUTS',
      'RNG_OUTPUT_MISMATCH',
    ],
  },
  {
    file: 'rng-missing-fields.json',
    expectFinal: 'failed',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'MISSING_INPUTS',
      'MISSING_POSITION',
      'MISSING_DROPPED_ITEM_IDS',
      'MISSING_DROP_SEED_HASH',
    ],
  },
  {
    file: 'rng-unsupported-outcome.json',
    expectFinal: 'unsupported',
    expectReasons: ['UNSUPPORTED_OUTCOME_TYPE'],
  },

  // ---- F1/#100: receipt-contained RNG proof v1 fixtures ----
  {
    file: 'rng-v1-proof-valid-loot-drop.json',
    expectFinal: 'rng_consistent',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
    ],
  },
  {
    file: 'rng-v1-proof-tampered-seed.json',
    expectFinal: 'failed',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'RECEIPT_BODY_HASH_MISMATCH',
      'COMMIT_MISMATCH',
      'RNG_OUTPUT_MISMATCH',
      'OUTCOME_MISMATCH',
    ],
  },
  {
    // v0 commit tampered: rngCommit(reveal_seed) no longer matches → genuine
    // tampering (COMMIT_MISMATCH). LEGACY_PRECOMMIT_UNBOUND is NOT emitted here —
    // that code is reserved for legitimate, offline-unverifiable v1 commits.
    file: 'rng-v1-proof-tampered-commit.json',
    expectFinal: 'failed',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'COMMIT_MISMATCH',
    ],
  },
  {
    file: 'rng-v1-proof-tampered-output.json',
    expectFinal: 'failed',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'RNG_OUTPUT_MISMATCH',
    ],
  },
  {
    file: 'rng-v1-proof-tampered-outcome.json',
    expectFinal: 'failed',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'OUTCOME_MISMATCH',
    ],
  },
  {
    file: 'rng-v1-proof-body-hash-mismatch.json',
    expectFinal: 'failed',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'RECEIPT_BODY_HASH_MISMATCH',
    ],
  },
  {
    file: 'rng-v1-proof-unsupported-outcome.json',
    expectFinal: 'unsupported',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'UNSUPPORTED_OUTCOME_TYPE',
    ],
  },
  {
    // LEGITIMATE v1-commit receipt (NOT tampered): the deferred precommit cannot
    // be reproduced offline, so rng_commit_reveal is "unsupported"
    // (LEGACY_PRECOMMIT_UNBOUND) while rng output + outcome derivation still
    // verify. This must be replay_consistent, NOT failed. Real v1 commit
    // verification is tracked in #101.
    file: 'rng-v1-proof-v1commit-legacy.json',
    expectFinal: 'replay_consistent',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'LEGACY_PRECOMMIT_UNBOUND',
    ],
  },

  // ---- #101: v2 precommit-anchored proof fixtures (chronicle-aware) ----
  // DOWNGRADE (this release): commit-before-outcome ordering is NOT chain-proven
  // (chronicle and receipt logs use separate seq spaces; caller-supplied ordinals
  // are not trusted). So precommit_anchoring is always "not_checked"
  // (ORDERING_NOT_CHAIN_PROVEN) and "verified" is UNREACHABLE. The cryptographic
  // commit/reveal binding + outcome derivation still cap at rng_consistent.
  // Real ordering proof is a #94-coordinated follow-up.
  {
    // Even WITH auth pubkey + commit+reveal context: ordering unproven → caps at
    // rng_consistent, NOT verified. (authenticity passes silently.)
    file: 'rng-v2-anchored-verified.json',
    contextFile: 'rng-v2-anchored-verified.context.json',
    expectFinal: 'rng_consistent',
    expectReasons: ['ORDERING_NOT_CHAIN_PROVEN'],
  },
  {
    // Reveal present, no auth pubkey → rng_consistent, ordering unproven.
    file: 'rng-v2-anchored-verified.json',
    contextFile: 'rng-v2-anchored-no-pubkey.context.json',
    expectFinal: 'rng_consistent',
    expectReasons: ['RECEIPT_SIGNATURE_NOT_CHECKED', 'ORDERING_NOT_CHAIN_PROVEN'],
  },
  {
    // Commit present, reveal NOT yet published → replay_consistent, NOT failed.
    file: 'rng-v2-anchored-verified.json',
    contextFile: 'rng-v2-reveal-pending.context.json',
    expectFinal: 'replay_consistent',
    expectReasons: [
      'REVEAL_NOT_PUBLISHED',
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'ORDERING_NOT_CHAIN_PROVEN',
    ],
  },
  {
    // Documents the gap: a commit ordered AFTER the outcome is NOT detected,
    // because ordering is not chain-proven. Still rng_consistent (the binding is
    // valid); ORDERING_NOT_CHAIN_PROVEN flags that ordering was not verified.
    // Detecting this requires the chronicle-global-hash ordering follow-up.
    file: 'rng-v2-anchored-verified.json',
    contextFile: 'rng-v2-commit-out-of-order.context.json',
    expectFinal: 'rng_consistent',
    expectReasons: ['RECEIPT_SIGNATURE_NOT_CHECKED', 'ORDERING_NOT_CHAIN_PROVEN'],
  },
  {
    file: 'rng-v2-tampered-rng-out.json',
    contextFile: 'rng-v2-anchored-no-pubkey.context.json',
    expectFinal: 'failed',
    expectReasons: [
      'RNG_OUTPUT_MISMATCH',
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'ORDERING_NOT_CHAIN_PROVEN',
    ],
  },
  {
    file: 'rng-v2-tampered-outcome.json',
    contextFile: 'rng-v2-anchored-no-pubkey.context.json',
    expectFinal: 'failed',
    expectReasons: [
      'OUTCOME_MISMATCH',
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'ORDERING_NOT_CHAIN_PROVEN',
    ],
  },
  {
    file: 'rng-v2-precommit-mismatch.json',
    contextFile: 'rng-v2-anchored-no-pubkey.context.json',
    expectFinal: 'failed',
    expectReasons: [
      'PRECOMMIT_COMMIT_MISMATCH',
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'ORDERING_NOT_CHAIN_PROVEN',
    ],
  },
];

function sortedUnique(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort();
}

function assertEqualSet(actual: string[], expected: string[], label: string): void {
  const a = sortedUnique(actual);
  const e = sortedUnique(expected);
  if (a.length !== e.length || a.some((v, i) => v !== e[i])) {
    throw new Error(
      `[${label}] reason_codes mismatch\n  expected: ${JSON.stringify(e)}\n  actual:   ${JSON.stringify(a)}`
    );
  }
}

let failures = 0;

for (const c of cases) {
  const full = path.join(FIXTURES, c.file);
  const receipt = JSON.parse(fs.readFileSync(full, 'utf8'));
  const isV2 = !!c.contextFile;
  const context: OutcomeVerificationContext | undefined = c.contextFile
    ? (JSON.parse(
        fs.readFileSync(path.join(FIXTURES, c.contextFile), 'utf8')
      ) as OutcomeVerificationContext)
    : undefined;
  const result = verifyOutcomeFromReceipt(receipt, context);
  const label = c.contextFile ? `${c.file} + ${c.contextFile}` : c.file;

  try {
    if (result.final_status !== c.expectFinal) {
      throw new Error(
        `[${label}] final_status mismatch: expected ${c.expectFinal}, got ${result.final_status}`
      );
    }
    assertEqualSet(result.reason_codes, c.expectReasons, label);

    if (!isV2) {
      // v1/legacy hard invariant: this path must NEVER emit "verified" and
      // precommit_anchoring must always be "fail" (except unsupported).
      if ((result.final_status as string) === 'verified') {
        throw new Error(`[${label}] illegal final_status "verified" for v1/legacy`);
      }
      if (result.precommit_anchoring !== 'fail' && c.expectFinal !== 'unsupported') {
        throw new Error(
          `[${label}] v1 precommit_anchoring must be "fail", got ${result.precommit_anchoring}`
        );
      }
    } else {
      // v2 invariant (this release): ordering is NOT chain-proven, so "verified"
      // is UNREACHABLE and precommit_anchoring must never be "pass".
      if ((result.final_status as string) === 'verified') {
        throw new Error(`[${label}] illegal "verified" — v2 ordering is not chain-proven yet`);
      }
      if (result.precommit_anchoring === 'pass') {
        throw new Error(
          `[${label}] v2 precommit_anchoring must not be "pass" (got ${result.precommit_anchoring})`
        );
      }
    }

    console.log(`OK  ${label} -> ${result.final_status}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Step 1 invariant: "rng proof envelope does not alter receipt body hash seed"
//
// Adding inputs.rng_proof to the FINAL combat_resolved receipt MUST NOT change
// the seed, which is computeReceiptHash(combatResolvedBase) — a NAMED SUBSET
// hashed BEFORE drop fields. We hash the base, then build the full persisted
// receipt (with inputs.rng_proof + drop fields), reconstruct the base from it
// exactly as the verifier does, and assert the hash is byte-identical.
// ---------------------------------------------------------------------------
function computeReceiptHashLocal(receipt: object): string {
  const { event_hash: _e, signature: _s, ...content } = receipt as Record<string, unknown>;
  const canonical = stableStringify(content);
  const hashBytes = blake3(new TextEncoder().encode(canonical));
  return `blake3:${Buffer.from(hashBytes).toString('hex')}`;
}

try {
  const combatResolvedBase = {
    actor_id: 'did:akalynth:attacker-001',
    action: 'combat_resolved',
    inputs: {
      target_player_id: 'did:akalynth:victim-001',
      map: 'Azura',
      position: { x: 12, y: 34 },
      outcome: 'kill',
    },
    result: 'ok',
  };
  const seedBefore = computeReceiptHashLocal(combatResolvedBase);

  // The valid fixture is the real persisted receipt WITH inputs.rng_proof.
  const persisted = JSON.parse(
    fs.readFileSync(path.join(FIXTURES, 'rng-v1-proof-valid-loot-drop.json'), 'utf8')
  ) as Record<string, unknown>;
  const inp = persisted.inputs as Record<string, unknown>;

  // Reconstruct the base from the persisted receipt (named subset only).
  const reconstructedBase = {
    actor_id: persisted.actor_id,
    action: 'combat_resolved',
    inputs: {
      target_player_id: inp.target_player_id,
      map: inp.map,
      position: inp.position,
      outcome: inp.outcome,
    },
    result: 'ok',
  };
  const seedAfter = computeReceiptHashLocal(reconstructedBase);

  if (seedBefore !== seedAfter) {
    throw new Error(
      `seed changed: before=${seedBefore} after=${seedAfter}`
    );
  }
  // The persisted drop_seed_hash and rng_proof.receipt_body_hash must equal it.
  const proof = inp.rng_proof as Record<string, unknown>;
  if (inp.drop_seed_hash !== seedAfter) {
    throw new Error(`drop_seed_hash != seed: ${String(inp.drop_seed_hash)}`);
  }
  if (proof.receipt_body_hash !== seedAfter) {
    throw new Error(`rng_proof.receipt_body_hash != seed: ${String(proof.receipt_body_hash)}`);
  }
  console.log('OK  rng proof envelope does not alter receipt body hash seed');
} catch (err) {
  failures++;
  console.error(`FAIL [seed-invariant] ${(err as Error).message}`);
}

// ---------------------------------------------------------------------------
// #101 v2 seed-invariant: the v2 proof envelope (precommit_ref / event_domain /
// world_id / rng_out / derivation) MUST NOT change combatResolvedBase's hash.
// The v2 outcome change comes ONLY from feeding rngDeriveSeedV2's output to the
// PRF — the seed PREIMAGE boundary (the named subset) is byte-identical to v1.
// ---------------------------------------------------------------------------
try {
  const v2 = JSON.parse(
    fs.readFileSync(path.join(FIXTURES, 'rng-v2-anchored-verified.json'), 'utf8')
  ) as Record<string, unknown>;
  const inp = v2.inputs as Record<string, unknown>;
  const reconstructedBase = {
    actor_id: v2.actor_id,
    action: 'combat_resolved',
    inputs: {
      target_player_id: inp.target_player_id,
      map: inp.map,
      position: inp.position,
      outcome: inp.outcome,
    },
    result: 'ok',
  };
  const seed = computeReceiptHashLocal(reconstructedBase);
  const proof = inp.rng_proof as Record<string, unknown>;
  // event_preimage_hash and drop_seed_hash must BOTH equal the base hash — the
  // v2 proof leaves the seed PREIMAGE untouched (only the derived seed differs).
  if (inp.drop_seed_hash !== seed) {
    throw new Error(`v2 drop_seed_hash != base seed: ${String(inp.drop_seed_hash)} vs ${seed}`);
  }
  if (proof.event_preimage_hash !== seed) {
    throw new Error(
      `v2 rng_proof.event_preimage_hash != base seed: ${String(proof.event_preimage_hash)}`
    );
  }
  if (proof.version !== 2) {
    throw new Error(`v2 fixture has wrong version: ${String(proof.version)}`);
  }
  // The v2 proof MUST NOT leak the reveal secret in any field.
  if ('reveal_seed' in proof || 'reveal' in proof) {
    throw new Error('v2 proof must NOT contain the reveal secret');
  }
  console.log('OK  v2 proof envelope does not alter receipt body hash seed (no reveal leak)');
} catch (err) {
  failures++;
  console.error(`FAIL [v2-seed-invariant] ${(err as Error).message}`);
}

if (failures > 0) {
  console.error(`\n[verify-outcome] ${failures} fixture(s) FAILED`);
  process.exit(1);
}

console.log('\n[verify-outcome] PASS');
