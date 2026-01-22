/**
 * Metrics Collection and SLO Evaluation
 *
 * Collects time-series metrics during load test runs and evaluates
 * against SLO thresholds to detect breaking points.
 */

import { SLOThresholds } from './config.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface Percentiles {
  p50: number;
  p95: number;
  p99: number;
  max: number;
  count: number;
}

export interface MetricsSample {
  timestamp: number;
  tick_duration_ms?: number;
  event_loop_lag_ms?: number;
  message_latency_ms?: number;
  receipt_append_latency_ms?: number;
  heap_used_mb?: number;
  cpu_percent?: number;
  active_connections?: number;
  messages_sent?: number;
  messages_received?: number;
  errors?: number;
  disconnects?: number;
  // Global rate limiter metrics
  global_rate_limited?: number;
  global_send_queue_depth?: number;
}

export interface MetricsSummary {
  tick_duration_ms: Percentiles;
  event_loop_lag_ms: Percentiles;
  message_latency_ms: Percentiles;
  receipt_append_latency_ms: Percentiles;
  peak_memory_mb: number;
  peak_cpu_percent: number;
  total_messages_sent: number;
  total_messages_received: number;
  total_errors: number;
  total_disconnects: number;
  receipts_per_sec: number;
  duration_sec: number;
  // Global rate limiter metrics
  global_rate_limited_sends: number;
  global_send_queue_depth_max: number;
}

export interface SLOBreachInfo {
  metric: string;
  value: number;
  threshold: number;
  sustained_sec: number;
}

// -----------------------------------------------------------------------------
// Metrics Collector
// -----------------------------------------------------------------------------

export class MetricsCollector {
  private samples: MetricsSample[] = [];
  private tickDurations: number[] = [];
  private eventLoopLags: number[] = [];
  private messageLatencies: number[] = [];
  private receiptLatencies: number[] = [];
  private heapSamples: number[] = [];
  private cpuSamples: number[] = [];

  private totalMessagesSent = 0;
  private totalMessagesReceived = 0;
  private totalErrors = 0;
  private totalDisconnects = 0;
  private receiptCount = 0;

  // Global rate limiter tracking
  private globalRateLimitedSends = 0;
  private globalSendQueueDepthMax = 0;

  private startTime: number = Date.now();

  // Breach tracking
  private breachStart: Map<string, number> = new Map();

  reset(): void {
    this.samples = [];
    this.tickDurations = [];
    this.eventLoopLags = [];
    this.messageLatencies = [];
    this.receiptLatencies = [];
    this.heapSamples = [];
    this.cpuSamples = [];
    this.totalMessagesSent = 0;
    this.totalMessagesReceived = 0;
    this.totalErrors = 0;
    this.totalDisconnects = 0;
    this.receiptCount = 0;
    this.globalRateLimitedSends = 0;
    this.globalSendQueueDepthMax = 0;
    this.startTime = Date.now();
    this.breachStart.clear();
  }

  recordSample(sample: MetricsSample): void {
    this.samples.push(sample);

    if (sample.tick_duration_ms !== undefined) {
      this.tickDurations.push(sample.tick_duration_ms);
    }
    if (sample.event_loop_lag_ms !== undefined) {
      this.eventLoopLags.push(sample.event_loop_lag_ms);
    }
    if (sample.message_latency_ms !== undefined) {
      this.messageLatencies.push(sample.message_latency_ms);
    }
    if (sample.receipt_append_latency_ms !== undefined) {
      this.receiptLatencies.push(sample.receipt_append_latency_ms);
    }
    if (sample.heap_used_mb !== undefined) {
      this.heapSamples.push(sample.heap_used_mb);
    }
    if (sample.cpu_percent !== undefined) {
      this.cpuSamples.push(sample.cpu_percent);
    }
    if (sample.messages_sent !== undefined) {
      this.totalMessagesSent += sample.messages_sent;
    }
    if (sample.messages_received !== undefined) {
      this.totalMessagesReceived += sample.messages_received;
    }
    if (sample.errors !== undefined) {
      this.totalErrors += sample.errors;
    }
    if (sample.disconnects !== undefined) {
      this.totalDisconnects += sample.disconnects;
    }
  }

  recordMessageSent(): void {
    this.totalMessagesSent++;
  }

  recordMessageReceived(): void {
    this.totalMessagesReceived++;
  }

  recordError(): void {
    this.totalErrors++;
  }

  recordDisconnect(): void {
    this.totalDisconnects++;
  }

  recordMessageLatency(ms: number): void {
    this.messageLatencies.push(ms);
  }

  recordReceipt(): void {
    this.receiptCount++;
  }

  recordGlobalRateLimited(): void {
    this.globalRateLimitedSends++;
  }

  recordGlobalSendQueueDepth(depth: number): void {
    if (depth > this.globalSendQueueDepthMax) {
      this.globalSendQueueDepthMax = depth;
    }
  }

  getSamples(): MetricsSample[] {
    return [...this.samples];
  }

