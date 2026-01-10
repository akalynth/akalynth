import type { AntiCheatState, Signal, SignalType } from '../../../shared/types.js';
import {
  SIGNAL_DECAY_MS,
  THROTTLE_DURATION_MS,
} from '../../../shared/types.js';
import {
  MIN_MOVE_INTERVAL_MS,
} from '../../../shared/constants.js';

const CADENCE_WINDOW_N = 12;
const CADENCE_MEAN_MIN_MS = 80;
const CADENCE_MEAN_MAX_MS = 400;
const CADENCE_STDDEV_MAX_MS = 10;
const CADENCE_IDLE_RESET_MS = 5_000;

export interface AntiCheatRuntime {
  state: AntiCheatState;
  lastMoveAt: number | null;
  lastMoveAppliedAt: number | null;
  moveIntervalsMs: number[];
  cadenceIntervalsMs: number[];
  chatTimestamps: number[];
}

export type DetectorAction =
  | { action: 'none' }
  | { action: 'warn'; signal: Signal }
  | { action: 'request_tem'; signal: Signal }
  | { action: 'throttle'; signal: Signal; until: number }
  | { action: 'kick'; signal: Signal; reason: string };

export function createAntiCheatRuntime(now: number): AntiCheatRuntime {
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
    moveIntervalsMs: [],
    cadenceIntervalsMs: [],
    chatTimestamps: [],
  };
}

export function decaySignals(rt: AntiCheatRuntime, now: number): void {
  rt.state.signals = rt.state.signals.filter((s) => now - s.timestamp <= SIGNAL_DECAY_MS);
  rt.chatTimestamps = rt.chatTimestamps.filter((t) => now - t <= 10_000);
  rt.moveIntervalsMs = rt.moveIntervalsMs.slice(-32);
  rt.cadenceIntervalsMs = rt.cadenceIntervalsMs.slice(-32);
}

function addSignal(rt: AntiCheatRuntime, type: SignalType, now: number, details: Record<string, unknown>): Signal {
  const signal: Signal = { type, timestamp: now, details };
  rt.state.signals.push(signal);
  return signal;
}

function cadenceStats(intervals: number[]): { mean: number; std: number; min: number; max: number } | null {
  if (intervals.length < CADENCE_WINDOW_N) return null;
  const window = intervals.slice(-CADENCE_WINDOW_N);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const variance = window.reduce((a, x) => a + (x - mean) ** 2, 0) / window.length;
  const std = Math.sqrt(variance);
  if (mean >= CADENCE_MEAN_MIN_MS && mean <= CADENCE_MEAN_MAX_MS && std <= CADENCE_STDDEV_MAX_MS) {
    const min = Math.min(...window);
    const max = Math.max(...window);
    return { mean, std, min, max };
  }
  return null;
}

export function onMoveIntent(rt: AntiCheatRuntime, now: number): DetectorAction {
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
      if (rt.state.temChallengeActive) return { action: 'none' };
      return { action: 'request_tem', signal };
    }
  }

  rt.lastMoveAt = now;
  return { action: 'none' };
}

export function onMoveApplied(rt: AntiCheatRuntime, now: number): DetectorAction {
  decaySignals(rt, now);

  if (rt.lastMoveAppliedAt !== null && now - rt.lastMoveAppliedAt > CADENCE_IDLE_RESET_MS) {
    rt.cadenceIntervalsMs = [];
  }

  if (rt.lastMoveAppliedAt !== null) {
    const rawDt = now - rt.lastMoveAppliedAt;
    const dt = Math.max(0, Math.min(rawDt, 2_000));
    rt.cadenceIntervalsMs.push(dt);

    const stats = cadenceStats(rt.cadenceIntervalsMs);
    if (stats && !rt.state.temChallengeActive) {
      const signal = addSignal(rt, 'repeated_timing', now, {
        mean_ms: Number(stats.mean.toFixed(2)),
        std_ms: Number(stats.std.toFixed(2)),
        min_ms: stats.min,
        max_ms: stats.max,
        n: CADENCE_WINDOW_N,
        intervals_ms: rt.cadenceIntervalsMs.slice(-CADENCE_WINDOW_N),
      });
      rt.cadenceIntervalsMs = [];
      rt.lastMoveAppliedAt = now;
      return { action: 'request_tem', signal };
    }
  }

  rt.lastMoveAppliedAt = now;
  return { action: 'none' };
}

export function onChat(rt: AntiCheatRuntime, now: number): DetectorAction {
  decaySignals(rt, now);
  rt.chatTimestamps.push(now);

  const windowCount = rt.chatTimestamps.filter((t) => now - t <= 5_000).length;
  if (windowCount >= 8) {
    const signal = addSignal(rt, 'chat_spam', now, { msgs_5s: windowCount });
    if (rt.state.temChallengeActive) return { action: 'none' };
    if (rt.state.throttleUntil && now < rt.state.throttleUntil) {
      return { action: 'kick', signal, reason: 'chat_spam_while_throttled' };
    }
    return { action: 'throttle', signal, until: now + THROTTLE_DURATION_MS };
  }

  return { action: 'none' };
}

