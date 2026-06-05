import type { MapName } from '../../../../packages/shared/http.js';
import { RECEIPT_ACTIONS } from '../persist/types.js';

export const WITNESS_MOTH_BLOOM_EVENT_ID = 'witness_moth_bloom';
export const WITNESS_MOTH_BLOOM_SKILL_PREFIX = `event:${WITNESS_MOTH_BLOOM_EVENT_ID}:`;

export type WitnessMothBloomPhase = 'idle' | 'signal' | 'investigation' | 'resolved';
export type WitnessMothBloomOutcome = 'controlled_release';
export type WitnessMothBloomContributionId =
  | 'verify_testimony'
  | 'craft_lantern_frame'
  | 'defend_scribes';

export interface WitnessMothBloomContribution {
  contribution_id: WitnessMothBloomContributionId;
  player_id: string;
  recorded_at_ms: number;
}

export interface WitnessMothBloomRuntime {
  event_id: typeof WITNESS_MOTH_BLOOM_EVENT_ID;
  map: Extract<MapName, 'Azura'>;
  phase: WitnessMothBloomPhase;
  started_by: string | null;
  started_at_ms: number | null;
  resolved_by: string | null;
  resolved_at_ms: number | null;
  outcome: WitnessMothBloomOutcome | null;
  contributions: Partial<Record<WitnessMothBloomContributionId, WitnessMothBloomContribution>>;
}

export interface WitnessMothBloomHydrationRow {
  event_id: string;
  map: string;
  phase: string;
  started_by: string | null;
  started_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  outcome: string | null;
  contributions_json: string;
}

type WriteReceiptInput = {
  player_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
};

type WriteReceipt = (receipt: WriteReceiptInput) => unknown;

export const WITNESS_MOTH_BLOOM_CONTRIBUTIONS: ReadonlyArray<{
  contribution_id: WitnessMothBloomContributionId;
  label: string;
}> = [
  { contribution_id: 'verify_testimony', label: 'Verify testimony' },
  { contribution_id: 'craft_lantern_frame', label: 'Craft lantern frame' },
  { contribution_id: 'defend_scribes', label: 'Defend scribes' },
];

export function createWitnessMothBloomRuntime(): WitnessMothBloomRuntime {
  return {
    event_id: WITNESS_MOTH_BLOOM_EVENT_ID,
    map: 'Azura',
    phase: 'idle',
    started_by: null,
    started_at_ms: null,
    resolved_by: null,
    resolved_at_ms: null,
    outcome: null,
    contributions: {},
  };
}

export function parseWitnessMothBloomSkillId(skillId: string): WitnessMothBloomContributionId | null {
  if (!skillId.startsWith(WITNESS_MOTH_BLOOM_SKILL_PREFIX)) return null;
  const contributionId = skillId.slice(WITNESS_MOTH_BLOOM_SKILL_PREFIX.length);
  return isWitnessMothBloomContributionId(contributionId) ? contributionId : null;
}

export function witnessMothBloomPublicState(runtime: WitnessMothBloomRuntime) {
  return {
    event_id: runtime.event_id,
    map: runtime.map,
    phase: runtime.phase,
    contribution_count: Object.keys(runtime.contributions).length,
    required_count: WITNESS_MOTH_BLOOM_CONTRIBUTIONS.length,
    outcome: runtime.outcome,
  };
}

export function hydrateWitnessMothBloomRuntime(
  runtime: WitnessMothBloomRuntime,
  row: WitnessMothBloomHydrationRow | null
): boolean {
  if (!row || row.event_id !== runtime.event_id || row.map !== runtime.map) return false;
  if (!isWitnessMothBloomPhase(row.phase)) return false;

  runtime.phase = row.phase;
  runtime.started_by = row.started_by;
  runtime.started_at_ms = timestampMs(row.started_at);
  runtime.resolved_by = row.resolved_by;
  runtime.resolved_at_ms = timestampMs(row.resolved_at);
  runtime.outcome = row.outcome === 'controlled_release' ? row.outcome : null;
  runtime.contributions = parseHydratedContributions(row.contributions_json);
  return true;
}

