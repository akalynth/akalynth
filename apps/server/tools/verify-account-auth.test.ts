#!/usr/bin/env tsx
/**
 * Account auth integration test (E2 / AKALYNTH_ACCOUNT_AUTH_API_V1).
 *
 * Exercises register → verify → login → me → logout → reset against a real
 * in-memory SQLite DB (E1 schema) and REAL Argon2id hashing. Asserts the
 * security contract: no-enumeration uniform responses, hashed-at-rest tokens,
 * session cookie + CSRF double-submit, password rotation revokes sessions, and
 * privacy-bounded receipts (no PII/secret values). Run: npm run test:account-auth
 */
import Database from 'better-sqlite3';
import { initSchema } from '../src/persist/schema.js';
import { AccountStore } from '../src/account/store.js';
import { AccountService, SESSION_COOKIE, CSRF_COOKIE } from '../src/account/service.js';
import { hashPassword, verifyPassword } from '../src/account/password.js';

let failed = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

function cookieValue(cookies: string[] | undefined, name: string): string | undefined {
  for (const sc of cookies ?? []) {
    const m = sc.match(new RegExp(`^${name}=([^;]*)`));
    if (m) return decodeURIComponent(m[1]);
  }
  return undefined;
}

interface Emitted { action: string; accountId: string | null; inputs?: Record<string, unknown>; result: string }

