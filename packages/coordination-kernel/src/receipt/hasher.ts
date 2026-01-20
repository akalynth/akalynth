// Receipt Hashing Utilities
// Content addressing and chain integrity verification

import crypto from 'node:crypto';
import stableStringify from 'fast-json-stable-stringify';
import type { CoordinationReceipt } from '../types.js';

// ============================================================================
// Hash Utilities
// ============================================================================

/**
 * Generate SHA-256 hex hash of data
 */
export function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Compute evidence hash for a receipt (excluding evidence_hash field)
 */
export function computeEvidenceHash(receipt: Omit<CoordinationReceipt, 'evidence_hash'>): string {
  const evidence = stableStringify({
    timestamp: receipt.timestamp,
    actor_id: receipt.actor_id,
    action: receipt.action,
    inputs: receipt.inputs,
    result: receipt.result,
    prev_hash: receipt.prev_hash,
  });

  return `sha256:${sha256Hex(evidence)}`;
}

/**
 * Serialize receipt to canonical JSONL format (deterministic)
 */
export function serializeReceipt(receipt: CoordinationReceipt): string {
  return stableStringify(receipt) + '\n';
}

/**
 * Verify receipt hash integrity
 */
export function verifyReceiptHash(receipt: CoordinationReceipt): boolean {
  const expectedHash = computeEvidenceHash(receipt);
  return receipt.evidence_hash === expectedHash;
}

/**
 * Verify chain integrity between two consecutive receipts
 */
export function verifyChainLink(prev: CoordinationReceipt, next: CoordinationReceipt): boolean {
  return next.prev_hash === prev.evidence_hash;
}

/**
 * Verify genesis receipt (first in chain)
 */
export function verifyGenesisReceipt(receipt: CoordinationReceipt): boolean {
  return receipt.prev_hash === null && verifyReceiptHash(receipt);
}