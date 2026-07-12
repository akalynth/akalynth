// Identity Token Signing and Verification
// Ed25519 signed stateless tokens for authentication
import crypto from 'node:crypto';
import { blake3HexBytes, canonicalize } from '../receipt/hasher.js';
const TOKEN_ID_DOMAIN = 'akalynth/token_id/v0';
// Default TTL: 1 hour
export const DEFAULT_TOKEN_TTL_MS = 3600000;
// Maximum TTL: 24 hours (server policy, hard cap)
export const MAX_TOKEN_TTL_MS = 86400000;
/**
 * Generate a cryptographically random nonce (16 bytes hex).
 */
export function generateNonce() {
    return crypto.randomBytes(16).toString('hex');
}
/**
 * Compute deterministic token ID from stable inputs.
 * token_id = BLAKE3("akalynth/token_id/v0" || player_id || issued_at || nonce)
 */
export function computeTokenId(playerId, issuedAt, nonce) {
    const domainBytes = new TextEncoder().encode(TOKEN_ID_DOMAIN);
    const playerIdBytes = new TextEncoder().encode(playerId);
    const issuedAtBytes = new TextEncoder().encode(issuedAt.toString());
    const nonceBytes = new TextEncoder().encode(nonce);
    const combined = new Uint8Array(domainBytes.length + playerIdBytes.length + issuedAtBytes.length + nonceBytes.length);
    let offset = 0;
    combined.set(domainBytes, offset);
    offset += domainBytes.length;
    combined.set(playerIdBytes, offset);
    offset += playerIdBytes.length;
    combined.set(issuedAtBytes, offset);
    offset += issuedAtBytes.length;
    combined.set(nonceBytes, offset);
    return blake3HexBytes(combined);
}
/**
 * Create a signed auth token.
 */
export function signToken(playerId, authPrivateKey, options) {
    const nowMs = options?.nowMs ?? Date.now();
    const ttlMs = Math.min(options?.ttlMs ?? DEFAULT_TOKEN_TTL_MS, MAX_TOKEN_TTL_MS);
    const nonce = options?.nonce ?? generateNonce();
    const payload = {
        token_id: computeTokenId(playerId, nowMs, nonce),
        player_id: playerId,
        issued_at: nowMs,
        expires_at: nowMs + ttlMs,
        nonce,
    };
    // Canonical JSON for deterministic payload encoding
    const payloadJson = canonicalize(payload);
    const payloadB64 = Buffer.from(payloadJson, 'utf-8').toString('base64url');
    // Sign the encoded payload bytes to authenticate the wire format
    const signature = crypto.sign(null, Buffer.from(payloadB64, 'utf-8'), authPrivateKey);
    const signatureHex = signature.toString('hex');
    const signatureB64 = signature.toString('base64url');
    // Wire format: base64url(payload) + '.' + base64url(signature)
    const wire = `${payloadB64}.${signatureB64}`;
    return { payload, signature: signatureHex, wire };
}
/**
 * Parse and verify a signed auth token.
 */
export function verifyToken(wire, authPublicKey, options) {
    const nowMs = options?.nowMs ?? Date.now();
    const maxTtlMs = options?.maxTtlMs ?? MAX_TOKEN_TTL_MS;
    const allowLegacyCanonical = options?.allowLegacyCanonical ?? true;
    // Parse wire format
    const dotIndex = wire.indexOf('.');
    if (dotIndex <= 0 ||
        dotIndex !== wire.lastIndexOf('.') ||
        dotIndex >= wire.length - 1) {
        return { ok: false, error: 'malformed' };
    }
    const payloadB64 = wire.slice(0, dotIndex);
    const signatureB64 = wire.slice(dotIndex + 1);
    let payloadJson;
    let payload;
    let signatureBytes;
    try {
        payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
        payload = JSON.parse(payloadJson);
        signatureBytes = Buffer.from(signatureB64, 'base64url');
    }
    catch {
        return { ok: false, error: 'malformed' };
    }
    if (signatureBytes.length !== 64) {
        return { ok: false, error: 'malformed' };
    }
    // Validate required fields
    if (typeof payload.token_id !== 'string' ||
        typeof payload.player_id !== 'string' ||
        typeof payload.issued_at !== 'number' ||
        typeof payload.expires_at !== 'number' ||
        typeof payload.nonce !== 'string') {
        return { ok: false, error: 'malformed' };
    }
    // Verify signature over payload_b64 (wire-authenticated)
    let isValid = crypto.verify(null, Buffer.from(payloadB64, 'utf-8'), authPublicKey, signatureBytes);
    if (!isValid && allowLegacyCanonical) {
        // Legacy fallback: canonical JSON signature (pre-wire-authenticated tokens)
        const canonicalPayload = canonicalize(payload);
        isValid = crypto.verify(null, Buffer.from(canonicalPayload), authPublicKey, signatureBytes);
    }
    if (!isValid) {
        return { ok: false, error: 'invalid_signature' };
    }
    // Check expiry
    if (payload.expires_at <= nowMs) {
        return { ok: false, error: 'expired' };
    }
    // Enforce max TTL policy
    const ttl = payload.expires_at - payload.issued_at;
    if (ttl > maxTtlMs) {
        return { ok: false, error: 'ttl_exceeded' };
    }
    // Verify token_id integrity
    const expectedTokenId = computeTokenId(payload.player_id, payload.issued_at, payload.nonce);
    if (payload.token_id !== expectedTokenId) {
        return { ok: false, error: 'malformed' };
    }
    return { ok: true, payload };
}
