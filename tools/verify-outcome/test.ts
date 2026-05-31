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

if (failures > 0) {
  console.error(`\n[verify-outcome] ${failures} fixture(s) FAILED`);
  process.exit(1);
}

console.log('\n[verify-outcome] PASS');
