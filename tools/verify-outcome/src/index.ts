#!/usr/bin/env node
/**
 * Akalynth Offline RNG Outcome Verifier — CLI
 *
 * Reads a single receipt JSON file, runs the pure offline verifier, and prints
 * the OutcomeVerificationResult as machine-readable JSON. No server required.
 *
 * Usage:
 *   npx tsx tools/verify-outcome/src/index.ts path/to/receipt.json
 *
 * See docs/RNG_OUTCOME_VERIFICATION.md for the meaning of each final_status and
 * the trust boundary (server execution authority vs. offline verification).
 */

import * as fs from 'node:fs';
import { verifyOutcomeFromReceipt } from '../../../packages/shared/verifyOutcome.js';

function main(): void {
  const argv = process.argv.slice(2);
  const filePath = argv[0];

  if (!filePath) {
    process.stderr.write(
      'usage: tsx tools/verify-outcome/src/index.ts <path/to/receipt.json>\n'
    );
    process.exit(2);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    process.stderr.write(`error: cannot read file ${filePath}: ${(err as Error).message}\n`);
    process.exit(2);
    return;
  }

  let receipt: unknown;
  try {
    receipt = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`error: invalid JSON in ${filePath}: ${(err as Error).message}\n`);
    process.exit(2);
    return;
  }

  const result = verifyOutcomeFromReceipt(receipt);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  // Exit non-zero for outright failures so the CLI is scriptable; non-failing
  // statuses (replay_consistent / rng_consistent / unsupported) exit 0.
  process.exit(result.final_status === 'failed' ? 1 : 0);
}

main();
