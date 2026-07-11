// Beta Player Readiness and Measurement v1 report.
//
// The report joins the operational cohort ledger to account/session/character
// projections and canonical receipts. It deliberately emits no email, token,
// password, or player-authored feedback body.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { resolveChainPaths } from '../../../packages/shared/paths.js';

type Receipt = {
  actor_id?: string;
  action?: string;
  timestamp?: string;
  inputs?: Record<string, unknown>;
  result?: string;
};

type Cohort = {
  cohort_id: string;
  release_commit: string;
  platform: string;
  invite_cap: number;
  status: string;
  rollback_commit: string | null;
  created_at: string;
  opens_at: string | null;
  closes_at: string | null;
  created_by: string | null;
  issued_count: number;
  redeemed_count: number;
};

const root = path.resolve(import.meta.dirname, '../../..');
const paths = resolveChainPaths(root);

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function iso(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function timestamp(receipt: Receipt): number {
  return Date.parse(receipt.timestamp ?? '') || 0;
}

function unique(values: Iterable<string>): string[] {
  return Array.from(new Set(values));
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Number((numerator / denominator).toFixed(4));
}

function readReceipts(file: string): { receipts: Receipt[]; malformed: number } {
  if (!fs.existsSync(file)) return { receipts: [], malformed: 0 };
  let malformed = 0;
  const receipts: Receipt[] = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as Receipt;
      if (parsed && typeof parsed === 'object') receipts.push(parsed);
      else malformed += 1;
    } catch {
      malformed += 1;
    }
  }
  return { receipts, malformed };
}

async function healthCheck(url: string | null): Promise<Record<string, unknown>> {
  if (!url) return { status: 'not_checked' };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    return { status: response.ok && body?.ok === true ? 'pass' : 'fail', http_status: response.status, response: body };
  } catch (error) {
    return { status: 'unavailable', error: error instanceof Error ? error.message : String(error) };
  }
}

function safeRows<T>(db: Database.Database, sql: string, ...params: unknown[]): T[] {
  try {
    return db.prepare(sql).all(...params) as T[];
  } catch {
    return [];
  }
}

