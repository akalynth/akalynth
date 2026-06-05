// Browser-local identity for the web client (issue #148). Mirrors the Android
// IdentityStore: persists the player's signed auth token so a created character
// survives reloads, and rotates it when the server returns a fresh token on
// login_ack. Guest play needs none of this — it is the fallback when no token
// is stored.
//
// Tokens here are short-lived BEARER tokens, not secrets/keys: kept in
// localStorage and never logged.

export interface StoredIdentity {
  playerId: string;
  name: string;
  token: string;
  expiresAt: number; // epoch ms
}

const KEY = 'akalynth.identity.v1';

export function loadIdentity(): StoredIdentity | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<StoredIdentity>;
    if (
      typeof v.playerId !== 'string' ||
      typeof v.name !== 'string' ||
      typeof v.token !== 'string' ||
      typeof v.expiresAt !== 'number'
    ) {
      return null;
    }
    return { playerId: v.playerId, name: v.name, token: v.token, expiresAt: v.expiresAt };
  } catch {
    return null;
  }
}

export function saveIdentity(identity: StoredIdentity): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // localStorage unavailable (private mode / SSR) — identity stays in-memory.
  }
}

export function clearIdentity(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** True when the stored token is present and not expired. */
export function hasValidToken(identity: StoredIdentity | null, nowMs: number = Date.now()): boolean {
  return !!identity && identity.token.length > 0 && identity.expiresAt > nowMs;
}
