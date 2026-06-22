#!/usr/bin/env tsx
/**
 * Nickname (handle) account test (AKALYNTH_ACCOUNT_NICKNAME_V1).
 *
 * Verifies nickname-or-email signup + login against a real in-memory SQLite DB
 * with REAL Argon2id: nickname-only register (no email, recovery=none),
 * handle_taken / invalid_handle, login by nickname AND by email, email stays
 * no-enumeration, /me carries handle + has_email, and legacy {email,password}
 * register/login still work. Run: npm run test:account-handle
 */
import Database from 'better-sqlite3';
import { initSchema } from '../src/persist/schema.js';
import { AccountStore } from '../src/account/store.js';
import { AccountService, SESSION_COOKIE } from '../src/account/service.js';
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

async function main(): Promise<void> {
  const db = new Database(':memory:');
  initSchema(db);
  const store = new AccountStore(db);
  const svc = new AccountService({
    store,
    hashPassword,
    verifyPassword,
    emitReceipt: () => {},
    now: () => Date.now(),
    config: { secureCookies: false, csrfCookieDomain: '.akalynth.test', sessionTtlSec: 3600, verificationTtlSec: 3600, resetTtlSec: 3600, devExposeLinks: true },
  });
  const PW = 'correct horse battery';

  // schema is v22 (handle columns from v21; players.origin_* restored in migrateToV22)
  const ver = db.prepare(`SELECT value FROM _meta WHERE key='schema_version'`).get() as { value: string };
  check('schema_version is 22', ver.value === '22');

  // nickname-only register
  const reg = await svc.register({ handle: 'Brannic', password: PW });
  const regBody = reg.body as { ok: boolean; account?: { handle?: string; status?: string }; recovery?: string; loss_warning?: string };
  check('nickname register 201', reg.status === 201);
  check('register returns handle', regBody.account?.handle === 'Brannic');
  check('nickname-only status active', regBody.account?.status === 'active');
  check('nickname-only recovery none', regBody.recovery === 'none' && !!regBody.loss_warning);

  // duplicate nickname (case-insensitive) -> explicit 409
  const dup = await svc.register({ handle: 'brannic', password: PW });
  check('duplicate nickname -> 409 handle_taken', dup.status === 409 && (dup.body as { error?: string }).error === 'handle_taken');

  // invalid / reserved handles -> 400
  check('invalid handle -> 400', (await svc.register({ handle: 'x', password: PW })).status === 400);
  check('reserved handle (admin) -> 400', (await svc.register({ handle: 'admin', password: PW })).status === 400);

  // short password -> 400
  check('short password -> 400', (await svc.register({ handle: 'Shorty', password: '123' })).status === 400);

  // login by nickname
  const loginNick = await svc.login({ identifier: 'brannic', password: PW }, { cookies: {} });
  check('login by nickname 200', loginNick.status === 200);
  check('login by nickname sets session', !!cookieValue(loginNick.cookies, SESSION_COOKIE));
  check('login wrong password -> 401', (await svc.login({ identifier: 'brannic', password: 'nope' }, { cookies: {} })).status === 401);

  // /me carries handle + has_email=false for nickname-only
  const token = cookieValue(loginNick.cookies, SESSION_COOKIE) as string;
  const me = svc.me({ cookies: { [SESSION_COOKIE]: token } });
  const meAcct = (me.body as { account: { handle?: string; has_email?: boolean } }).account;
  check('me handle = Brannic', meAcct.handle === 'Brannic');
  check('me has_email false', meAcct.has_email === false);

  // register with handle + email -> 201, dev token, pending verification
  const regBoth = await svc.register({ handle: 'Mira', email: 'mira@example.com', password: PW });
  const bothBody = regBoth.body as { recovery?: string; dev_verification_token?: string };
  check('handle+email register 201', regBoth.status === 201);
  check('handle+email recovery pending', bothBody.recovery === 'email_pending_verification' && !!bothBody.dev_verification_token);
  // login by email for that account
  check('login by email 200', (await svc.login({ identifier: 'mira@example.com', password: PW }, { cookies: {} })).status === 200);

  // legacy email-only register still 200 + dev token
  const legacy = await svc.register({ email: 'legacy@example.com', password: PW });
  check('legacy email-only register 200', legacy.status === 200);
  check('legacy register issues dev token', typeof (legacy.body as { dev_verification_token?: string }).dev_verification_token === 'string');
  check('legacy login by email 200', (await svc.login({ email: 'legacy@example.com', password: PW }, { cookies: {} })).status === 200);

  // email no-enumeration: re-register same email -> uniform 200, no new account
  const reEmail = await svc.register({ email: 'legacy@example.com', password: PW });
  check('duplicate email -> uniform 200 (no account)', reEmail.status === 200 && !(reEmail.body as { account?: unknown }).account);

  // neither handle nor email -> 400
  check('no identifier -> 400', (await svc.register({ password: PW })).status === 400);
}

main().then(() => {
  if (failed > 0) {
    console.error(`\n[verify-account-handle.test] ${failed} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\n[verify-account-handle.test] all checks passed');
}).catch((e) => {
  console.error('test crashed:', e);
  process.exit(1);
});