function buildCohortReport(db: Database.Database, receipts: Receipt[], cohort: Cohort, nowMs: number) {
  const invites = safeRows<{ invite_id: string; account_id: string | null; status: string; issued_at: string; redeemed_at: string | null }>(
    db,
    `SELECT invite_id, account_id, status, issued_at, redeemed_at FROM beta_invites WHERE cohort_id = ?`,
    cohort.cohort_id,
  );
  const accountIds = unique(invites.map((row) => row.account_id).filter((id): id is string => !!id));
  const accounts = safeRows<{ account_id: string; created_at: string }>(db, `SELECT account_id, created_at FROM accounts WHERE account_id IN (${accountIds.map(() => '?').join(',') || "''"})`, ...accountIds);
  const sessions = safeRows<{ account_id: string; session_id: string; created_at: string }>(db, `SELECT account_id, session_id, created_at FROM account_sessions WHERE account_id IN (${accountIds.map(() => '?').join(',') || "''"}) ORDER BY created_at ASC`, ...accountIds);
  const characters = safeRows<{ account_id: string; character_id: string }>(db, `SELECT account_id, character_id FROM account_characters WHERE account_id IN (${accountIds.map(() => '?').join(',') || "''"})`, ...accountIds);
  const characterIds = new Set(characters.map((row) => row.character_id));
  const cohortReceipts = receipts.filter((receipt) => {
    const inputs = receipt.inputs ?? {};
    if (inputs.cohort_id === cohort.cohort_id) return true;
    return typeof receipt.actor_id === 'string' && accountIds.includes(receipt.actor_id);
  });
  const eventReceipts = cohortReceipts.filter((receipt) => receipt.action === 'beta_event_recorded');
  const gameplayReceipts = receipts.filter((receipt) => typeof receipt.actor_id === 'string' && characterIds.has(receipt.actor_id));

  const firstLoginByAccount = new Map<string, number>();
  for (const session of sessions) {
    const when = Date.parse(session.created_at);
    if (Number.isFinite(when) && !firstLoginByAccount.has(session.account_id)) firstLoginByAccount.set(session.account_id, when);
  }
  const eligibleD1 = accountIds.filter((id) => (firstLoginByAccount.get(id) ?? nowMs) <= nowMs - 24 * 60 * 60 * 1000);
  const eligibleD7 = accountIds.filter((id) => (firstLoginByAccount.get(id) ?? nowMs) <= nowMs - 7 * 24 * 60 * 60 * 1000);
  const returnedAfter = (eligible: string[], days: number) => eligible.filter((id) => {
    const first = firstLoginByAccount.get(id) ?? nowMs;
    return sessions.some((session) => session.account_id === id && Date.parse(session.created_at) >= first + days * 24 * 60 * 60 * 1000);
  });

  const accountForCharacter = new Map(characters.map((row) => [row.character_id, row.account_id]));
  const actorSetForAction = (actions: string[], predicate?: (receipt: Receipt) => boolean) => new Set(
    gameplayReceipts
      .filter((receipt) => actions.includes(receipt.action ?? '') && (!predicate || predicate(receipt)))
      .map((receipt) => accountForCharacter.get(receipt.actor_id ?? '') ?? '')
      .filter(Boolean),
  );
  const firstMeaningfulAccounts = actorSetForAction(['move_result'], (receipt) => receipt.result === 'ok');
  for (const receipt of gameplayReceipts) {
    if (receipt.action === 'tutorial_step_complete' && receipt.inputs?.step === 'move') {
      const accountId = accountForCharacter.get(receipt.actor_id ?? '');
      if (accountId) firstMeaningfulAccounts.add(accountId);
    }
  }

  const eventCounts = (event: string) => unique(eventReceipts.filter((receipt) => receipt.inputs?.event === event).map((receipt) => receipt.actor_id ?? String(receipt.inputs?.client_session_id ?? ''))).length;
  const completedOnboarding = actorSetForAction(['tutorial_completed']);
  const cohortFeedbackIds = new Set(receipts
    .filter((item) => item.action === 'beta_feedback_submitted')
    .filter((item) => {
      const inputs = item.inputs ?? {};
      return inputs.cohort_id === cohort.cohort_id || (typeof item.actor_id === 'string' && accountIds.includes(item.actor_id));
    })
    .map((item) => typeof item.inputs?.feedback_id === 'string' ? item.inputs.feedback_id : null)
    .filter((id): id is string => !!id));
  const feedbackSubmitted = new Map<string, { severity: string; category: string; has_reproduction: boolean; status: string; owner: string | null; submitted_at: string | null }>();
  for (const receipt of receipts.filter((item) => item.action === 'beta_feedback_submitted' || item.action === 'beta_feedback_triaged')) {
    const inputs = receipt.inputs ?? {};
    const feedbackId = typeof inputs.feedback_id === 'string' ? inputs.feedback_id : null;
    if (!feedbackId) continue;
    if (receipt.action === 'beta_feedback_triaged' && !cohortFeedbackIds.has(feedbackId)) continue;
    if (receipt.action === 'beta_feedback_submitted' && !cohortFeedbackIds.has(feedbackId)) continue;
    const existing = feedbackSubmitted.get(feedbackId);
    if (receipt.action === 'beta_feedback_submitted') {
      feedbackSubmitted.set(feedbackId, {
        severity: String(inputs.severity ?? 'unknown'),
        category: String(inputs.category ?? 'unknown'),
        has_reproduction: typeof inputs.reproduction_steps === 'string' && inputs.reproduction_steps.length > 0,
        status: 'open',
        owner: null,
        submitted_at: receipt.timestamp ?? null,
      });
    } else if (existing) {
      feedbackSubmitted.set(feedbackId, {
        ...existing,
        status: String(inputs.status ?? existing.status),
        owner: typeof inputs.owner === 'string' ? inputs.owner : existing.owner,
      });
    }
  }
  const feedback = Array.from(feedbackSubmitted.values());

  const sessionStarts = eventReceipts.filter((receipt) => receipt.inputs?.event === 'play_session_started');
  const sessionEnds = eventReceipts.filter((receipt) => receipt.inputs?.event === 'play_session_ended');
  const durations = sessionEnds.map((receipt) => Number(receipt.inputs?.duration_ms)).filter((value) => Number.isFinite(value) && value >= 0);
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const median = sortedDurations.length ? sortedDurations[Math.floor(sortedDurations.length / 2)] : null;

  const gameplay = {
    movement: firstMeaningfulAccounts.size,
    combat: actorSetForAction(['combat_resolved', 'mob_kill']).size,
    chat: actorSetForAction(['chat'], (receipt) => receipt.result === 'ok').size,
    inventory: actorSetForAction(['item_added_to_inventory', 'item_minted']).size,
    quest_progression: actorSetForAction(['tutorial_step_complete', 'gate_unlock', 'tutorial_completed']).size,
    tutorial_completed: completedOnboarding.size,
  };

  const stabilityReceipts = receipts.filter((receipt) => {
    if (receipt.action === 'beta_event_recorded') return receipt.inputs?.cohort_id === cohort.cohort_id;
    return typeof receipt.actor_id === 'string' && (accountIds.includes(receipt.actor_id) || characterIds.has(receipt.actor_id));
  });

  return {
    cohort: {
      cohort_id: cohort.cohort_id,
      release_commit: cohort.release_commit,
      platform: cohort.platform,
      invite_cap: cohort.invite_cap,
      status: cohort.status,
      rollback_commit: cohort.rollback_commit,
    },
    invitations: {
      sent: invites.length,
      accepted: invites.filter((row) => row.status === 'redeemed').length,
      first_login: firstLoginByAccount.size,
      invite_conversion: ratio(invites.filter((row) => row.status === 'redeemed').length, invites.length),
      first_login_conversion: ratio(firstLoginByAccount.size, invites.filter((row) => row.status === 'redeemed').length),
    },
    playability: {
      browser_mount: eventCounts('browser_mount'),
      world_state_reached: eventCounts('world_state_reached'),
      onboarding_started: eventCounts('onboarding_started'),
      onboarding_completed: completedOnboarding.size,
      first_meaningful_action: firstMeaningfulAccounts.size,
      activation_rate: ratio(firstMeaningfulAccounts.size, invites.filter((row) => row.status === 'redeemed').length),
    },
    stability: {
      blank_screen_proxy: { browser_errors: eventCounts('browser_error') },
      crashes_proxy: { browser_errors: eventCounts('browser_error') },
      console_errors_proxy: { browser_errors: eventCounts('browser_error') },
      disconnects: eventCounts('ws_disconnected') + stabilityReceipts.filter((receipt) => receipt.action === 'disconnect').length,
      ws_errors: stabilityReceipts.filter((receipt) => receipt.action === 'ws_error').length,
      receipt_count: stabilityReceipts.length,
    },
    engagement: {
      first_session_length_ms: { sample_count: durations.length, median: median, average: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null },
      play_sessions_started: sessionStarts.length,
      play_sessions_ended: sessionEnds.length,
      d1: { eligible: eligibleD1.length, returned: returnedAfter(eligibleD1, 1).length, retention: ratio(returnedAfter(eligibleD1, 1).length, eligibleD1.length) },
      d7: { eligible: eligibleD7.length, returned: returnedAfter(eligibleD7, 7).length, retention: ratio(returnedAfter(eligibleD7, 7).length, eligibleD7.length) },
    },
    gameplay,
    feedback: {
      submitted: feedback.length,
      reproducible_submissions: feedback.filter((item) => item.has_reproduction).length,
      by_severity: Object.fromEntries(['P0', 'P1', 'P2', 'P3'].map((severity) => [severity, feedback.filter((item) => item.severity === severity).length])),
      open_or_active: feedback.filter((item) => item.status !== 'fixed' && item.status !== 'closed').length,
      items: feedback,
    },
    evidence: {
      account_count: accounts.length,
      character_count: characters.length,
      receipt_source: paths.receiptsPath,
      database_source: paths.dbPath,
      gameplay_truth: 'server_receipts',
      client_readiness_truth: 'allow-listed beta_event_recorded receipts',
    },
  };
}

