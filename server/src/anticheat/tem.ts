import { randomUUID } from 'node:crypto';
import type { AntiCheatState } from '../../../shared/types';
import { TEM_CHALLENGE_TIMEOUT_MS, TEM_CHALLENGE_RESPONSE, THROTTLE_DURATION_MS } from '../../../shared/types';

export interface TemChallenge {
  challenge_id: string;
  message: string;
  timeout_seconds: number;
}

export type TemOutcome =
  | { outcome: 'none' }
  | { outcome: 'issued'; challenge: TemChallenge }
  | { outcome: 'passed' }
  | { outcome: 'failed'; reason: 'wrong_response' | 'timeout' };

export function issueTemChallenge(state: AntiCheatState, now: number): TemOutcome {
  if (state.temChallengeActive) return { outcome: 'none' };

  const challenge_id = `tc_${randomUUID()}`;
  state.temChallengeActive = true;
  state.temChallengeId = challenge_id;
  state.temChallengeExpires = now + TEM_CHALLENGE_TIMEOUT_MS;

  return {
    outcome: 'issued',
    challenge: {
      challenge_id,
      message: 'Hi! 👋 type AZURA in chat within 15 seconds',
      timeout_seconds: Math.floor(TEM_CHALLENGE_TIMEOUT_MS / 1000),
    },
  };
}

export function checkTemTimeout(state: AntiCheatState, now: number): TemOutcome {
  if (!state.temChallengeActive || !state.temChallengeExpires) return { outcome: 'none' };
  if (now < state.temChallengeExpires) return { outcome: 'none' };

  state.temChallengeActive = false;
  state.temChallengeId = null;
  state.temChallengeExpires = null;
  return { outcome: 'failed', reason: 'timeout' };
}

export function handleTemResponse(state: AntiCheatState, response: string): TemOutcome {
  if (!state.temChallengeActive) return { outcome: 'none' };

  const ok = response.trim().toUpperCase() === TEM_CHALLENGE_RESPONSE;
  state.temChallengeActive = false;
  state.temChallengeId = null;
  state.temChallengeExpires = null;

  return ok ? { outcome: 'passed' } : { outcome: 'failed', reason: 'wrong_response' };
}

export function applyThrottle(state: AntiCheatState, now: number): void {
  state.throttleUntil = Math.max(state.throttleUntil ?? 0, now + THROTTLE_DURATION_MS);
}

export function isThrottled(state: AntiCheatState, now: number): boolean {
  return state.throttleUntil !== null && now < state.throttleUntil;
}

