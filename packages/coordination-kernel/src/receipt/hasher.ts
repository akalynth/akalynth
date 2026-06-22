// Receipt Hashing Utilities
// Chronicle-aligned content addressing and chain integrity verification

import crypto from 'node:crypto';
import { blake3 } from '@noble/hashes/blake3';
import stableStringify from 'fast-json-stable-stringify';
import type { CoordinationReceipt } from '../types.js';

export const GENESIS_MARKER = 'genesis';

// ============================================================================
// Hash Utilities
// ============================================================================

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

/**
 * Compute raw BLAKE3 bytes.
 */
export function blake3Bytes(data: Uint8Array): Uint8Array {
  return blake3(data);
}

/**
 * Compute prefixed BLAKE3 hex for raw bytes.
 */
export function blake3HexBytes(data: Uint8Array): string {
  return `blake3:${toHex(blake3Bytes(data))}`;
}

function blake3Hex(data: string): string {
  return blake3HexBytes(new TextEncoder().encode(data));
}

/**
 * Serialize value to canonical JSON (deterministic).
 */
export function canonicalize(value: unknown): string {
  return stableStringify(value);
}

/**
 * Compute BLAKE3 over canonical JSON.
 *
 * This is the receipt-system primitive used by subsystems that need the same
 * `blake3:<hex>` convention without re-implementing hashing locally.
 */
export function hashCanonicalJson(value: unknown): string {
  return blake3Hex(canonicalize(value));
}

/**
 * Compute inputs hash for a receipt.
 */
export function computeInputsHash(inputs: Record<string, unknown>): string {
  return hashCanonicalJson(inputs);
}

/**
 * Compute outputs hash for a receipt (result string).
 */
export function computeOutputsHash(result: string): string {
  return hashCanonicalJson(result);
}

/**
 * Compute event hash for a receipt (excluding event_hash/signature).
 */
export function computeEventHash(
  receipt: Omit<CoordinationReceipt, 'event_hash' | 'signature'>
): string {
  const body = {
    ...receipt,
  };
  return hashCanonicalJson(body);
}

/**
 * Serialize receipt to canonical JSONL format (deterministic).
 */
export function serializeReceipt(receipt: CoordinationReceipt): string {
  return canonicalize(receipt) + '\n';
}

// ============================================================================
// Signature Utilities
// ============================================================================

const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export function createPrivateKeyFromSeed(signingKey: Uint8Array): crypto.KeyObject {
  const key = Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(signingKey)]);
  return crypto.createPrivateKey({ key, format: 'der', type: 'pkcs8' });
}

export function createPublicKeyFromSeed(signingKey: Uint8Array): crypto.KeyObject {
  const privateKey = createPrivateKeyFromSeed(signingKey);
  return crypto.createPublicKey(privateKey);
}

export function signEvent(prev_hash: string, event_hash: string, signingKey: crypto.KeyObject): string {
  const message = Buffer.from(`${prev_hash}|${event_hash}`);
  const signature = crypto.sign(null, message, signingKey);
  return signature.toString('hex');
}

export function verifyEventSignature(
  prev_hash: string,
  event_hash: string,
  signatureHex: string,
  publicKey: crypto.KeyObject
): boolean {
  const message = Buffer.from(`${prev_hash}|${event_hash}`);
  const signatureBytes = Buffer.from(signatureHex, 'hex');
  return crypto.verify(null, message, publicKey, signatureBytes);
}

// ============================================================================
// Integrity Checks
// ============================================================================

/**
 * Verify receipt hashes (inputs/output/event) integrity.
 */
export function verifyReceiptHashes(receipt: CoordinationReceipt): {
  ok: boolean;
  reason?: string;
} {
  const expectedInputsHash = computeInputsHash(receipt.inputs);
  if (receipt.inputs_hash !== expectedInputsHash) {
    return { ok: false, reason: 'inputs_hash_mismatch' };
  }

  const expectedOutputsHash = computeOutputsHash(receipt.result);
  if (receipt.outputs_hash !== expectedOutputsHash) {
    return { ok: false, reason: 'outputs_hash_mismatch' };
  }

  const { event_hash: _event, signature: _sig, ...body } = receipt;
  const expectedEventHash = computeEventHash(body);
  if (receipt.event_hash !== expectedEventHash) {
    return { ok: false, reason: 'event_hash_mismatch' };
  }

  return { ok: true };
}

/**
 * Verify chain integrity between two consecutive receipts.
 */
export function verifyChainLink(prev: CoordinationReceipt, next: CoordinationReceipt): boolean {
  return next.prev_hash === prev.event_hash;
}

/**
 * Verify genesis receipt (first in chain).
 */
export function verifyGenesisReceipt(receipt: CoordinationReceipt): boolean {
  return receipt.prev_hash === GENESIS_MARKER;
}