const db = new Database(paths.dbPath, { readonly: true });
try {
  const cohortId = arg('cohort');
  const outPath = arg('out');
  const healthUrl = arg('health-url') ?? process.env.BETA_API_HEALTH_URL ?? null;
  const cohorts = safeRows<Cohort>(db, `
    SELECT c.*, COUNT(i.invite_id) AS issued_count,
           COALESCE(SUM(CASE WHEN i.status = 'redeemed' THEN 1 ELSE 0 END), 0) AS redeemed_count
    FROM beta_cohorts c
    LEFT JOIN beta_invites i ON i.cohort_id = c.cohort_id
    ${cohortId ? 'WHERE c.cohort_id = ?' : ''}
    GROUP BY c.cohort_id
    ORDER BY c.created_at DESC
  `, ...(cohortId ? [cohortId] : []));
  if (cohorts.length === 0) throw new Error(cohortId ? `cohort_not_found: ${cohortId}` : 'no_beta_cohorts');
  const { receipts, malformed } = readReceipts(paths.receiptsPath);
  const report = {
    report: 'BETA_PLAYER_READINESS_AND_MEASUREMENT_V1',
    generated_at: new Date().toISOString(),
    scope: cohortId ?? 'all_cohorts',
    source: { db: paths.dbPath, receipts: paths.receiptsPath, receipt_count: receipts.length, malformed_receipts: malformed },
    api_health: await healthCheck(healthUrl),
    cohorts: cohorts.map((cohort) => buildCohortReport(db, receipts, cohort, Date.now())),
    interpretation: {
      launch_claim: 'controlled playable pre-alpha cohort only',
      first_meaningful_action: 'server-accepted movement or move tutorial completion',
      retention_basis: 'account session created_at after first account session; use only after D1/D7 eligibility matures',
      player_feedback_text: 'omitted from report output; inspect private receipt chain under operator access',
    },
  };
  const json = JSON.stringify(report, null, 2);
  if (outPath) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outPath), `${json}\n`);
  }
  console.log(json);
} finally {
  db.close();
}
