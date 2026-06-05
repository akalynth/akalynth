// Token, cookie, and id helpers for the account API (E2).
//
// Plaintext tokens (session / email-verification / password-reset) exist only in
// transit (cookie or email). At rest we store ONLY their sha256 hash, so a DB
// leak cannot replay a session or consume a verification/reset link.
import { randomBytes, createHash, timingSafeEqual, randomUUID } from 'node:crypto';

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

/** Opaque, URL-safe random token (the plaintext handed to the client/email). */
export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Deterministic hash for at-rest storage of a token (never store plaintext). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time string compare (for CSRF double-submit). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// ---- Cookies (zero-dep; the http layer has no cookie middleware) ----

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export interface CookieOptions {
  maxAgeSec?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
}

export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${opts.path ?? '/'}`];
  if (opts.maxAgeSec !== undefined) parts.push(`Max-Age=${opts.maxAgeSec}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite ?? 'Strict'}`);
  return parts.join('; ');
}

/** A Set-Cookie value that clears a cookie. */
export function clearCookie(name: string, opts: CookieOptions = {}): string {
  return serializeCookie(name, '', { ...opts, maxAgeSec: 0 });
}
