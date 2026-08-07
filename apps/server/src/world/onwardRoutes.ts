import type { AuditReceipt } from '../../../../packages/shared/types.js';
import {
  ASHGLASS_EVIDENCE_RECOVERED_ACTION,
  DREAM_FRAGMENT_ANCHORED_ACTION,
  DREAM_GATE_ARRIVAL_RECORDED_ACTION,
  DREAM_GATE_INTERPRETED_ACTION,
  DREAM_GATE_SEAL_PREPARED_ACTION,
  DREAM_GATE_TRAVERSAL_AUTHORIZED_ACTION,
  FORGEHOLD_ASHGLASS_RAVINE_EVIDENCE_RECOVERED_ACTION,
  FORGEHOLD_CARAVAN_EVIDENCE_RECOVERED_ACTION,
  FORGEHOLD_CARAVAN_ACTIVITY_ID,
  FORGEHOLD_CARAVAN_GUARD_DECISION_ACTION,
  FORGEHOLD_CARAVAN_MERCHANT_ARRIVED_ACTION,
  FORGEHOLD_COMPONENT_PAYOUT_CREDITED_ACTION,
  FORGEHOLD_COMPONENT_SETTLED_ACTION,
  FORGEHOLD_ECONOMY_QUOTED_ACTION,
  FORGEHOLD_CARAVAN_EVENT_ID,
  FORGEHOLD_MILEPOST_EVIDENCE_RECOVERED_ACTION,
  FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION,
  HEARTFORGE_GATE_PREPARED_ACTION,
  ROUTE_ABUSE_NOTES_REVIEWED_ACTION,
  ROUTE_SURVEYED_ACTION,
  SOULSTEEL_COMPONENT_MINTED_ACTION,
  SOULSTEEL_REFINEMENT_AUTHORIZED_ACTION,
  SOULSTEEL_STABILIZED_ACTION,
} from '../../../../packages/shared/skills.js';

export interface OnwardRouteReceiptProgress {
  forgeholdSurveyed: boolean;
  forgeholdMilepostEvidenceRecovered: boolean;
  forgeholdCaravanEvidenceRecovered: boolean;
  forgeholdAshglassRavineEvidenceRecovered: boolean;
  forgeholdShipmentInvestigated: boolean;
  forgeholdEconomyQuoted: boolean;
  soulsteelStabilized: boolean;
  forgeholdAbuseNotesReviewed: boolean;
  heartforgeGatePrepared: boolean;
  ashglassEvidenceRecovered: boolean;
  soulsteelRefinementAuthorized: boolean;
  soulsteelComponentMinted: boolean;
  forgeholdComponentSettled: boolean;
  forgeholdComponentPayoutCredited: boolean;
  moonspireSurveyed: boolean;
  dreamGateInterpreted: boolean;
  dreamFragmentAnchored: boolean;
  dreamGateAbuseNotesReviewed: boolean;
  dreamGateSealPrepared: boolean;
  dreamGateTraversalAuthorized: boolean;
  dreamGateArrivalRecorded: boolean;
  forgeholdCaravanProtection: {
    activity_id: typeof FORGEHOLD_CARAVAN_ACTIVITY_ID;
    route_id: 'forgehold_route_slice_v1';
    act_id: 'act_02_ember_road_recovery';
    event_sequence: number;
    last_event_id: string | null;
    last_actor: string | null;
    last_event_at_ms: number | null;
    route_safety: 'unsecured' | 'sealed' | 'monitored';
    merchant_access: 'closed' | 'open';
    merchant_stock: number;
    merchant_travel_due_at_ms: number | null;
    bandit_pressure: number;
    player_trust: number;
  };
}

function defaultProgress(): OnwardRouteReceiptProgress {
  return {
    forgeholdSurveyed: false,
    forgeholdMilepostEvidenceRecovered: false,
    forgeholdCaravanEvidenceRecovered: false,
    forgeholdAshglassRavineEvidenceRecovered: false,
    forgeholdShipmentInvestigated: false,
    forgeholdEconomyQuoted: false,
    soulsteelStabilized: false,
    forgeholdAbuseNotesReviewed: false,
    heartforgeGatePrepared: false,
    ashglassEvidenceRecovered: false,
    soulsteelRefinementAuthorized: false,
    soulsteelComponentMinted: false,
    forgeholdComponentSettled: false,
    forgeholdComponentPayoutCredited: false,
    moonspireSurveyed: false,
    dreamGateInterpreted: false,
    dreamFragmentAnchored: false,
    dreamGateAbuseNotesReviewed: false,
    dreamGateSealPrepared: false,
    dreamGateTraversalAuthorized: false,
    dreamGateArrivalRecorded: false,
    forgeholdCaravanProtection: {
      activity_id: FORGEHOLD_CARAVAN_ACTIVITY_ID,
      route_id: 'forgehold_route_slice_v1',
      act_id: 'act_02_ember_road_recovery',
      event_sequence: 0,
      last_event_id: null,
      last_actor: null,
      last_event_at_ms: null,
      route_safety: 'unsecured',
      merchant_access: 'closed',
      merchant_stock: 0,
      merchant_travel_due_at_ms: null,
      bandit_pressure: 0,
      player_trust: 0,
    },
  };
}

