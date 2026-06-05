#!/usr/bin/env tsx
/**
 * Account email delivery test (E3 / AKALYNTH_ACCOUNT_EMAIL_V1).
 *
 * Asserts the provider-neutral delivery contract: message templates carry the
 * portal link for verify/reset, the console transport logs, the factory picks
 * transports (and falls back to console on misconfigured SMTP), and the
 * AccountService fires deliverEmail with the recipient email + the SAME token it
 * issued — while keeping email/token OUT of receipts. Uses a stub password
 * hasher so it runs without @node-rs/argon2. Run: npm run test:account-email
 */
import Database from 'better-sqlite3';
import { initSchema } from '../src/persist/schema.js';
import { AccountStore } from '../src/account/store.js';
import { AccountService } from '../src/account/service.js';
import {
  buildAccountEmail,
  createEmailSender,
  ConsoleEmailSender,
  type EmailLinks,
} from '../src/account/email.js';

let failed = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

const LINKS: EmailLinks = { portalBaseUrl: 'https://akalynth.com/', from: 'Akalynth <no-reply@akalynth.com>' };

// ------------------------------------------------------------- buildAccountEmail
const verify = buildAccountEmail('verify', 'player@example.com', 'tok-abc', LINKS);
check('verify subject', verify.subject === 'Verify your Akalynth account');
check('verify to-address', verify.to === 'player@example.com');
check('verify link uses ?verify= and trims base slash', verify.text.includes('https://akalynth.com/account?verify=tok-abc'));
check('verify link present in html too', verify.html.includes('account?verify=tok-abc'));

const reset = buildAccountEmail('reset', 'player@example.com', 'tok/xyz 1', LINKS);
check('reset subject', reset.subject === 'Reset your Akalynth password');
check('reset link uses ?reset= and url-encodes token', reset.text.includes('account?reset=tok%2Fxyz%201'));
check('reset copy reassures on no-op', reset.text.includes('password stays unchanged'));

// ------------------------------------------------------------- console transport
let logged = '';
const console_ = new ConsoleEmailSender((line) => {
  logged += line;
});
await console_.send(verify);
check('console transport identifies as console', console_.transport === 'console');
check('console transport logs recipient + subject', logged.includes('player@example.com') && logged.includes('Verify your Akalynth account'));

// ------------------------------------------------------------- factory selection
check('factory: console -> console', createEmailSender({ transport: 'console' }).transport === 'console');
check(
  'factory: smtp with host -> smtp',
  createEmailSender({ transport: 'smtp', smtp: { host: 'smtp.example.com', port: 587, secure: false, from: LINKS.from } }).transport === 'smtp',
);
check(
  'factory: smtp without host -> console fallback (no crash)',
  createEmailSender({ transport: 'smtp', smtp: { host: '', port: 587, secure: false, from: LINKS.from } }).transport === 'console',
);

// ------------------------------------------------- AccountService wiring + privacy
interface Delivered { kind: string; accountId: string; email: string; token: string }
interface Receipt { action: string; accountId: string | null; inputs?: Record<string, unknown> }
const db = new Database(':memory:');
initSchema(db);
const store = new AccountStore(db);
const delivered: Delivered[] = [];
const receipts: Receipt[] = [];
const svc = new AccountService({
  store,
  // Stub hasher (keeps the test free of @node-rs/argon2).
  hashPassword: async (p) => `stub$${p}`,
  verifyPassword: async (enc, p) => enc === `stub$${p}`,
  emitReceipt: (e) => receipts.push(e),
  now: () => Date.now(),
  config: { secureCookies: false, sessionTtlSec: 3600, verificationTtlSec: 3600, resetTtlSec: 3600, devExposeLinks: true },
  deliverEmail: (m) => delivered.push(m),
});

const EMAIL = 'Player@Example.com';
const reg = (await svc.register({ email: EMAIL, password: 'correct horse battery' })) as { body: { dev_verification_token?: string } };
const verifyDelivery = delivered.find((d) => d.kind === 'verify');
check('register delivers a verify email', !!verifyDelivery);
// Delivered to the as-entered address (case preserved); only the dedup key is
// lowercased. Trimmed of surrounding whitespace.
check('delivered email is the as-stored recipient', verifyDelivery?.email === 'Player@Example.com');
check('delivered token equals the issued (dev) token', !!verifyDelivery && verifyDelivery.token === reg.body.dev_verification_token);

const rr = (await svc.resetRequest({ email: EMAIL })) as { body: { dev_reset_token?: string } };
const resetDelivery = delivered.find((d) => d.kind === 'reset');
check('reset request delivers a reset email', !!resetDelivery);
check('delivered reset token equals the issued token', !!resetDelivery && resetDelivery.token === rr.body.dev_reset_token);

// Privacy boundary: no receipt may carry the email or a delivered token.
const blob = JSON.stringify(receipts);
check('no receipt contains the recipient email', !blob.toLowerCase().includes('example.com'));
check('no receipt contains a delivered token', !delivered.some((d) => blob.includes(d.token)));
check('receipts still recorded the verification request', receipts.some((r) => r.action.includes('verification_requested')));

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll account-email checks passed');
