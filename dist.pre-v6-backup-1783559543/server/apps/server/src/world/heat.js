const clampScore = (value) => Math.max(0, Math.min(100, value));
function clearExpiredPenalty(state, nowMs) {
    if (state.penalty_until_ms !== null && nowMs >= state.penalty_until_ms) {
        return { ...state, penalty_until_ms: null };
    }
    return state;
}
export function createHeatState(nowMs) {
    return {
        score: 0,
        last_updated_ms: nowMs,
        last_tem_trigger_ms: null,
        last_decay_ms: nowMs,
        penalty_until_ms: null,
        reason_counters: {},
    };
}
export function hydrateHeatState(saved, nowMs, decayPerMin) {
    const updatedAtMs = Date.parse(saved.updated_at);
    const base = {
        score: Number.isFinite(saved.heat) ? clampScore(saved.heat) : 0,
        last_updated_ms: Number.isFinite(updatedAtMs) ? updatedAtMs : nowMs,
        last_tem_trigger_ms: saved.last_tem_ms,
        last_decay_ms: Number.isFinite(updatedAtMs) ? updatedAtMs : nowMs,
        penalty_until_ms: saved.penalty_until_ms,
        reason_counters: {},
    };
    return applyDecay(base, nowMs, decayPerMin).state;
}
export function applyDecay(state, nowMs, decayPerMin) {
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
export function addHeat(state, nowMs, delta, reason, decayPerMin) {
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
export function shouldTemEscalate(state, nowMs, threshold, cooldownMs) {
    if (state.score < threshold)
        return false;
    if (state.last_tem_trigger_ms !== null && nowMs - state.last_tem_trigger_ms < cooldownMs)
        return false;
    return true;
}
export function shouldApplyPenalty(state, nowMs, threshold) {
    if (state.score < threshold)
        return false;
    if (state.penalty_until_ms !== null && nowMs < state.penalty_until_ms)
        return false;
    return true;
}
export function isPenaltyActive(state, nowMs) {
    return state.penalty_until_ms !== null && nowMs < state.penalty_until_ms;
}
export function startPenalty(state, nowMs, durationMs) {
    return {
        ...state,
        penalty_until_ms: nowMs + durationMs,
        last_updated_ms: nowMs,
    };
}
