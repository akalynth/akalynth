#!/usr/bin/env tsx
/**
 * verify-receipts-chain.ts — Offline receipts.jsonl chain verifier
 *
 * Re-validates the audit receipt chain (audit/receipts.jsonl) using the SAME
 * hash + signature primitives the server's receipt logger uses to write it
 * (packages/coordination-kernel/src/receipt/hasher.ts). Reuses, never
 * reimplements, those primitives.
 *
 * Validates, per receipt:
 * - inputs_hash / outputs_hash / event_hash (verifyReceiptHashes)
 * - chain linkage: first receipt is genesis (prev_hash === "genesis"),
 *   each subsequent links to the prior event_hash (verifyChainLink)
 * - Ed25519 signature over `${prev_hash}|${event_hash}` (verifyEventSignature),
 *   IFF a verifying key is available. Keyless/dev mode skips signatures only.
 *
 * Empty chain (0 receipts) is OK (genesis/bootstrap), matching replay semantics.
 *
 * Usage:
 *   tsx tools/verify-receipts-chain.ts            # resolves audit/receipts.jsonl
 *   tsx tools/verify-receipts-chain.ts <path>     # explicit path (fixtures)
 *   tsx tools/verify-receipts-chain.ts --verbose
 */
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import type { KeyObject } from 'node:crypto';
import {
  verifyReceiptHashes,
  verifyChainLink,
  verifyGenesisReceipt,
  verifyEventSignature,
  loadVerifyingKey,
} from '@akalynth/coordination-kernel';
import type { CoordinationReceipt } from '@akalynth/coordination-kernel';
import { resolveChainPaths } from '../../../packages/shared/paths.js';
import type { AuditReceipt } from '../../../packages/shared/types.js';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const VERBOSE = process.argv.includes('--verbose');

function logFail(reason: string): void {
  console.error(`${RED}[verify:receipts-chain] FAIL${RESET} ${reason}`);
}

function logOk(msg: string): void {
  console.log(`${GREEN}[verify:receipts-chain] OK${RESET} ${msg}`);
}

function logInfo(msg: string): void {
  console.log(`[verify:receipts-chain] ${msg}`);
}

function isAuditReceiptShape(obj: unknown): obj is AuditReceipt {
  if (obj === null || typeof obj !== 'object') return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.sequence === 'number' &&
    typeof r.timestamp === 'string' &&
    typeof r.prev_hash === 'string' &&
    typeof r.event_hash === 'string' &&
    typeof r.signature === 'string' &&
    typeof r.actor_id === 'string' &&
    typeof r.action === 'string' &&
    r.inputs !== null &&
    typeof r.inputs === 'object' &&
    typeof r.result === 'string' &&
    typeof r.inputs_hash === 'string' &&
    typeof r.outputs_hash === 'string'
  );
}

/**
 * AuditReceipt and CoordinationReceipt are field-identical; the kernel hash
 * functions are typed against CoordinationReceipt. Adapt by cast.
 */
function asKernelReceipt(r: AuditReceipt): CoordinationReceipt {
  return r as unknown as CoordinationReceipt;
}

function main(): void {
  // argv override path for fixtures: first non-flag arg
  const argPath = process.argv.slice(2).find((a) => !a.startsWith('--'));

  const paths = resolveChainPaths(process.cwd());

  // Path precedence:
  //  1) explicit argv path (fixtures / ad-hoc)
  //  2) resolved chain path (env override, else <cwd>/audit/receipts.jsonl)
  //  3) repoRoot fallback apps/server/audit/receipts.jsonl — matches the
  //     spine's `receipts-exist` verifier, so running from repo root (as the
  //     spine does) still finds the real server chain.
  let receiptsPath: string;
  if (argPath) {
    receiptsPath = path.resolve(process.cwd(), argPath);
  } else if (fs.existsSync(paths.receiptsPath)) {
    receiptsPath = paths.receiptsPath;
  } else {
    const serverFallback = path.resolve(process.cwd(), 'apps/server/audit/receipts.jsonl');
    receiptsPath = fs.existsSync(serverFallback) ? serverFallback : paths.receiptsPath;
  }

  if (!fs.existsSync(receiptsPath)) {
    // Missing chain is treated as empty (fresh install / bootstrap) → OK.
    logOk(`no receipts file at ${receiptsPath} (treated as empty chain).`);
    process.exit(0);
  }

  const raw = fs.readFileSync(receiptsPath, 'utf8');
  const lines = raw.split('\n');

  // Parse all non-blank lines; malformed line → FAIL.
  const receipts: AuditReceipt[] = [];
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
    if (!isAuditReceiptShape(obj)) {
      logFail(`line ${i + 1} is not a valid AuditReceipt shape`);
      process.exit(1);
    }
    receipts.push(obj);
  }

  if (receipts.length === 0) {
    logOk(`empty chain (0 receipts) at ${receiptsPath} — genesis/bootstrap.`);
    process.exit(0);
  }

  // Resolve verifying key (signatures) if available.
  let verifyKey: KeyObject | null = null;
  let keyStatus: string;
  if (paths.keyPath && fs.existsSync(paths.keyPath)) {
    try {
      verifyKey = loadVerifyingKey(paths.keyPath);
      keyStatus = `signatures CHECKED (key: ${paths.keyPath})`;
    } catch (err) {
      logFail(`failed to load verifying key at ${paths.keyPath}: ${(err as Error).message}`);
      process.exit(1);
    }
  } else {
    keyStatus = 'signatures NOT checked (no key)';
  }

  let prev: AuditReceipt | null = null;
  let sigChecked = 0;

  for (const r of receipts) {
    const kr = asKernelReceipt(r);

    // 1. Chain linkage (structural) — checked first so a deliberate linkage
    //    break surfaces as a linkage failure rather than a downstream hash
    //    mismatch.
    if (prev === null) {
      if (!verifyGenesisReceipt(kr)) {
        logFail(
          `first receipt (sequence ${r.sequence}) is not genesis: prev_hash="${r.prev_hash}" (expected "genesis")`,
        );
        process.exit(1);
      }
    } else {
      if (!verifyChainLink(asKernelReceipt(prev), kr)) {
        logFail(
          `chain link broken between sequence ${prev.sequence} and ${r.sequence}: ` +
            `prev_hash="${r.prev_hash}" != prior event_hash="${prev.event_hash}"`,
        );
        process.exit(1);
      }
    }

    // 2. Hashes (inputs/outputs/event).
    const h = verifyReceiptHashes(kr);
    if (!h.ok) {
      logFail(`receipt sequence ${r.sequence}: ${h.reason}`);
      process.exit(1);
    }

    // 3. Signature (only when a key is available).
    if (verifyKey) {
      const sigOk = verifyEventSignature(r.prev_hash, r.event_hash, r.signature, verifyKey);
      if (!sigOk) {
        logFail(`signature invalid at sequence ${r.sequence}`);
        process.exit(1);
      }
      sigChecked++;
    }

    if (VERBOSE) {
      logInfo(`seq ${r.sequence} ${r.action} OK (hash+link${verifyKey ? '+sig' : ''})`);
    }

    prev = r;
  }

  logOk(`${receipts.length} receipts, linkage OK, ${keyStatus}.`);
  if (verifyKey) {
    logInfo(`signatures verified: ${sigChecked}/${receipts.length}`);
  }
  process.exit(0);
}

main();
