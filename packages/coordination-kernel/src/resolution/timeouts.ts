// Time-bounded Decision Management
// TTL enforcement and automatic resolution

import type { AuditWriter } from '../types.js';
import type { ResolutionConfig, BoundedResolution } from './quorum.js';
import { cleanupExpiredRequests, tryResolveRequest, getPendingResolutions } from './quorum.js';

// ============================================================================
// Timeout Management
// ============================================================================

export interface TimeoutManager {
  /**
   * Check and resolve any expired requests
   */
  processTimeouts(): Promise<{
    processed: number;
    resolved: string[];
    errors: Array<{ request_id: string; error: string }>;
  }>;

  /**
   * Get time until next timeout
   */
  getNextTimeoutMs(): number | null;

  /**
   * Force resolve all pending requests (for testing)
   */
  forceResolveAll(): Promise<void>;

  /**
   * Get timeout statistics
   */
  getTimeoutStats(): {
    pending_requests: number;
    average_age_ms: number;
    oldest_request_age_ms: number;
    requests_near_timeout: number;
  };
}

/**
 * Create a timeout manager for bounded resolution
 */
export function createTimeoutManager(
  config: ResolutionConfig,
  audit: AuditWriter
): TimeoutManager {
  return {
    async processTimeouts(): Promise<{
      processed: number;
      resolved: string[];
      errors: Array<{ request_id: string; error: string }>;
    }> {
      const now = Date.now();
      const resolved: string[] = [];
      const errors: Array<{ request_id: string; error: string }> = [];

      // Get all pending requests that might be expired
      const pending = getPendingResolutions();
      const expiredRequests = pending.filter(r => now >= r.expires_at);

      for (const request of expiredRequests) {
        try {
          const outcome = await tryResolveRequest(request.id, config, audit, now);
          if (outcome) {
            resolved.push(request.id);
          }
        } catch (error) {
          errors.push({
            request_id: request.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Also run the general cleanup
      try {
        const cleanup = await cleanupExpiredRequests(config, audit, now);
        // Add any additional resolved requests from cleanup
        for (const requestId of cleanup.expired_requests) {
          if (!resolved.includes(requestId)) {
            resolved.push(requestId);
          }
        }
      } catch (error) {
        errors.push({
          request_id: 'cleanup_process',
          error: error instanceof Error ? error.message : 'Cleanup failed'
        });
      }

      return {
        processed: expiredRequests.length,
        resolved,
        errors
      };
    },

    getNextTimeoutMs(): number | null {
      const now = Date.now();
      const pending = getPendingResolutions();

      if (pending.length === 0) return null;

      const nextExpiry = Math.min(...pending.map(r => r.expires_at));
      return Math.max(0, nextExpiry - now);
    },

    async forceResolveAll(): Promise<void> {
      const now = Date.now();
      const pending = getPendingResolutions();

      for (const request of pending) {
        try {
          // Force resolve by treating as expired
          await tryResolveRequest(request.id, config, audit, request.expires_at + 1);
        } catch (error) {
          await audit.write({
            actor_id: 'system',
            action: 'timeout_force_resolve_failed',
            inputs: {
              request_id: request.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            },
            result: 'error',
          });
        }
      }
    },

    getTimeoutStats(): {
      pending_requests: number;
      average_age_ms: number;
      oldest_request_age_ms: number;
      requests_near_timeout: number;
    } {
      const now = Date.now();
      const pending = getPendingResolutions();

      if (pending.length === 0) {
        return {
          pending_requests: 0,
          average_age_ms: 0,
          oldest_request_age_ms: 0,
          requests_near_timeout: 0
        };
      }

      const ages = pending.map(r => now - r.created_at);
      const timeToExpiry = pending.map(r => r.expires_at - now);

      const averageAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
      const oldestAge = Math.max(...ages);

      // Consider "near timeout" as having less than 20% of TTL remaining
      const nearTimeoutThreshold = config.requestTtlMs * 0.2;
      const nearTimeout = timeToExpiry.filter(ttl => ttl <= nearTimeoutThreshold && ttl > 0).length;

      return {
        pending_requests: pending.length,
        average_age_ms: Math.round(averageAge),
        oldest_request_age_ms: oldestAge,
        requests_near_timeout: nearTimeout
      };
    }
  };
}

// ============================================================================
// Automatic Timeout Processing
// ============================================================================

export interface AutoTimeoutProcessor {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  getStats(): {
    cycles_run: number;
    last_run_at: number | null;
    total_resolved: number;
    total_errors: number;
  };
}

/**
 * Create an automatic timeout processor that runs on an interval
 */
export function createAutoTimeoutProcessor(
  timeoutManager: TimeoutManager,
  intervalMs: number = 30000 // Default: 30 seconds
): AutoTimeoutProcessor {
  let intervalHandle: NodeJS.Timeout | null = null;
  let cyclesRun = 0;
  let lastRunAt: number | null = null;
  let totalResolved = 0;
  let totalErrors = 0;

  return {
    start(): void {
      if (intervalHandle) return; // Already running

      intervalHandle = setInterval(async () => {
        try {
          const result = await timeoutManager.processTimeouts();
          cyclesRun++;
          lastRunAt = Date.now();
          totalResolved += result.resolved.length;
          totalErrors += result.errors.length;
        } catch (error) {
          totalErrors++;
          console.error('Auto timeout processor failed:', error);
        }
      }, intervalMs);
    },

    stop(): void {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
    },

    isRunning(): boolean {
      return intervalHandle !== null;
    },

    getStats() {
      return {
        cycles_run: cyclesRun,
        last_run_at: lastRunAt,
        total_resolved: totalResolved,
        total_errors: totalErrors
      };
    }
  };
}

// ============================================================================
// Timeout Utilities
// ============================================================================

/**
 * Calculate recommended TTL based on expected participation
 */
export function calculateRecommendedTtl(
  participantCount: number,
  baseResponseTimeMs: number = 60000 // 1 minute base
): number {
  // More participants = longer TTL (but with diminishing returns)
  const participantMultiplier = Math.log10(participantCount + 1) + 1;
  return Math.round(baseResponseTimeMs * participantMultiplier);
}

/**
 * Get human-readable time remaining
 */
export function formatTimeRemaining(expiresAt: number, now: number = Date.now()): string {
  const remaining = expiresAt - now;

  if (remaining <= 0) return 'EXPIRED';

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Check if a request is in "urgent" state (near expiration)
 */
export function isUrgent(request: BoundedResolution, urgentThresholdMs: number = 60000): boolean {
  const now = Date.now();
  return !request.resolved && (request.expires_at - now) <= urgentThresholdMs;
}