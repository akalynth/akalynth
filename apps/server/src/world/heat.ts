export type HeatState = {
  score: number;
  last_updated_ms: number;
  last_tem_trigger_ms: number | null;
  last_decay_ms: number;
  penalty_until_ms: number | null;
  reason_counters: Record<string, number>;
};

export interface PersistedHeatState {
  heat: number;
  penalty_until_ms: number | null;
  last_tem_ms: number | null;
  updated_at: string;
}

const clampScore = (value: number): number => Math.max(0, Math.min(100, value));

function clearExpiredPenalty(state: HeatState, nowMs: number): HeatState {
  if (state.penalty_until_ms !== null && nowMs >= state.penalty_until_ms) {
    return { ...state, penalty_until_ms: null };
  }
  return state;
}

export function createHeatState(nowMs: number): HeatState {
  return {
    score: 0,
    last_updated_ms: nowMs,
    last_tem_trigger_ms: null,
    last_decay_ms: nowMs,
    penalty_until_ms: null,
    reason_counters: {},
  };
}

export function hydrateHeatState(
  saved: PersistedHeatState,
  nowMs: number,
  decayPerMin: number
): HeatState {
  const updatedAtMs = Date.parse(saved.updated_at);
  const base: HeatState = {
    score: Number.isFinite(saved.heat) ? clampScore(saved.heat) : 0,
    last_updated_ms: Number.isFinite(updatedAtMs) ? updatedAtMs : nowMs,
    last_tem_trigger_ms: saved.last_tem_ms,
    last_decay_ms: Number.isFinite(updatedAtMs) ? updatedAtMs : nowMs,
    penalty_until_ms: saved.penalty_until_ms,
    reason_counters: {},
  };

  return applyDecay(base, nowMs, decayPerMin).state;
}

export function applyDecay(
  state: HeatState,
  nowMs: number,
  decayPerMin: number
): { state: HeatState; decayApplied: number } {
  const base = clearExpiredPenalty(state, nowMs);
  const elapsedMs = Math.max(0, nowMs - base.last_decay_ms);
  const shouldDecay = decayPerMin > 0 && base.score > 0 && elapsedMs > 0;
  if (!shouldDecay) {
    return { state: { ...base, last_decay_ms: nowMs }, decayApplied: 0 };
  }

  const decayAmount = (elapsedMs / 60_000) * decayPerMin;
  const newScore = clampScore(base.score - decayAmount);
  const decayApplied = base.score - newScore;

  return {
    state: {
      ...base,
      score: newScore,
      last_decay_ms: nowMs,
      last_updated_ms: nowMs,
    },
    decayApplied,
  };
}

export function addHeat(
  state: HeatState,
  nowMs: number,
  delta: number,
  reason: string,
  decayPerMin: number
): { state: HeatState; prevScore: number; newScore: number; decayApplied: number } {
  const prevScore = state.score;
  const { state: decayed, decayApplied } = applyDecay(state, nowMs, decayPerMin);
  const newScore = clampScore(decayed.score + delta);
  const reasonCount = (decayed.reason_counters[reason] ?? 0) + 1;

  return {
    state: {
      ...decayed,
      score: newScore,
      last_updated_ms: nowMs,
      reason_counters: { ...decayed.reason_counters, [reason]: reasonCount },
    },
    prevScore,
    newScore,
    decayApplied,
  };
}

export function shouldTemEscalate(
  state: HeatState,
  nowMs: number,
  threshold: number,
  cooldownMs: number
): boolean {
  if (state.score < threshold) return false;
  if (state.last_tem_trigger_ms !== null && nowMs - state.last_tem_trigger_ms < cooldownMs) return false;
  return true;
}

export function shouldApplyPenalty(state: HeatState, nowMs: number, threshold: number): boolean {
  if (state.score < threshold) return false;
  if (state.penalty_until_ms !== null && nowMs < state.penalty_until_ms) return false;
  return true;
}

export function isPenaltyActive(state: HeatState, nowMs: number): boolean {
  return state.penalty_until_ms !== null && nowMs < state.penalty_until_ms;
}

export function startPenalty(state: HeatState, nowMs: number, durationMs: number): HeatState {
  return {
    ...state,
    penalty_until_ms: nowMs + durationMs,
    last_updated_ms: nowMs,
  };
}