  computeSummary(): MetricsSummary {
    const durationSec = (Date.now() - this.startTime) / 1000;

    return {
      tick_duration_ms: computePercentiles(this.tickDurations),
      event_loop_lag_ms: computePercentiles(this.eventLoopLags),
      message_latency_ms: computePercentiles(this.messageLatencies),
      receipt_append_latency_ms: computePercentiles(this.receiptLatencies),
      peak_memory_mb: Math.max(...this.heapSamples, 0),
      peak_cpu_percent: Math.max(...this.cpuSamples, 0),
      total_messages_sent: this.totalMessagesSent,
      total_messages_received: this.totalMessagesReceived,
      total_errors: this.totalErrors,
      total_disconnects: this.totalDisconnects,
      receipts_per_sec: this.receiptCount / Math.max(durationSec, 1),
      duration_sec: durationSec,
      global_rate_limited_sends: this.globalRateLimitedSends,
      global_send_queue_depth_max: this.globalSendQueueDepthMax,
    };
  }

  /**
   * Check for sustained SLO breach.
   * Returns breach info if a metric has been over threshold for breach_duration_sec.
   */
  checkSLOBreach(
    thresholds: SLOThresholds,
    nowMs: number = Date.now()
  ): SLOBreachInfo | null {
    const checks: Array<{ metric: string; value: number; threshold: number }> = [];

    // Tick p95
    const tickP95 = computePercentiles(this.tickDurations.slice(-100)).p95;
    if (tickP95 > 0) {
      checks.push({
        metric: 'tick_p95_ms',
        value: tickP95,
        threshold: thresholds.tick_p95_ms,
      });
    }

    // Receipt append p95
    const receiptP95 = computePercentiles(this.receiptLatencies.slice(-100)).p95;
    if (receiptP95 > 0) {
      checks.push({
        metric: 'receipt_append_p95_ms',
        value: receiptP95,
        threshold: thresholds.receipt_append_p95_ms,
      });
    }

    // CPU sustained
    const recentCpu = this.cpuSamples.slice(-30);
    if (recentCpu.length >= 10) {
      const avgCpu = recentCpu.reduce((a, b) => a + b, 0) / recentCpu.length;
      checks.push({
        metric: 'cpu_percent_sustained',
        value: avgCpu,
        threshold: thresholds.cpu_percent_sustained,
      });
    }

    // Heap growth rate (check last 60 samples ~= 1 min at 1 sample/sec)
    if (this.heapSamples.length >= 60) {
      const first30 = this.heapSamples.slice(-60, -30);
      const last30 = this.heapSamples.slice(-30);
      const firstAvg = first30.reduce((a, b) => a + b, 0) / first30.length;
      const lastAvg = last30.reduce((a, b) => a + b, 0) / last30.length;
      const growthPerMin = (lastAvg - firstAvg) * 2; // 30s window, extrapolate to 1min
      if (growthPerMin > 0) {
        checks.push({
          metric: 'heap_growth_mb_per_min',
          value: growthPerMin,
          threshold: thresholds.heap_growth_mb_per_min,
        });
      }
    }

    // Disconnect rate in window
    // (simplified: check total disconnects vs total connections)
    const windowSamples = this.samples.slice(-thresholds.disconnect_window_sec);
    const windowDisconnects = windowSamples.reduce(
      (sum, s) => sum + (s.disconnects || 0),
      0
    );
    const windowConnections = windowSamples.reduce(
      (sum, s) => sum + (s.active_connections || 0),
      0
    );
    if (windowConnections > 0) {
      const disconnectRate = (windowDisconnects / windowConnections) * 100;
      checks.push({
        metric: 'disconnect_rate_percent',
        value: disconnectRate,
        threshold: thresholds.disconnect_rate_percent,
      });
    }

    // Evaluate breaches
    for (const check of checks) {
      const isOverThreshold = check.value > check.threshold;

      if (isOverThreshold) {
        const breachKey = check.metric;
        if (!this.breachStart.has(breachKey)) {
          this.breachStart.set(breachKey, nowMs);
        }

        const breachDurationMs = nowMs - this.breachStart.get(breachKey)!;
        const breachDurationSec = breachDurationMs / 1000;

        if (breachDurationSec >= thresholds.breach_duration_sec) {
          return {
            metric: check.metric,
            value: check.value,
            threshold: check.threshold,
            sustained_sec: breachDurationSec,
          };
        }
      } else {
        // Metric recovered, clear breach tracking
        this.breachStart.delete(check.metric);
      }
    }

    return null;
  }
}

// -----------------------------------------------------------------------------
// Percentile Calculation
// -----------------------------------------------------------------------------

export function computePercentiles(values: number[]): Percentiles {
  if (values.length === 0) {
    return { p50: 0, p95: 0, p99: 0, max: 0, count: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  return {
    p50: sorted[Math.floor(n * 0.5)] ?? 0,
    p95: sorted[Math.floor(n * 0.95)] ?? sorted[n - 1] ?? 0,
    p99: sorted[Math.floor(n * 0.99)] ?? sorted[n - 1] ?? 0,
    max: sorted[n - 1] ?? 0,
    count: n,
  };
}