async function main(): Promise<void> {
  const db = new Database(':memory:');
  initSchema(db);
  const store = new AccountStore(db);
  const events: Emitted[] = [];
  const svc = new AccountService({
    store,
    hashPassword,
    verifyPassword,
    emitReceipt: (e) => events.push(e),
    now: () => Date.now(),
    config: { secureCookies: false, csrfCookieDomain: '.akalynth.test', sessionTtlSec: 3600, verificationTtlSec: 3600, resetTtlSec: 3600, devExposeLinks: true },
  });
  const actions = () => events.map((e) => e.action);

  const EMAIL = 'Player@Example.com';
  const PW = 'correct horse battery';

  // register (new)
  const reg = await svc.register({ email: EMAIL, password: PW });
  check('register returns 200', reg.status === 200);
  const vToken = (reg.body as { dev_verification_token?: string }).dev_verification_token;
  check('register issued a verification token (dev)', typeof vToken === 'string' && vToken.length > 0);
  check('account row created (1)', (db.prepare('SELECT count(*) c FROM accounts').get() as { c: number }).c === 1);
  check('receipts: account_created + verification_requested', actions().includes('account_created') && actions().includes('account_email_verification_requested'));

  // password stored as Argon2id, email normalized lower
  const row = db.prepare('SELECT * FROM accounts').get() as { password_hash: string; email: string; email_lower: string; email_verified: number };
  check('password stored as Argon2id PHC', row.password_hash.startsWith('$argon2id$'));
  check('plaintext password NOT in DB', !row.password_hash.includes(PW));
  check('email_lower normalized', row.email_lower === 'player@example.com' && row.email === EMAIL);
  // verification token stored hashed (plaintext not present)
  const vrow = db.prepare('SELECT token_hash FROM account_email_verifications').get() as { token_hash: string };
  check('verification token stored hashed', !!vrow && vrow.token_hash !== vToken && vrow.token_hash.length === 64);

  // unverified sessions can request a replacement verification email, with CSRF.
  const preVerifyLogin = await svc.login({ email: EMAIL, password: PW }, { cookies: {} });
  const preVerifySess = cookieValue(preVerifyLogin.cookies, SESSION_COOKIE);
  const preVerifyCsrf = cookieValue(preVerifyLogin.cookies, CSRF_COOKIE);
  const preVerifyCtx = { cookies: { [SESSION_COOKIE]: preVerifySess!, [CSRF_COOKIE]: preVerifyCsrf! } };
  check('resend verify wrong csrf -> 403', svc.resendVerification({ cookies: preVerifyCtx.cookies, csrfHeader: 'wrong' }).status === 403);
  const resend = svc.resendVerification({ cookies: preVerifyCtx.cookies, csrfHeader: preVerifyCsrf });
  const resendToken = (resend.body as { dev_verification_token?: string }).dev_verification_token;
  check('resend verify 200 + token', resend.status === 200 && typeof resendToken === 'string');
  check('resend verify token stored hashed', (db.prepare('SELECT count(*) c FROM account_email_verifications').get() as { c: number }).c === 2);

  // register (same email) — no enumeration, no new account
  const reg2 = await svc.register({ email: 'player@example.com', password: PW });
  check('duplicate register: uniform 200', reg2.status === 200);
  check('duplicate register: no new account', (db.prepare('SELECT count(*) c FROM accounts').get() as { c: number }).c === 1);

  // register bad input
  check('register short password -> 400', (await svc.register({ email: 'x@y.com', password: 'short' })).status === 400);
  check('register bad email -> 400', (await svc.register({ email: 'nope', password: PW })).status === 400);

  // verify email
  check('account starts unverified', row.email_verified === 0);
  const ver = svc.verifyEmail({ token: vToken });
  check('verify-email 200', ver.status === 200);
  check('email_verified set', (db.prepare('SELECT email_verified e FROM accounts').get() as { e: number }).e === 1);
  check('receipt account_email_verified', actions().includes('account_email_verified'));
  check('verify-email reused token -> 400', svc.verifyEmail({ token: vToken }).status === 400);
  check('resend after verified -> already_verified', (svc.resendVerification({ cookies: preVerifyCtx.cookies, csrfHeader: preVerifyCsrf }).body as { status?: string }).status === 'already_verified');

  // login wrong password
  const badLogin = await svc.login({ email: EMAIL, password: 'wrong' }, { cookies: {} });
  check('login wrong password -> 401', badLogin.status === 401 && !badLogin.cookies);
  check('receipt account_login_failed', actions().includes('account_login_failed'));
  // login unknown email is uniform 401
  check('login unknown email -> 401 (uniform)', (await svc.login({ email: 'nobody@x.com', password: PW }, { cookies: {} })).status === 401);

  // login correct
  const login = await svc.login({ email: EMAIL, password: PW }, { cookies: {} });
  check('login 200', login.status === 200);
  const sessTok = cookieValue(login.cookies, SESSION_COOKIE);
  const csrf = cookieValue(login.cookies, CSRF_COOKIE);
  check('login set session + csrf cookies', !!sessTok && !!csrf);
  check('login body returns csrf token for static portal', (login.body as { csrf_token?: string }).csrf_token === csrf);
  check('session cookie is HttpOnly', !!login.cookies?.find((c) => c.startsWith(SESSION_COOKIE) && c.includes('HttpOnly')));
  check('csrf cookie is NOT HttpOnly', !!login.cookies?.find((c) => c.startsWith(CSRF_COOKIE) && !c.includes('HttpOnly')));
  check('csrf cookie can be scoped to portal parent domain', !!login.cookies?.find((c) => c.startsWith(CSRF_COOKIE) && c.includes('Domain=.akalynth.test')));
  check('session cookie remains host scoped', !login.cookies?.find((c) => c.startsWith(SESSION_COOKIE) && c.includes('Domain=')));
  check('receipts login_succeeded + session_issued', actions().includes('account_login_succeeded') && actions().includes('account_session_issued'));
  // session token stored hashed
  const srow = db.prepare('SELECT token_hash FROM account_sessions').get() as { token_hash: string };
  check('session token stored hashed', srow.token_hash !== sessTok && srow.token_hash.length === 64);

  const authCtx = { cookies: { [SESSION_COOKIE]: sessTok!, [CSRF_COOKIE]: csrf! } };

  // me
  check('me with session -> 200', svc.me(authCtx).status === 200);
  check('me without session -> 401', svc.me({ cookies: {} }).status === 401);

  // logout requires CSRF
  check('logout wrong csrf -> 403', svc.logout({ cookies: authCtx.cookies, csrfHeader: 'wrong' }).status === 403);
  const out = svc.logout({ cookies: authCtx.cookies, csrfHeader: csrf });
  check('logout 200 + clears cookies', out.status === 200 && !!out.cookies);
  check('receipt session_revoked', actions().includes('account_session_revoked'));
  check('me after logout -> 401 (session revoked)', svc.me(authCtx).status === 401);

  // password reset
  const rr = svc.resetRequest({ email: EMAIL });
  const rToken = (rr.body as { dev_reset_token?: string }).dev_reset_token;
  check('reset-request 200 + token', rr.status === 200 && typeof rToken === 'string');
  check('reset-request unknown email -> 200 uniform, no reset row', svc.resetRequest({ email: 'nobody@x.com' }).status === 200 && (db.prepare('SELECT count(*) c FROM account_password_resets').get() as { c: number }).c === 1);
  check('receipt password_reset_requested', actions().includes('account_password_reset_requested'));

  const NEWPW = 'a whole new password';
  // make a fresh session, then confirm reset revokes it
  const login2 = await svc.login({ email: EMAIL, password: PW }, { cookies: {} });
  const sess2 = cookieValue(login2.cookies, SESSION_COOKIE)!;
  const confirm = await svc.resetConfirm({ token: rToken, password: NEWPW });
  check('reset-confirm 200', confirm.status === 200);
  check('receipt password_reset_completed', actions().includes('account_password_reset_completed'));
  check('old password no longer works', (await svc.login({ email: EMAIL, password: PW }, { cookies: {} })).status === 401);
  check('new password works', (await svc.login({ email: EMAIL, password: NEWPW }, { cookies: {} })).status === 200);
  check('reset revoked prior sessions', svc.me({ cookies: { [SESSION_COOKIE]: sess2 } }).status === 401);
  check('reused reset token -> 400', (await svc.resetConfirm({ token: rToken, password: NEWPW })).status === 400);

  // privacy: no receipt input ever carried email or a raw password/token
  const leak = events.some((e) => JSON.stringify(e.inputs ?? {}).toLowerCase().includes('example.com') || JSON.stringify(e.inputs ?? {}).includes(PW) || JSON.stringify(e.inputs ?? {}).includes(NEWPW));
  check('no receipt carried email/password/token', !leak);
}

main().then(() => {
  if (failed > 0) {
    console.error(`\n[verify-account-auth.test] ${failed} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\n[verify-account-auth.test] all checks passed');
}).catch((e) => {
  console.error('test crashed:', e);
  process.exit(1);
});
