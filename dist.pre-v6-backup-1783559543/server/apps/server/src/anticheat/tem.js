import { randomUUID } from 'node:crypto';
import { TEM_CHALLENGE_RESPONSE, THROTTLE_DURATION_MS } from '../../../../packages/shared/types.js';
import { TEM_TIMEOUT_SECONDS } from '../../../../packages/shared/constants.js';
export function issueTemChallenge(state, now) {
    if (state.temChallengeActive)
        return { outcome: 'none' };
    const challenge_id = `tc_${randomUUID()}`;
    state.temChallengeActive = true;
    state.temChallengeId = challenge_id;
    state.temChallengeExpires = now + TEM_TIMEOUT_SECONDS * 1000;
    return {
        outcome: 'issued',
        challenge: {
            challenge_id,
            message: `Type ${TEM_CHALLENGE_RESPONSE} to confirm you are playing by hand. You have ${TEM_TIMEOUT_SECONDS} seconds.`,
            timeout_seconds: TEM_TIMEOUT_SECONDS,
        },
    };
}
export function checkTemTimeout(state, now) {
    if (!state.temChallengeActive || !state.temChallengeExpires)
        return { outcome: 'none' };
    if (now < state.temChallengeExpires)
        return { outcome: 'none' };
    state.temChallengeActive = false;
    state.temChallengeId = null;
    state.temChallengeExpires = null;
    return { outcome: 'failed', reason: 'timeout' };
}
export function handleTemResponse(state, response) {
    if (!state.temChallengeActive)
        return { outcome: 'none' };
    const ok = response.trim().toUpperCase() === TEM_CHALLENGE_RESPONSE;
    state.temChallengeActive = false;
    state.temChallengeId = null;
    state.temChallengeExpires = null;
    return ok ? { outcome: 'passed' } : { outcome: 'failed', reason: 'wrong_response' };
}
export function applyThrottle(state, now) {
    state.throttleUntil = Math.max(state.throttleUntil ?? 0, now + THROTTLE_DURATION_MS);
}
export function isThrottled(state, now) {
    return state.throttleUntil !== null && now < state.throttleUntil;
}