const progressByPlayerId = new Map<string, OnwardRouteReceiptProgress>();

function cloneProgress(progress: OnwardRouteReceiptProgress): OnwardRouteReceiptProgress {
  return {
    ...progress,
    forgeholdCaravanProtection: { ...progress.forgeholdCaravanProtection },
  };
}

function parsedTime(value: unknown, fallback: number | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  const candidate = toNumber(value, fallback);
  return Number.isFinite(candidate) && candidate >= 0 ? candidate : fallback;
}

function nonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function safeRouteSafety(value: unknown): OnwardRouteReceiptProgress['forgeholdCaravanProtection']['route_safety'] {
  return value === 'sealed' || value === 'monitored' ? value : 'unsecured';
}

function safeMerchantAccess(value: unknown): OnwardRouteReceiptProgress['forgeholdCaravanProtection']['merchant_access'] {
  return value === 'open' ? 'open' : 'closed';
}

function nextCaravanProtectionState(
  progress: OnwardRouteReceiptProgress,
  eventId: string,
  actorId: string,
  nowMs: number | null,
  stateAfter: Record<string, unknown>,
): OnwardRouteReceiptProgress['forgeholdCaravanProtection'] {
  const base = progress.forgeholdCaravanProtection;
  const state = stateAfter ?? {};
  return {
    ...base,
    event_sequence: base.event_sequence + 1,
    last_event_id: eventId,
    last_actor: actorId,
    last_event_at_ms: nowMs,
    route_safety: safeRouteSafety(state.route_safety),
    merchant_access: safeMerchantAccess(state.merchant_access),
    merchant_stock: nonNegativeNumber(state.merchant_stock, base.merchant_stock),
    merchant_travel_due_at_ms: state.merchant_travel_due_at_ms === null
      ? null
      : parsedTime(state.merchant_travel_due_at_ms, base.merchant_travel_due_at_ms),
    bandit_pressure: nonNegativeNumber(state.bandit_pressure, base.bandit_pressure),
    player_trust: nonNegativeNumber(state.player_trust, base.player_trust),
  };
}

export function getOnwardRouteReceiptProgress(playerId: string): OnwardRouteReceiptProgress {
  return cloneProgress(progressByPlayerId.get(playerId) ?? defaultProgress());
}

export function clearOnwardRouteProjection(): void {
  progressByPlayerId.clear();
}

function setProgress(playerId: string, next: OnwardRouteReceiptProgress): void {
  progressByPlayerId.set(playerId, cloneProgress(next));
}

