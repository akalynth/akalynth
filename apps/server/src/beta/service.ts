// Beta Player Readiness and Measurement v1.
//
// This service accepts only bounded readiness signals. It never accepts player
// position, inventory, combat, quest, or retention truth from the client.
// Gameplay metrics are reconstructed from server receipts by the readiness
// report tool.
import { createHash } from 'node:crypto';
import type {
  BetaCohortStatus,
  BetaFeedbackRequest,
  BetaFeedbackResponse,
  BetaMeResponse,
  BetaReadinessEventRequest,
  BetaReadinessEventResponse,
} from '../../../../packages/shared/http.js';
import { newId, hashToken } from '../account/tokens.js';
import { RECEIPT_ACTIONS } from '../persist/types.js';
import { BetaStore } from './store.js';

const EVENTS = new Set<BetaReadinessEventRequest['event']>([
  'browser_mount',
  'browser_error',
  'ws_connected',
  'ws_disconnected',
  'world_state_reached',
  'play_session_started',
  'play_session_ended',
  'onboarding_started',
  'onboarding_completed',
]);
const SEVERITIES = new Set<BetaFeedbackRequest['severity']>(['P0', 'P1', 'P2', 'P3']);
const CATEGORIES = new Set<BetaFeedbackRequest['category']>(['onboarding', 'stability', 'gameplay', 'accessibility', 'other']);
const STEPS = new Set(['move', 'chat', 'tem', 'training', 'profession', 'gate', 'complete']);
const CLIENT_SESSION_RE = /^[A-Za-z0-9_-]{16,96}$/;
const SAFE_REASON_RE = /^[a-z0-9_.:-]{1,96}$/i;
const MAX_TITLE = 120;
const MAX_BODY = 4000;
const MAX_REPRO = 4000;

export interface BetaInviteClaim {
  ok: true;
  cohort: BetaCohortStatus | null;
}

export interface BetaInviteClaimFailure {
  ok: false;
  status: 400 | 403 | 409;
  error: 'beta_invite_required' | 'beta_invite_invalid' | 'beta_invite_unavailable';
}

export interface BetaServiceDeps {
  store: BetaStore;
  enabled: boolean;
  requireInvite: boolean;
  releaseCommit: string;
  now: () => number;
  emitReceipt: (event: { actorId: string; action: string; inputs: Record<string, unknown>; result: string }) => void;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function accountActor(accountId: string | null, clientSessionId: string): string {
  if (accountId) return accountId;
  return `beta_session_${createHash('sha256').update(clientSessionId).digest('hex').slice(0, 24)}`;
}

function normalizeSessionId(value: unknown): string | null {
  return typeof value === 'string' && CLIENT_SESSION_RE.test(value) ? value : null;
}

function normalizeStep(value: unknown): string | null {
  return typeof value === 'string' && STEPS.has(value) ? value : null;
}

function normalizeMap(value: unknown): 'Rookguard' | 'Azura' | null {
  return value === 'Rookguard' || value === 'Azura' ? value : null;
}

function cohortStatus(row: ReturnType<BetaStore['cohortForAccount']>): BetaCohortStatus | null {
  if (!row) return null;
  return {
    cohort_id: row.cohort.cohort_id,
    release_commit: row.cohort.release_commit,
    platform: row.cohort.platform,
    invite_cap: row.cohort.invite_cap,
    invite_status: 'redeemed',
    joined_at: row.redeemed_at ?? row.issued_at,
    rollback_commit: row.cohort.rollback_commit,
  };
}

export class BetaService {
  constructor(private readonly d: BetaServiceDeps) {}

  claimInvite(
    code: unknown,
    accountId: string,
    commitAccount?: () => void,
  ): BetaInviteClaim | BetaInviteClaimFailure {
    const raw = typeof code === 'string' ? code.trim() : '';
    if (!raw) {
      if (this.d.requireInvite) {
        return { ok: false, status: 403, error: 'beta_invite_required' };
      }
      commitAccount?.();
      return { ok: true, cohort: null };
    }
    if (this.d.store.cohortForAccount(accountId)) {
      return { ok: false, status: 409, error: 'beta_invite_unavailable' };
    }
    const claimed = this.d.store.claimInvite(
      hashToken(raw),
      accountId,
      iso(this.d.now()),
      commitAccount,
    );
    if (!claimed.ok) {
      return {
        ok: false,
        status: claimed.reason === 'cohort_closed' ? 409 : 403,
        error: claimed.reason === 'cohort_closed' ? 'beta_invite_unavailable' : 'beta_invite_invalid',
      };
    }
    const cohort = {
      cohort_id: claimed.cohort.cohort_id,
      release_commit: claimed.cohort.release_commit,
      platform: claimed.cohort.platform,
      invite_cap: claimed.cohort.invite_cap,
      invite_status: 'redeemed' as const,
      joined_at: claimed.invite.redeemed_at ?? iso(this.d.now()),
      rollback_commit: claimed.cohort.rollback_commit,
    };
    this.d.emitReceipt({
      actorId: accountId,
      action: RECEIPT_ACTIONS.BETA_INVITE_REDEEMED,
      inputs: { invite_id: claimed.invite.invite_id, cohort_id: cohort.cohort_id, release_commit: cohort.release_commit },
      result: 'ok',
    });
    return { ok: true, cohort };
  }

