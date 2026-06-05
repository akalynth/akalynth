// apps/server/src/api/cors.ts
// CORS allowlist for the account portal (E5 companion / AKALYNTH_ACCOUNT_CORS_V1).
//
// The static website (akalynth.com) is a separate origin from this API
// (api.akalynth.com) and signs in with HttpOnly cookie sessions, so its fetch
// uses `credentials: 'include'`. That requires the API to answer cross-origin
// preflight + actual requests with an explicit, echoed `Access-Control-Allow-
// Origin` and `Access-Control-Allow-Credentials: true`.
//
// Security invariant (per ACCOUNT_AUTH_SECURITY_MODEL): with credentials we
// MUST NOT use the `*` wildcard. Only origins on an explicit allowlist are
// reflected. The website + API are same-site subdomains, so SameSite=Strict
// cookies are still sent; CORS is what authorizes the cross-*origin* read.

/** Headers echoed when an origin is allowed. Keys are lowercased for Node. */
export interface CorsHeaders {
  'access-control-allow-origin': string;
  'access-control-allow-credentials': 'true';
  'access-control-allow-methods': string;
  'access-control-allow-headers': string;
  'access-control-max-age': string;
  vary: 'Origin';
}

// GET/POST cover the portal surface; OPTIONS is the preflight itself.
export const CORS_ALLOW_METHODS = 'GET,POST,OPTIONS';
// content-type (JSON bodies), authorization (bearer reads), x-csrf-token
// (double-submit on state-changing account/character calls).
export const CORS_ALLOW_HEADERS = 'authorization,content-type,x-csrf-token';
export const CORS_MAX_AGE = '600';

/**
 * Normalize to `scheme://host[:port]` (lowercased, default ports dropped) so
 * allowlist comparison is canonical. Returns null for anything that isn't a
 * plain http/https origin (no path/query/userinfo survives URL.origin).
 */
export function normalizeOrigin(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Parse a comma-separated origin allowlist (e.g. ACCOUNT_CORS_ORIGINS). Falls
 * back to `defaults` when unset/blank. Invalid entries are dropped.
 */
export function parseCorsOrigins(value: string | undefined, defaults: readonly string[]): Set<string> {
  const source = value && value.trim() ? value.split(',') : defaults;
  const set = new Set<string>();
  for (const part of source) {
    const norm = normalizeOrigin(String(part).trim());
    if (norm) set.add(norm);
  }
  return set;
}

export interface CorsPolicy {
  /** Canonical (normalized) allowed origins. */
  allow: Set<string>;
  /** When true, localhost/127.0.0.1/::1 origins are additionally allowed. */
  allowLocalDev: boolean;
}

/** True for loopback dev origins regardless of port. */
export function isLocalDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return (
      (u.protocol === 'http:' || u.protocol === 'https:') &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1')
    );
  } catch {
    return false;
  }
}

/** Whether this Origin may make credentialed cross-origin requests. */
export function corsOriginAllowed(origin: string, policy: CorsPolicy): boolean {
  const norm = normalizeOrigin(origin);
  if (!norm) return false;
  if (policy.allow.has(norm)) return true;
  if (policy.allowLocalDev && isLocalDevOrigin(origin)) return true;
  return false;
}

/**
 * Build the CORS headers to echo for a request Origin, or null when the origin
 * is absent/disallowed (caller then emits no CORS headers — browser blocks it).
 * The exact request Origin is reflected (never `*`) per the credentials rule.
 */
export function corsHeadersFor(origin: string | undefined, policy: CorsPolicy): CorsHeaders | null {
  if (typeof origin !== 'string' || !corsOriginAllowed(origin, policy)) return null;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': CORS_ALLOW_METHODS,
    'access-control-allow-headers': CORS_ALLOW_HEADERS,
    'access-control-max-age': CORS_MAX_AGE,
    vary: 'Origin',
  };
}
