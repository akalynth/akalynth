// Identity Token Signing and Verification
// Ed25519 signed stateless tokens for authentication

import crypto from 'node:crypto';
import { blake3 } from '@noble/hashes/blake3';
import { canonicalize } from '../receipt/hasher.js';

const TOKEN_ID_DOMAIN = 'akalynth/token_id/v0';

// Default TTL: 1 hour
export const DEFAULT_TOKEN_TTL_MS = 3600000;
// Maximum TTL: 24 hours (server policy, hard cap)
export const MAX_TOKEN_TTL_MS = 86400000;

/**
 * Token payload stored in the wire format.
 */
export interface AuthTokenPayload {
  token_id: string;      // BLAKE3 hash of (player_id + issued_at + nonce)
  player_id: string;     // p_UUID
  issued_at: number;     // epoch ms
  expires_at: number;    // epoch ms
  nonce: string;         // 16-byte hex (captured in receipt for determinism)
}

/**
 * Signed token with wire format for transmission.
 */
export interface SignedToken {
  payload: AuthTokenPayload;
  signature: string;     // hex-encoded Ed25519 signature
  wire: string;          // base64url(payload) + '.' + base64url(signature)
}

/**
 * Token verification result.
 */
export type TokenVerifyResult =
  | { ok: true; payload: AuthTokenPayload }
  | { ok: false; error: 'malformed' | 'invalid_signature' | 'expired' | 'ttl_exceeded' };

/**
 * Generate a cryptographically random nonce (16 bytes hex).
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Compute deterministic token ID from stable inputs.
 * token_id = BLAKE3("akalynth/token_id/v0" || player_id || issued_at || nonce)
 */
export function computeTokenId(playerId: string, issuedAt: number, nonce: string): string {
  const domainBytes = new TextEncoder().encode(TOKEN_ID_DOMAIN);
  const playerIdBytes = new TextEncoder().encode(playerId);
  const issuedAtBytes = new TextEncoder().encode(issuedAt.toString());
  const nonceBytes = new TextEncoder().encode(nonce);

  const combined = new Uint8Array(
    domainBytes.length + playerIdBytes.length + issuedAtBytes.length + nonceBytes.length
  );
  let offset = 0;
  combined.set(domainBytes, offset); offset += domainBytes.length;
  combined.set(playerIdBytes, offset); offset += playerIdBytes.length;
  combined.set(issuedAtBytes, offset); offset += issuedAtBytes.length;
  combined.set(nonceBytes, offset);

  const hashBytes = blake3(combined);
  return `blake3:${Buffer.from(hashBytes).toString('hex')}`;
}

/**
 * Create a signed auth token.
 */
export function signToken(
  playerId: string,
  authPrivateKey: crypto.KeyObject,
  options?: {
    ttlMs?: number;
    nowMs?: number;
    nonce?: string; // Allow deterministic nonce for testing
  }
): SignedToken {
  const nowMs = options?.nowMs ?? Date.now();
  const ttlMs = Math.min(options?.ttlMs ?? DEFAULT_TOKEN_TTL_MS, MAX_TOKEN_TTL_MS);
  const nonce = options?.nonce ?? generateNonce();

  const payload: AuthTokenPayload = {
    token_id: computeTokenId(playerId, nowMs, nonce),
    player_id: playerId,
    issued_at: nowMs,
    expires_at: nowMs + ttlMs,
    nonce,
  };

  // Canonical JSON for deterministic signing
  const payloadJson = canonicalize(payload);
  const payloadB64 = Buffer.from(payloadJson).toString('base64url');

  // Sign the canonical payload JSON
  const signature = crypto.sign(null, Buffer.from(payloadJson), authPrivateKey);
  const signatureHex = signature.toString('hex');
  const signatureB64 = signature.toString('base64url');

  // Wire format: base64url(payload) + '.' + base64url(signature)
  const wire = `${payloadB64}.${signatureB64}`;

  return { payload, signature: signatureHex, wire };
}

/**
 * Parse and verify a signed auth token.
 */
export function verifyToken(
  wire: string,
  authPublicKey: crypto.KeyObject,
  options?: {
    nowMs?: number;
    maxTtlMs?: number;
  }
): TokenVerifyResult {
  const nowMs = options?.nowMs ?? Date.now();
  const maxTtlMs = options?.maxTtlMs ?? MAX_TOKEN_TTL_MS;

  // Parse wire format
  const parts = wire.split('.');
  if (parts.length !== 2) {
    return { ok: false, error: 'malformed' };
  }

  const [payloadB64, signatureB64] = parts;

  let payloadJson: string;
  let payload: AuthTokenPayload;
  let signatureBytes: Buffer;

  try {
    payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    payload = JSON.parse(payloadJson) as AuthTokenPayload;
    signatureBytes = Buffer.from(signatureB64, 'base64url');
  } catch {
    return { ok: false, error: 'malformed' };
  }

  // Validate required fields
  if (
    typeof payload.token_id !== 'string' ||
    typeof payload.player_id !== 'string' ||
    typeof payload.issued_at !== 'number' ||
    typeof payload.expires_at !== 'number' ||
    typeof payload.nonce !== 'string'
  ) {
    return { ok: false, error: 'malformed' };
  }

  // Verify signature over canonical payload
  const canonicalPayload = canonicalize(payload);
  const isValid = crypto.verify(null, Buffer.from(canonicalPayload), authPublicKey, signatureBytes);
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
