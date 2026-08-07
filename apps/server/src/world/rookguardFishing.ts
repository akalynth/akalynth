import type { MapName } from '../../../../packages/shared/http.js';
import type {
  AuditReceipt,
  RookguardFishingProgress,
} from '../../../../packages/shared/types.js';
import {
  ROOKGUARD_CANAL_FISHED_ACTION,
  SKILL_REGISTRY,
} from '../../../../packages/shared/skills.js';

/**
 * Receipt-replayed causal state for the existing Rookguard canal Fish action.
 *
 * The canonical projection never advances itself from wall-clock time. A
 * receipt records the recovery deadline, and callers derive availability from
 * an injected `nowMs`. That keeps replay clock-free while allowing restart and
 * reconnect views to recover elapsed time correctly.
 */
export const ROOKGUARD_FISHING_SKILL_ID = 'activity:fishing:rookguard';
export const ROOKGUARD_FISHING_ACTIVITY_ID = 'rookguard_canal_fishing_v1';
export const ROOKGUARD_FISHING_PLACE_ID = 'rookguard_canal';
export const ROOKGUARD_FISHING_MERCHANT_ID = 'npc:rookguard:canal_merchant';
export const ROOKGUARD_FISHING_MERCHANT_REACTED_ACTION = 'rookguard_canal_merchant_reacted';
export const ROOKGUARD_FISHING_RECOVERY_MS = SKILL_REGISTRY[ROOKGUARD_FISHING_SKILL_ID].cooldown_ms;

type CanalState = 'calm' | 'disturbed';
type MerchantBehavior = RookguardFishingProgress['merchant_behavior'];

export interface RookguardFishingState {
  activity_id: typeof ROOKGUARD_FISHING_ACTIVITY_ID;
  map: Extract<MapName, 'Rookguard'>;
  place_id: typeof ROOKGUARD_FISHING_PLACE_ID;
  canal_state: CanalState;
  catch_state: RookguardFishingProgress['catch_state'];
  cast_count: number;
  merchant_behavior: MerchantBehavior;
  merchant_respect: number;
  merchant_memory: string | null;
  last_event_id: string | null;
  last_actor: string | null;
  last_fished_at_ms: number | null;
  recovers_at_ms: number | null;
  last_updated_at_ms: number | null;
}

type MintReward = () => { item_id: string; item_type: string } | null;

type WriteReceipt = (receipt: {
  player_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
}) => AuditReceipt | unknown;

const DEFAULT_STATE: RookguardFishingState = {
  activity_id: ROOKGUARD_FISHING_ACTIVITY_ID,
  map: 'Rookguard',
  place_id: ROOKGUARD_FISHING_PLACE_ID,
  canal_state: 'calm',
  catch_state: null,
  cast_count: 0,
  merchant_behavior: 'unaware',
  merchant_respect: 0,
  merchant_memory: null,
  last_event_id: null,
  last_actor: null,
  last_fished_at_ms: null,
  recovers_at_ms: null,
  last_updated_at_ms: null,
};

const state: RookguardFishingState = { ...DEFAULT_STATE };

