// Account auth service (E2 / AKALYNTH_ACCOUNT_AUTH_API_V1).
//
// Framework-agnostic business logic for register / login / logout / me /
// password-reset. Returns structured results (status, body, Set-Cookie values) so
// it is unit-testable without a running HTTP server. Security posture per
// docs/account-portal/ACCOUNT_AUTH_SECURITY_MODEL.md:
//   - Argon2id password hashing (injected)
//   - HTTP-only Secure SameSite=Strict session cookie + double-submit CSRF token
//   - uniform responses (no account enumeration) on register / login / reset
//   - tokens stored hashed at rest; privacy-bounded receipts (no PII/secrets)
import { AccountStore } from './store.js';
import { RECEIPT_ACTIONS } from '../persist/types.js';
import {
  newId,
  newToken,
  hashToken,
  safeEqual,
  serializeCookie,
  clearCookie,
} from './tokens.js';

export const SESSION_COOKIE = 'akalynth_session';
export const CSRF_COOKIE = 'akalynth_csrf';

const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AccountConfig {
  secureCookies: boolean;
  sessionTtlSec: number;
  verificationTtlSec: number;
  resetTtlSec: number;
  /** Dev mode returns verification/reset links in the response (no real email yet — E3). */
  devExposeLinks: boolean;
}

export interface AccountServiceDeps {
  store: AccountStore;
  hashPassword: (p: string) => Promise<string>;
  verifyPassword: (encoded: string, p: string) => Promise<boolean>;
  /** Privacy-bounded receipt emit. NEVER pass PII/secrets in inputs. */
  emitReceipt: (e: { action: string; accountId: string | null; inputs?: Record<string, unknown>; result: string }) => void;
  now: () => number;
  config: AccountConfig;
  logLink?: (kind: string, accountId: string, token: string) => void;
}

export interface RequestCtx {
  cookies: Record<string, string>;
  csrfHeader?: string;
  client?: string | null;
}

export interface AccountResponse {
  status: number;
  body: unknown;
  cookies?: string[];
}

const iso = (ms: number) => new Date(ms).toISOString();
const addSec = (ms: number, sec: number) => ms + sec * 1000;

function normalizeEmail(email: string): { email: string; lower: string } | null {
  const trimmed = email.trim();
  if (!EMAIL_RE.test(trimmed) || trimmed.length > 254) return null;
  return { email: trimmed, lower: trimmed.toLowerCase() };
}

function validPassword(p: string): boolean {
  return typeof p === 'string' && p.length >= MIN_PASSWORD_LEN && p.length <= MAX_PASSWORD_LEN;
}

export class AccountService {
  constructor(private readonly d: AccountServiceDeps) {}

