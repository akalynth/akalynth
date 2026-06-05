import * as fs from 'node:fs';

export interface LifecycleAuditReceipt {
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

export interface LifecycleVerificationOptions {
  fromSequence?: number | null;
}

export interface LifecycleVerificationResult {
  violations: string[];
  sawBoot: boolean;
  scopedFromSequence: number | null;
  receiptCount: number;
}

export class LifecycleVerifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LifecycleVerifierError';
  }
}

export function parseLifecycleReceiptsText(text: string): LifecycleAuditReceipt[] {
  const receipts: LifecycleAuditReceipt[] = [];
  let lineNo = 0;
  for (const line of text.split('\n')) {
    lineNo++;
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      receipts.push(JSON.parse(trimmed));
    } catch {
      throw new LifecycleVerifierError(`malformed JSONL at line ${lineNo}`);
    }
  }
  return receipts;
}

export function readLifecycleReceipts(file: string): LifecycleAuditReceipt[] {
  if (!fs.existsSync(file)) {
    throw new LifecycleVerifierError(`receipts file not found: ${file}`);
  }
  return parseLifecycleReceiptsText(fs.readFileSync(file, 'utf8'));
}

export function scopeLifecycleReceipts(
  receipts: LifecycleAuditReceipt[],
  fromSequence?: number | null
): LifecycleAuditReceipt[] {
  if (fromSequence === null || fromSequence === undefined) return receipts;
  const scoped = receipts.filter((r) => typeof r.sequence === 'number' && r.sequence >= fromSequence);
  if (scoped.length === 0) {
    throw new LifecycleVerifierError(`no receipts found at or after sequence ${fromSequence}`);
  }
  return scoped;
}

function isServerReceipt(r: LifecycleAuditReceipt): boolean {
  return r.action.startsWith('server_');
}

export function verifyLifecycleReceipts(
  receipts: LifecycleAuditReceipt[],
  options: LifecycleVerificationOptions = {}
): LifecycleVerificationResult {
  const scoped = scopeLifecycleReceipts(receipts, options.fromSequence);
  const violations: string[] = [];
  let booted = false;
  let sawBoot = false;
  let lastSequence = 0;

  for (const r of scoped) {
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

  return {
    violations,
    sawBoot,
    scopedFromSequence: options.fromSequence ?? null,
    receiptCount: scoped.length,
  };
}

export function verifyLifecycleReceiptFile(
  file: string,
  options: LifecycleVerificationOptions = {}
): LifecycleVerificationResult {
  return verifyLifecycleReceipts(readLifecycleReceipts(file), options);
}
