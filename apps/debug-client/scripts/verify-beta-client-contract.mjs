import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const repoRoot = resolve(appRoot, '../..');

const files = {
  app: readFileSync(resolve(appRoot, 'src/App.tsx'), 'utf8'),
  css: readFileSync(resolve(appRoot, 'src/index.css'), 'utf8'),
  feedback: readFileSync(resolve(appRoot, 'src/components/BetaFeedbackSheet.tsx'), 'utf8'),
  telemetryHook: readFileSync(resolve(appRoot, 'src/hooks/useBetaTelemetry.ts'), 'utf8'),
  telemetryService: readFileSync(resolve(appRoot, 'src/services/betaTelemetry.ts'), 'utf8'),
  accountPortal: readFileSync(resolve(repoRoot, 'infra/web/beta/account.html'), 'utf8'),
  registerPortal: readFileSync(resolve(repoRoot, 'infra/web/beta/register.html'), 'utf8'),
};

const checks = [];

function requireLiteral(id, file, literal) {
  checks.push({
    id,
    pass: files[file].includes(literal),
    evidence: `${file} includes ${JSON.stringify(literal)}`,
  });
}

function forbidLiteral(id, file, literal) {
  checks.push({
    id,
    pass: !files[file].includes(literal),
    evidence: `${file} omits ${JSON.stringify(literal)}`,
  });
}

function requirePattern(id, file, pattern) {
  checks.push({
    id,
    pass: pattern.test(files[file]),
    evidence: `${file} matches ${String(pattern)}`,
  });
}

requireLiteral(
  'register_keeps_explicit_invite_input',
  'registerPortal',
  '<input id="invite" type="text"',
);
requireLiteral(
  'register_submits_optional_invite_body',
  'registerPortal',
  '...(invite ? { invite_code: invite } : {})',
);
forbidLiteral(
  'register_does_not_read_raw_invite_from_query',
  'registerPortal',
  "new URLSearchParams(window.location.search).get('invite')",
);
forbidLiteral(
  'register_does_not_name_invite_query_parameter',
  'registerPortal',
  "params.get('invite')",
);

requireLiteral(
  'rookguard_step_uses_server_six_step_projection',
  'telemetryHook',
  "return nextQuestStep ?? (loop.rookguardQuest.completed ? 'complete' : undefined);",
);
requireLiteral(
  'rookguard_completion_precedes_legacy_fallback',
  'telemetryHook',
  'return loop.rookguardQuest ? loop.rookguardQuest.completed : loop.complete;',
);
requireLiteral(
  'onboarding_event_uses_completion_helper',
  'telemetryHook',
  'if (betaOnboardingComplete(state) && !sentOnboardingComplete.current) {',
);

requireLiteral(
  'document_lifecycle_survives_strict_effect_replay',
  'telemetryHook',
  'const lifecycleByHttpBase = new Map<string, BetaDocumentLifecycle>();',
);
requireLiteral(
  'browser_mount_is_document_guarded',
  'telemetryHook',
  'if (!lifecycle.browserMountSent) {',
);
requireLiteral(
  'session_start_is_guarded',
  'telemetryHook',
  'if (lifecycle.activeSessionStartedAt !== null) return;',
);
requirePattern(
  'session_end_clears_before_emit',
  'telemetryHook',
  /lifecycle\.activeSessionStartedAt = null;\s+sendBetaEvent\(httpBase, 'play_session_ended'/,
);
requireLiteral(
  'bfcache_restore_starts_only_persisted_page',
  'telemetryHook',
  'if (event.persisted) startPlaySession(httpBase, lifecycle, currentMap.current);',
);
requireLiteral(
  'pagehide_and_pageshow_are_both_observed',
  'telemetryHook',
  "window.addEventListener('pageshow', onPageShow);",
);

requirePattern(
  'feedback_transport_is_caught',
  'telemetryService',
  /export async function submitBetaFeedback[\s\S]*?\btry \{[\s\S]*?\} catch \{/,
);
requireLiteral(
  'feedback_transport_preserves_draft_message',
  'telemetryService',
  'Could not reach beta feedback. Your draft is still here; try again.',
);
requirePattern(
  'feedback_sheet_always_releases_busy_state',
  'feedback',
  /\} finally \{\s+setBusy\(false\);/,
);
requireLiteral(
  'feedback_sheet_has_error_notice',
  'feedback',
  "setNotice({ kind: 'error', message: result.error });",
);
requireLiteral(
  'feedback_error_has_distinct_style',
  'css',
  '.beta-feedback-notice--error',
);

requireLiteral(
  'feedback_dialog_has_focus_ref',
  'feedback',
  'const dialogRef = useRef<HTMLElement>(null);',
);
requireLiteral(
  'feedback_dialog_focuses_entry',
  'feedback',
  '(focusable()[0] ?? dialog)?.focus();',
);
requireLiteral(
  'feedback_dialog_closes_on_escape',
  'feedback',
  "if (event.key === 'Escape') {",
);
requireLiteral(
  'feedback_dialog_traps_tab',
  'feedback',
  "if (event.key !== 'Tab') return;",
);
requireLiteral(
  'feedback_dialog_restores_focus',
  'feedback',
  'previouslyFocused?.focus();',
);

requirePattern(
  'beta_status_is_optional_and_caught',
  'accountPortal',
  /async function renderBetaStatus\(\) \{[\s\S]*?\btry \{[\s\S]*?\} catch \{\s+notice\.style\.display = 'none';/,
);
requireLiteral(
  'beta_status_does_not_block_account_boot',
  'accountPortal',
  'void renderBetaStatus();',
);
forbidLiteral(
  'beta_status_is_not_awaited',
  'accountPortal',
  'await renderBetaStatus();',
);
requireLiteral(
  'presentation_dock_exposes_report',
  'app',
  "key: 'feedback',",
);
requirePattern(
  'presentation_dock_has_five_columns',
  'css',
  /\.app-shell--presentation \.bottom-actions\s*\{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/,
);

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  for (const check of failed) {
    console.error(`[verify-beta-client-contract] FAIL ${check.id}: ${check.evidence}`);
  }
  process.exit(1);
}

console.log(`[verify-beta-client-contract] PASS (${checks.length}/${checks.length})`);
