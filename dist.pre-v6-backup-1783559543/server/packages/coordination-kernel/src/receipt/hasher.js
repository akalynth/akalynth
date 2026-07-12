// Receipt Hashing Utilities
// Chronicle-aligned content addressing and chain integrity verification
import crypto from 'node:crypto';
import { blake3 } from '@noble/hashes/blake3';
import stableStringify from 'fast-json-stable-stringify';
export const GENESIS_MARKER = 'genesis';
// ============================================================================
// Hash Utilities
// ============================================================================
function toHex(bytes) {
    return Buffer.from(bytes).toString('hex');
}
/**
 * Compute raw BLAKE3 bytes.
 */
export function blake3Bytes(data) {
    return blake3(data);
}
/**
 * Compute prefixed BLAKE3 hex for raw bytes.
 */
export function blake3HexBytes(data) {
    return `blake3:${toHex(blake3Bytes(data))}`;
}
function blake3Hex(data) {
    return blake3HexBytes(new TextEncoder().encode(data));
}
/**
 * Serialize value to canonical JSON (deterministic).
 */
export function canonicalize(value) {
    return stableStringify(value);
}
/**
 * Compute BLAKE3 over canonical JSON.
 *
 * This is the receipt-system primitive used by subsystems that need the same
 * `blake3:<hex>` convention without re-implementing hashing locally.
 */
export function hashCanonicalJson(value) {
    return blake3Hex(canonicalize(value));
}
/**
 * Compute inputs hash for a receipt.
 */
export function computeInputsHash(inputs) {
    return hashCanonicalJson(inputs);
}
/**
 * Compute outputs hash for a receipt (result string).
 */
export function computeOutputsHash(result) {
    return hashCanonicalJson(result);
}
/**
 * Compute event hash for a receipt (excluding event_hash/signature).
 */
export function computeEventHash(receipt) {
    const body = {
        ...receipt,
    };
    return hashCanonicalJson(body);
}
/**
 * Serialize receipt to canonical JSONL format (deterministic).
 */
export function serializeReceipt(receipt) {
    return canonicalize(receipt) + '\n';
}
// ============================================================================
// Signature Utilities
// ============================================================================
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
export function createPrivateKeyFromSeed(signingKey) {
    const key = Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(signingKey)]);
    return crypto.createPrivateKey({ key, format: 'der', type: 'pkcs8' });
}
export function createPublicKeyFromSeed(signingKey) {
    const privateKey = createPrivateKeyFromSeed(signingKey);
    return crypto.createPublicKey(privateKey);
}
export function signEvent(prev_hash, event_hash, signingKey) {
    const message = Buffer.from(`${prev_hash}|${event_hash}`);
    const signature = crypto.sign(null, message, signingKey);
    return signature.toString('hex');
}
export function verifyEventSignature(prev_hash, event_hash, signatureHex, publicKey) {
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
export function verifyReceiptHashes(receipt) {
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
export function verifyChainLink(prev, next) {
    return next.prev_hash === prev.event_hash;
}
/**
 * Verify genesis receipt (first in chain).
 */
export function verifyGenesisReceipt(receipt) {
    return receipt.prev_hash === GENESIS_MARKER;
}
