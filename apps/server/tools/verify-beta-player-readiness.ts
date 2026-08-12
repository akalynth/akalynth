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
import {
  BETA_RELEASE_MANIFEST_SCHEMA_VERSION,
  bindCohortReleaseManifests,
  parseBetaReleaseManifest,
} from '../src/beta/releaseManifest.js';

const RELEASE_COMMIT = '1'.repeat(40);
const ROLLBACK_COMMIT = '2'.repeat(40);
const RELEASE_MANIFEST_SHA256 = 'a'.repeat(64);
const ROLLBACK_MANIFEST_SHA256 = 'b'.repeat(64);

function manifest(commit: string, releaseId: string) {
  return {
    schema_version: BETA_RELEASE_MANIFEST_SCHEMA_VERSION,
    release_id: releaseId,
    generated_at: '2026-08-12T00:00:00.000Z',
    platform: 'web',
    backend: {
      commit,
      build_info_sha256: '3'.repeat(64),
    },
    portal: {
      commit: '4'.repeat(40),
      files_sha256: {
        'index.html': '5'.repeat(64),
        'account.html': '5'.repeat(64),
        'register.html': '6'.repeat(64),
        'forgot.html': '5'.repeat(64),
        'beta.html': '6'.repeat(64),
        'js/app.js': '5'.repeat(64),
        'css/style.css': '6'.repeat(64),
      },
    },
    web_client: {
      source_commit: '7'.repeat(40),
      files_sha256: {
        'index.html': '8'.repeat(64),
        'assets/index.js': '9'.repeat(64),
        'assets/index.css': 'a'.repeat(64),
      },
    },
    policy: {
      CHILL_ZONE_GATHER_ENABLED: true,
      CHILL_ZONE_REFINE_ENABLED: true,
      AKALYNTH_BETA_ENABLED: true,
      AKALYNTH_BETA_REQUIRE_INVITE: true,
    },
    routing: {
      caddy_config_sha256: 'c'.repeat(64),
      beta_static_root: '/var/www/akalynth-beta',
      beta_api_upstream: '127.0.0.1:3010',
    },
  };
}

