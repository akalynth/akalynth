import type { CausalParityEvent, SharedWorldId } from '../../../../packages/shared/causalParity.js';
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
): SharedWorldObservationMessage {
  const events = rows.map(chronicleEventFromRow);
  const latest = events.find((event) => event.causal?.world_id === worldId)?.causal ?? null;
  return {
    type: 'shared_world_observation',
    observer_player_id: observerPlayerId,
    world_id: worldId,
    state: latest?.state_transition.after ?? null,
    latest_event_id: latest?.event_id ?? null,
    latest_receipt_hash: latest?.receipt.hash ?? null,
    events,
  };
}
