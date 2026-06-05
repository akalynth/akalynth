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
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveChainPaths } from '../../../packages/shared/paths.js';

interface AuditReceipt {
  sequence: number;
  timestamp: string;
  prev_hash: string;
  event_hash: string;
  signature: string;
  actor_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
  inputs_hash: string;
  outputs_hash: string;
}

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

function parseReceipts(file: string): AuditReceipt[] {
  if (!fs.existsSync(file)) {
    errorOut(`receipts file not found: ${file}`);
  }
  const text = fs.readFileSync(file, 'utf8');
  const receipts: AuditReceipt[] = [];
  let lineNo = 0;
  for (const line of text.split('\n')) {
    lineNo++;
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      receipts.push(JSON.parse(trimmed));
    } catch {
      errorOut(`malformed JSONL at line ${lineNo}`);
    }
  }
  return receipts;
}

function isServerReceipt(r: AuditReceipt): boolean {
  return r.action.startsWith('server_');
}

function verifyLifecycle(receipts: AuditReceipt[]): string[] {
  const violations: string[] = [];
  let booted = false;
  let sawBoot = false;
  let lastSequence = 0;

  for (const r of receipts) {
    if (typeof r.sequence === 'number') {
      if (r.sequence <= lastSequence) {
        violations.push(`non-monotonic sequence at ${r.sequence}`);
      }
      lastSequence = r.sequence;
    }
    if (r.action === 'server_boot') {
      if (booted) {
        violations.push('double server_boot without intervening server_shutdown');
      }
      booted = true;
      sawBoot = true;
      continue;
    }

    if (r.action === 'server_shutdown') {
      if (!booted) {
        violations.push('server_shutdown before server_boot');
      }
      booted = false;
      continue;
    }

    if (isServerReceipt(r) && !booted) {
      violations.push(`server receipt before server_boot: ${r.action}`);
    }
  }

  if (sawBoot) {
    ok('server_boot observed');
  } else {
    ok('no server_boot receipts');
  }

  return violations;
}

const absReceipts = path.resolve(process.cwd(), RECEIPTS_OVERRIDE ?? RECEIPTS_PATH);
const receipts = parseReceipts(absReceipts);
const violations = verifyLifecycle(receipts);

if (violations.length > 0) {
  for (const v of violations) {
    fail(v);
  }
  process.exit(1);
}

ok('lifecycle ordering valid');