const db = new Database(':memory:');
try {
  initSchema(db);
  assert.equal(SCHEMA_VERSION, 27);
  assert.equal(
    db.prepare("SELECT value FROM _meta WHERE key = 'schema_version'")
      .get()?.value,
    '27',
  );

  const releaseManifest = manifest(RELEASE_COMMIT, 'verify-release');
  const rollbackManifest = manifest(ROLLBACK_COMMIT, 'verify-rollback');
  const releaseJson = JSON.stringify(releaseManifest);
  const activeReleaseJson = JSON.stringify({
    routing: releaseManifest.routing,
    policy: releaseManifest.policy,
    web_client: releaseManifest.web_client,
    portal: releaseManifest.portal,
    backend: releaseManifest.backend,
    platform: releaseManifest.platform,
    generated_at: releaseManifest.generated_at,
    release_id: releaseManifest.release_id,
    schema_version: releaseManifest.schema_version,
  }, null, 2);
  const bound = bindCohortReleaseManifests({
    release_json: releaseJson,
    rollback_json: JSON.stringify(rollbackManifest),
    active_release_json: activeReleaseJson,
    release_commit: RELEASE_COMMIT,
    rollback_commit: ROLLBACK_COMMIT,
    platform: 'web',
  });
  assert.equal(bound.release.sha256, parseBetaReleaseManifest(activeReleaseJson).sha256);
  assert.match(bound.release.sha256, /^[0-9a-f]{64}$/);
  assert.throws(
    () => bindCohortReleaseManifests({
      release_json: releaseJson,
      rollback_json: JSON.stringify(rollbackManifest),
      active_release_json: JSON.stringify(manifest(RELEASE_COMMIT, 'drifted-active')),
      release_commit: RELEASE_COMMIT,
      rollback_commit: ROLLBACK_COMMIT,
      platform: 'web',
    }),
    /active_release_manifest_mismatch/,
  );
  assert.throws(
    () => parseBetaReleaseManifest(JSON.stringify({ ...releaseManifest, unexpected: true })),
    /release_manifest_keys_invalid/,
  );
  const incompletePortal = JSON.parse(JSON.stringify(releaseManifest)) as {
    portal: { files_sha256: Record<string, string> };
  };
  delete incompletePortal.portal.files_sha256['beta.html'];
  assert.throws(
    () => parseBetaReleaseManifest(JSON.stringify(incompletePortal)),
    /release_manifest\.portal\.files_sha256_missing: beta\.html/,
  );

  const store = new BetaStore(db);
  const rawInvite = newToken(24);
  store.insertCohort({
    cohort_id: 'verify-cohort',
    release_commit: 'verify-release',
    release_manifest_sha256: RELEASE_MANIFEST_SHA256,
    platform: 'web',
    invite_cap: 1,
    rollback_commit: 'verify-rollback',
    rollback_manifest_sha256: ROLLBACK_MANIFEST_SHA256,
    created_at: new Date().toISOString(),
    opens_at: new Date().toISOString(),
    closes_at: null,
    created_by: 'test',
  });
  assert.equal(store.setCohortStatus('verify-cohort', 'paused'), true);
  assert.throws(
    () => store.setCohortStatus(
      'verify-cohort',
      'open',
      'd'.repeat(64),
    ),
    /active_release_manifest_mismatch/,
  );
  assert.equal(store.findCohort('verify-cohort')?.status, 'paused');
  assert.equal(
    store.setCohortStatus(
      'verify-cohort',
      'open',
      RELEASE_MANIFEST_SHA256,
    ),
    true,
  );
  store.issueInvite({
    invite_id: 'verify-invite',
    cohort_id: 'verify-cohort',
    token_hash: hashToken(rawInvite),
    token_hint: rawInvite.slice(-8),
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  }, RELEASE_MANIFEST_SHA256);
  assert.throws(
    () => store.issueInvite({
      invite_id: 'verify-over-cap',
      cohort_id: 'verify-cohort',
      token_hash: hashToken(newToken(24)),
      token_hint: 'overcap',
      issued_at: new Date().toISOString(),
      expires_at: null,
    }, RELEASE_MANIFEST_SHA256),
    /invite_cap_reached/,
  );
  const stored = db.prepare(
    'SELECT token_hash FROM beta_invites WHERE invite_id = ?',
  ).get('verify-invite') as { token_hash: string };
  assert.equal(stored.token_hash, hashToken(rawInvite));
  assert.notEqual(stored.token_hash, rawInvite);

  const unboundInvite = newToken(24);
  db.prepare(`
    INSERT INTO beta_cohorts (
      cohort_id, release_commit, platform, invite_cap, status,
      rollback_commit, created_at, opens_at, closes_at, created_by
    ) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, NULL, ?)
  `).run(
    'verify-legacy-unbound',
    'legacy-release',
    'web',
    2,
    'legacy-rollback',
    new Date().toISOString(),
    new Date().toISOString(),
    'test',
  );
  db.prepare(`
    INSERT INTO beta_invites (
      invite_id, cohort_id, token_hash, token_hint, status, issued_at, expires_at
    ) VALUES (?, ?, ?, ?, 'issued', ?, NULL)
  `).run(
    'verify-legacy-invite',
    'verify-legacy-unbound',
    hashToken(unboundInvite),
    unboundInvite.slice(-8),
    new Date().toISOString(),
  );
  assert.throws(
    () => store.setCohortStatus(
      'verify-legacy-unbound',
      'open',
      RELEASE_MANIFEST_SHA256,
    ),
    /cohort_manifest_unbound/,
  );
  assert.throws(
    () => store.issueInvite({
      invite_id: 'verify-legacy-second-invite',
      cohort_id: 'verify-legacy-unbound',
      token_hash: hashToken(newToken(24)),
      token_hint: 'unbound2',
      issued_at: new Date().toISOString(),
      expires_at: null,
    }, RELEASE_MANIFEST_SHA256),
    /cohort_manifest_unbound/,
  );

  const receipts: Array<{
    action: string;
    inputs: Record<string, unknown>;
  }> = [];
  const service = new BetaService({
    store,
    enabled: true,
    requireInvite: true,
    releaseCommit: 'verify-release',
    activeReleaseManifestSha256: RELEASE_MANIFEST_SHA256,
    now: () => Date.now(),
    emitReceipt: (event) => {
      receipts.push({ action: event.action, inputs: event.inputs });
    },
  });
  const driftedService = new BetaService({
    store,
    enabled: true,
    requireInvite: true,
    releaseCommit: 'verify-release',
    activeReleaseManifestSha256: 'd'.repeat(64),
    now: () => Date.now(),
    emitReceipt: () => undefined,
  });
  const missingActiveService = new BetaService({
    store,
    enabled: true,
    requireInvite: true,
    releaseCommit: 'verify-release',
    activeReleaseManifestSha256: null,
    now: () => Date.now(),
    emitReceipt: () => undefined,
  });
  assert.deepEqual(
    missingActiveService.claimInvite(rawInvite, 'acc_missing_active'),
    { ok: false, status: 409, error: 'beta_invite_unavailable' },
  );
  assert.deepEqual(
    driftedService.claimInvite(rawInvite, 'acc_drifted'),
    { ok: false, status: 409, error: 'beta_invite_unavailable' },
  );
  assert.deepEqual(
    db.prepare(`
      SELECT status, account_id
      FROM beta_invites
      WHERE invite_id = 'verify-invite'
    `).get(),
    { status: 'issued', account_id: null },
  );
  const claim = service.claimInvite(rawInvite, 'acc_verify');
  assert.equal(claim.ok, true);
  assert.equal(claim.ok && claim.cohort?.cohort_id, 'verify-cohort');
  assert.equal(
    claim.ok && claim.cohort?.release_manifest_sha256,
    RELEASE_MANIFEST_SHA256,
  );
  assert.equal(service.claimInvite(rawInvite, 'acc_other').ok, false);
  assert.deepEqual(
    service.claimInvite(unboundInvite, 'acc_unbound'),
    { ok: false, status: 409, error: 'beta_invite_unavailable' },
  );
  assert.equal(
    service.status('acc_verify').cohort?.cohort_id,
    'verify-cohort',
  );
  assert.equal(
    service.status('acc_verify').cohort?.release_manifest_sha256,
    RELEASE_MANIFEST_SHA256,
  );
  assert.equal(
    service.status('acc_verify').cohort?.rollback_manifest_sha256,
    ROLLBACK_MANIFEST_SHA256,
  );

  const atomicInvite = newToken(24);
  store.insertCohort({
    cohort_id: 'verify-atomic-cohort',
    release_commit: 'verify-release',
    release_manifest_sha256: RELEASE_MANIFEST_SHA256,
    platform: 'web',
    invite_cap: 1,
    rollback_commit: 'verify-rollback',
    rollback_manifest_sha256: ROLLBACK_MANIFEST_SHA256,
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
  }, RELEASE_MANIFEST_SHA256);
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
  for (const action of [
    'beta_invite_redeemed',
    'beta_event_recorded',
    'beta_feedback_submitted',
  ]) {
    assert.ok(
      receipts.some(
        (receipt) => receipt.action === action
          && receipt.inputs.release_manifest_sha256 === RELEASE_MANIFEST_SHA256,
      ),
      `${action} must bind the cohort release manifest`,
    );
  }

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
    release_manifest_sha256: RELEASE_MANIFEST_SHA256,
    platform: 'web',
    invite_cap: 2,
    rollback_commit: 'verify-rollback',
    rollback_manifest_sha256: ROLLBACK_MANIFEST_SHA256,
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
  }, RELEASE_MANIFEST_SHA256);
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
    '[verify-beta-player-readiness] PASS: schema v27, canonical release/rollback binding, missing/stale/legacy fail-closed admission, cap, hashed invite, atomic account binding, redemption, six-step readiness labels, event, and P1 feedback contracts',
  );
} finally {
  db.close();
}
