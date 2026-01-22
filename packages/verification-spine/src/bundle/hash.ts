/**
 * Bundle Hash Computation
 *
 * Computes file hashes for bundle integrity verification.
 * Supports SHA-256 and BLAKE3.
 */

import * as fs from 'node:fs';
import { sha256 } from '@noble/hashes/sha256';
import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex } from '@noble/hashes/utils';

export type HashAlgorithm = 'sha256' | 'blake3';

/**
 * Parse hash string with prefix (e.g., "sha256:abc123...")
 * Returns { algorithm, hash } or null if invalid format
 */
export function parseHashString(hashStr: string): { algorithm: HashAlgorithm; hash: string } | null {
  const match = hashStr.match(/^(sha256|blake3):([0-9a-fA-F]{64})$/);
  if (!match) return null;

  return {
    algorithm: match[1] as HashAlgorithm,
    hash: match[2].toLowerCase(), // Normalize to lowercase
  };
}

/**
 * Compute hash of a file
 * @param algorithm - Hash algorithm to use
 * @param absPath - Absolute path to file
 * @returns Hash string with prefix (e.g., "sha256:abc123...")
 */
export function hashFile(algorithm: HashAlgorithm, absPath: string): string {
  const fileBytes = fs.readFileSync(absPath);

  let hashBytes: Uint8Array;
  switch (algorithm) {
    case 'sha256':
      hashBytes = sha256(fileBytes);
      break;
    case 'blake3':
      hashBytes = blake3(fileBytes);
      break;
    default:
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }

  const hexHash = bytesToHex(hashBytes);
  return `${algorithm}:${hexHash}`;
}

/**
 * Verify a file hash matches expected value
 * @param expectedHash - Expected hash with prefix (e.g., "sha256:abc123...")
 * @param absPath - Absolute path to file
 * @returns { ok: true } or { ok: false, actual: string }
 */
export function verifyFileHash(
  expectedHash: string,
  absPath: string
): { ok: true } | { ok: false; actual: string } {
  const parsed = parseHashString(expectedHash);
  if (!parsed) {
    throw new Error(`Invalid hash format: ${expectedHash}`);
  }

  const actualHash = hashFile(parsed.algorithm, absPath);

  if (actualHash.toLowerCase() === expectedHash.toLowerCase()) {
    return { ok: true };
  } else {
    return { ok: false, actual: actualHash };
  }
}
