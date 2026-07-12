import { RECEIPT_ACTIONS } from '../persist/types.js';
import { newId, newToken, hashToken, safeEqual, serializeCookie, clearCookie, } from './tokens.js';
export const SESSION_COOKIE = 'akalynth_session';
export const CSRF_COOKIE = 'akalynth_csrf';
// Operator Codex surface gating (AKALYNTH_OPERATOR_CODEX_GATE_V1): which account
// roles may view each surface. 'admin' implies all; operators also see 'agent'.
export const SURFACE_ROLE_MAP = {
    operator: ['admin', 'operator'],
    builder: ['admin', 'builder'],
    agent: ['admin', 'operator', 'agent'],
};
export const ADMIN_LOGIN_PATH = '/operator/login';
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const iso = (ms) => new Date(ms).toISOString();
const addSec = (ms, sec) => ms + sec * 1000;
function normalizeEmail(email) {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed) || trimmed.length > 254)
        return null;
    return { email: trimmed, lower: trimmed.toLowerCase() };
}
// Nickname (handle) rules mirror the principal system (principal/service.ts): 3–32
// chars, letters/digits/_/-, starting with a letter; a small reserved set is denied.
const HANDLE_RE = /^[A-Za-z][A-Za-z0-9_-]{2,31}$/;
const RESERVED_HANDLES = new Set(['admin', 'moderator', 'project', 'system', 'support', 'official', 'akalynth']);
function normalizeHandle(handle) {
    const trimmed = handle.trim();
    if (!HANDLE_RE.test(trimmed))
        return null;
    const lower = trimmed.toLowerCase();
    if (RESERVED_HANDLES.has(lower) || lower.startsWith('guest_') || lower.startsWith('deleted_'))
        return null;
    return { handle: trimmed, lower };
}
function validPassword(p) {
    return typeof p === 'string' && p.length >= MIN_PASSWORD_LEN && p.length <= MAX_PASSWORD_LEN;
}
/** Parse the accounts.roles JSON column into a string[]; defaults to ['player']. */
function parseAccountRoles(rolesJson) {
    if (typeof rolesJson !== 'string' || !rolesJson)
        return ['player'];
    try {
        const v = JSON.parse(rolesJson);
        if (Array.isArray(v))
            return v.filter((r) => typeof r === 'string');
    }
    catch {
        // fall through
    }
    return ['player'];
}
export class AccountService {
    d;
    constructor(d) {
        this.d = d;
    }
    sessionCookies(token, csrf) {
        const { secureCookies, sessionTtlSec, csrfCookieDomain } = this.d.config;
        return [
            serializeCookie(SESSION_COOKIE, token, {
                httpOnly: true,
                secure: secureCookies,
                sameSite: 'Strict',
                maxAgeSec: sessionTtlSec,
                path: '/',
            }),
            // CSRF token is readable by the static portal (double-submit); not HttpOnly.
            serializeCookie(CSRF_COOKIE, csrf, {
                httpOnly: false,
                secure: secureCookies,
                sameSite: 'Strict',
                maxAgeSec: sessionTtlSec,
                path: '/',
                domain: csrfCookieDomain,
            }),
        ];
    }
    clearCookies() {
        const { secureCookies, csrfCookieDomain } = this.d.config;
        return [
            clearCookie(SESSION_COOKIE, { httpOnly: true, secure: secureCookies, sameSite: 'Strict', path: '/' }),
            clearCookie(CSRF_COOKIE, { httpOnly: false, secure: secureCookies, sameSite: 'Strict', path: '/', domain: csrfCookieDomain }),
        ];
    }
    /**
     * POST /v1/accounts/register — nickname-or-email signup.
     * Nickname (handle) is the primary identifier; email is OPTIONAL and verified
     * later (a non-blocking lane). At least one of handle/email is required, plus a
     * valid password. Handle uniqueness is disclosed (handle_taken) — handles are
     * inherently enumerable, like the principal API. Email keeps the uniform,
     * no-enumeration response and is only attached if free. Backward-compatible:
     * `{ email, password }` (no handle) still works for existing clients.
     */
    async register(input) {
        const now = this.d.now();
        if (!validPassword(input.password)) {
            return { status: 400, body: { ok: false, error: 'invalid_input', message: `Provide a password of at least ${MIN_PASSWORD_LEN} characters.` } };
        }
        const wantsHandle = typeof input.handle === 'string' && input.handle.trim() !== '';
        const wantsEmail = typeof input.email === 'string' && input.email.trim() !== '';
        if (!wantsHandle && !wantsEmail) {
            return { status: 400, body: { ok: false, error: 'invalid_input', message: 'Provide a nickname or an email.' } };
        }
        // Handle: validate + uniqueness (explicit errors).
        let handle = null;
        let handleLower = null;
        if (wantsHandle) {
            const h = normalizeHandle(input.handle);
            if (!h) {
                return { status: 400, body: { ok: false, error: 'invalid_handle', message: 'Nickname must be 3-32 characters: letters, digits, _ or -, starting with a letter.' } };
            }
            if (this.d.store.findByHandleLower(h.lower)) {
                return { status: 409, body: { ok: false, error: 'handle_taken', message: 'That nickname is taken.' } };
            }
            handle = h.handle;
            handleLower = h.lower;
        }
        // Email: optional, no-enumeration. Only attach if shape-valid AND free.
        const uniformEmailBody = { ok: true, message: 'If this email can be registered, a verification link has been sent.' };
        let email = null;
        let emailLower = null;
        if (wantsEmail) {
            const norm = normalizeEmail(input.email);
            if (!norm) {
                return { status: 400, body: { ok: false, error: 'invalid_input', message: 'Provide a valid email address.' } };
            }
            if (!this.d.store.findByEmailLower(norm.lower)) {
                email = norm.email;
                emailLower = norm.lower;
            }
            // If taken: silently skip attaching the email (no enumeration). A nickname is
            // still created below; an email-only signup with a taken email creates nothing.
        }
        if (!wantsHandle && wantsEmail && !email) {
            // Legacy email-only signup, email already registered -> uniform success, no creation.
            return { status: 200, body: uniformEmailBody };
        }
        const accountId = newId('acc');
        const passwordHash = await this.d.hashPassword(input.password);
        this.d.store.insertAccount({
            account_id: accountId,
            email,
            email_lower: emailLower,
            handle,
            handle_lower: handleLower,
            password_hash: passwordHash,
            status: email ? 'registered_unverified' : 'active',
            created_at: iso(now),
            created_receipt: null,
        });
        this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_CREATED, accountId, result: 'ok' });
        let devToken;
        if (email) {
            // Issue an email-verification token (deferred lane; delivery is E3).
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
            this.d.deliverEmail?.({ kind: 'verify', accountId, email, token });
            if (this.d.config.devExposeLinks)
                devToken = token;
        }
        const account = { account_id: accountId, handle, email_verified: false, status: email ? 'registered_unverified' : 'active' };
        const body = { ok: true, account };
        // Recovery posture: nickname-only accounts have no email-based reset.
        if (!email) {
            body.recovery = 'none';
            body.loss_warning = 'No email is set on this account, so there is no password recovery. Add an email later to enable recovery.';
        }
        else {
            body.recovery = 'email_pending_verification';
            body.message = uniformEmailBody.message;
            if (devToken)
                body.dev_verification_token = devToken;
        }
        // 200 for the legacy email path (no handle); 201 when a nickname account is created.
        return { status: wantsHandle ? 201 : 200, body };
    }
    /** POST /v1/accounts/verify-email — consume a verification token. */
    verifyEmail(input) {
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
    /**
     * POST /v1/accounts/login — sign in with a nickname OR an email.
     * Accepts `identifier` (preferred), or legacy `email`, or `handle`. An
     * '@'-containing identifier is resolved as an email, otherwise as a nickname.
     * Uniform invalid-credentials (no enumeration); sets session + CSRF cookies.
     */
    async login(input, ctx) {
        const now = this.d.now();
        const invalid = { status: 401, body: { ok: false, error: 'invalid_credentials' } };
        const idRaw = typeof input.identifier === 'string' ? input.identifier
            : typeof input.email === 'string' ? input.email
                : typeof input.handle === 'string' ? input.handle
                    : '';
        const id = idRaw.trim();
        if (!id || typeof input.password !== 'string')
            return invalid;
        let acct;
        if (id.includes('@')) {
            const norm = normalizeEmail(id);
            acct = norm ? this.d.store.findByEmailLower(norm.lower) : undefined;
        }
        else {
            acct = this.d.store.findByHandleLower(id.toLowerCase());
        }
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
            body: { ok: true, account: { account_id: acct.account_id, handle: acct.handle, email_verified: acct.email_verified === 1, status: acct.status }, csrf_token: csrf },
            cookies: this.sessionCookies(token, csrf),
        };
    }
    /** Resolve the active session from the request cookies (not revoked, not expired). */
    resolveSession(ctx) {
        const token = ctx.cookies[SESSION_COOKIE];
        if (!token)
            return null;
        const row = this.d.store.findSessionByTokenHash(hashToken(token));
        if (!row || row.revoked_at || Date.parse(row.expires_at) <= this.d.now())
            return null;
        return row;
    }
    /**
     * Public session→account resolver for other routers (e.g. the E4 character
     * API): returns the opaque account_id + email_verified, or null if no valid
     * session. Never exposes the session token or any PII.
     */
    sessionAccount(cookies) {
        const session = this.resolveSession({ cookies });
        if (!session)
            return null;
        const acct = this.d.store.findById(session.account_id);
        if (!acct)
            return null;
        return { accountId: acct.account_id, emailVerified: acct.email_verified === 1 };
    }
    /** GET /v1/accounts/me — current account from the session cookie. */
    me(ctx) {
        const session = this.resolveSession(ctx);
        if (!session)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        const acct = this.d.store.findById(session.account_id);
        if (!acct)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        const csrf = ctx.cookies[CSRF_COOKIE];
        return {
            status: 200,
            body: {
                ok: true,
                account: { account_id: acct.account_id, handle: acct.handle, has_email: !!acct.email_lower, email_verified: acct.email_verified === 1, status: acct.status, roles: parseAccountRoles(acct.roles), created_at: acct.created_at },
                ...(typeof csrf === 'string' && csrf ? { csrf_token: csrf } : {}),
            },
        };
    }
    /**
     * GET /v1/accounts/authorize — Caddy forward_auth gate for the operator Codex
     * surfaces. 200 if the session's account holds a role permitting `surface`;
     * 302 to the admin login (with ?next=) when unauthenticated; 403 when signed in
     * without the role. Read-only GET subrequest (no body, no cookies set).
     */
    authorize(ctx, surface, requestedUri) {
        const allowed = SURFACE_ROLE_MAP[surface];
        if (!allowed)
            return { status: 400, body: { ok: false, error: 'unknown_surface' } };
        // Only allow a same-site, path-absolute next; reject protocol-relative ('//')
        // and absolute URLs to avoid an open redirect off the login page.
        const safeNext = requestedUri.startsWith('/') && !requestedUri.startsWith('//');
        const next = safeNext ? requestedUri : `/${surface}/`;
        const loginRedirect = {
            status: 302,
            body: { ok: false, error: 'not_authenticated' },
            headers: { Location: `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(next)}`, 'Cache-Control': 'no-store' },
        };
        const session = this.resolveSession(ctx);
        if (!session)
            return loginRedirect;
        const acct = this.d.store.findById(session.account_id);
        if (!acct)
            return loginRedirect;
        const roles = parseAccountRoles(acct.roles);
        if (roles.some((r) => allowed.includes(r))) {
            return { status: 200, body: { ok: true, surface, roles }, headers: { 'Cache-Control': 'no-store' } };
        }
        return { status: 403, body: { ok: false, error: 'forbidden_surface', surface }, headers: { 'Cache-Control': 'no-store' } };
    }
    /** POST /v1/accounts/logout — requires session + matching CSRF double-submit. */
    logout(ctx) {
        const session = this.resolveSession(ctx);
        if (!session)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        const csrfCookie = ctx.cookies[CSRF_COOKIE];
        if (!csrfCookie || !ctx.csrfHeader || !safeEqual(csrfCookie, ctx.csrfHeader)) {
            return { status: 403, body: { ok: false, error: 'csrf_failed' } };
        }
        this.d.store.revokeSession(session.session_id, iso(this.d.now()));
        this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_SESSION_REVOKED, accountId: session.account_id, inputs: { session_id: session.session_id }, result: 'ok' });
        return { status: 200, body: { ok: true }, cookies: this.clearCookies() };
    }
    /** POST /v1/accounts/verify/resend — reissue verification for the signed-in account. */
    resendVerification(ctx) {
        const session = this.resolveSession(ctx);
        if (!session)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        const csrfCookie = ctx.cookies[CSRF_COOKIE];
        if (!csrfCookie || !ctx.csrfHeader || !safeEqual(csrfCookie, ctx.csrfHeader)) {
            return { status: 403, body: { ok: false, error: 'csrf_failed' } };
        }
        const acct = this.d.store.findById(session.account_id);
        if (!acct)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        if (!acct.email) {
            return { status: 400, body: { ok: false, error: 'no_email', message: 'Add an email before requesting verification.' } };
        }
        if (acct.email_verified === 1) {
            return { status: 200, body: { ok: true, status: 'already_verified', message: 'Email is already verified.' } };
        }
        const now = this.d.now();
        const token = newToken();
        this.d.store.insertVerification({
            id: newId('ev'),
            account_id: acct.account_id,
            token_hash: hashToken(token),
            created_at: iso(now),
            expires_at: iso(addSec(now, this.d.config.verificationTtlSec)),
        });
        this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_EMAIL_VERIFICATION_REQUESTED, accountId: acct.account_id, result: 'ok' });
        this.d.logLink?.('verify', acct.account_id, token);
        this.d.deliverEmail?.({ kind: 'verify', accountId: acct.account_id, email: acct.email, token });
        const body = { ok: true, status: 'sent', message: 'Verification email sent.' };
        if (this.d.config.devExposeLinks)
            body.dev_verification_token = token;
        return { status: 200, body };
    }
    /** POST /v1/accounts/password-reset/request — uniform response (no enumeration). */
    resetRequest(input) {
        const now = this.d.now();
        const uniform = { status: 200, body: { ok: true, message: 'If this email has an account, a reset link has been sent.' } };
        const norm = typeof input.email === 'string' ? normalizeEmail(input.email) : null;
        if (!norm)
            return uniform;
        const acct = this.d.store.findByEmailLower(norm.lower);
        if (!acct || !acct.email)
            return uniform;
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
        this.d.deliverEmail?.({ kind: 'reset', accountId: acct.account_id, email: acct.email, token });
        return this.d.config.devExposeLinks ? { status: 200, body: { ...uniform.body, dev_reset_token: token } } : uniform;
    }
    /** POST /v1/accounts/password-reset/confirm — consume reset token, rotate password, revoke sessions. */
    async resetConfirm(input) {
        const now = this.d.now();
        const invalid = { status: 400, body: { ok: false, error: 'invalid_or_expired' } };
        if (typeof input.token !== 'string' || !input.token)
            return invalid;
        if (!validPassword(input.password)) {
            return { status: 400, body: { ok: false, error: 'invalid_input', message: `Password must be at least ${MIN_PASSWORD_LEN} characters.` } };
        }
        const row = this.d.store.findResetByTokenHash(hashToken(input.token));
        if (!row || row.consumed_at || Date.parse(row.expires_at) <= now)
            return invalid;
        const passwordHash = await this.d.hashPassword(input.password);
        this.d.store.updatePasswordHash(row.account_id, passwordHash, iso(now));
        this.d.store.consumeReset(row.id, iso(now));
        this.d.store.revokeAllSessions(row.account_id, iso(now)); // a reset logs out everywhere
        this.d.emitReceipt({ action: RECEIPT_ACTIONS.ACCOUNT_PASSWORD_RESET_COMPLETED, accountId: row.account_id, result: 'ok' });
        return { status: 200, body: { ok: true } };
    }
}