const ACTIVITY_GUARD = Object.freeze({
  wallet_debit_gold: 0,
  wallet_credit_gold: 0,
  item_mint: false,
  item_transfer: false,
  xp_awarded: 0,
  travel_unlocked: false,
  heat_changed: false,
  penalty_applied: false,
});

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = finiteNumber(value, fallback);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function nonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function objectInput(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parsedTime(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function canonicalSnapshot(value: RookguardFishingState): Record<string, unknown> {
  return {
    canal_state: value.canal_state,
    catch_state: value.catch_state,
    cast_count: value.cast_count,
    merchant_behavior: value.merchant_behavior,
    merchant_respect: value.merchant_respect,
    last_fished_at_ms: value.last_fished_at_ms,
    recovers_at_ms: value.recovers_at_ms,
  };
}

function stateSnapshotAt(value: RookguardFishingState, nowMs: number): Record<string, unknown> {
  const snapshot = canonicalSnapshot(value);
  if (value.canal_state === 'disturbed'
    && value.recovers_at_ms !== null
    && nowMs >= value.recovers_at_ms) {
    snapshot.canal_state = 'calm';
  }
  return snapshot;
}

export function getRookguardFishingState(): RookguardFishingState {
  return { ...state };
}

export function clearRookguardFishingProjection(): void {
  Object.assign(state, DEFAULT_STATE);
}

export function rookguardFishingPublicState(nowMs: number): RookguardFishingProgress {
  const recovering = state.canal_state === 'disturbed'
    && state.recovers_at_ms !== null
    && nowMs < state.recovers_at_ms;
  const remainingRecoveryMs = recovering && state.recovers_at_ms !== null
    ? Math.max(0, state.recovers_at_ms - nowMs)
    : 0;

  return {
    activity_id: state.activity_id,
    map: state.map,
    place_id: state.place_id,
    phase: recovering ? 'recovering' : 'ready',
    catch_state: state.catch_state,
    cast_count: state.cast_count,
    merchant_behavior: state.merchant_behavior,
    merchant_respect: state.merchant_respect,
    merchant_memory: state.merchant_memory,
    last_event_id: state.last_event_id,
    last_actor: state.last_actor,
    last_fished_at_ms: state.last_fished_at_ms,
    recovers_at_ms: state.recovers_at_ms,
    remaining_recovery_ms: remainingRecoveryMs,
    next_consequence: recovering
      ? 'The canal is settling; the merchant remembers the patience shown here.'
      : state.cast_count === 0
        ? 'Fish the Rookguard canal; the server will resolve what the town remembers.'
        : state.merchant_respect > 1
          ? `The canal merchant nods when you approach. "The patience you showed is still talked about at the stalls."`
          : `Mara's family reopened their fish stall. The canal merchant told them a patient fisher helped the waters settle.`,
  };
}

/** Apply canonical receipts to the deterministic in-memory world projection. */
export function applyReceiptToRookguardFishing(receipt: AuditReceipt): void {
  if (receipt.result !== 'ok') return;
  const inputs = receipt.inputs ?? {};

  if (receipt.action === ROOKGUARD_CANAL_FISHED_ACTION) {
    const after = objectInput(inputs.state_after);
    const fallbackResolvedAt = parsedTime(inputs.fished_at, parsedTime(receipt.timestamp, 0));
    const resolvedAt = parsedTime(inputs.resolved_at_ms, fallbackResolvedAt);
    const recoveryMs = positiveInteger(inputs.recovery_ms, ROOKGUARD_FISHING_RECOVERY_MS);
    const nextCastCount = positiveInteger(after.cast_count, state.cast_count + 1);

    state.canal_state = 'disturbed';
    state.catch_state = 'nothing_tradeable';
    state.cast_count = nextCastCount;
    state.last_event_id = nonEmptyString(
      inputs.event_id,
      `${ROOKGUARD_FISHING_ACTIVITY_ID}:${nextCastCount}`,
    );
    state.last_actor = receipt.actor_id;
    state.last_fished_at_ms = parsedTime(after.last_fished_at_ms, resolvedAt);
    state.recovers_at_ms = parsedTime(after.recovers_at_ms, resolvedAt + recoveryMs);
    state.last_updated_at_ms = resolvedAt;
    return;
  }

  if (receipt.action === ROOKGUARD_FISHING_MERCHANT_REACTED_ACTION) {
    const after = objectInput(inputs.state_after);
    const behavior = after.merchant_behavior;
    if (behavior === 'unaware' || behavior === 'noticing_patience') {
      state.merchant_behavior = behavior;
    }
    state.merchant_respect = positiveInteger(after.merchant_respect, state.merchant_respect + 1);
    state.merchant_memory = nonEmptyString(inputs.memory, state.merchant_memory ?? 'The canal merchant remembers patient fishing.');
    state.last_updated_at_ms = parsedTime(inputs.reacted_at_ms, parsedTime(receipt.timestamp, state.last_updated_at_ms ?? 0));
  }
}

export type ResolveRookguardFishingResult =
  | {
      ok: true;
      payload: Record<string, unknown> & { world_state: RookguardFishingProgress };
    }
  | {
      ok: false;
      reason: 'invalid_target' | 'cooldown';
      cooldown_until_ms?: number;
      payload: Record<string, unknown>;
    };

/**
 * Resolve one Fish intent. All mutable consequences are written as receipts
 * before their corresponding projection changes.
 */
export function resolveRookguardCanalFishing(
  input: {
    player_id: string;
    player_name: string;
    map: MapName;
    in_world: boolean;
    now_ms: number;
    mintReward?: MintReward;
  },
  writeReceipt: WriteReceipt,
): ResolveRookguardFishingResult {
  if (!input.in_world || input.map !== 'Rookguard') {
    return {
      ok: false,
      reason: 'invalid_target',
      payload: { error: input.in_world ? 'wrong_map' : 'not_in_world' },
    };
  }

  const before = rookguardFishingPublicState(input.now_ms);
  if (before.phase === 'recovering') {
    return {
      ok: false,
      reason: 'cooldown',
      cooldown_until_ms: before.recovers_at_ms ?? undefined,
      payload: {
        error: 'canal_recovering',
        world_state: before,
      },
    };
  }

  const eventId = `${ROOKGUARD_FISHING_ACTIVITY_ID}:${state.cast_count + 1}`;
  const recoversAtMs = input.now_ms + ROOKGUARD_FISHING_RECOVERY_MS;
  const reward = input.mintReward ? input.mintReward() : null;
  const rewardPayload = reward
    ? { item_id: reward.item_id, item_type: reward.item_type }
    : null;
  const memory = `${input.player_name} fished the Rookguard canal with patience; the canal merchant took notice.`;
  const fishingAfter = {
    canal_state: 'disturbed',
      catch_state: 'nothing_tradeable',
      cast_count: state.cast_count + 1,
      last_fished_at_ms: input.now_ms,
      recovers_at_ms: recoversAtMs,
    };

  writeReceipt({
    player_id: input.player_id,
    action: ROOKGUARD_CANAL_FISHED_ACTION,
    inputs: {
      event_id: eventId,
      activity_id: ROOKGUARD_FISHING_ACTIVITY_ID,
      intent: 'fish',
      authority: 'server:rookguard-fishing:v1',
      map: 'Rookguard',
      place_id: ROOKGUARD_FISHING_PLACE_ID,
      catch_state: 'nothing_tradeable',
      resolved_at_ms: input.now_ms,
      fished_at: new Date(input.now_ms).toISOString(),
      recovery_ms: ROOKGUARD_FISHING_RECOVERY_MS,
      recovers_at_ms: recoversAtMs,
      next_objective: 'Wait for the canal to settle, then fish again.',
      state_before: stateSnapshotAt(state, input.now_ms),
      state_after: fishingAfter,
      downstream_event_ids: [`${eventId}:merchant`],
      effects: {
        canal_state: 'disturbed',
        catch_state: 'nothing_tradeable',
        respect_delta: 1,
      },
      minted_item: rewardPayload,
      activity_guard: ACTIVITY_GUARD,
      economy_impact: 'none',
      memory,
    },
    result: 'ok',
  });

  const merchantBefore = {
    merchant_behavior: state.merchant_behavior,
    merchant_respect: state.merchant_respect,
  };
  const merchantAfter = {
    merchant_behavior: 'noticing_patience' as const,
    merchant_respect: state.merchant_respect + 1,
  };

  writeReceipt({
    player_id: input.player_id,
    action: ROOKGUARD_FISHING_MERCHANT_REACTED_ACTION,
    inputs: {
      event_id: `${eventId}:merchant`,
      parent_event_id: eventId,
      activity_id: ROOKGUARD_FISHING_ACTIVITY_ID,
      event_type: 'MerchantNoticedPatience',
      agent_id: ROOKGUARD_FISHING_MERCHANT_ID,
      map: 'Rookguard',
      place_id: ROOKGUARD_FISHING_PLACE_ID,
      state_before: merchantBefore,
      state_after: merchantAfter,
      downstream_event_ids: [],
      effects: { merchant_respect_delta: 1 },
      reacted_at_ms: input.now_ms,
      memory,
      economy_impact: 'none',
    },
    result: 'ok',
  });

  return {
    ok: true,
    payload: {
      event_id: eventId,
      activity_id: ROOKGUARD_FISHING_ACTIVITY_ID,
      title: 'Rookguard Canal Fishing',
      status: 'reflected',
      place_id: ROOKGUARD_FISHING_PLACE_ID,
      catch_state: 'nothing_tradeable',
      respect_delta: 1,
      merchant_behavior: 'noticing_patience',
      line: 'Nothing worth selling bites, but the canal merchant notices your patience.',
      next_objective: 'Wait for the canal to settle, then fish again.',
      receipt_action: ROOKGUARD_CANAL_FISHED_ACTION,
      merchant_receipt_action: ROOKGUARD_FISHING_MERCHANT_REACTED_ACTION,
      activity_guard: ACTIVITY_GUARD,
      economy_impact: 'none',
      inventory_item: rewardPayload,
      minted_item: rewardPayload,
      world_state: rookguardFishingPublicState(input.now_ms),
    },
  };
}
