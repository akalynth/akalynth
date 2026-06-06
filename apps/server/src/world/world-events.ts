import type { MapName } from '../../../../packages/shared/http.js';
import { RECEIPT_ACTIONS } from '../persist/types.js';

export const WITNESS_MOTH_BLOOM_EVENT_ID = 'witness_moth_bloom';
export const WITNESS_MOTH_BLOOM_SKILL_PREFIX = `event:${WITNESS_MOTH_BLOOM_EVENT_ID}:`;
export const WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX = `${WITNESS_MOTH_BLOOM_SKILL_PREFIX}evidence:`;
export const EMBER_ROAD_TEASER_ID = 'ember_road_marker';

export type WitnessMothBloomPhase = 'idle' | 'signal' | 'investigation' | 'resolved';
export type WitnessMothBloomOutcome = 'controlled_release';
export type WitnessMothBloomEvidenceId =
  | 'testimony_shard'
  | 'damaged_ledger'
  | 'moth_residue';
export type WitnessMothBloomContributionId =
  | 'verify_testimony'
  | 'craft_lantern_frame'
  | 'defend_scribes';

export type WitnessMothBloomSkillIntent =
  | { kind: 'evidence'; evidence_id: WitnessMothBloomEvidenceId }
  | { kind: 'contribution'; contribution_id: WitnessMothBloomContributionId };

export interface WitnessMothBloomEvidence {
  evidence_id: WitnessMothBloomEvidenceId;
  player_id: string;
  recovered_at_ms: number;
}

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
  evidence: Partial<Record<WitnessMothBloomEvidenceId, WitnessMothBloomEvidence>>;
  contributions: Partial<Record<WitnessMothBloomContributionId, WitnessMothBloomContribution>>;
  teaser: { id: typeof EMBER_ROAD_TEASER_ID; unlocked: true; unlocked_by: string; unlocked_at_ms: number } | null;
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
  evidence_json?: string | null;
  teaser_json?: string | null;
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

export const WITNESS_MOTH_BLOOM_EVIDENCE: ReadonlyArray<{
  evidence_id: WitnessMothBloomEvidenceId;
  label: string;
}> = [
  { evidence_id: 'testimony_shard', label: 'Testimony shard' },
  { evidence_id: 'damaged_ledger', label: 'Damaged ledger' },
  { evidence_id: 'moth_residue', label: 'Witness moth residue' },
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
    evidence: {},
    contributions: {},
    teaser: null,
  };
}

export function parseWitnessMothBloomSkillId(skillId: string): WitnessMothBloomContributionId | null {
  if (!skillId.startsWith(WITNESS_MOTH_BLOOM_SKILL_PREFIX)) return null;
  if (skillId.startsWith(WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX)) return null;
  const contributionId = skillId.slice(WITNESS_MOTH_BLOOM_SKILL_PREFIX.length);
  return isWitnessMothBloomContributionId(contributionId) ? contributionId : null;
}

export function parseWitnessMothBloomEvidenceSkillId(skillId: string): WitnessMothBloomEvidenceId | null {
  if (!skillId.startsWith(WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX)) return null;
  const evidenceId = skillId.slice(WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX.length);
  return isWitnessMothBloomEvidenceId(evidenceId) ? evidenceId : null;
}

export function parseWitnessMothBloomSkillIntent(skillId: string): WitnessMothBloomSkillIntent | null {
  const evidenceId = parseWitnessMothBloomEvidenceSkillId(skillId);
  if (evidenceId) return { kind: 'evidence', evidence_id: evidenceId };

  const contributionId = parseWitnessMothBloomSkillId(skillId);
  if (contributionId) return { kind: 'contribution', contribution_id: contributionId };

  return null;
}

