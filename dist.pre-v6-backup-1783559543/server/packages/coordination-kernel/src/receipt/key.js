// Key loading utilities for receipt chain signing/verification
// Shared between logger.ts and verify.ts to eliminate duplication
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createPrivateKeyFromSeed, createPublicKeyFromSeed } from './hasher.js';
/**
 * Check if running in production mode.
 * True if NODE_ENV=production OR AKALYNTH_ENV=production
 */
export function isProductionMode() {
    return (process.env.NODE_ENV === 'production' ||
        process.env.AKALYNTH_ENV === 'production');
}
/**
 * Load Ed25519 signing key seed from file.
 *
 * @param keyPath - Absolute path to key file (32-byte raw seed)
 * @returns Raw 32-byte seed as Uint8Array
 * @throws If file not found, wrong size, or insecure permissions in production
 */
export function loadKeySeed(keyPath) {
    if (!fs.existsSync(keyPath)) {
        throw new Error(`Signing key not found: ${keyPath}`);
    }
    // Permissions check on POSIX only
    if (isProductionMode() && process.platform !== 'win32') {
        const mode = fs.statSync(keyPath).mode & 0o777;
        if ((mode & 0o077) !== 0) {
            throw new Error(`Signing key permissions too open: ${keyPath} (mode ${mode.toString(8)}). Require 0600 or stricter.`);
        }
    }
    const keyBytes = fs.readFileSync(keyPath);
    if (keyBytes.length !== 32) {
        throw new Error(`Invalid signing key at ${keyPath}: expected 32 bytes, got ${keyBytes.length}`);
    }
    return new Uint8Array(keyBytes);
}
/**
 * Load Ed25519 signing key (private key object) from file.
 *
 * @param keyPath - Absolute path to key file (32-byte raw seed)
 * @returns Node.js crypto KeyObject for signing
 */
export function loadSigningKey(keyPath) {
    const seed = loadKeySeed(keyPath);
    return createPrivateKeyFromSeed(seed);
}
/**
 * Load Ed25519 verifying key (public key object) from file.
 *
 * @param keyPath - Absolute path to key file (32-byte raw seed)
 * @returns Node.js crypto KeyObject for verification
 */
export function loadVerifyingKey(keyPath) {
    const seed = loadKeySeed(keyPath);
    return createPublicKeyFromSeed(seed);
}
/**
 * Raw 32-byte Ed25519 verifying-key hex for the signing key at keyPath.
 * Matches ed25519-dalek `verifying_key().as_bytes()` hex (RFC 8032), i.e. the
 * public key the chronicle_append binary and the receipt signer both use. Use
 * this to publish the signing pubkey (transparency) and to verify chronicle/
 * receipt signatures offline.
 */
export function loadVerifyingKeyHex(keyPath) {
    const pub = loadVerifyingKey(keyPath);
    const der = pub.export({ format: 'der', type: 'spki' });
    // SPKI DER for Ed25519 ends with the raw 32-byte public key.
    return Buffer.from(der.subarray(-32)).toString('hex');
}
/**
 * Resolve key path from config or environment.
 * For use in coordination-kernel (generic, not Akalynth-specific).
 *
 * @param configKeyPath - Explicit key path from config (takes precedence)
 * @param envVar - Environment variable name to check (default: CHRONICLE_KEY_PATH)
 * @param defaultPath - Default path if neither config nor env is set
 */
export function resolveKeyPath(configKeyPath, envVar = 'CHRONICLE_KEY_PATH', defaultPath = 'chronicle.key') {
    const envPath = process.env[envVar];
    const keyPath = configKeyPath ?? envPath ?? defaultPath;
    return path.resolve(keyPath);
}
