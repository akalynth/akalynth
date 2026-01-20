// Key loading utilities for receipt chain signing/verification
// Shared between logger.ts and verify.ts to eliminate duplication

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createPrivateKeyFromSeed, createPublicKeyFromSeed } from './hasher.js';

/**
 * Check if running in production mode.
 * True if NODE_ENV=production OR AKALYNTH_ENV=production
 */
export function isProductionMode(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.AKALYNTH_ENV === 'production'
  );
}

/**
 * Load Ed25519 signing key seed from file.
 *
 * @param keyPath - Absolute path to key file (32-byte raw seed)
 * @returns Raw 32-byte seed as Uint8Array
 * @throws If file not found, wrong size, or insecure permissions in production
 */
export function loadKeySeed(keyPath: string): Uint8Array {
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Signing key not found: ${keyPath}`);
  }

  // Permissions check on POSIX only
  if (isProductionMode() && process.platform !== 'win32') {
    const mode = fs.statSync(keyPath).mode & 0o777;
    if ((mode & 0o077) !== 0) {
      throw new Error(
        `Signing key permissions too open: ${keyPath} (mode ${mode.toString(8)}). Require 0600 or stricter.`
      );
    }
  }

  const keyBytes = fs.readFileSync(keyPath);
  if (keyBytes.length !== 32) {
    throw new Error(
      `Invalid signing key at ${keyPath}: expected 32 bytes, got ${keyBytes.length}`
    );
  }

  return new Uint8Array(keyBytes);
}

/**
 * Load Ed25519 signing key (private key object) from file.
 *
 * @param keyPath - Absolute path to key file (32-byte raw seed)
 * @returns Node.js crypto KeyObject for signing
 */
export function loadSigningKey(keyPath: string) {
  const seed = loadKeySeed(keyPath);
  return createPrivateKeyFromSeed(seed);
}

/**
 * Load Ed25519 verifying key (public key object) from file.
 *
 * @param keyPath - Absolute path to key file (32-byte raw seed)
 * @returns Node.js crypto KeyObject for verification
 */
export function loadVerifyingKey(keyPath: string) {
  const seed = loadKeySeed(keyPath);
  return createPublicKeyFromSeed(seed);
}

/**
 * Resolve key path from config or environment.
 * For use in coordination-kernel (generic, not Akalynth-specific).
 *
 * @param configKeyPath - Explicit key path from config (takes precedence)
 * @param envVar - Environment variable name to check (default: CHRONICLE_KEY_PATH)
 * @param defaultPath - Default path if neither config nor env is set
 */
export function resolveKeyPath(
  configKeyPath?: string,
  envVar = 'CHRONICLE_KEY_PATH',
  defaultPath = 'chronicle.key'
): string {
  const envPath = process.env[envVar];
  const keyPath = configKeyPath ?? envPath ?? defaultPath;
  return path.resolve(keyPath);
}
