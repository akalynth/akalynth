import type { AuditReceipt } from './types.js';

export const CAUSAL_PARITY_SCHEMA_VERSION = 'akalynth.causal-parity/v1';

export const SHARED_WORLD_IDS = {
  rookguardCanal: 'rookguard_canal',
  forgeholdCaravanRoute: 'forgehold_caravan_route',
} as const;

export type SharedWorldId = typeof SHARED_WORLD_IDS[keyof typeof SHARED_WORLD_IDS];

export function isSharedWorldId(value: unknown): value is SharedWorldId {
  return value === SHARED_WORLD_IDS.rookguardCanal
    || value === SHARED_WORLD_IDS.forgeholdCaravanRoute;
}

export interface CausalPlayerView {
  action: string;
  result: string;
  world: string;
  future?: string;
}

export interface CausalParityEvent {
  schema_version: typeof CAUSAL_PARITY_SCHEMA_VERSION;
  event_id: string;
  actor_id: string;
  world_id: SharedWorldId | null;
  receipt: {
    id: string;
    sequence: number;
    hash: string;
    actor_id: string;
    action: string;
    result: string;
    timestamp: string;
  };
  intent: {
    action: string;
    verb: string | null;
    skill_id: string | null;
    target_id: string | null;
  };
  location: {
    map: string | null;
    zone: string | null;
    place_id: string | null;
    location_id: string | null;
    x: number | null;
    y: number | null;
  };
  resolution: {
    status: 'accepted' | 'rejected';
    outcome: string | null;
    event_type: string | null;
  };
  state_transition: {
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  };
  effects: Record<string, unknown> | null;
  parent_event_ids: string[];
  downstream_event_ids: string[];
  chronicle: {
    event_id: number;
    kind: string;
    source_action: string;
    receipt_hash: string;
  };
  player_view: CausalPlayerView | null;
}

export interface CausalParityChronicleSource {
  event_id: number;
  kind: string;
  source_action: string;
  receipt_hash: string;
  zone: string | null;
  x: number | null;
  y: number | null;
}

