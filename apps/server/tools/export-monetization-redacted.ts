#!/usr/bin/env node
/**
 * Monetization Redacted Export
 *
 * Produces a privacy-safe JSON export of monetization receipts.
 *
 * Exit codes:
 *   0 - Exported successfully, or skip-cleanly (default path missing)
 *   1 - Policy verification failed
 *   2 - Operational error (explicit path missing, parse error, IO error)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from '../../../packages/shared/hashPrimitive.js';
import { resolveChainPaths } from '../../../packages/shared/paths.js';
import {
  SUPPORT_CREDIT_GRANTED_ACTION,
  SUPPORT_CREDIT_SPENT_ACTION,
  SUPPORT_ENTITLEMENT_GRANTED_ACTION,
  SUPPORT_ENTITLEMENT_REVOKED_ACTION,
  SUPPORT_REFUND_ISSUED_ACTION,
} from '../../../packages/shared/types.js';

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

type RedactedReceipt = {
  sequence: number | null;
  timestamp: string | null;
  action: string;
  category: string | null;
  sku: string | null;
  policy_ref: { doc: string | null; article: string | null } | null;
  not_power_justification_id: string | null;
  result: string | null;
  event_hash: string | null;
  prev_hash: string | null;
};

const MONETIZATION_ACTIONS = new Set<string>([
  SUPPORT_CREDIT_GRANTED_ACTION,
  SUPPORT_CREDIT_SPENT_ACTION,
  SUPPORT_ENTITLEMENT_GRANTED_ACTION,
  SUPPORT_ENTITLEMENT_REVOKED_ACTION,
  SUPPORT_REFUND_ISSUED_ACTION,
]);

const RECEIPTS_ENV_OVERRIDE_SET = Boolean(
  process.env.AKALYNTH_RECEIPT_CHAIN_PATH || process.env.AKALYNTH_RECEIPTS_PATH
);

const chainPaths = resolveChainPaths(path.resolve(process.cwd()));
const RECEIPTS_PATH = chainPaths.receiptsPath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_PATH = path.resolve(REPO_ROOT, 'artifacts', 'monetization_redacted.json');

function errorOut(msg: string): never {
  console.error(`[export-monetization] ERROR: ${msg}`);
  process.exit(2);
}

function failOut(msg: string): never {
  console.error(`[export-monetization] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string): void {
  console.log(`[export-monetization] OK: ${msg}`);
}

function parseReceipts(file: string): AuditReceipt[] {
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

function getObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function redactReceipt(receipt: AuditReceipt): RedactedReceipt {
  const inputs = getObject(receipt.inputs) ?? {};
  const policyRef = getObject(inputs.policy_ref);

  return {
    sequence: getNumber(receipt.sequence),
    timestamp: getString(receipt.timestamp),
    action: receipt.action,
    category: getString(inputs.category),
    sku: getString(inputs.sku),
    policy_ref: policyRef
      ? {
          doc: getString(policyRef.doc),
          article: getString(policyRef.article),
        }
      : null,
    not_power_justification_id: getString(inputs.not_power_justification_id),
    result: getString(receipt.result),
    event_hash: getString(receipt.event_hash),
    prev_hash: getString(receipt.prev_hash),
  };
}

function sortBySequence(a: AuditReceipt, b: AuditReceipt): number {
  const seqA = typeof a.sequence === 'number' ? a.sequence : 0;
  const seqB = typeof b.sequence === 'number' ? b.sequence : 0;
  if (seqA !== seqB) return seqA - seqB;
  const hashA = typeof a.event_hash === 'string' ? a.event_hash : '';
  const hashB = typeof b.event_hash === 'string' ? b.event_hash : '';
  return hashA.localeCompare(hashB);
}

function summarize(redacted: RedactedReceipt[]) {
  const actions: Record<string, number> = {};
  const categories: Record<string, number> = {};
  for (const r of redacted) {
    actions[r.action] = (actions[r.action] ?? 0) + 1;
    if (r.category) {
      categories[r.category] = (categories[r.category] ?? 0) + 1;
    }
  }
  const sequences = redacted
    .map((r) => r.sequence)
    .filter((v): v is number => typeof v === 'number');
  const firstSequence = sequences.length > 0 ? Math.min(...sequences) : null;
  const lastSequence = sequences.length > 0 ? Math.max(...sequences) : null;
  return {
    count: redacted.length,
    first_sequence: firstSequence,
    last_sequence: lastSequence,
    actions,
    categories,
  };
}

function canonicalPrettyJson(value: unknown): string {
  return JSON.stringify(JSON.parse(canonicalJson(value)), null, 2);
}

function runVerifier(): void {
  const result = spawnSync('npm', ['run', 'verify:monetization'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      AKALYNTH_RECEIPTS_PATH: RECEIPTS_PATH,
    },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 2);
  }
}

if (!fs.existsSync(RECEIPTS_PATH)) {
  if (RECEIPTS_ENV_OVERRIDE_SET) {
    errorOut(`receipts file not found: ${RECEIPTS_PATH}`);
  }
  ok(`receipts file not found (skip): ${RECEIPTS_PATH}`);
  process.exit(0);
}

runVerifier();

const receipts = parseReceipts(RECEIPTS_PATH)
  .filter((r) => MONETIZATION_ACTIONS.has(r.action))
  .sort(sortBySequence);

const redacted = receipts.map(redactReceipt);
const output = {
  version: 1,
  generated_at: new Date().toISOString(),
  summary: summarize(redacted),
  receipts: redacted,
};

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, canonicalPrettyJson(output) + '\n', 'utf8');

ok(`exported ${redacted.length} receipts to ${OUTPUT_PATH}`);
