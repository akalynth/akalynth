import { SHARED_WORLD_IDS, type CausalParityEvent, type SharedWorldId } from '../../../../packages/shared/causalParity.js';
import type { ChronicleEvent, SharedWorldObservationMessage } from '../../../../packages/shared/protocol.js';
import type { ChronicleEventRow } from '../persist/types.js';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function detailsForRow(row: ChronicleEventRow): Record<string, unknown> {
  try {
    const parsed = JSON.parse(row.details_json) as unknown;
    return record(parsed) ?? {};
  } catch {
    return {};
  }
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Reduce persisted causal transitions into the current public world view.
 * Rows are stored newest-first, but state transitions must be applied oldest
 * first so partial downstream reactions (such as the canal merchant reaction)
 * do not hide fields established by their parent event.
 */
function sharedWorldStateAt(
  worldId: SharedWorldId,
  causalEvents: CausalParityEvent[],
  nowMs: number,
): Record<string, unknown> | null {
  const state: Record<string, unknown> = {};
  for (const causal of causalEvents.slice().reverse()) {
    if (causal.state_transition.after) Object.assign(state, causal.state_transition.after);
  }
  if (Object.keys(state).length === 0) return null;

  if (worldId === SHARED_WORLD_IDS.rookguardCanal) {
    const recoversAtMs = finiteNumber(state.recovers_at_ms);
    if (recoversAtMs !== null) {
      const recovered = nowMs >= recoversAtMs;
      state.canal_state = recovered ? 'calm' : (state.canal_state ?? 'disturbed');
      state.phase = recovered ? 'ready' : 'recovering';
      state.remaining_recovery_ms = recovered ? 0 : Math.max(0, recoversAtMs - nowMs);
    }
  }

  return state;
}

export function chronicleEventFromRow(row: ChronicleEventRow): ChronicleEvent {
  const details = detailsForRow(row);
  const causalValue = record(details.causal);
  const causal = causalValue as CausalParityEvent | null;
  const event: ChronicleEvent = {
    kind: row.kind,
    timestamp: row.timestamp,
    zone: row.zone,
    x: row.x,
    y: row.y,
    details,
  };

  if (causal) event.causal = causal;
  if (row.evidence_ref) {
    try {
      event.evidence_ref = JSON.parse(row.evidence_ref) as {
        chronicle_event_id: number;
        receipt_hash: string;
      };
    } catch {
      event.evidence_ref = null;
    }
  }
  return event;
}

export function sharedWorldObservationFromRows(
  observerPlayerId: string,
  worldId: SharedWorldId,
  rows: ChronicleEventRow[],
  nowMs: number = Date.now(),
): SharedWorldObservationMessage {
  const events = rows.map(chronicleEventFromRow);
  const causalEvents = events
    .map((event) => event.causal)
    .filter((event): event is CausalParityEvent => event?.world_id === worldId);
  const latest = causalEvents[0] ?? null;
  return {
    type: 'shared_world_observation',
    observer_player_id: observerPlayerId,
    world_id: worldId,
    state: sharedWorldStateAt(worldId, causalEvents, nowMs),
    latest_event_id: latest?.event_id ?? null,
    latest_receipt_hash: latest?.receipt.hash ?? null,
    events,
  };
}
