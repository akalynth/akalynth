import type { ExtractedReceipt, LearningFeatureRow } from './types.js';

export const FEATURE_VERSION = 'anti_cheat_features_v1';

const DEFAULT_SESSION_GAP_MS = 30 * 60 * 1000;
const SESSION_START_ACTIONS = new Set(['session_guest_minted']);
const SESSION_TERMINAL_ACTIONS = new Set(['session_guest_expired', 'kick']);

interface SessionAccumulator {
  player_id: string;
  session_id: string;
  window_start: string;
  window_end: string;
  first_sequence: number;
  last_sequence: number;
  receipt_count: number;
  move_intent_count: number;
  accepted_move_count: number;
  rejected_move_count: number;
  move_intervals_ms: number[];
  last_move_intent_ms: number | null;
  perfect_cadence_count: number;
  tem_challenge_issued_count: number;
  tem_response_count: number;
  tem_failed_count: number;
  heat_changed_count: number;
  max_heat_seen: number;
  heat_escalation_count: number;
  runestone_denial_spam_count: number;
  repeated_legend_probe_count: number;
  chat_message_count: number;
  chat_rate_spike_count: number;
  chat_timestamps_ms: number[];
  throttle_count: number;
  kick_count: number;
  rate_limit_exceeded_count: number;
  map_transition_count: number;
  disconnect_count: number;
  current_map: string | null;
  last_timestamp_ms: number;
  last_action: string;
}

export interface BuildFeatureRowsOptions {
  sessionGapMs?: number;
}

export function buildFeatureRows(
  events: ExtractedReceipt[],
  options: BuildFeatureRowsOptions = {}
): LearningFeatureRow[] {
  const sessionGapMs = options.sessionGapMs ?? DEFAULT_SESSION_GAP_MS;
  const byPlayer = new Map<string, SessionAccumulator>();
  const rows: LearningFeatureRow[] = [];

  for (const event of events) {
    const current = byPlayer.get(event.actor_id);
    const mustRotate =
      !current ||
      SESSION_START_ACTIONS.has(event.action) ||
      event.timestamp_ms - current.last_timestamp_ms > sessionGapMs ||
      SESSION_TERMINAL_ACTIONS.has(current.last_action);

    const session = mustRotate ? startSession(event) : current;

    if (mustRotate && current) {
      rows.push(finalizeSession(current));
    }

    applyEvent(session, event);
    byPlayer.set(event.actor_id, session);
  }

  for (const session of byPlayer.values()) {
    rows.push(finalizeSession(session));
  }

  return rows;
}

function startSession(event: ExtractedReceipt): SessionAccumulator {
  return {
    player_id: event.actor_id,
    session_id: `sess_${event.actor_id}_${event.sequence}`,
    window_start: event.timestamp,
    window_end: event.timestamp,
    first_sequence: event.sequence,
    last_sequence: event.sequence,
    receipt_count: 0,
    move_intent_count: 0,
    accepted_move_count: 0,
    rejected_move_count: 0,
    move_intervals_ms: [],
    last_move_intent_ms: null,
    perfect_cadence_count: 0,
    tem_challenge_issued_count: 0,
    tem_response_count: 0,
    tem_failed_count: 0,
    heat_changed_count: 0,
    max_heat_seen: 0,
    heat_escalation_count: 0,
    runestone_denial_spam_count: 0,
    repeated_legend_probe_count: 0,
    chat_message_count: 0,
    chat_rate_spike_count: 0,
    chat_timestamps_ms: [],
    throttle_count: 0,
    kick_count: 0,
    rate_limit_exceeded_count: 0,
    map_transition_count: 0,
    disconnect_count: 0,
    current_map: null,
    last_timestamp_ms: event.timestamp_ms,
    last_action: event.action,
  };
}

