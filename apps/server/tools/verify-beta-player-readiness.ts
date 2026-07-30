#!/usr/bin/env tsx
// Focused store/service checks for Beta Player Readiness and Measurement v1.
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { initSchema, SCHEMA_VERSION } from '../src/persist/schema.js';
import { BetaStore } from '../src/beta/store.js';
import { BetaService } from '../src/beta/service.js';
import { AccountService } from '../src/account/service.js';
import { AccountStore } from '../src/account/store.js';
import { newToken, hashToken } from '../src/account/tokens.js';

const db = new Database(':memory:');
try {
  initSchema(db);
  assert.equal(SCHEMA_VERSION, 26);
  assert.equal(
    db.prepare("SELECT value FROM _meta WHERE key = 'schema_version'")
      .get()?.value,
    '26',
  );

  const store = new BetaStore(db);
  const rawInvite = newToken(24);
  store.insertCohort({
    cohort_id: 'verify-cohort',
    release_commit: 'verify-release',
    platform: 'web',
    invite_cap: 1,
    rollback_commit: 'verify-rollback',
    created_at: new Date().toISOString(),
    opens_at: new Date().toISOString(),
    closes_at: null,
    created_by: 'test',
  });
  store.issueInvite({
    invite_id: 'verify-invite',
    cohort_id: 'verify-cohort',
    token_hash: hashToken(rawInvite),
    token_hint: rawInvite.slice(-8),
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.throws(
    () => store.issueInvite({
      invite_id: 'verify-over-cap',
      cohort_id: 'verify-cohort',
      token_hash: hashToken(newToken(24)),
      token_hint: 'overcap',
      issued_at: new Date().toISOString(),
      expires_at: null,
    }),
    /invite_cap_reached/,
  );
  const stored = db.prepare(
    'SELECT token_hash FROM beta_invites WHERE invite_id = ?',
  ).get('verify-invite') as { token_hash: string };
  assert.equal(stored.token_hash, hashToken(rawInvite));
  assert.notEqual(stored.token_hash, rawInvite);

  const receipts: Array<{
    action: string;
    inputs: Record<string, unknown>;
  }> = [];
  const service = new BetaService({
    store,
    enabled: true,
    requireInvite: true,
    releaseCommit: 'verify-release',
    now: () => Date.now(),
    emitReceipt: (event) => {
      receipts.push({ action: event.action, inputs: event.inputs });
    },
  });
  const claim = service.claimInvite(rawInvite, 'acc_verify');
  assert.equal(claim.ok, true);
  assert.equal(claim.ok && claim.cohort?.cohort_id, 'verify-cohort');
  assert.equal(service.claimInvite(rawInvite, 'acc_other').ok, false);
  assert.equal(
    service.status('acc_verify').cohort?.cohort_id,
    'verify-cohort',
  );

  const atomicInvite = newToken(24);
  store.insertCohort({
    cohort_id: 'verify-atomic-cohort',
    release_commit: 'verify-release',
    platform: 'web',
    invite_cap: 1,
    rollback_commit: 'verify-rollback',
    created_at: new Date().toISOString(),
    opens_at: new Date().toISOString(),
    closes_at: null,
    created_by: 'test',
  });
  store.issueInvite({
    invite_id: 'verify-atomic-invite',
    cohort_id: 'verify-atomic-cohort',
    token_hash: hashToken(atomicInvite),
    token_hint: atomicInvite.slice(-8),
    issued_at: new Date().toISOString(),
    expires_at: null,
  });
  const accountStore = new AccountStore(db);
  const insertAtomicAccount = (accountId: string) => accountStore.insertAccount({
    account_id: accountId,
    email: null,
    email_lower: null,
    handle: accountId,
    handle_lower: accountId,
    password_hash: 'test-password-hash',
    status: 'active',
    created_at: new Date().toISOString(),
    created_receipt: null,
  });
  const receiptCountBeforeFailedClaim = receipts.length;
  assert.throws(
    () => service.claimInvite(atomicInvite, 'acc_atomic_failed', () => {
      insertAtomicAccount('acc_atomic_failed');
      throw new Error('forced_account_insert_failure');
    }),
    /forced_account_insert_failure/,
  );
  assert.equal(accountStore.findById('acc_atomic_failed'), undefined);
  assert.deepEqual(
    db.prepare(`
      SELECT status, account_id
      FROM beta_invites
      WHERE invite_id = 'verify-atomic-invite'
    `).get(),
    { status: 'issued', account_id: null },
  );
  assert.equal(receipts.length, receiptCountBeforeFailedClaim);

  const atomicRetry = service.claimInvite(atomicInvite, 'acc_atomic_retry', () => {
    insertAtomicAccount('acc_atomic_retry');
  });
  assert.equal(atomicRetry.ok, true);
  assert.ok(accountStore.findById('acc_atomic_retry'));
  assert.deepEqual(
    db.prepare(`
      SELECT status, account_id
      FROM beta_invites
      WHERE invite_id = 'verify-atomic-invite'
    `).get(),
    { status: 'redeemed', account_id: 'acc_atomic_retry' },
  );

  const event = service.recordEvent('acc_verify', {
    event: 'world_state_reached',
    client_session_id: 'session_verify_123456',
    map: 'Rookguard',
  });
  assert.equal('ok' in event && event.ok, true);
  const badEvent = service.recordEvent(null, {
    event: 'world_state_reached',
    client_session_id: 'bad',
  });
  assert.equal(
    'error' in badEvent && badEvent.error,
    'invalid_client_session_id',
  );

  // The browser may report which six-step panel it is displaying, but
  // training/profession completion remains derived from server gameplay
  // receipts in the report, never from these readiness observations.
  for (const tutorialStep of ['training', 'profession'] as const) {
    const observed = service.recordEvent('acc_verify', {
      event: 'onboarding_started',
      client_session_id: `session_${tutorialStep}_123456`,
      map: 'Rookguard',
      tutorial_step: tutorialStep,
    });
    assert.equal('ok' in observed && observed.ok, true);
    assert.ok(
      receipts.some(
        (receipt) => receipt.action === 'beta_event_recorded'
          && receipt.inputs.tutorial_step === tutorialStep,
      ),
    );
  }

  const feedback = service.submitFeedback('acc_verify', {
    severity: 'P1',
    category: 'gameplay',
    title: 'Movement stopped',
    body: 'The player cannot move after entering Rookguard.',
    reproduction_steps: 'Enter the plaza, press north twice.',
    client_session_id: 'session_verify_123456',
    map: 'Rookguard',
    tutorial_step: 'move',
  });
  assert.equal('ok' in feedback && feedback.ok, true);
  assert.ok(
    receipts.some(
      (receipt) => receipt.action === 'beta_invite_redeemed',
    ),
  );
  assert.ok(
    receipts.some(
      (receipt) => receipt.action === 'beta_event_recorded',
    ),
  );
  assert.ok(
    receipts.some(
      (receipt) => receipt.action === 'beta_feedback_submitted',
    ),
  );

  const accountService = new AccountService({
    store: accountStore,
    hashPassword: async () => 'test-password-hash',
    verifyPassword: async () => true,
    emitReceipt: (event) => {
      receipts.push({
        action: event.action,
        inputs: event.inputs ?? {},
      });
    },
    now: () => Date.now(),
    config: {
      secureCookies: false,
      sessionTtlSec: 3600,
      verificationTtlSec: 3600,
      resetTtlSec: 3600,
      devExposeLinks: false,
    },
    beta: {
      requireInvite: true,
      claimInvite: (code, accountId, commitAccount) =>
        service.claimInvite(code, accountId, commitAccount),
    },
  });
  const missingInvite = await accountService.register({
    handle: 'BetaPlayer0',
    password: 'password123',
  });
  assert.equal(missingInvite.status, 403);
  const registered = await accountService.register({
    handle: 'BetaPlayer',
    password: 'password123',
    invite_code: newToken(24),
  });
  assert.equal(registered.status, 403);

  const redeemable = newToken(24);
  store.insertCohort({
    cohort_id: 'verify-registration-cohort',
    release_commit: 'verify-release',
    platform: 'web',
    invite_cap: 2,
    rollback_commit: 'verify-rollback',
    created_at: new Date().toISOString(),
    opens_at: new Date().toISOString(),
    closes_at: null,
    created_by: 'test',
  });
  store.issueInvite({
    invite_id: 'verify-registration-invite',
    cohort_id: 'verify-registration-cohort',
    token_hash: hashToken(redeemable),
    token_hint: redeemable.slice(-8),
    issued_at: new Date().toISOString(),
    expires_at: null,
  });
  const registeredWithInvite = await accountService.register({
    handle: 'BetaPlayer2',
    password: 'password123',
    invite_code: redeemable,
  });
  assert.equal(registeredWithInvite.status, 201);
  assert.equal(
    (
      registeredWithInvite.body as {
        beta_cohort?: { cohort_id?: string };
      }
    ).beta_cohort?.cohort_id,
    'verify-registration-cohort',
  );
  const registeredAccountId = (
    registeredWithInvite.body as {
      account?: { account_id?: string };
    }
  ).account?.account_id;
  assert.ok(registeredAccountId);
  assert.ok(accountStore.findById(registeredAccountId));
  assert.equal(
    service.status(registeredAccountId).cohort?.cohort_id,
    'verify-registration-cohort',
  );

  console.log(
    '[verify-beta-player-readiness] PASS: schema v26, cap, hashed invite, atomic account binding, redemption, six-step readiness labels, event, and P1 feedback contracts',
  );
} finally {
  db.close();
}