export type StartWitnessMothBloomResult =
  | {
      ok: true;
      started: boolean;
      phase: WitnessMothBloomPhase;
      message: string;
      payload: Record<string, unknown>;
    }
  | { ok: false; reason: 'invalid_target'; payload: Record<string, unknown> };

export function startWitnessMothBloom(
  runtime: WitnessMothBloomRuntime,
  input: { player_id: string; map: MapName; now_ms: number },
  writeReceipt: WriteReceipt
): StartWitnessMothBloomResult {
  if (input.map !== runtime.map) {
    return {
      ok: false,
      reason: 'invalid_target',
      payload: { error: 'wrong_map', event_id: runtime.event_id, required_map: runtime.map },
    };
  }

  if (runtime.phase !== 'idle') {
    return {
      ok: true,
      started: false,
      phase: runtime.phase,
      message: messageForPhase(runtime.phase),
      payload: witnessMothBloomPublicState(runtime),
    };
  }

  writeReceipt({
    player_id: input.player_id,
    action: RECEIPT_ACTIONS.WORLD_EVENT_STARTED,
    inputs: {
      event_id: runtime.event_id,
      map: runtime.map,
      phase: 'signal',
      source: 'azura_herald',
    },
    result: 'ok',
  });

  runtime.phase = 'signal';
  runtime.started_by = input.player_id;
  runtime.started_at_ms = input.now_ms;

  return {
    ok: true,
    started: true,
    phase: runtime.phase,
    message: messageForPhase(runtime.phase),
    payload: witnessMothBloomPublicState(runtime),
  };
}

export type RecordWitnessMothContributionResult =
  | {
      ok: true;
      recorded: boolean;
      resolved: boolean;
      phase: WitnessMothBloomPhase;
      message: string;
      payload: Record<string, unknown>;
    }
  | {
      ok: false;
      reason: 'invalid_skill' | 'invalid_target';
      payload: Record<string, unknown>;
    };

export function recordWitnessMothBloomContribution(
  runtime: WitnessMothBloomRuntime,
  input: {
    player_id: string;
    map: MapName;
    contribution_id: WitnessMothBloomContributionId;
    now_ms: number;
  },
  writeReceipt: WriteReceipt
): RecordWitnessMothContributionResult {
  if (input.map !== runtime.map) {
    return {
      ok: false,
      reason: 'invalid_target',
      payload: { error: 'wrong_map', event_id: runtime.event_id, required_map: runtime.map },
    };
  }

  if (runtime.phase === 'idle') {
    return {
      ok: false,
      reason: 'invalid_target',
      payload: { error: 'event_inactive', event_id: runtime.event_id },
    };
  }

  if (runtime.phase === 'resolved') {
    return {
      ok: true,
      recorded: false,
      resolved: true,
      phase: runtime.phase,
      message: messageForPhase(runtime.phase),
      payload: witnessMothBloomPublicState(runtime),
    };
  }

  if (runtime.contributions[input.contribution_id]) {
    return {
      ok: true,
      recorded: false,
      resolved: false,
      phase: runtime.phase,
      message: 'That contribution is already recorded in the Bloom.',
      payload: {
        ...witnessMothBloomPublicState(runtime),
        contribution_id: input.contribution_id,
        duplicate: true,
      },
    };
  }

  const acceptedCount = Object.keys(runtime.contributions).length + 1;
  const phaseForReceipt: WitnessMothBloomPhase = 'investigation';

  writeReceipt({
    player_id: input.player_id,
    action: RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION,
    inputs: {
      event_id: runtime.event_id,
      map: runtime.map,
      phase: phaseForReceipt,
      contribution_id: input.contribution_id,
      accepted_count: acceptedCount,
      required_count: WITNESS_MOTH_BLOOM_CONTRIBUTIONS.length,
    },
    result: 'ok',
  });

  runtime.phase = phaseForReceipt;
  runtime.contributions[input.contribution_id] = {
    contribution_id: input.contribution_id,
    player_id: input.player_id,
    recorded_at_ms: input.now_ms,
  };

  const shouldResolve = acceptedCount >= WITNESS_MOTH_BLOOM_CONTRIBUTIONS.length;
  if (!shouldResolve) {
    return {
      ok: true,
      recorded: true,
      resolved: false,
      phase: runtime.phase,
      message: messageForContribution(input.contribution_id),
      payload: {
        ...witnessMothBloomPublicState(runtime),
        contribution_id: input.contribution_id,
      },
    };
  }

  const outcome: WitnessMothBloomOutcome = 'controlled_release';
  writeReceipt({
    player_id: input.player_id,
    action: RECEIPT_ACTIONS.WORLD_EVENT_RESOLVED,
    inputs: {
      event_id: runtime.event_id,
      map: runtime.map,
      phase: 'resolved',
      outcome,
      accepted_count: acceptedCount,
      required_count: WITNESS_MOTH_BLOOM_CONTRIBUTIONS.length,
    },
    result: 'ok',
  });

  runtime.phase = 'resolved';
  runtime.resolved_by = input.player_id;
  runtime.resolved_at_ms = input.now_ms;
  runtime.outcome = outcome;

  return {
    ok: true,
    recorded: true,
    resolved: true,
    phase: runtime.phase,
    message: messageForPhase(runtime.phase),
    payload: {
      ...witnessMothBloomPublicState(runtime),
      contribution_id: input.contribution_id,
    },
  };
}

