#!/usr/bin/env tsx
/**
 * verify-absence-receipts.ts — Offline verifier for absence_receipt.v1.
 *
 * Finds every `absence_receipt` in a committed receipt chain and independently
 * re-verifies its claim using the kernel's bounded re-execution verifier
 * (packages/coordination-kernel/src/absence): it re-executes the chain
 * genesis->to_seq with the SAME hash/linkage/signature primitives the receipt
 * logger uses, recomputes the predicate + authority-snapshot hashes, and
 * re-evaluates the predicate over [from_seq..to_seq] asserting zero matches.
 *
 * A receipt PASSES iff the independently recomputed AbsenceResult equals the
 * result the receipt claims (CoordinationReceipt.result) and no error-severity
 * finding is raised. This catches forged "absent" claims, predicate/authority
 * drift, tampered slices, log gaps, and authority transitions.
 *
 * Empty chain / no absence receipts → OK (nothing to verify).
 *
 * Usage:
 *   tsx tools/verify-absence-receipts.ts            # resolves audit/receipts.jsonl
 *   tsx tools/verify-absence-receipts.ts <path>     # explicit path (fixtures)
 *   tsx tools/verify-absence-receipts.ts --verbose
 */
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import type { KeyObject } from 'node:crypto';
import {
  verifyAbsenceClaim,
  loadVerifyingKey,
  type CoordinationReceipt,
  type AbsenceReceiptInputs,
} from '@akalynth/coordination-kernel';
import { resolveChainPaths } from '../../../packages/shared/paths.js';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

const VERBOSE = process.argv.includes('--verbose');

function logFail(reason: string): void {
  console.error(`${RED}[verify:absence-receipts] FAIL${RESET} ${reason}`);
}
function logOk(msg: string): void {
  console.log(`${GREEN}[verify:absence-receipts] OK${RESET} ${msg}`);
}
function logInfo(msg: string): void {
  console.log(`[verify:absence-receipts] ${msg}`);
}

function isReceiptShape(obj: unknown): obj is CoordinationReceipt {
  if (obj === null || typeof obj !== 'object') return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.sequence === 'number' &&
    typeof r.actor_id === 'string' &&
    typeof r.action === 'string' &&
    typeof r.result === 'string' &&
    r.inputs !== null &&
    typeof r.inputs === 'object'
  );
}

function main(): void {
  const argPath = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const paths = resolveChainPaths(process.cwd());

  let receiptsPath: string;
  if (argPath) {
    receiptsPath = path.resolve(process.cwd(), argPath);
  } else if (fs.existsSync(paths.receiptsPath)) {
    receiptsPath = paths.receiptsPath;
  } else {
    const fallback = path.resolve(process.cwd(), 'apps/server/audit/receipts.jsonl');
    receiptsPath = fs.existsSync(fallback) ? fallback : paths.receiptsPath;
  }

  if (!fs.existsSync(receiptsPath)) {
    logOk(`no receipts file at ${receiptsPath} (treated as empty chain).`);
    process.exit(0);
  }

  const raw = fs.readFileSync(receiptsPath, 'utf8');
  const receipts: CoordinationReceipt[] = [];
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      logFail(`malformed JSON at line ${i + 1} of ${receiptsPath}`);
      process.exit(1);
    }
    if (!isReceiptShape(obj)) {
      logFail(`line ${i + 1} is not a valid receipt shape`);
      process.exit(1);
    }
    receipts.push(obj);
  }

  // Optional verifying key (signatures checked when available).
  let verifyKey: KeyObject | null = null;
  if (paths.keyPath && fs.existsSync(paths.keyPath)) {
    try {
      verifyKey = loadVerifyingKey(paths.keyPath);
    } catch (err) {
      logFail(`failed to load verifying key at ${paths.keyPath}: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  const absenceReceipts = receipts.filter((r) => r.action === 'absence_receipt');
  if (absenceReceipts.length === 0) {
    logOk(`no absence receipts in ${receiptsPath} (nothing to verify).`);
    process.exit(0);
  }

  let failures = 0;
  for (const ar of absenceReceipts) {
    const inputs = ar.inputs as unknown as AbsenceReceiptInputs;
    const outcome = verifyAbsenceClaim(receipts, inputs, { publicKey: verifyKey });
    const claimed = ar.result;
    const errors = outcome.findings.filter((f) => f.severity === 'error');

    if (outcome.result !== claimed) {
      logFail(
        `seq ${ar.sequence}: claims "${claimed}" but re-verification yields "${outcome.result}" ` +
          `[${outcome.findings.map((f) => f.code).join(',')}]`,
      );
      failures++;
      continue;
    }
    if (errors.length > 0) {
      logFail(`seq ${ar.sequence}: ${errors.map((f) => `${f.code}: ${f.message}`).join('; ')}`);
      failures++;
      continue;
    }
    if (VERBOSE) {
      const pid = inputs.predicate?.predicate_id ?? '?';
      const iv = inputs.interval ? `${inputs.interval.from_seq}..${inputs.interval.to_seq}` : '?';
      logInfo(`seq ${ar.sequence} "${pid}" [${iv}] → ${outcome.result} OK`);
    }
  }

  if (failures > 0) {
    logFail(`${failures}/${absenceReceipts.length} absence receipt(s) failed verification.`);
    process.exit(1);
  }
  logOk(`${absenceReceipts.length} absence receipt(s) verified${verifyKey ? ' (signatures checked)' : ''}.`);
  process.exit(0);
}

main();
