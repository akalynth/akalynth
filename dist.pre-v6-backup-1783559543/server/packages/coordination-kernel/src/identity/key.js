// Identity Key Derivation
// Derives auth signing key from chronicle key with domain separation
import { blake3Bytes, createPrivateKeyFromSeed, createPublicKeyFromSeed } from '../receipt/hasher.js';
import { loadKeySeed, resolveKeyPath } from '../receipt/key.js';
// Domain separator for auth key derivation
// Ensures auth keys cannot be confused with chronicle signing keys
const AUTH_KEY_DOMAIN = 'akalynth/auth/v0';
/**
 * Derive auth signing seed from chronicle key seed.
 * Uses BLAKE3 with domain separation.
 *
 * Formula: auth_seed = BLAKE3("akalynth/auth/v0" || chronicle_seed)
 *
 * @param chronicleSeed - 32-byte chronicle key seed
 * @returns 32-byte auth signing seed
 */
export function deriveAuthSeed(chronicleSeed) {
    if (chronicleSeed.length !== 32) {
        throw new Error(`Chronicle seed must be 32 bytes, got ${chronicleSeed.length}`);
    }
    const domainBytes = new TextEncoder().encode(AUTH_KEY_DOMAIN);
    const input = new Uint8Array(domainBytes.length + chronicleSeed.length);
    input.set(domainBytes, 0);
    input.set(chronicleSeed, domainBytes.length);
    return blake3Bytes(input);
}
/**
 * Derive Ed25519 auth key pair from chronicle key seed.
 *
 * @param chronicleSeed - 32-byte chronicle key seed
 * @returns Object with privateKey and publicKey (crypto.KeyObject)
 */
export function deriveAuthKeyPair(chronicleSeed) {
    const authSeed = deriveAuthSeed(chronicleSeed);
    const privateKey = createPrivateKeyFromSeed(authSeed);
    const publicKey = createPublicKeyFromSeed(authSeed);
    return { privateKey, publicKey };
}
/**
 * Load auth key pair from chronicle key file.
 * Convenience function that handles file loading and derivation.
 *
 * @param keyPath - Optional path to chronicle key file (uses env/default if not provided)
 * @returns Object with privateKey, publicKey, and publicKeyHex
 */
export function loadAuthKeyPair(keyPath) {
    const resolvedPath = resolveKeyPath(keyPath);
    const chronicleSeed = loadKeySeed(resolvedPath);
    const { privateKey, publicKey } = deriveAuthKeyPair(chronicleSeed);
    // Export public key as raw 32-byte hex for transparency endpoint
    const publicKeyDer = publicKey.export({ format: 'der', type: 'spki' });
    // Ed25519 SPKI has 12-byte prefix, raw key is last 32 bytes
    const publicKeyRaw = publicKeyDer.subarray(-32);
    const publicKeyHex = Buffer.from(publicKeyRaw).toString('hex');
    return { privateKey, publicKey, publicKeyHex };
}
/**
 * Get the domain separator used for auth key derivation.
 * Useful for documentation and transparency.
 */
export function getAuthKeyDomain() {
    return AUTH_KEY_DOMAIN;
}
