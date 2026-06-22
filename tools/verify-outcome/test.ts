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
import {
  verifyOutcomeFromReceipt,
  type FinalStatus,
  type OutcomeVerificationContext,
} from '../../packages/shared/verifyOutcome.js';
import { blake3Prefixed, canonicalJson } from '../../packages/shared/hashPrimitive.js';

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

  // ---- #104/#107: v2 precommit-anchored proof fixtures (chronicle-GLOBAL-CHAIN +
  // line-signature AUTHENTICATION). ----
  // Ordering is checked by the verifier RE-CHECKING the chronicle global hash
  // chain (Seal 2.3) over a supplied slice and requiring commit < death(outcome)
  // < reveal by link-checked POSITION. #107: a hash-linked slice is forgeable on
  // its own, so the verifier now AUTHENTICATES the slice — verifying each line's
  // Ed25519 signature against the published signing_public_key_hex. Only an
  // AUTHENTICATED slice (+ receipt signature verifying against the SAME key +
  // binding/derivation) reaches "verified". No signing pubkey / unsigned →
  // rng_consistent (SLICE_NOT_AUTHENTICATED). Invalid line signature → failed.
  {
    // Authentic signed slice + signingPublicKeyHex + receipt signed by the same
    // key → VERIFIED.
    file: 'rng-v2-anchored-verified.json',
    contextFile: 'rng-v2-slice-valid-pubkey.context.json',
    expectFinal: 'verified',
    expectReasons: [],
  },
  {
    // Authentic slice, NO signing pubkey → slice cannot be authenticated →
    // rng_consistent (SLICE_NOT_AUTHENTICATED). Receipt also unchecked.
    file: 'rng-v2-anchored-verified.json',
    contextFile: 'rng-v2-slice-valid-no-pubkey.context.json',
    expectFinal: 'rng_consistent',
    expectReasons: ['SLICE_NOT_AUTHENTICATED', 'RECEIPT_SIGNATURE_NOT_CHECKED'],
  },
  {
    // Slice with one INVALID line signature (present but wrong) → FAILED
    // (SLICE_SIGNATURE_INVALID). Signing pubkey IS supplied; receipt verifies.
    file: 'rng-v2-anchored-verified.json',
    contextFile: 'rng-v2-slice-invalid-signature.context.json',
    expectFinal: 'failed',
    expectReasons: ['SLICE_SIGNATURE_INVALID'],
  },
  {
    // Commit recorded AFTER the death in the verified chain → FAILED. This is the
    // mis-order #101 could NOT catch; the global-chain position now detects it.
    file: 'rng-v2-anchored-verified.json',
    contextFile: 'rng-v2-slice-commit-out-of-order.context.json',
    expectFinal: 'failed',
    expectReasons: ['PRECOMMIT_OUT_OF_ORDER', 'RECEIPT_SIGNATURE_NOT_CHECKED'],
  },
  {
    // A broken global-chain link in the slice → FAILED (CHRONICLE_CHAIN_BROKEN).
    file: 'rng-v2-anchored-verified.json',
    contextFile: 'rng-v2-slice-broken-link.context.json',
    expectFinal: 'failed',
    expectReasons: ['CHRONICLE_CHAIN_BROKEN', 'RECEIPT_SIGNATURE_NOT_CHECKED'],
  },
  {
    // Death event missing / no matching drop_seed_hash → FAILED.
    file: 'rng-v2-anchored-verified.json',
    contextFile: 'rng-v2-slice-no-death.context.json',
    expectFinal: 'failed',
    expectReasons: ['OUTCOME_EVENT_NOT_FOUND', 'RECEIPT_SIGNATURE_NOT_CHECKED'],
  },
  {
    // Commit < death present, reveal NOT yet published in the slice →
    // replay_consistent (NOT failed).
    file: 'rng-v2-anchored-verified.json',
    contextFile: 'rng-v2-slice-reveal-pending.context.json',
    expectFinal: 'replay_consistent',
    expectReasons: ['REVEAL_NOT_PUBLISHED', 'RECEIPT_SIGNATURE_NOT_CHECKED'],
  },
  {
    // NO chronicle slice (deprecated reveal-only binding) → rng_consistent,
    // ordering not chain-proven. Unchanged receipt-only ceiling.
    file: 'rng-v2-anchored-verified.json',
    contextFile: 'rng-v2-no-slice-reveal.context.json',
    expectFinal: 'rng_consistent',
    expectReasons: ['ORDERING_NOT_CHAIN_PROVEN', 'RECEIPT_SIGNATURE_NOT_CHECKED'],
  },
  {
    // Tampered rng_out, verified slice → FAILED (RNG_OUTPUT_MISMATCH). The chain
    // verifies + events are ordered, but the derivation does not.
    file: 'rng-v2-tampered-rng-out.json',
    contextFile: 'rng-v2-slice-valid-no-pubkey.context.json',
    expectFinal: 'failed',
    expectReasons: ['RNG_OUTPUT_MISMATCH', 'RECEIPT_SIGNATURE_NOT_CHECKED', 'SLICE_NOT_AUTHENTICATED'],
  },
  {
    file: 'rng-v2-tampered-outcome.json',
    contextFile: 'rng-v2-slice-valid-no-pubkey.context.json',
    expectFinal: 'failed',
    expectReasons: ['OUTCOME_MISMATCH', 'RECEIPT_SIGNATURE_NOT_CHECKED', 'SLICE_NOT_AUTHENTICATED'],
  },
  {
    file: 'rng-v2-precommit-mismatch.json',
    contextFile: 'rng-v2-slice-valid-no-pubkey.context.json',
    expectFinal: 'failed',
    expectReasons: ['PRECOMMIT_COMMIT_MISMATCH', 'RECEIPT_SIGNATURE_NOT_CHECKED', 'SLICE_NOT_AUTHENTICATED'],
  },

  // ---- #103: salted inventory commitment fixtures ----
  // These use inventory_commit + inventory_size instead of plaintext items.
  {
    // Valid commitment, opening supplied → commitment verifies, outcome derives.
    // v0 commit scheme → rng triple verifies → rng_consistent.
    file: 'rng-v1-proof-commitment-valid-with-opening.json',
    contextFile: 'rng-v1-proof-commitment-valid-with-opening.context.json',
    expectFinal: 'rng_consistent',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
    ],
  },
  {
    // Valid commitment, NO opening → outcome_derivation: unsupported. NOT a failure.
    // v0 commit scheme → rng triple verifies → rng_consistent (honest ceiling).
    file: 'rng-v1-proof-commitment-no-opening.json',
    expectFinal: 'rng_consistent',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'COMMITTED_NOT_OPENED',
    ],
  },
  {
    // Tampered commitment: the stored inventory_commit does not match the opening.
    // INVENTORY_COMMIT_MISMATCH → outcome_derivation: fail → final_status: failed.
    file: 'rng-v1-proof-commitment-tampered-commit.json',
    contextFile: 'rng-v1-proof-commitment-valid-with-opening.context.json',
    expectFinal: 'failed',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'INVENTORY_COMMIT_MISMATCH',
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
      // v2 invariant (#107): "verified" IS reachable, but ONLY via a
      // signature-AUTHENTICATED slice. Whenever final_status === "verified", ALL
      // THREE of {receipt_authenticity, chronicle_inclusion, precommit_anchoring}
      // MUST be "pass" — "verified" can NEVER rest on an unsigned/forged slice or
      // an unchecked receipt. Conversely, if any of those is NOT "pass", the
      // status must NOT be "verified".
      const authChecksAllPass =
        result.receipt_authenticity === 'pass' &&
        result.chronicle_inclusion === 'pass' &&
        result.precommit_anchoring === 'pass';
      if ((result.final_status as string) === 'verified' && !authChecksAllPass) {
        throw new Error(
          `[${label}] illegal "verified" — requires receipt_authenticity+chronicle_inclusion+precommit_anchoring all "pass" ` +
            `(got ${result.receipt_authenticity}/${result.chronicle_inclusion}/${result.precommit_anchoring})`
        );
      }
      if (authChecksAllPass && (result.final_status as string) !== 'verified') {
        // Defensive: all three auth checks pass but binding/derivation failed →
        // must be "failed", never silently downgraded.
        if (result.final_status !== 'failed') {
          throw new Error(
            `[${label}] all auth checks pass but final_status is ${result.final_status} (expected verified or failed)`
          );
        }
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
  return blake3Prefixed(canonicalJson(content));
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
