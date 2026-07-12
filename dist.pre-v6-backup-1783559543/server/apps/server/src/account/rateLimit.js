// Minimal in-memory sliding-window rate limiter for the account endpoints (E2).
//
// Single-instance, process-local. Keyed by a caller-chosen string (e.g. a hash of
// source IP, or IP + email_lower) so login/register/reset cannot be hammered.
// A production multi-instance deployment would back this with a shared store; the
// interface stays the same.
export class RateLimiter {
    limit;
    windowMs;
    windows = new Map();
    constructor(limit, windowMs) {
        this.limit = limit;
        this.windowMs = windowMs;
    }
    check(key, nowMs = Date.now()) {
        const w = this.windows.get(key);
        if (!w || nowMs >= w.resetAt) {
            this.windows.set(key, { count: 1, resetAt: nowMs + this.windowMs });
            return { ok: true, retryAfterSec: 0 };
        }
        if (w.count >= this.limit) {
            return { ok: false, retryAfterSec: Math.ceil((w.resetAt - nowMs) / 1000) };
        }
        w.count += 1;
        return { ok: true, retryAfterSec: 0 };
    }
    /** Opportunistic cleanup of expired windows (call periodically if desired). */
    sweep(nowMs = Date.now()) {
        for (const [k, w] of this.windows)
            if (nowMs >= w.resetAt)
                this.windows.delete(k);
    }
}
