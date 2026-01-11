// Akalynth Receipt Hashing
// Canonical JSON + BLAKE3 for deterministic, replay-safe hashing

import { blake3 } from '@noble/hashes/blake3';
import stableStringify from 'fast-json-stable-stringify';

// ============================================================================
// Canonical JSON
// ============================================================================

/**
 * Produce canonical JSON string with sorted keys.
 * Deterministic across Node versions and runtimes.
 */
export function canonicalize(obj: object): string {
  return stableStringify(obj);
}

// ============================================================================
// Receipt Hash
// ============================================================================

/**
 * Compute BLAKE3 hash of canonical JSON.
 * Format: "blake3:<hex>"
 * Does NOT include trailing newline.
 */
export function computeReceiptHash(receipt: object): string {
  const canonical = canonicalize(receipt);
  const hashBytes = blake3(new TextEncoder().encode(canonical));
  const hex = Buffer.from(hashBytes).toString('hex');
  return `blake3:${hex}`;
}

/**
 * Verify a receipt hash matches expected.
 */
export function verifyReceiptHash(receipt: object, expectedHash: string): boolean {
  const computed = computeReceiptHash(receipt);
  return computed === expectedHash;
}

// ============================================================================
// JSONL Line Utilities
// ============================================================================

/**
 * Serialize receipt to canonical JSONL line (with newline).
 */
export function toJsonlLine(receipt: object): string {
  return canonicalize(receipt) + '\n';
}

/**
 * Parse JSONL line (strips trailing newline if present).
 */
export function parseJsonlLine(line: string): object {
  const trimmed = line.endsWith('\n') ? line.slice(0, -1) : line;
  return JSON.parse(trimmed);
}