export function witnessMothBloomPublicState(runtime: WitnessMothBloomRuntime) {
  const teaser = runtime.teaser?.unlocked
    ? { id: runtime.teaser.id, unlocked: true as const }
    : undefined;

  return {
    event_id: runtime.event_id,
    map: runtime.map,
    phase: runtime.phase,
    evidence_count: Object.keys(runtime.evidence).length,
    required_evidence_count: WITNESS_MOTH_BLOOM_EVIDENCE.length,
    contribution_count: Object.keys(runtime.contributions).length,
    required_count: WITNESS_MOTH_BLOOM_CONTRIBUTIONS.length,
    outcome: runtime.outcome,
    ...(teaser ? { teaser } : {}),
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
  runtime.evidence = parseHydratedEvidence(row.evidence_json);
  runtime.contributions = parseHydratedContributions(row.contributions_json);
  runtime.teaser = parseHydratedTeaser(row.teaser_json);
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

export type RecoverWitnessMothEvidenceResult =
  | {
      ok: true;
      recovered: boolean;
      phase: WitnessMothBloomPhase;
      message: string;
      payload: Record<string, unknown>;
    }
  | {
      ok: false;
      reason: 'invalid_skill' | 'invalid_target';
      payload: Record<string, unknown>;
    };

export function recoverWitnessMothBloomEvidence(
  runtime: WitnessMothBloomRuntime,
  input: {
    player_id: string;
    map: MapName;
    evidence_id: WitnessMothBloomEvidenceId;
    now_ms: number;
  },
  writeReceipt: WriteReceipt
): RecoverWitnessMothEvidenceResult {
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
      recovered: false,
      phase: runtime.phase,
      message: messageForPhase(runtime.phase),
      payload: witnessMothBloomPublicState(runtime),
    };
  }

  if (runtime.evidence[input.evidence_id]) {
    return {
      ok: true,
      recovered: false,
      phase: runtime.phase,
      message: 'That evidence is already recovered for the Bloom.',
      payload: {
        ...witnessMothBloomPublicState(runtime),
        evidence_id: input.evidence_id,
        duplicate: true,
      },
    };
  }

  const recoveredCount = Object.keys(runtime.evidence).length + 1;
  writeReceipt({
    player_id: input.player_id,
    action: RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED,
    inputs: {
      event_id: runtime.event_id,
      map: runtime.map,
      phase: runtime.phase,
      evidence_id: input.evidence_id,
      recovered_count: recoveredCount,
      required_evidence_count: WITNESS_MOTH_BLOOM_EVIDENCE.length,
    },
    result: 'ok',
  });

  runtime.evidence[input.evidence_id] = {
    evidence_id: input.evidence_id,
    player_id: input.player_id,
    recovered_at_ms: input.now_ms,
  };

  return {
    ok: true,
    recovered: true,
    phase: runtime.phase,
    message: messageForEvidence(input.evidence_id),
    payload: {
      ...witnessMothBloomPublicState(runtime),
      evidence_id: input.evidence_id,
    },
  };
}

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

  if (!allWitnessMothBloomEvidenceRecovered(runtime)) {
    return {
      ok: false,
      reason: 'invalid_target',
      payload: {
        error: 'evidence_required',
        event_id: runtime.event_id,
        required_evidence_ids: WITNESS_MOTH_BLOOM_EVIDENCE.map((entry) => entry.evidence_id),
      },
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

  writeReceipt({
    player_id: input.player_id,
    action: RECEIPT_ACTIONS.WORLD_EVENT_TEASER_UNLOCKED,
    inputs: {
      event_id: runtime.event_id,
      map: runtime.map,
      phase: 'resolved',
      teaser_id: EMBER_ROAD_TEASER_ID,
      unlocked: true,
      source: RECEIPT_ACTIONS.WORLD_EVENT_RESOLVED,
    },
    result: 'ok',
  });

  runtime.phase = 'resolved';
  runtime.resolved_by = input.player_id;
  runtime.resolved_at_ms = input.now_ms;
  runtime.outcome = outcome;
  runtime.teaser = {
    id: EMBER_ROAD_TEASER_ID,
    unlocked: true,
    unlocked_by: input.player_id,
    unlocked_at_ms: input.now_ms,
  };

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
): RecordWitnessMothContributionResult | RecoverWitnessMothEvidenceResult {
  const intent = parseWitnessMothBloomSkillIntent(input.skill_id);
  if (!intent) {
    return {
      ok: false,
      reason: 'invalid_skill',
      payload: { error: 'invalid_world_event_skill', event_id: runtime.event_id },
    };
  }

  if (intent.kind === 'evidence') {
    return recoverWitnessMothBloomEvidence(
      runtime,
      {
        player_id: input.player_id,
        map: input.map,
        evidence_id: intent.evidence_id,
        now_ms: input.now_ms,
      },
      writeReceipt
    );
  }

  return recordWitnessMothBloomContribution(
    runtime,
    {
      player_id: input.player_id,
      map: input.map,
      contribution_id: intent.contribution_id,
      now_ms: input.now_ms,
    },
    writeReceipt
  );
}

function allWitnessMothBloomEvidenceRecovered(runtime: WitnessMothBloomRuntime): boolean {
  return WITNESS_MOTH_BLOOM_EVIDENCE.every((entry) => !!runtime.evidence[entry.evidence_id]);
}

function isWitnessMothBloomEvidenceId(value: string): value is WitnessMothBloomEvidenceId {
  return WITNESS_MOTH_BLOOM_EVIDENCE.some((entry) => entry.evidence_id === value);
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

function parseHydratedEvidence(raw: string | null | undefined): WitnessMothBloomRuntime['evidence'] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? '{}');
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const evidence: WitnessMothBloomRuntime['evidence'] = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isWitnessMothBloomEvidenceId(key)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const rawEvidence = value as Record<string, unknown>;
    const playerId = rawEvidence.player_id;
    const recoveredAt = rawEvidence.recovered_at_ms;
    if (typeof playerId !== 'string' || typeof recoveredAt !== 'number') continue;
    evidence[key] = {
      evidence_id: key,
      player_id: playerId,
      recovered_at_ms: recoveredAt,
    };
  }
  return evidence;
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

function parseHydratedTeaser(
  raw: string | null | undefined
): WitnessMothBloomRuntime['teaser'] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? '{}');
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const teaser = parsed as Record<string, unknown>;
  if (teaser.id !== EMBER_ROAD_TEASER_ID || teaser.unlocked !== true) return null;
  const unlockedBy = teaser.unlocked_by;
  const unlockedAt = teaser.unlocked_at_ms;
  if (typeof unlockedBy !== 'string' || typeof unlockedAt !== 'number') return null;
  return {
    id: EMBER_ROAD_TEASER_ID,
    unlocked: true,
    unlocked_by: unlockedBy,
    unlocked_at_ms: unlockedAt,
  };
}

function messageForPhase(phase: WitnessMothBloomPhase): string {
  switch (phase) {
    case 'signal':
      return 'Lanterns draw moths. Witness draws memory. When the bloom comes, stand where you mean to be seen.';
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

function messageForEvidence(evidenceId: WitnessMothBloomEvidenceId): string {
  switch (evidenceId) {
    case 'testimony_shard':
      return 'A testimony shard is recovered from the Bloom signal.';
    case 'damaged_ledger':
      return 'A damaged ledger is pulled from the archive steps.';
    case 'moth_residue':
      return 'Witness moth residue is sealed for Chronicle review.';
  }
}
