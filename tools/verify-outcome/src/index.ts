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
 * Optional #104 chronicle/pubkey context (still fully offline):
 *   --context path/to/context.json   sidecar with { chronicle: ChronicleEntry[],
 *                                     authPublicKeyHex? } — an ORDERED slice of
 *                                     parsed chronicle.log entries (with their
 *                                     Seal 2.3 global-chain fields) and an
 *                                     optional receipt pubkey. The verifier
 *                                     RE-CHECKS the global hash chain over the
 *                                     slice and proves commit < death < reveal by
 *                                     link-checked position.
 *   --pubkey <hex>                    raw 32-byte Ed25519 receipt pubkey
 *                                     (overrides authPublicKeyHex in --context).
 *
 * "verified" for a v2 proof is reachable ONLY with BOTH a chain-verified slice
 * (ordered commit < death < reveal) AND a valid pubkey. Without the slice the CLI
 * caps at rng_consistent; without the pubkey it caps at rng_consistent
 * (PRECOMMIT_ANCHORED) — see docs/RNG_OUTCOME_VERIFICATION.md.
 */

import * as fs from 'node:fs';
import {
  verifyOutcomeFromReceipt,
  type OutcomeVerificationContext,
} from '../../../packages/shared/verifyOutcome.js';

function readJson(filePath: string, label: string): unknown {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    process.stderr.write(`error: cannot read ${label} ${filePath}: ${(err as Error).message}\n`);
    process.exit(2);
  }
  try {
    return JSON.parse(raw!);
  } catch (err) {
    process.stderr.write(`error: invalid JSON in ${label} ${filePath}: ${(err as Error).message}\n`);
    process.exit(2);
  }
}

function main(): void {
  const argv = process.argv.slice(2);

  let filePath: string | undefined;
  let contextPath: string | undefined;
  let pubkeyHex: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--context') {
      contextPath = argv[++i];
    } else if (a === '--pubkey') {
      pubkeyHex = argv[++i];
    } else if (!filePath) {
      filePath = a;
    }
  }

  if (!filePath) {
    process.stderr.write(
      'usage: tsx tools/verify-outcome/src/index.ts <path/to/receipt.json> ' +
        '[--context ctx.json] [--pubkey <hex>]\n'
    );
    process.exit(2);
  }

  const receipt = readJson(filePath!, 'receipt');

  let context: OutcomeVerificationContext | undefined;
  if (contextPath) {
    context = readJson(contextPath, 'context') as OutcomeVerificationContext;
  }
  if (pubkeyHex) {
    context = { ...(context ?? {}), authPublicKeyHex: pubkeyHex };
  }

  const result = verifyOutcomeFromReceipt(receipt, context);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  // Exit non-zero for outright failures so the CLI is scriptable; non-failing
  // statuses (replay_consistent / rng_consistent / unsupported) exit 0.
  process.exit(result.final_status === 'failed' ? 1 : 0);
}

main();