  private sessionCookies(token: string, csrf: string): string[] {
    const { secureCookies, sessionTtlSec } = this.d.config;
    return [
      serializeCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'Strict',
        maxAgeSec: sessionTtlSec,
        path: '/',
      }),
      // CSRF token is readable by JS (double-submit); not HttpOnly.
      serializeCookie(CSRF_COOKIE, csrf, {
        httpOnly: false,
        secure: secureCookies,
        sameSite: 'Strict',
        maxAgeSec: sessionTtlSec,
        path: '/',
      }),
    ];
  }

  private clearCookies(): string[] {
    const { secureCookies } = this.d.config;
    return [
      clearCookie(SESSION_COOKIE, { httpOnly: true, secure: secureCookies, sameSite: 'Strict', path: '/' }),
      clearCookie(CSRF_COOKIE, { httpOnly: false, secure: secureCookies, sameSite: 'Strict', path: '/' }),
    ];
  }

  /** POST /v1/accounts/register — uniform response (no enumeration). */
  async register(input: { email?: unknown; password?: unknown }): Promise<AccountResponse> {
    const now = this.d.now();
    // Uniform success body regardless of whether the email already exists.
    const uniform: AccountResponse = {
      status: 200,
      body: { ok: true, message: 'If this email can be registered, a verification link has been sent.' },
    };

    const norm = typeof input.email === 'string' ? normalizeEmail(input.email) : null;
    if (!norm || !validPassword(input.password as string)) {
      // Shape errors (bad email/password) are safe to report without enumeration.
      return { status: 400, body: { ok: false, error: 'invalid_input', message: `Provide a valid email and a password of at least ${MIN_PASSWORD_LEN} characters.` } };
    }

    const existing = this.d.store.findByEmailLower(norm.lower);
    if (existing) {
      // Do not reveal existence; in a fuller flow we'd email "you already have an
      // account". Return the same uniform response.
      return uniform;
    }

    const accountId = newId('acc');
    const passwordHash = await this.d.hashPassword(input.password as string);
    this.d.store.insertAccount({
      account_id: accountId,
      email: norm.email,
      email_lower: norm.lower,
      password_hash: passwordHash,
      status: 'registered_unverified',
      created_at: iso(now),
      created_receipt: null,
    });
    this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_CREATED, accountId, result: 'ok' });

    // Issue an email-verification token (delivery is E3; dev mode logs it).
    const token = newToken();
    this.d.store.insertVerification({
      id: newId('ev'),
      account_id: accountId,
      token_hash: hashToken(token),
      created_at: iso(now),
      expires_at: iso(addSec(now, this.d.config.verificationTtlSec)),
    });
    this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_EMAIL_VERIFICATION_REQUESTED, accountId, result: 'ok' });
    this.d.logLink?.('verify', accountId, token);

    return this.d.config.devExposeLinks
      ? { status: 200, body: { ...(uniform.body as object), dev_verification_token: token } }
      : uniform;
  }

  /** POST /v1/accounts/verify-email — consume a verification token. */
  verifyEmail(input: { token?: unknown }): AccountResponse {
    const now = this.d.now();
    if (typeof input.token !== 'string' || !input.token) {
      return { status: 400, body: { ok: false, error: 'invalid_or_expired' } };
    }
    const row = this.d.store.findVerificationByTokenHash(hashToken(input.token));
    if (!row || row.consumed_at || Date.parse(row.expires_at) <= now) {
      return { status: 400, body: { ok: false, error: 'invalid_or_expired' } };
    }
    this.d.store.consumeVerification(row.id, iso(now));
    this.d.store.setEmailVerified(row.account_id, iso(now));
    this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_EMAIL_VERIFIED, accountId: row.account_id, result: 'ok' });
    return { status: 200, body: { ok: true } };
  }

  /** POST /v1/accounts/login — uniform invalid-credentials; sets session + CSRF cookies. */
  async login(input: { email?: unknown; password?: unknown }, ctx: RequestCtx): Promise<AccountResponse> {
    const now = this.d.now();
    const invalid: AccountResponse = { status: 401, body: { ok: false, error: 'invalid_credentials' } };

    const norm = typeof input.email === 'string' ? normalizeEmail(input.email) : null;
    if (!norm || typeof input.password !== 'string') return invalid;

    const acct = this.d.store.findByEmailLower(norm.lower);
    if (!acct) {
      this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_LOGIN_FAILED, accountId: null, inputs: { reason: 'no_account' }, result: 'rejected' });
      return invalid;
    }
    const ok = await this.d.verifyPassword(acct.password_hash, input.password);
    if (!ok) {
      this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_LOGIN_FAILED, accountId: acct.account_id, inputs: { reason: 'bad_password' }, result: 'rejected' });
      return invalid;
    }
    if (acct.status === 'locked' || acct.status === 'disabled') {
      this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_LOGIN_FAILED, accountId: acct.account_id, inputs: { reason: acct.status }, result: 'rejected' });
      return { status: 403, body: { ok: false, error: 'account_unavailable' } };
    }

    const token = newToken();
    const csrf = newToken(24);
    const sessionId = newId('sess');
    this.d.store.insertSession({
      session_id: sessionId,
      account_id: acct.account_id,
      token_hash: hashToken(token),
      client: ctx.client ?? null,
      created_at: iso(now),
      expires_at: iso(addSec(now, this.d.config.sessionTtlSec)),
    });
    this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_LOGIN_SUCCEEDED, accountId: acct.account_id, result: 'ok' });
    this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_SESSION_ISSUED, accountId: acct.account_id, inputs: { session_id: sessionId }, result: 'ok' });

    return {
      status: 200,
      body: { ok: true, account: { account_id: acct.account_id, email_verified: acct.email_verified === 1, status: acct.status } },
      cookies: this.sessionCookies(token, csrf),
    };
  }

  /** Resolve the active session from the request cookies (not revoked, not expired). */
  private resolveSession(ctx: RequestCtx) {
    const token = ctx.cookies[SESSION_COOKIE];
    if (!token) return null;
    const row = this.d.store.findSessionByTokenHash(hashToken(token));
    if (!row || row.revoked_at || Date.parse(row.expires_at) <= this.d.now()) return null;
    return row;
  }

  /**
   * Public session→account resolver for other routers (e.g. the E4 character
   * API): returns the opaque account_id + email_verified, or null if no valid
   * session. Never exposes the session token or any PII.
   */
  sessionAccount(cookies: Record<string, string>): { accountId: string; emailVerified: boolean } | null {
    const session = this.resolveSession({ cookies });
    if (!session) return null;
    const acct = this.d.store.findById(session.account_id);
    if (!acct) return null;
    return { accountId: acct.account_id, emailVerified: acct.email_verified === 1 };
  }

  /** GET /v1/accounts/me — current account from the session cookie. */
  me(ctx: RequestCtx): AccountResponse {
    const session = this.resolveSession(ctx);
    if (!session) return { status: 401, body: { ok: false, error: 'not_authenticated' } };
    const acct = this.d.store.findById(session.account_id);
    if (!acct) return { status: 401, body: { ok: false, error: 'not_authenticated' } };
    return {
      status: 200,
      body: { ok: true, account: { account_id: acct.account_id, email_verified: acct.email_verified === 1, status: acct.status, created_at: acct.created_at } },
    };
  }

  /** POST /v1/accounts/logout — requires session + matching CSRF double-submit. */
  logout(ctx: RequestCtx): AccountResponse {
    const session = this.resolveSession(ctx);
    if (!session) return { status: 401, body: { ok: false, error: 'not_authenticated' } };
    const csrfCookie = ctx.cookies[CSRF_COOKIE];
    if (!csrfCookie || !ctx.csrfHeader || !safeEqual(csrfCookie, ctx.csrfHeader)) {
      return { status: 403, body: { ok: false, error: 'csrf_failed' } };
    }
    this.d.store.revokeSession(session.session_id, iso(this.d.now()));
    this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_SESSION_REVOKED, accountId: session.account_id, inputs: { session_id: session.session_id }, result: 'ok' });
    return { status: 200, body: { ok: true }, cookies: this.clearCookies() };
  }

  /** POST /v1/accounts/password-reset/request — uniform response (no enumeration). */
  resetRequest(input: { email?: unknown }): AccountResponse {
    const now = this.d.now();
    const uniform: AccountResponse = { status: 200, body: { ok: true, message: 'If this email has an account, a reset link has been sent.' } };
    const norm = typeof input.email === 'string' ? normalizeEmail(input.email) : null;
    if (!norm) return uniform;
    const acct = this.d.store.findByEmailLower(norm.lower);
    if (!acct) return uniform;

    const token = newToken();
    this.d.store.insertReset({
      id: newId('pr'),
      account_id: acct.account_id,
      token_hash: hashToken(token),
      created_at: iso(now),
      expires_at: iso(addSec(now, this.d.config.resetTtlSec)),
    });
    this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_PASSWORD_RESET_REQUESTED, accountId: acct.account_id, result: 'ok' });
    this.d.logLink?.('reset', acct.account_id, token);
    return this.d.config.devExposeLinks ? { status: 200, body: { ...(uniform.body as object), dev_reset_token: token } } : uniform;
  }

  /** POST /v1/accounts/password-reset/confirm — consume reset token, rotate password, revoke sessions. */
  async resetConfirm(input: { token?: unknown; password?: unknown }): Promise<AccountResponse> {
    const now = this.d.now();
    const invalid: AccountResponse = { status: 400, body: { ok: false, error: 'invalid_or_expired' } };
    if (typeof input.token !== 'string' || !input.token) return invalid;
    if (!validPassword(input.password as string)) {
      return { status: 400, body: { ok: false, error: 'invalid_input', message: `Password must be at least ${MIN_PASSWORD_LEN} characters.` } };
    }
    const row = this.d.store.findResetByTokenHash(hashToken(input.token));
    if (!row || row.consumed_at || Date.parse(row.expires_at) <= now) return invalid;

    const passwordHash = await this.d.hashPassword(input.password as string);
    this.d.store.updatePasswordHash(row.account_id, passwordHash, iso(now));
    this.d.store.consumeReset(row.id, iso(now));
    this.d.store.revokeAllSessions(row.account_id, iso(now)); // a reset logs out everywhere
    this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_PASSWORD_RESET_COMPLETED, accountId: row.account_id, result: 'ok' });
    return { status: 200, body: { ok: true } };
  }
}
