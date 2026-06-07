#!/usr/bin/env tsx
/**
 * test-absence-receipts.ts — Assertion harness for absence_receipt.v1.
 *
 * Loads each committed fixture (apps/server/fixtures/absence/), re-verifies its
 * absence receipt(s) with the kernel verifier, and asserts the verdict matches
 * the expectation. A verdict PASSES when the recomputed AbsenceResult equals the
 * receipt's claimed result and no error-severity finding is raised — identical
 * to the rule used by verify-absence-receipts.ts.
 *
 *   tsx tools/test-absence-receipts.ts
 */
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifyAbsenceClaim,
  ABSENCE_CODE,
  type CoordinationReceipt,
  type AbsenceReceiptInputs,
} from '@akalynth/coordination-kernel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/absence');

interface Expectation {
  file: string;
  pass: boolean; // does the absence receipt re-verify consistently with its claim?
  code?: string; // a finding code expected when failing
}

const EXPECTATIONS: Expectation[] = [
  { file: 'absent.jsonl', pass: true },
  { file: 'unprovable-honest.jsonl', pass: true },
  { file: 'forged-match.jsonl', pass: false, code: ABSENCE_CODE.MATCH_FOUND },
  { file: 'overclaim-authority.jsonl', pass: false, code: ABSENCE_CODE.AUTHORITY_TRANSITION },
  { file: 'tampered.jsonl', pass: false, code: ABSENCE_CODE.CHAIN_INVALID },
];

function loadChain(file: string): CoordinationReceipt[] {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8');
  return raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as CoordinationReceipt);
}

function main(): void {
  let failed = 0;

  for (const exp of EXPECTATIONS) {
    const chain = loadChain(exp.file);
    const absence = chain.filter((r) => r.action === 'absence_receipt');
    if (absence.length === 0) {
      console.error(`FAIL ${exp.file}: no absence_receipt present`);
      failed++;
      continue;
    }

    for (const ar of absence) {
      const inputs = ar.inputs as unknown as AbsenceReceiptInputs;
      const outcome = verifyAbsenceClaim(chain, inputs);
      const errors = outcome.findings.filter((f) => f.severity === 'error');
      const verdictPass = outcome.result === ar.result && errors.length === 0;
      const codes = outcome.findings.map((f) => f.code);

      if (verdictPass !== exp.pass) {
        console.error(
          `FAIL ${exp.file}: expected ${exp.pass ? 'PASS' : 'FAIL'} but got ${verdictPass ? 'PASS' : 'FAIL'} ` +
            `(claimed="${ar.result}", recomputed="${outcome.result}", codes=[${codes.join(',')}])`,
        );
        failed++;
        continue;
      }
      if (!exp.pass && exp.code && !codes.includes(exp.code)) {
        console.error(`FAIL ${exp.file}: expected finding ${exp.code}, got [${codes.join(',')}]`);
        failed++;
        continue;
      }
      console.log(
        `OK   ${exp.file}: ${exp.pass ? 'PASS' : 'FAIL'} (recomputed="${outcome.result}"${exp.code ? `, ${exp.code}` : ''})`,
      );
    }
  }

  if (failed > 0) {
    console.error(`\nabsence fixtures: ${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log(`\nabsence fixtures: all ${EXPECTATIONS.length} verdicts as expected`);
  process.exit(0);
}

main();