export function applyReceiptToOnwardRoutes(receipt: AuditReceipt): void {
  const playerId = typeof receipt.inputs?.chronicle_player_id === 'string'
    ? receipt.inputs.chronicle_player_id
    : receipt.actor_id;
  if (!playerId || receipt.result === 'rejected') return;

  const current = getOnwardRouteReceiptProgress(playerId);
  const actorId = typeof receipt.inputs?.agent_id === 'string' && receipt.inputs.agent_id.length > 0
    ? receipt.inputs.agent_id
    : playerId;
  let next: OnwardRouteReceiptProgress | null = null;

  if (receipt.action === ROUTE_SURVEYED_ACTION) {
    if (receipt.inputs?.route_id === 'forgehold_route_slice_v1') {
      next = { ...current, forgeholdSurveyed: true };
    } else if (receipt.inputs?.route_id === 'moonspire_dream_gate_slice_v1') {
      next = { ...current, moonspireSurveyed: true };
    }
  } else if (receipt.action === FORGEHOLD_MILEPOST_EVIDENCE_RECOVERED_ACTION) {
    next = { ...current, forgeholdMilepostEvidenceRecovered: true };
  } else if (receipt.action === FORGEHOLD_CARAVAN_EVIDENCE_RECOVERED_ACTION) {
    const nowMs = parsedTime(receipt.timestamp, null);
    const eventId = nonEmptyString(
      receipt.inputs?.event_id,
      `${FORGEHOLD_CARAVAN_EVENT_ID}:${current.forgeholdCaravanProtection.event_sequence + 1}`,
    );
    const inputState = receipt.inputs?.state_after as Record<string, unknown> | undefined;
    const computedState = nextCaravanProtectionState(
      current,
      eventId,
      actorId,
      nowMs,
      {
        route_safety: nonEmptyString(inputState?.route_safety, 'sealed'),
        merchant_access: 'open',
        merchant_stock: nonNegativeNumber(inputState?.merchant_stock, 1),
        bandit_pressure: nonNegativeNumber(inputState?.bandit_pressure, 2),
        player_trust: nonNegativeNumber(inputState?.player_trust, current.forgeholdCaravanProtection.player_trust + 1),
        ...inputState,
      },
    );

    next = {
      ...current,
      forgeholdCaravanEvidenceRecovered: true,
      forgeholdCaravanProtection: computedState,
    };
  } else if (receipt.action === FORGEHOLD_CARAVAN_GUARD_DECISION_ACTION) {
    const nowMs = parsedTime(receipt.timestamp, null);
    const eventId = nonEmptyString(
      receipt.inputs?.event_id,
      `${FORGEHOLD_CARAVAN_EVENT_ID}:${current.forgeholdCaravanProtection.event_sequence + 1}:guard`,
    );
    const stateAfter = receipt.inputs?.state_after as Record<string, unknown> | undefined;
    const computedState = nextCaravanProtectionState(
      current,
      eventId,
      actorId,
      nowMs,
      {
        route_safety: nonEmptyString(stateAfter?.route_safety, 'monitored'),
        merchant_access: 'open',
        merchant_stock: nonNegativeNumber(stateAfter?.merchant_stock, Math.max(current.forgeholdCaravanProtection.merchant_stock - 1, 0)),
        bandit_pressure: nonNegativeNumber(stateAfter?.bandit_pressure, Math.max(current.forgeholdCaravanProtection.bandit_pressure - 1, 0)),
        player_trust: nonNegativeNumber(stateAfter?.player_trust, current.forgeholdCaravanProtection.player_trust + 1),
        ...stateAfter,
      },
    );
    next = {
      ...current,
      forgeholdCaravanProtection: computedState,
    };
  } else if (receipt.action === FORGEHOLD_CARAVAN_MERCHANT_ARRIVED_ACTION) {
    const nowMs = parsedTime(receipt.inputs?.arrived_at_ms, parsedTime(receipt.timestamp, null));
    const stateAfter = receipt.inputs?.state_after as Record<string, unknown> | undefined;
    const computedState = nextCaravanProtectionState(
      current,
      nonEmptyString(
        receipt.inputs?.event_instance_id,
        `${FORGEHOLD_CARAVAN_EVENT_ID}:${current.forgeholdCaravanProtection.event_sequence + 1}:merchant_arrived`,
      ),
      typeof receipt.inputs?.agent_id === 'string' ? receipt.inputs.agent_id : receipt.actor_id,
      nowMs,
      {
        ...current.forgeholdCaravanProtection,
        merchant_access: 'open',
        merchant_stock: 1,
        merchant_travel_due_at_ms: null,
        ...stateAfter,
      },
    );
    next = {
      ...current,
      forgeholdCaravanProtection: computedState,
    };
  } else if (receipt.action === FORGEHOLD_ASHGLASS_RAVINE_EVIDENCE_RECOVERED_ACTION) {
    next = { ...current, forgeholdAshglassRavineEvidenceRecovered: true };
  } else if (receipt.action === FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION) {
    next = { ...current, forgeholdShipmentInvestigated: true };
  } else if (receipt.action === FORGEHOLD_ECONOMY_QUOTED_ACTION) {
    next = { ...current, forgeholdEconomyQuoted: true };
  } else if (receipt.action === SOULSTEEL_STABILIZED_ACTION) {
    next = { ...current, soulsteelStabilized: true };
  } else if (receipt.action === DREAM_GATE_INTERPRETED_ACTION) {
    next = { ...current, dreamGateInterpreted: true };
  } else if (receipt.action === DREAM_FRAGMENT_ANCHORED_ACTION) {
    next = { ...current, dreamFragmentAnchored: true };
  } else if (receipt.action === ROUTE_ABUSE_NOTES_REVIEWED_ACTION) {
    if (receipt.inputs?.route_id === 'forgehold_route_slice_v1') {
      next = { ...current, forgeholdAbuseNotesReviewed: true };
    } else if (receipt.inputs?.route_id === 'moonspire_dream_gate_slice_v1') {
      next = { ...current, dreamGateAbuseNotesReviewed: true };
    }
  } else if (receipt.action === HEARTFORGE_GATE_PREPARED_ACTION) {
    next = { ...current, heartforgeGatePrepared: true };
  } else if (receipt.action === ASHGLASS_EVIDENCE_RECOVERED_ACTION) {
    next = { ...current, ashglassEvidenceRecovered: true };
  } else if (receipt.action === SOULSTEEL_REFINEMENT_AUTHORIZED_ACTION) {
    next = { ...current, soulsteelRefinementAuthorized: true };
  } else if (receipt.action === SOULSTEEL_COMPONENT_MINTED_ACTION) {
    next = { ...current, soulsteelComponentMinted: true };
  } else if (receipt.action === FORGEHOLD_COMPONENT_SETTLED_ACTION) {
    next = { ...current, forgeholdComponentSettled: true };
  } else if (receipt.action === FORGEHOLD_COMPONENT_PAYOUT_CREDITED_ACTION) {
    next = { ...current, forgeholdComponentPayoutCredited: true };
  } else if (receipt.action === DREAM_GATE_SEAL_PREPARED_ACTION) {
    next = { ...current, dreamGateSealPrepared: true };
  } else if (receipt.action === DREAM_GATE_TRAVERSAL_AUTHORIZED_ACTION) {
    next = { ...current, dreamGateTraversalAuthorized: true };
  } else if (receipt.action === DREAM_GATE_ARRIVAL_RECORDED_ACTION) {
    next = { ...current, dreamGateArrivalRecorded: true };
  }

  if (next) setProgress(playerId, next);
}
