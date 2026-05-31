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
} from '../../packages/shared/verifyOutcome.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../packages/shared/test/fixtures');

type Case = {
  file: string;
  expectFinal: FinalStatus;
  // reason_codes are asserted as a SET (order-independent), full equality.
  expectReasons: string[];
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
      'LEGACY_PRECOMMIT_UNBOUND',
      'RNG_OUTPUT_MISMATCH',
      'OUTCOME_MISMATCH',
    ],
  },
  {
    file: 'rng-v1-proof-tampered-commit.json',
    expectFinal: 'failed',
    expectReasons: [
      'RECEIPT_SIGNATURE_NOT_CHECKED',
      'CHRONICLE_INCLUSION_NOT_CHECKED',
      'PRECOMMIT_NOT_PROVEN',
      'COMMIT_MISMATCH',
      'LEGACY_PRECOMMIT_UNBOUND',
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
  const result = verifyOutcomeFromReceipt(receipt);

  try {
    if (result.final_status !== c.expectFinal) {
      throw new Error(
        `[${c.file}] final_status mismatch: expected ${c.expectFinal}, got ${result.final_status}`
      );
    }
    assertEqualSet(result.reason_codes, c.expectReasons, c.file);

    // Hard invariant: this verifier must NEVER emit "verified".
    if ((result.final_status as string) === 'verified') {
      throw new Error(`[${c.file}] illegal final_status "verified"`);
    }
    if (result.precommit_anchoring !== 'fail' && c.expectFinal !== 'unsupported') {
      throw new Error(
        `[${c.file}] precommit_anchoring must be "fail", got ${result.precommit_anchoring}`
      );
    }

    console.log(`OK  ${c.file} -> ${result.final_status}`);
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

if (failures > 0) {
  console.error(`\n[verify-outcome] ${failures} fixture(s) FAILED`);
  process.exit(1);
}

console.log('\n[verify-outcome] PASS');
