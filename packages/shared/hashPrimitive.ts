import { blake3 } from '@noble/hashes/blake3';
import stableStringify from 'fast-json-stable-stringify';

/**
 * Canonical JSON used by Akalynth hash preimages: sorted keys, no whitespace.
 */
export function canonicalJson(value: unknown): string {
  return stableStringify(value);
}

/**
 * Raw BLAKE3 digest bytes.
 */
export function blake3Bytes(value: Uint8Array): Uint8Array {
  return blake3(value);
}

/**
 * Raw BLAKE3 hex of bytes, without the `blake3:` prefix.
 */
export function blake3HexBytes(value: Uint8Array): string {
  return Buffer.from(blake3Bytes(value)).toString('hex');
}

/**
 * Raw BLAKE3 hex of a UTF-8 string, without the `blake3:` prefix.
 */
export function blake3HexUtf8(value: string): string {
  return blake3HexBytes(Buffer.from(value, 'utf8'));
}

/**
 * Akalynth-prefixed BLAKE3 hash of a UTF-8 string.
 */
export function blake3Prefixed(value: string): string {
  return `blake3:${blake3HexUtf8(value)}`;
}
