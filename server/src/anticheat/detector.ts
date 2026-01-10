import type { AntiCheatState, Signal, SignalType } from '../../../shared/types.js';
import {
  SIGNAL_DECAY_MS,
  THROTTLE_DURATION_MS,
} from '../../../shared/types.js';
import { MIN_MOVE_INTERVAL_MS } from '../../../shared/constants.js';

export interface AntiCheatRuntime {
  state: AntiCheatState;
  lastMoveAt: number | null;
  moveIntervalsMs: number[];
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
    moveIntervalsMs: [],
    chatTimestamps: [],
  };
}

export function decaySignals(rt: AntiCheatRuntime, now: number): void {
  rt.state.signals = rt.state.signals.filter((s) => now - s.timestamp <= SIGNAL_DECAY_MS);
  rt.chatTimestamps = rt.chatTimestamps.filter((t) => now - t <= 10_000);
  rt.moveIntervalsMs = rt.moveIntervalsMs.slice(-32);
}

function addSignal(rt: AntiCheatRuntime, type: SignalType, now: number, details: Record<string, unknown>): Signal {
  const signal: Signal = { type, timestamp: now, details };
  rt.state.signals.push(signal);
  return signal;
}

function lowVariance(intervals: number[]): boolean {
  if (intervals.length < 12) return false;
  const xs = intervals.slice(-12);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const var_ = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length;
  const std = Math.sqrt(var_);
  return std < 2; // "perfect timing" signature (ms)
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

    if (lowVariance(rt.moveIntervalsMs)) {
      const signal = addSignal(rt, 'repeated_timing', now, { intervals_ms: rt.moveIntervalsMs.slice(-12) });
      if (rt.state.temChallengeActive) return { action: 'none' };
      return { action: 'request_tem', signal };
    }
  }

  rt.lastMoveAt = now;
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

