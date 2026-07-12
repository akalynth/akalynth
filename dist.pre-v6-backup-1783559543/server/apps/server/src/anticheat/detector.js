import { SIGNAL_DECAY_MS, THROTTLE_DURATION_MS, } from '../../../../packages/shared/types.js';
import { MIN_MOVE_INTERVAL_MS, CADENCE_WINDOW_N, CADENCE_MIN_SAMPLES, CADENCE_STDDEV_MAX_MS, CADENCE_MEAN_TARGET_MS, CADENCE_MEAN_TOLERANCE_MS, CADENCE_COOLDOWN_MS, CADENCE_IDLE_RESET_MS, } from '../../../../packages/shared/constants.js';
export function createAntiCheatRuntime(now) {
    return {
        state: {
            signals: [],
            warnCount: 0,
            temChallengeActive: false,
            temChallengeId: null,
            temChallengeExpires: null,
            throttleUntil: null,
            kickCount: 0,
        },
        lastMoveAt: null,
        lastMoveAppliedAt: null,
        lastCadenceTriggerAt: null,
        moveIntervalsMs: [],
        cadenceIntervalsMs: [],
        chatTimestamps: [],
    };
}
export function hydrateAntiCheatRuntime(saved, now) {
    const runtime = createAntiCheatRuntime(now);
    runtime.state.warnCount = Number.isFinite(saved.warn_count) ? Math.max(0, saved.warn_count) : 0;
    runtime.state.kickCount = Number.isFinite(saved.kick_count) ? Math.max(0, saved.kick_count) : 0;
    if (saved.throttle_until_ms !== null && saved.throttle_until_ms > now) {
        runtime.state.throttleUntil = saved.throttle_until_ms;
    }
    return runtime;
}
export function decaySignals(rt, now) {
    rt.state.signals = rt.state.signals.filter((s) => now - s.timestamp <= SIGNAL_DECAY_MS);
    rt.chatTimestamps = rt.chatTimestamps.filter((t) => now - t <= 10_000);
    rt.moveIntervalsMs = rt.moveIntervalsMs.slice(-32);
    rt.cadenceIntervalsMs = rt.cadenceIntervalsMs.slice(-32);
}
function addSignal(rt, type, now, details) {
    const signal = { type, timestamp: now, details };
    rt.state.signals.push(signal);
    return signal;
}
function cadenceStats(intervals) {
    if (intervals.length < CADENCE_MIN_SAMPLES)
        return null;
    const window = intervals.slice(-CADENCE_WINDOW_N);
    const n = window.length;
    const mean = window.reduce((a, b) => a + b, 0) / n;
    const variance = window.reduce((a, x) => a + (x - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    // Perfect cadence: mean near tick target with very low variance
    const meanInRange = Math.abs(mean - CADENCE_MEAN_TARGET_MS) <= CADENCE_MEAN_TOLERANCE_MS;
    if (meanInRange && std <= CADENCE_STDDEV_MAX_MS) {
        const min = Math.min(...window);
        const max = Math.max(...window);
        return { mean, std, min, max, n };
    }
    return null;
}
export function onMoveIntent(rt, now) {
    decaySignals(rt, now);
    if (rt.state.throttleUntil && now < rt.state.throttleUntil) {
        // While throttled, still record if they keep spamming.
    }
    if (rt.lastMoveAt !== null) {
        const dt = now - rt.lastMoveAt;
        rt.moveIntervalsMs.push(dt);
        if (dt < MIN_MOVE_INTERVAL_MS) {
            const signal = addSignal(rt, 'speed_violation', now, { dt_ms: dt, min_ms: MIN_MOVE_INTERVAL_MS });
            // Escalate quickly on repeated speed violations.
            if (rt.state.temChallengeActive)
                return { action: 'none' };
            return { action: 'request_tem', signal };
        }
    }
    rt.lastMoveAt = now;
    return { action: 'none' };
}
export function onMoveApplied(rt, now) {
    decaySignals(rt, now);
    // Reset cadence window after idle period
    if (rt.lastMoveAppliedAt !== null && now - rt.lastMoveAppliedAt > CADENCE_IDLE_RESET_MS) {
        rt.cadenceIntervalsMs = [];
    }
    if (rt.lastMoveAppliedAt !== null) {
        const rawDt = now - rt.lastMoveAppliedAt;
        const dt = Math.max(0, Math.min(rawDt, 2_000));
        rt.cadenceIntervalsMs.push(dt);
        const stats = cadenceStats(rt.cadenceIntervalsMs);
        if (stats && !rt.state.temChallengeActive) {
            // Check cooldown to prevent spam challenges
            const sinceLastTrigger = rt.lastCadenceTriggerAt !== null
                ? now - rt.lastCadenceTriggerAt
                : Infinity;
            if (sinceLastTrigger >= CADENCE_COOLDOWN_MS) {
                rt.lastCadenceTriggerAt = now;
                const signal = addSignal(rt, 'perfect_cadence', now, {
                    signal: 'perfect_cadence',
                    mean_ms: Number(stats.mean.toFixed(2)),
                    std_ms: Number(stats.std.toFixed(2)),
                    min_ms: stats.min,
                    max_ms: stats.max,
                    n: stats.n,
                    cooldown_ms: CADENCE_COOLDOWN_MS,
                    since_last_ms: sinceLastTrigger === Infinity ? null : sinceLastTrigger,
                });
                rt.cadenceIntervalsMs = [];
                rt.lastMoveAppliedAt = now;
                return { action: 'request_tem', signal };
            }
        }
    }
    rt.lastMoveAppliedAt = now;
    return { action: 'none' };
}
export function onChat(rt, now) {
    decaySignals(rt, now);
    rt.chatTimestamps.push(now);
    const windowCount = rt.chatTimestamps.filter((t) => now - t <= 5_000).length;
    if (windowCount >= 8) {
        const signal = addSignal(rt, 'chat_spam', now, { msgs_5s: windowCount });
        if (rt.state.temChallengeActive)
            return { action: 'none' };
        if (rt.state.throttleUntil && now < rt.state.throttleUntil) {
            return { action: 'kick', signal, reason: 'chat_spam_while_throttled' };
        }
        return { action: 'throttle', signal, until: now + THROTTLE_DURATION_MS };
    }
    return { action: 'none' };
}
