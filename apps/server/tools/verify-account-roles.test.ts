#!/usr/bin/env tsx
/**
 * Account roles + operator-surface authorize gate test
 * (AKALYNTH_OPERATOR_CODEX_GATE_V1). Exercises the forward_auth contract against
 * a real in-memory SQLite DB: roles in /me, role→surface mapping, the
 * unauthenticated 302→login redirect (with open-redirect sanitization), and the
 * signed-in-but-wrong-role 403. Run: npm run test:account-roles
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
function roles(res: { body: unknown }): string[] {
  return ((res.body as { account?: { roles?: string[] } }).account?.roles) ?? [];
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

  const EMAIL = 'op@example.com';
  const PW = 'correct horse battery';
  await svc.register({ email: EMAIL, password: PW });
  const login = await svc.login({ email: EMAIL, password: PW }, { cookies: {} });
  check('login 200', login.status === 200);
  const token = cookieValue(login.cookies, SESSION_COOKIE);
  check('session cookie issued', !!token);
  const ctx = { cookies: { [SESSION_COOKIE]: token as string } };
  const acctId = store.findByEmailLower(EMAIL.toLowerCase())!.account_id;

  // default role
  check('me roles default [player]', JSON.stringify(roles(svc.me(ctx))) === JSON.stringify(['player']));

  // unauthenticated → 302 to login with sanitized next
  const anon = svc.authorize({ cookies: {} }, 'operator', '/operator/');
  check('anon → 302 login', anon.status === 302 && /^\/operator\/login\?next=/.test(anon.headers?.Location ?? ''));
  const anonEvil = svc.authorize({ cookies: {} }, 'operator', '//evil.test/x');
  check('anon next open-redirect sanitized', /next=%2Foperator%2F$/.test(anonEvil.headers?.Location ?? ''));

  // player signed in → 403 everywhere
  check('player operator → 403', svc.authorize(ctx, 'operator', '/operator/').status === 403);

  // operator role
  store.setRoles(acctId, JSON.stringify(['operator']), new Date().toISOString());
  check('operator → /operator 200', svc.authorize(ctx, 'operator', '/operator/').status === 200);
  check('operator → /agent 200', svc.authorize(ctx, 'agent', '/agent/').status === 200);
  check('operator → /builder 403', svc.authorize(ctx, 'builder', '/builder/').status === 403);

  // builder role
  store.setRoles(acctId, JSON.stringify(['builder']), new Date().toISOString());
  check('builder → /builder 200', svc.authorize(ctx, 'builder', '/builder/').status === 200);
  check('builder → /operator 403', svc.authorize(ctx, 'operator', '/operator/').status === 403);

  // admin role → all surfaces
  store.setRoles(acctId, JSON.stringify(['admin']), new Date().toISOString());
  check('admin → /operator 200', svc.authorize(ctx, 'operator', '/operator/').status === 200);
  check('admin → /builder 200', svc.authorize(ctx, 'builder', '/builder/').status === 200);
  check('admin → /agent 200', svc.authorize(ctx, 'agent', '/agent/').status === 200);
  check('me reflects roles [admin]', JSON.stringify(roles(svc.me(ctx))) === JSON.stringify(['admin']));

  // unknown surface → 400
  check('unknown surface → 400', svc.authorize(ctx, 'nope', '/nope/').status === 400);
}

main().then(() => {
  if (failed > 0) {
    console.error(`\n[verify-account-roles.test] ${failed} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\n[verify-account-roles.test] all checks passed');
}).catch((e) => {
  console.error('test crashed:', e);
  process.exit(1);
});
