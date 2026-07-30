#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const files = {
  schema: readFileSync(
    resolve(root, 'apps/server/src/persist/schema.ts'),
    'utf8',
  ),
  betaStore: readFileSync(
    resolve(root, 'apps/server/src/beta/store.ts'),
    'utf8',
  ),
  betaService: readFileSync(
    resolve(root, 'apps/server/src/beta/service.ts'),
    'utf8',
  ),
  betaRouter: readFileSync(
    resolve(root, 'apps/server/src/beta/router.ts'),
    'utf8',
  ),
  account: readFileSync(
    resolve(root, 'apps/server/src/account/service.ts'),
    'utf8',
  ),
  report: readFileSync(
    resolve(root, 'apps/server/tools/beta-player-readiness-report.ts'),
    'utf8',
  ),
  cli: readFileSync(
    resolve(root, 'apps/server/tools/beta-cohort.ts'),
    'utf8',
  ),
  serviceVerifier: readFileSync(
    resolve(root, 'apps/server/tools/verify-beta-player-readiness.ts'),
    'utf8',
  ),
  routerVerifier: readFileSync(
    resolve(root, 'apps/server/tools/verify-beta-router.test.ts'),
    'utf8',
  ),
  telemetry: readFileSync(
    resolve(root, 'apps/debug-client/src/services/betaTelemetry.ts'),
    'utf8',
  ),
  hook: readFileSync(
    resolve(root, 'apps/debug-client/src/hooks/useBetaTelemetry.ts'),
    'utf8',
  ),
  feedback: readFileSync(
    resolve(root, 'apps/debug-client/src/components/BetaFeedbackSheet.tsx'),
    'utf8',
  ),
  app: readFileSync(
    resolve(root, 'apps/debug-client/src/App.tsx'),
    'utf8',
  ),
  register: readFileSync(
    resolve(root, 'infra/web/beta/register.html'),
    'utf8',
  ),
  accountPortal: readFileSync(
    resolve(root, 'infra/web/beta/account.html'),
    'utf8',
  ),
  decision: readFileSync(
    resolve(
      root,
      'docs/decisions/AKALYNTH_BETA_PLAYER_READINESS_AND_MEASUREMENT_V1/DECISION.md',
    ),
    'utf8',
  ),
  runbook: readFileSync(
    resolve(root, 'docs/runbooks/beta-player-readiness-runbook-v1.md'),
    'utf8',
  ),
};

const checks = [];
function check(id, file, literal) {
  const pass = files[file].includes(literal);
  checks.push({
    id,
    status: pass ? 'pass' : 'fail',
    evidence: { file, literal },
  });
}

check('schema_v26', 'schema', 'export const SCHEMA_VERSION = 26;');
check(
  'cohort_table',
  'schema',
  'CREATE TABLE IF NOT EXISTS beta_cohorts',
);
check(
  'invite_hash_only',
  'schema',
  'token_hash      TEXT NOT NULL UNIQUE',
);
check('atomic_invite_claim', 'betaStore', 'UPDATE beta_invites');
check(
  'invite_gate_is_env_controlled',
  'account',
  'invite_code?: unknown',
);
check('beta_me_route', 'betaRouter', "path === '/v1/beta/me'");
check(
  'beta_event_route',
  'betaRouter',
  "path === '/v1/beta/events'",
);
check(
  'beta_feedback_route',
  'betaRouter',
  "path === '/v1/beta/feedback'",
);
check(
  'beta_redeem_route',
  'betaRouter',
  "path === '/v1/beta/invites/redeem'",
);
check(
  'readiness_events_are_receipts',
  'betaService',
  'RECEIPT_ACTIONS.BETA_EVENT_RECORDED',
);
check(
  'feedback_is_receipted',
  'betaService',
  'RECEIPT_ACTIONS.BETA_FEEDBACK_SUBMITTED',
);
check(
  'report_uses_server_receipts',
  'report',
  "gameplay_truth: 'server_receipts'",
);
check(
  'report_tracks_six_step_path',
  'report',
  'rookguard_six_step_progression',
);
check(
  'report_tracks_training_receipt',
  'report',
  "receipt.inputs?.mob_type === 'training_slime'",
);
check(
  'report_tracks_profession_receipt',
  'report',
  "['vocation_declared']",
);
check('report_contains_retention', 'report', 'd1:');
check('operator_can_triage', 'cli', 'BETA_FEEDBACK_TRIAGED');
check(
  'service_verifier_targets_v26',
  'serviceVerifier',
  'assert.equal(SCHEMA_VERSION, 26)',
);
check(
  'router_verifier_covers_csrf',
  'routerVerifier',
  "response.body.error, 'csrf_failed'",
);
check('browser_mount_event', 'hook', "'browser_mount'");
check('ws_disconnect_event', 'hook', "'ws_disconnected'");
check('six_step_client_context', 'hook', 'loop.rookguardQuest.steps');
check('player_feedback_sheet', 'feedback', 'Send report');
check('feedback_is_touch_safe', 'feedback', 'severityHelp');
check('feedback_is_in_dock', 'app', "key: 'feedback'");
check('feedback_posts_with_csrf', 'telemetry', "'x-csrf-token'");
check('invite_registration_field', 'register', 'invite_code: invite');
check('account_cohort_status', 'accountPortal', "'/v1/beta/me'");
check(
  'decision_preserves_stage',
  'decision',
  'Stage boundary: controlled playable pre-alpha only',
);
check(
  'runbook_preserves_rollback',
  'runbook',
  '--rollback <last-known-good-sha>',
);

const failed = checks.filter((item) => item.status === 'fail');
console.log(JSON.stringify({
  report: 'beta_player_readiness_static_contract',
  status: failed.length ? 'fail' : 'pass',
  checks,
}, null, 2));
if (failed.length) process.exit(1);
