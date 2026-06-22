// Akalynth Receipt Hashing
// Canonical JSON + BLAKE3 for deterministic, replay-safe hashing

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { blake3HexUtf8, canonicalJson } from '../../../../packages/shared/hashPrimitive.js';

const require = createRequire(import.meta.url);

type NativeHashPrimitive = {
  mode: 'native';
  canonicalJson: (value: unknown) => string;
  blake3HexUtf8: (value: string) => string;
};

let nativeHashPrimitive: NativeHashPrimitive | null | undefined;

function uniquePaths(paths: Array<string | undefined>): string[] {
  return [...new Set(paths.filter((p): p is string => Boolean(p)))];
}

function repoRootCandidates(): string[] {
  return uniquePaths([
    process.env.AKALYNTH_SOURCE_REPO,
    resolve(process.cwd(), '../..'),
    process.cwd(),
    // apps/server/src/persist -> repo root in source; dist/server/apps/server/src/persist -> dist/server.
    resolve(import.meta.dirname, '../../../..'),
  ]);
}

function findRepoFile(relativePath: string): string {
  const candidates = repoRootCandidates().map((root) => resolve(root, relativePath));
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

function shouldPreferNativeHash(): boolean {
  return process.env.CHRONICLE_NATIVE !== '0';
}

function getNativeHashPrimitive(): NativeHashPrimitive | null {
  if (!shouldPreferNativeHash()) return null;
  if (nativeHashPrimitive !== undefined) return nativeHashPrimitive;

  try {
    const { openHashPrimitive } = require(findRepoFile('crates/chronicle/napi/loader.cjs')) as {
      openHashPrimitive: (opts?: { preferNative?: boolean }) => NativeHashPrimitive | null;
    };
    nativeHashPrimitive = openHashPrimitive({ preferNative: true });
  } catch {
    nativeHashPrimitive = null;
  }

  return nativeHashPrimitive;
}

export function receiptHashBackendMode(): 'native' | 'ts' {
  return getNativeHashPrimitive()?.mode ?? 'ts';
}

// ============================================================================
// Canonical JSON
// ============================================================================

/**
 * Produce canonical JSON string with sorted keys.
 * Deterministic across Node versions and runtimes.
 */
export function canonicalize(obj: object): string {
  return getNativeHashPrimitive()?.canonicalJson(obj) ?? canonicalJson(obj);
}

// ============================================================================
// Receipt Hash
// ============================================================================

/**
 * Compute BLAKE3 hash of canonical JSON.
 * Format: "blake3:<hex>"
 * Does NOT include trailing newline.
 *
 * Note: event_hash and signature are excluded from the hash computation since they
 * are derived metadata. This ensures hashes match between runtime (before event_hash
 * is added) and materialization (after event_hash/signature are added).
 */
export function computeReceiptHash(receipt: object): string {
  // Strip event_hash/signature before canonicalizing (derived metadata)
  const { event_hash: _, signature: __, ...contentFields } = receipt as Record<string, unknown>;
  const native = getNativeHashPrimitive();
  const canonical = native?.canonicalJson(contentFields) ?? canonicalJson(contentFields);
  const hash = native?.blake3HexUtf8(canonical) ?? blake3HexUtf8(canonical);
  return `blake3:${hash}`;
}

/**
 * Compute raw BLAKE3 hex for server-internal derived IDs.
 * Uses the same native-preferred backend as receipt hashing, without adding the
 * receipt-facing "blake3:" prefix.
 */
export function hashUtf8Hex(value: string): string {
  return getNativeHashPrimitive()?.blake3HexUtf8(value) ?? blake3HexUtf8(value);
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