function applyEvent(session: SessionAccumulator, event: ExtractedReceipt): void {
  session.window_end = event.timestamp;
  session.last_sequence = event.sequence;
  session.receipt_count += 1;
  session.last_timestamp_ms = event.timestamp_ms;
  session.last_action = event.action;

  switch (event.action) {
    case 'move_intent': {
      session.move_intent_count += 1;
      if (session.last_move_intent_ms !== null) {
        session.move_intervals_ms.push(event.timestamp_ms - session.last_move_intent_ms);
      }
      session.last_move_intent_ms = event.timestamp_ms;
      break;
    }
    case 'move_result': {
      const ok = Boolean((event.inputs as Record<string, unknown>).ok);
      if (ok) {
        session.accepted_move_count += 1;
      } else {
        session.rejected_move_count += 1;
      }
      const nextMap = readMapName((event.inputs as Record<string, unknown>).to);
      if (nextMap) {
        if (session.current_map !== null && session.current_map !== nextMap) {
          session.map_transition_count += 1;
        }
        session.current_map = nextMap;
      }
      break;
    }
    case 'cadence_suspected':
      session.perfect_cadence_count += 1;
      break;
    case 'tem_challenge_issued':
      session.tem_challenge_issued_count += 1;
      break;
    case 'tem_challenge_passed':
      session.tem_response_count += 1;
      break;
    case 'tem_challenge_failed':
      session.tem_response_count += 1;
      session.tem_failed_count += 1;
      break;
    case 'heat_changed': {
      session.heat_changed_count += 1;
      const newScore = Number((event.inputs as Record<string, unknown>).new_score ?? 0);
      if (Number.isFinite(newScore)) {
        session.max_heat_seen = Math.max(session.max_heat_seen, newScore);
      }
      break;
    }
    case 'heat_tem_escalation':
    case 'heat_penalty_applied':
      session.heat_escalation_count += 1;
      break;
    case 'runestone_denied':
      session.runestone_denial_spam_count += 1;
      break;
    case 'legend_attempted': {
      const attemptN = Number((event.inputs as Record<string, unknown>).attempt_n ?? 0);
      if (Number.isFinite(attemptN) && attemptN > 1) {
        session.repeated_legend_probe_count += 1;
      }
      break;
    }
    case 'chat':
      session.chat_message_count += 1;
      trackChatRate(session, event.timestamp_ms);
      break;
    case 'throttle':
      session.throttle_count += 1;
      break;
    case 'kick':
      session.kick_count += 1;
      session.disconnect_count += 1;
      break;
    case 'rate_limit_exceeded':
      session.rate_limit_exceeded_count += 1;
      break;
    case 'session_guest_expired':
      session.disconnect_count += 1;
      break;
    default:
      break;
  }
}

function trackChatRate(session: SessionAccumulator, timestampMs: number): void {
  session.chat_timestamps_ms.push(timestampMs);
  session.chat_timestamps_ms = session.chat_timestamps_ms.filter((value) => timestampMs - value <= 5_000);
  if (session.chat_timestamps_ms.length >= 8) {
    session.chat_rate_spike_count += 1;
  }
}

function finalizeSession(session: SessionAccumulator): LearningFeatureRow {
  const avgMoveIntervalMs = average(session.move_intervals_ms);
  const varianceMs = variance(session.move_intervals_ms, avgMoveIntervalMs);
  const moveOutcomeCount = session.accepted_move_count + session.rejected_move_count;
  return {
    feature_version: FEATURE_VERSION,
    player_id: session.player_id,
    session_id: session.session_id,
    window_start: session.window_start,
    window_end: session.window_end,
    move_intent_count: session.move_intent_count,
    accepted_move_count: session.accepted_move_count,
    rejected_move_count: session.rejected_move_count,
    reject_ratio: moveOutcomeCount === 0 ? 0 : round(session.rejected_move_count / moveOutcomeCount),
    avg_move_interval_ms: round(avgMoveIntervalMs),
    move_interval_variance_ms: round(varianceMs),
    perfect_cadence_count: session.perfect_cadence_count,
    tem_challenge_issued_count: session.tem_challenge_issued_count,
    tem_response_count: session.tem_response_count,
    tem_failed_count: session.tem_failed_count,
    heat_changed_count: session.heat_changed_count,
    max_heat_seen: round(session.max_heat_seen),
    heat_escalation_count: session.heat_escalation_count,
    runestone_denial_spam_count: session.runestone_denial_spam_count,
    repeated_legend_probe_count: session.repeated_legend_probe_count,
    chat_message_count: session.chat_message_count,
    chat_rate_spike_count: session.chat_rate_spike_count,
    throttle_count: session.throttle_count,
    kick_count: session.kick_count,
    rate_limit_exceeded_count: session.rate_limit_exceeded_count,
    session_duration_ms: Math.max(0, session.last_timestamp_ms - Date.parse(session.window_start)),
    map_transition_count: session.map_transition_count,
    disconnect_count: session.disconnect_count,
    first_sequence: session.first_sequence,
    last_sequence: session.last_sequence,
    receipt_count: session.receipt_count,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function readMapName(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const map = (value as Record<string, unknown>).map;
  return typeof map === 'string' ? map : null;
}