export interface CausalParitySource {
  receipt: AuditReceipt;
  receipt_hash: string;
  chronicle: CausalParityChronicleSource;
  details: Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function sharedWorldIdForDetails(
  details: Record<string, unknown>,
  inputs: Record<string, unknown>,
): SharedWorldId | null {
  const explicit = text(details.world_id) ?? text(inputs.world_id);
  if (isSharedWorldId(explicit)) return explicit;

  const eventId = text(details.event_id);
  if (eventId === 'rookguard_canal_fishing' || eventId === 'rookguard_canal_merchant') {
    return SHARED_WORLD_IDS.rookguardCanal;
  }
  if (eventId === 'forgehold_caravan_evidence' || text(details.route_id) === 'forgehold_route_slice_v1') {
    return SHARED_WORLD_IDS.forgeholdCaravanRoute;
  }
  return null;
}

/**
 * The only player-facing prose mapper for the causal parity lane. Codex does
 * not re-author these sentences; it consumes the resulting `player_view`.
 */
export function causalPlayerViewForDetails(
  detailsInput: Record<string, unknown>,
): CausalPlayerView | null {
  const details = record(detailsInput);
  const eventId = text(details.event_id);

  if (eventId === 'rookguard_canal_fishing') {
    const worldState = record(details.world_state);
    const catchState = text(details.outcome) ?? 'nothing_tradeable';
    const canalState = text(worldState.canal_state) ?? 'disturbed';
    const result = catchState === 'nothing_tradeable'
      ? 'Nothing tradeable was caught.'
      : `The catch resolved as ${catchState.replace(/_/g, ' ')}.`;
    const summary: CausalPlayerView = {
      action: 'Fish the Rookguard canal.',
      result,
      world: `The canal is ${canalState}; the cast is now part of its memory.`,
    };
    const future = text(details.next_objective);
    if (future) summary.future = future;
    return summary;
  }

  if (eventId === 'rookguard_canal_merchant') {
    const worldState = record(details.world_state);
    const behavior = text(worldState.merchant_behavior) ?? 'noticing patience';
    const respect = number(worldState.merchant_respect);
    return {
      action: 'Fish the Rookguard canal with patience.',
      result: 'The canal merchant noticed your patience.',
      world: respect === null
        ? `The merchant now remembers you as ${behavior.replace(/_/g, ' ')}.`
        : `The merchant now remembers you as ${behavior.replace(/_/g, ' ')} (respect ${respect}).`,
    };
  }

  if (eventId === 'forgehold_caravan_evidence' && details.event_type === 'caravan_guard_patrol_set') {
    const worldState = record(details.world_state);
    const routeSafety = text(worldState.route_safety) ?? 'monitored';
    const merchantAccess = text(worldState.merchant_access) ?? 'open';
    const banditPressure = number(worldState.bandit_pressure);
    const summary: CausalPlayerView = {
      action: 'Recover the charred shipment plate at the burned caravan site.',
      result: 'A caravan guard chose to monitor the route.',
      world: banditPressure === null
        ? `The route is ${routeSafety}; merchant access is ${merchantAccess}.`
        : `The route is ${routeSafety}; merchant access is ${merchantAccess}, with bandit pressure at ${banditPressure}.`,
    };
    const future = text(details.next_objective);
    if (future) summary.future = future;
    return summary;
  }

  if (eventId === 'forgehold_caravan_evidence') {
    const evidence = text(details.evidence_object_id) ?? 'shipment evidence';
    const location = text(details.location_id)?.replace(/_/g, ' ') ?? 'the burned caravan site';
    const summary: CausalPlayerView = {
      action: 'Recover the charred shipment plate at the burned caravan site.',
      result: `Recovered ${evidence.replace(/_/g, ' ')}.`,
      world: `The Forgehold route now records that evidence at ${location}.`,
    };
    const future = text(details.next_objective);
    if (future) summary.future = future;
    return summary;
  }

  return null;
}

/** Build the normalized event consumed by both the player and Codex views. */
export function buildCausalParityEvent(source: CausalParitySource): CausalParityEvent {
  const { receipt, receipt_hash: receiptHash, chronicle, details } = source;
  const inputs = receipt.inputs ?? {};
  const eventId = text(details.event_instance_id)
    ?? text(details.event_id)
    ?? `${receipt.action}:${receipt.sequence}`;
  const stateBefore = recordOrNull(details.state_before ?? inputs.state_before);
  const stateAfter = recordOrNull(details.state_after ?? inputs.state_after ?? details.world_state);
  const outcome = text(details.outcome)
    ?? text(inputs.outcome)
    ?? (receipt.result === 'ok' ? text(details.event_type) : null);
  const eventType = text(details.event_type) ?? text(inputs.event_type);
  const parentEventId = text(details.parent_event_id) ?? text(inputs.parent_event_id);

  return {
    schema_version: CAUSAL_PARITY_SCHEMA_VERSION,
    event_id: eventId,
    actor_id: receipt.actor_id,
    world_id: sharedWorldIdForDetails(details, inputs),
    receipt: {
      id: receiptHash,
      sequence: receipt.sequence,
      hash: receiptHash,
      actor_id: receipt.actor_id,
      action: receipt.action,
      result: receipt.result,
      timestamp: receipt.timestamp,
    },
    intent: {
      action: receipt.action,
      verb: text(inputs.intent),
      skill_id: text(inputs.skill_id),
      target_id: text(inputs.target_id),
    },
    location: {
      map: text(inputs.map),
      zone: chronicle.zone,
      place_id: text(inputs.place_id),
      location_id: text(inputs.location_id),
      x: chronicle.x,
      y: chronicle.y,
    },
    resolution: {
      status: receipt.result === 'ok' ? 'accepted' : 'rejected',
      outcome,
      event_type: eventType,
    },
    state_transition: {
      before: stateBefore,
      after: stateAfter,
    },
    effects: recordOrNull(details.effects ?? inputs.effects),
    parent_event_ids: parentEventId ? [parentEventId] : [],
    downstream_event_ids: strings(details.downstream_event_ids ?? inputs.downstream_event_ids),
    chronicle: {
      event_id: chronicle.event_id,
      kind: chronicle.kind,
      source_action: chronicle.source_action,
      receipt_hash: chronicle.receipt_hash,
    },
    player_view: causalPlayerViewForDetails(details),
  };
}