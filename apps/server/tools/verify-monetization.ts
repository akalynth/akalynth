#!/usr/bin/env node
/**
 * Monetization Receipt Verifier
 *
 * Enforces that any monetization receipts are policy-referenced and auditable.
 *
 * Exit codes:
 *   0 - PASS
 *   1 - FAIL (violations)
 *   2 - error (malformed input, missing file)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
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

// Canonical path resolution (single source of truth)
const chainPaths = resolveChainPaths(path.resolve(process.cwd()));
const RECEIPTS_PATH = chainPaths.receiptsPath;
const RECEIPTS_ENV_OVERRIDE_SET = Boolean(
  process.env.AKALYNTH_RECEIPT_CHAIN_PATH || process.env.AKALYNTH_RECEIPTS_PATH
);

// Repo root from apps/server/tools (for docs lookup)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const JUSTIFICATIONS_PATH = path.resolve(REPO_ROOT, 'docs', 'MONETIZATION_JUSTIFICATIONS.md');

const MONETIZATION_ACTIONS = new Set<string>([
  SUPPORT_CREDIT_GRANTED_ACTION,
  SUPPORT_CREDIT_SPENT_ACTION,
  SUPPORT_ENTITLEMENT_GRANTED_ACTION,
  SUPPORT_ENTITLEMENT_REVOKED_ACTION,
  SUPPORT_REFUND_ISSUED_ACTION,
]);

const CATEGORIES = new Set<string>([
  'cosmetic',
  'memory',
  'convenience',
  'world_support',
  'service',
]);

function errorOut(msg: string): never {
  console.error(`[verify-monetization] ERROR: ${msg}`);
  process.exit(2);
}

function fail(msg: string): void {
  console.error(`[verify-monetization] FAIL: ${msg}`);
}

function ok(msg: string): void {
  console.log(`[verify-monetization] OK: ${msg}`);
}

function parseJustificationIds(file: string): Set<string> {
  const ids = new Set<string>();
  if (!fs.existsSync(file)) return ids;

  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const parts = trimmed.split('|').map((p) => p.trim());
    // Format: | id | sku | ... |
    const id = parts[1];
    if (!id || id === 'id' || id === '---' || id === '(add)' || id === '*(add)*') continue;
    ids.add(id);
  }
  return ids;
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function getObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function validatePolicyFields(inputs: Record<string, unknown>, where: string): string[] {
  const violations: string[] = [];

  const category = inputs.category;
  if (!isNonEmptyString(category) || !CATEGORIES.has(category)) {
    violations.push(`${where}: invalid/missing category`);
  }

  const policyRef = getObject(inputs.policy_ref);
  if (!policyRef) {
    violations.push(`${where}: missing policy_ref`);
  } else {
    if (!isNonEmptyString(policyRef.doc) || policyRef.doc !== 'MONETIZATION_CONSTITUTION') {
      violations.push(`${where}: policy_ref.doc must be MONETIZATION_CONSTITUTION`);
    }
    if (!isNonEmptyString(policyRef.article)) {
      violations.push(`${where}: policy_ref.article missing`);
    }
  }

  if (!isNonEmptyString(inputs.not_power_justification_id)) {
    violations.push(`${where}: missing not_power_justification_id`);
  }

  return violations;
}

function verifyMonetization(receipts: AuditReceipt[]): string[] {
  const violations: string[] = [];
  const monetizationReceipts = receipts.filter((r) => MONETIZATION_ACTIONS.has(r.action));
  const justificationIds = parseJustificationIds(JUSTIFICATIONS_PATH);

  if (monetizationReceipts.length === 0) {
    ok('no monetization receipts observed');
    return violations;
  }

  if (!fs.existsSync(JUSTIFICATIONS_PATH)) {
    violations.push(`missing justifications registry: ${JUSTIFICATIONS_PATH}`);
  } else if (justificationIds.size === 0) {
    violations.push(`justifications registry has no IDs: ${JUSTIFICATIONS_PATH}`);
  }

  ok(`found ${monetizationReceipts.length} monetization receipts`);

  for (const r of monetizationReceipts) {
    const where = `seq=${r.sequence} action=${r.action}`;
    const inputs = r.inputs ?? {};

    if (!isNonEmptyString(r.actor_id)) {
      violations.push(`${where}: missing actor_id`);
    }
    if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
      violations.push(`${where}: inputs must be an object`);
      continue;
    }

    if (r.action === SUPPORT_CREDIT_GRANTED_ACTION) {
      if (!isPositiveInteger(inputs.amount)) violations.push(`${where}: invalid/missing inputs.amount`);
      if (!isNonEmptyString(inputs.reason)) violations.push(`${where}: invalid/missing inputs.reason`);
      continue;
    }

    if (r.action === SUPPORT_CREDIT_SPENT_ACTION) {
      if (!isPositiveInteger(inputs.amount)) violations.push(`${where}: invalid/missing inputs.amount`);
      if (!isNonEmptyString(inputs.sku)) violations.push(`${where}: invalid/missing inputs.sku`);
      violations.push(...validatePolicyFields(inputs, where));
      if (isNonEmptyString(inputs.not_power_justification_id) && !justificationIds.has(inputs.not_power_justification_id)) {
        violations.push(`${where}: unknown not_power_justification_id: ${inputs.not_power_justification_id}`);
      }
      continue;
    }

    if (r.action === SUPPORT_ENTITLEMENT_GRANTED_ACTION) {
      if (!isNonEmptyString(inputs.sku)) violations.push(`${where}: invalid/missing inputs.sku`);
      if (!isNonEmptyString(inputs.entitlement_key)) violations.push(`${where}: invalid/missing inputs.entitlement_key`);
      if (!isNonEmptyString(inputs.source_receipt_hash)) violations.push(`${where}: invalid/missing inputs.source_receipt_hash`);
      violations.push(...validatePolicyFields(inputs, where));
      if (isNonEmptyString(inputs.not_power_justification_id) && !justificationIds.has(inputs.not_power_justification_id)) {
        violations.push(`${where}: unknown not_power_justification_id: ${inputs.not_power_justification_id}`);
      }
      continue;
    }

    if (r.action === SUPPORT_ENTITLEMENT_REVOKED_ACTION) {
      if (!isNonEmptyString(inputs.entitlement_key)) violations.push(`${where}: invalid/missing inputs.entitlement_key`);
      if (!isNonEmptyString(inputs.reason)) violations.push(`${where}: invalid/missing inputs.reason`);
      if (!isNonEmptyString(inputs.source_receipt_hash)) violations.push(`${where}: invalid/missing inputs.source_receipt_hash`);
      continue;
    }

    if (r.action === SUPPORT_REFUND_ISSUED_ACTION) {
      if (!isPositiveInteger(inputs.amount)) violations.push(`${where}: invalid/missing inputs.amount`);
      if (!isNonEmptyString(inputs.kind)) violations.push(`${where}: invalid/missing inputs.kind`);
      if (!isNonEmptyString(inputs.source_receipt_hash)) violations.push(`${where}: invalid/missing inputs.source_receipt_hash`);
      continue;
    }
  }

  return violations;
}

if (!fs.existsSync(RECEIPTS_PATH)) {
  if (RECEIPTS_ENV_OVERRIDE_SET) {
    errorOut(`receipts file not found: ${RECEIPTS_PATH}`);
  }
  ok(`receipts file not found (skip): ${RECEIPTS_PATH}`);
  process.exit(0);
}

const receipts = parseReceipts(RECEIPTS_PATH);
const violations = verifyMonetization(receipts);

if (violations.length > 0) {
  for (const v of violations) {
    fail(v);
  }
  process.exit(1);
}

ok('monetization receipts valid');