  status(accountId: string): BetaMeResponse {
    return { ok: true, enabled: this.d.enabled, cohort: cohortStatus(this.d.store.cohortForAccount(accountId)) };
  }

  recordEvent(
    accountId: string | null,
    input: BetaReadinessEventRequest,
  ): BetaReadinessEventResponse | { status: 400; error: string } {
    if (!this.d.enabled) return { status: 400, error: 'beta_measurement_disabled' };
    if (!EVENTS.has(input.event)) return { status: 400, error: 'invalid_event' };
    const clientSessionId = normalizeSessionId(input.client_session_id);
    if (!clientSessionId) return { status: 400, error: 'invalid_client_session_id' };
    const map = normalizeMap(input.map);
    const tutorialStep = normalizeStep(input.tutorial_step);
    const reason = input.reason === undefined
      ? null
      : typeof input.reason === 'string' && SAFE_REASON_RE.test(input.reason)
        ? input.reason
        : null;
    const durationMs = input.duration_ms === undefined
      ? null
      : typeof input.duration_ms === 'number'
        && Number.isInteger(input.duration_ms)
        && input.duration_ms >= 0
        && input.duration_ms <= 86_400_000
        ? input.duration_ms
        : null;
    const eventId = newId('be');
    const recordedAt = iso(this.d.now());
    this.d.emitReceipt({
      actorId: accountActor(accountId, clientSessionId),
      action: RECEIPT_ACTIONS.BETA_EVENT_RECORDED,
      inputs: {
        event_id: eventId,
        event: input.event,
        client_session_id: clientSessionId,
        cohort_id: accountId ? (this.d.store.cohortForAccount(accountId)?.cohort.cohort_id ?? null) : null,
        release_commit: this.d.releaseCommit,
        map,
        tutorial_step: tutorialStep,
        reason,
        duration_ms: durationMs,
      },
      result: 'ok',
    });
    return { ok: true, event_id: eventId, server_recorded_at: recordedAt };
  }

  submitFeedback(
    accountId: string,
    input: BetaFeedbackRequest,
  ): BetaFeedbackResponse | { status: 400; error: string } {
    if (!SEVERITIES.has(input.severity)) return { status: 400, error: 'invalid_severity' };
    if (!CATEGORIES.has(input.category)) return { status: 400, error: 'invalid_category' };
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const body = typeof input.body === 'string' ? input.body.trim() : '';
    const reproduction = typeof input.reproduction_steps === 'string' ? input.reproduction_steps.trim() : '';
    if (!title || title.length > MAX_TITLE || !body || body.length > MAX_BODY || reproduction.length > MAX_REPRO) {
      return { status: 400, error: 'invalid_feedback' };
    }
    const clientSessionId = input.client_session_id === undefined ? null : normalizeSessionId(input.client_session_id);
    if (input.client_session_id !== undefined && !clientSessionId) {
      return { status: 400, error: 'invalid_client_session_id' };
    }
    const feedbackId = newId('bf');
    const cohort = this.d.store.cohortForAccount(accountId)?.cohort.cohort_id ?? null;
    this.d.emitReceipt({
      actorId: accountId,
      action: RECEIPT_ACTIONS.BETA_FEEDBACK_SUBMITTED,
      inputs: {
        feedback_id: feedbackId,
        severity: input.severity,
        category: input.category,
        title,
        body,
        reproduction_steps: reproduction || null,
        client_session_id: clientSessionId,
        cohort_id: cohort,
        release_commit: this.d.releaseCommit,
        map: normalizeMap(input.map),
        tutorial_step: normalizeStep(input.tutorial_step),
      },
      result: 'open',
    });
    return { ok: true, feedback_id: feedbackId, status: 'open' };
  }
}
