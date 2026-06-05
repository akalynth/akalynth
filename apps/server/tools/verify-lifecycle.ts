#!/usr/bin/env node
/**
 * Akalynth Lifecycle Verifier
 *
 * Enforces deterministic boot/shutdown ordering for server receipts.
 *
 * Rules (Option A):
 *  - server_boot must appear before any other server receipts
 *  - server_shutdown must appear after server_boot if it exists
 *  - no double-boot without an intervening shutdown
 *  - missing shutdown is not a violation
 *
 * Exit codes:
 *   0 - PASS
 *   1 - FAIL (violations)
 *   2 - error (malformed input, missing file)
 *
 * By default this verifier is strict over the full chain. Runtime boot/shutdown
 * checks may pass `--from-sequence <n>` (or AKALYNTH_LIFECYCLE_FROM_SEQUENCE)
 * to validate only the current lifecycle window without erasing older audit
 * violations from full-chain review.
 */

import * as path from 'node:path';
import { resolveChainPaths } from '../../../packages/shared/paths.js';
import {
  LifecycleVerifierError,
  verifyLifecycleReceiptFile,
} from '../src/audit/lifecycleVerifier.js';

// Canonical path resolution (single source of truth)
const chainPaths = resolveChainPaths(path.resolve(process.cwd()));
const RECEIPTS_PATH = chainPaths.receiptsPath;

// CLI override: `--receipts <path>` / `--receipts=<path>` runs the verifier
// against any supplied chain (CI fixtures, the live beta chain). Priority:
// flag > AKALYNTH_RECEIPT_CHAIN_PATH (resolveChainPaths) > default.
function receiptsArg(): string | null {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--receipts' && argv[i + 1]) return argv[i + 1];
    if (a.startsWith('--receipts=')) return a.slice('--receipts='.length);
  }
  return null;
}
const RECEIPTS_OVERRIDE = receiptsArg();

function fromSequenceArg(): number | null {
  const argv = process.argv.slice(2);
  let raw = process.env.AKALYNTH_LIFECYCLE_FROM_SEQUENCE ?? null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from-sequence' && argv[i + 1]) raw = argv[i + 1];
    if (a.startsWith('--from-sequence=')) raw = a.slice('--from-sequence='.length);
  }
  if (raw === null || raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    errorOut(`invalid --from-sequence value: ${raw}`);
  }
  return parsed;
}

function errorOut(msg: string): never {
  console.error(`[verify-lifecycle] ERROR: ${msg}`);
  process.exit(2);
}

function fail(msg: string): void {
  console.error(`[verify-lifecycle] FAIL: ${msg}`);
}

function ok(msg: string): void {
  console.log(`[verify-lifecycle] OK: ${msg}`);
}

const absReceipts = path.resolve(process.cwd(), RECEIPTS_OVERRIDE ?? RECEIPTS_PATH);
let result;
try {
  result = verifyLifecycleReceiptFile(absReceipts, { fromSequence: fromSequenceArg() });
} catch (error) {
  if (error instanceof LifecycleVerifierError) {
    errorOut(error.message);
  }
  throw error;
}

if (result.scopedFromSequence !== null) {
  ok(`scoped lifecycle window from sequence ${result.scopedFromSequence}`);
}
if (result.sawBoot) {
  ok('server_boot observed');
} else {
  ok('no server_boot receipts');
}

if (result.violations.length > 0) {
  for (const v of result.violations) {
    fail(v);
  }
  process.exit(1);
}

ok('lifecycle ordering valid');
