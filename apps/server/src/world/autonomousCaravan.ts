import type { CausalParityEvent } from '../../../../packages/shared/causalParity.js';
import {
  FORGEHOLD_CARAVAN_EVENT_ID,
  FORGEHOLD_CARAVAN_MERCHANT_ARRIVED_ACTION,
  FORGEHOLD_CARAVAN_MERCHANT_ID,
} from '../../../../packages/shared/skills.js';
import type { AuditReceipt } from '../../../../packages/shared/types.js';
import { chronicleEventFromRow } from '../chronicle/sharedWorldObservation.js';
import type { ChronicleEventRow } from '../persist/types.js';

type WriteReceipt = (receipt: {
  actor_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
}) => AuditReceipt | unknown;

export interface AutonomousCaravanAdvance {
  emitted: boolean;
  event_instance_id: string | null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function causalForRow(row: ChronicleEventRow): CausalParityEvent | null {
  return chronicleEventFromRow(row).causal ?? null;
}

/**
 * Advance the one autonomous actor in the Forgehold route slice.
 *
 * The schedule and state are read from persisted causal rows. The function is
 * deliberately clock-injected and idempotent: the emitted receipt becomes the
 * durable marker that prevents a second arrival.
 */
export function advanceForgeholdCaravanActor(
  rows: ChronicleEventRow[],
  nowMs: number,
  writeReceipt: WriteReceipt,
): AutonomousCaravanAdvance {
  const entries = rows
    .map((row) => ({ row, causal: causalForRow(row) }))
    .filter((entry): entry is { row: ChronicleEventRow; causal: CausalParityEvent } => entry.causal !== null);

  if (entries.some((entry) => entry.causal.resolution.event_type === 'caravan_merchant_arrived')) {
    return { emitted: false, event_instance_id: null };
  }

  const guard = entries.find((entry) => entry.causal.resolution.event_type === 'caravan_guard_patrol_set');
  if (!guard) return { emitted: false, event_instance_id: null };

  const guardAfter = guard.causal.state_transition.after ?? {};
  const dueAtMs = finiteNumber(guardAfter.merchant_travel_due_at_ms);
  if (dueAtMs === null || nowMs < dueAtMs) {
    return { emitted: false, event_instance_id: null };
  }

  const eventInstanceId = `${guard.causal.event_id}:merchant_arrived`;
  const stateBefore = { ...guardAfter };
  const stateAfter = {
    ...stateBefore,
    merchant_access: 'open',
    merchant_stock: 1,
    merchant_travel_due_at_ms: null,
  };

  writeReceipt({
    actor_id: FORGEHOLD_CARAVAN_MERCHANT_ID,
    action: FORGEHOLD_CARAVAN_MERCHANT_ARRIVED_ACTION,
    inputs: {
      event_id: FORGEHOLD_CARAVAN_EVENT_ID,
      event_instance_id: eventInstanceId,
      parent_event_id: guard.causal.event_id,
      event_type: 'caravan_merchant_arrived',
      phase: 'merchant_arrived',
      agent_id: FORGEHOLD_CARAVAN_MERCHANT_ID,
      chronicle_player_id: guard.row.player_id,
      route_id: 'forgehold_route_slice_v1',
      act_id: 'act_02_ember_road_recovery',
      location_id: 'forgehold_route_slice_v1',
      scheduled_at_ms: dueAtMs,
      arrived_at_ms: nowMs,
      state_before: stateBefore,
      state_after: stateAfter,
      effects: {
        merchant_stock_delta: 1,
        merchant_access: 'open',
      },
      downstream_event_ids: [],
      next_objective: 'The road remembers who kept it safe; more trade may follow.',
      memory: `Merchant Lora has set up a small stall on the eastern road. She mentions the guard you helped post made the first run possible. A child asked if the "road protector" would be back.`,
      economy_impact: 'restocked',
    },
    result: 'ok',
  });

  return { emitted: true, event_instance_id: eventInstanceId };
}