export function handleWitnessMothBloomSkillIntent(
  runtime: WitnessMothBloomRuntime,
  input: {
    player_id: string;
    map: MapName;
    skill_id: string;
    now_ms: number;
  },
  writeReceipt: WriteReceipt
): RecordWitnessMothContributionResult {
  const contributionId = parseWitnessMothBloomSkillId(input.skill_id);
  if (!contributionId) {
    return {
      ok: false,
      reason: 'invalid_skill',
      payload: { error: 'invalid_world_event_skill', event_id: runtime.event_id },
    };
  }

  return recordWitnessMothBloomContribution(
    runtime,
    {
      player_id: input.player_id,
      map: input.map,
      contribution_id: contributionId,
      now_ms: input.now_ms,
    },
    writeReceipt
  );
}

function isWitnessMothBloomContributionId(value: string): value is WitnessMothBloomContributionId {
  return WITNESS_MOTH_BLOOM_CONTRIBUTIONS.some((entry) => entry.contribution_id === value);
}

function isWitnessMothBloomPhase(value: string): value is WitnessMothBloomPhase {
  return value === 'idle' || value === 'signal' || value === 'investigation' || value === 'resolved';
}

function timestampMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHydratedContributions(raw: string): WitnessMothBloomRuntime['contributions'] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const contributions: WitnessMothBloomRuntime['contributions'] = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isWitnessMothBloomContributionId(key)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const rawContribution = value as Record<string, unknown>;
    const playerId = rawContribution.player_id;
    const recordedAt = rawContribution.recorded_at_ms;
    if (typeof playerId !== 'string' || typeof recordedAt !== 'number') continue;
    contributions[key] = {
      contribution_id: key,
      player_id: playerId,
      recorded_at_ms: recordedAt,
    };
  }
  return contributions;
}

function messageForPhase(phase: WitnessMothBloomPhase): string {
  switch (phase) {
    case 'signal':
      return 'Witness moths gather above Azura, replaying a forgotten trial in pale light.';
    case 'investigation':
      return 'The Bloom is being investigated. Testimony, lantern frames, and scribe defense all matter.';
    case 'resolved':
      return 'The Witness Moth Bloom settles into a controlled release. The Chronicle holds the result.';
    case 'idle':
    default:
      return 'No Bloom is active.';
  }
}

function messageForContribution(contributionId: WitnessMothBloomContributionId): string {
  switch (contributionId) {
    case 'verify_testimony':
      return 'A testimony shard is checked against the archive record.';
    case 'craft_lantern_frame':
      return 'A memory lantern frame is prepared for the Bloom.';
    case 'defend_scribes':
      return 'The scribes hold their line while the Bloom is indexed.';
  }
}
