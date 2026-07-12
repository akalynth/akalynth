// Akalynth Receipt Hashing
// Canonical JSON + BLAKE3 for deterministic, replay-safe hashing
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { blake3HexUtf8, canonicalJson } from '../../../../packages/shared/hashPrimitive.js';
const require = createRequire(import.meta.url);
let nativeHashPrimitive;
function uniquePaths(paths) {
    return [...new Set(paths.filter((p) => Boolean(p)))];
}
function repoRootCandidates() {
    return uniquePaths([
        process.env.AKALYNTH_SOURCE_REPO,
        resolve(process.cwd(), '../..'),
        process.cwd(),
        // apps/server/src/persist -> repo root in source; dist/server/apps/server/src/persist -> dist/server.
        resolve(import.meta.dirname, '../../../..'),
    ]);
}
function findRepoFile(relativePath) {
    const candidates = repoRootCandidates().map((root) => resolve(root, relativePath));
    for (const p of candidates) {
        if (existsSync(p))
            return p;
    }
    return candidates[0];
}
function shouldPreferNativeHash() {
    return process.env.CHRONICLE_NATIVE !== '0';
}
function getNativeHashPrimitive() {
    if (!shouldPreferNativeHash())
        return null;
    if (nativeHashPrimitive !== undefined)
        return nativeHashPrimitive;
    try {
        const { openHashPrimitive } = require(findRepoFile('crates/chronicle/napi/loader.cjs'));
        nativeHashPrimitive = openHashPrimitive({ preferNative: true });
    }
    catch {
        nativeHashPrimitive = null;
    }
    return nativeHashPrimitive;
}
export function receiptHashBackendMode() {
    return getNativeHashPrimitive()?.mode ?? 'ts';
}
// ============================================================================
// Canonical JSON
// ============================================================================
/**
 * Produce canonical JSON string with sorted keys.
 * Deterministic across Node versions and runtimes.
 */
export function canonicalize(obj) {
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
export function computeReceiptHash(receipt) {
    // Strip event_hash/signature before canonicalizing (derived metadata)
    const { event_hash: _, signature: __, ...contentFields } = receipt;
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
export function hashUtf8Hex(value) {
    return getNativeHashPrimitive()?.blake3HexUtf8(value) ?? blake3HexUtf8(value);
}
/**
 * Verify a receipt hash matches expected.
 */
export function verifyReceiptHash(receipt, expectedHash) {
    const computed = computeReceiptHash(receipt);
    return computed === expectedHash;
}
// ============================================================================
// JSONL Line Utilities
// ============================================================================
/**
 * Serialize receipt to canonical JSONL line (with newline).
 */
export function toJsonlLine(receipt) {
    return canonicalize(receipt) + '\n';
}
/**
 * Parse JSONL line (strips trailing newline if present).
 */
export function parseJsonlLine(line) {
    const trimmed = line.endsWith('\n') ? line.slice(0, -1) : line;
    return JSON.parse(trimmed);
}
