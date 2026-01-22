/**
 * Run Artifact Generation
 *
 * Produces reproducible, hashable run bundles for audit trails.
 */

import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { RunConfig } from './config.js';
import { MetricsSummary, MetricsSample, Percentiles } from './metrics.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PlateauResult {
  client_count: number;
  verdict: 'pass' | 'fail';
  breach_reason?: string;
  metrics: MetricsSummary;
}

export interface RunResults {
  run_id: string;
  verdict: 'pass' | 'fail';
  breach_reason?: string;
  breaking_point_clients?: number;

  metrics_summary: {
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
  };

  per_plateau: PlateauResult[];
  ended_at: string;
  duration_sec: number;
}

export interface AuditHashes {
  run_json_hash: string;
  results_json_hash: string;
  metrics_jsonl_hash: string;
  server_receipts_hash?: string;
}

// -----------------------------------------------------------------------------
// Hashing (SHA-256 for portability, BLAKE3 if available)
// -----------------------------------------------------------------------------

function computeHash(data: string): string {
  // Use SHA-256 for portability (BLAKE3 requires native binding)
  return createHash('sha256').update(data).digest('hex');
}

// -----------------------------------------------------------------------------
// Artifact Writer
// -----------------------------------------------------------------------------

export class ArtifactWriter {
  private runsDir: string;
  private runDir: string;
  private metricsLines: string[] = [];

  constructor(baseDir: string, runId: string) {
    this.runsDir = join(baseDir, 'runs');
    this.runDir = join(this.runsDir, runId);

    // Ensure directories exist
    if (!existsSync(this.runsDir)) {
      mkdirSync(this.runsDir, { recursive: true });
    }
    mkdirSync(this.runDir, { recursive: true });
  }

  writeRunConfig(config: RunConfig): void {
    const path = join(this.runDir, 'RUN.json');
    writeFileSync(path, JSON.stringify(config, null, 2));
  }

  appendMetricsSample(sample: MetricsSample): void {
    this.metricsLines.push(JSON.stringify(sample));
  }

  writeResults(results: RunResults): void {
    const path = join(this.runDir, 'RESULTS.json');
    writeFileSync(path, JSON.stringify(results, null, 2));
  }

  finalize(): AuditHashes {
    // Write accumulated metrics
    const metricsPath = join(this.runDir, 'METRICS.jsonl');
    writeFileSync(metricsPath, this.metricsLines.join('\n'));

    // Compute hashes
    const runJson = readFileSync(join(this.runDir, 'RUN.json'), 'utf-8');
    const resultsJson = readFileSync(join(this.runDir, 'RESULTS.json'), 'utf-8');
    const metricsJsonl = readFileSync(metricsPath, 'utf-8');

    const hashes: AuditHashes = {
      run_json_hash: computeHash(runJson),
      results_json_hash: computeHash(resultsJson),
      metrics_jsonl_hash: computeHash(metricsJsonl),
    };

    // Write audit hashes
    const auditPath = join(this.runDir, 'AUDIT_HASHES.json');
    writeFileSync(auditPath, JSON.stringify(hashes, null, 2));

    // Compute and write root hash
    const auditJson = JSON.stringify(hashes);
    const rootHash = computeHash(auditJson);
    const rootPath = join(this.runDir, 'ROOT.txt');
    writeFileSync(rootPath, rootHash + '\n');

    return hashes;
  }

  getRunDir(): string {
    return this.runDir;
  }
}

// -----------------------------------------------------------------------------
// Results Builder
// -----------------------------------------------------------------------------

export function buildResults(
  config: RunConfig,
  plateauResults: PlateauResult[],
  aggregateSummary: MetricsSummary
): RunResults {
  const failedPlateau = plateauResults.find((p) => p.verdict === 'fail');

  return {
    run_id: config.run_id,
    verdict: failedPlateau ? 'fail' : 'pass',
    breach_reason: failedPlateau?.breach_reason,
    breaking_point_clients: failedPlateau?.client_count,
    metrics_summary: {
      tick_duration_ms: aggregateSummary.tick_duration_ms,
      event_loop_lag_ms: aggregateSummary.event_loop_lag_ms,
      message_latency_ms: aggregateSummary.message_latency_ms,
      receipt_append_latency_ms: aggregateSummary.receipt_append_latency_ms,
      peak_memory_mb: aggregateSummary.peak_memory_mb,
      peak_cpu_percent: aggregateSummary.peak_cpu_percent,
      total_messages_sent: aggregateSummary.total_messages_sent,
      total_messages_received: aggregateSummary.total_messages_received,
      total_errors: aggregateSummary.total_errors,
      total_disconnects: aggregateSummary.total_disconnects,
      receipts_per_sec: aggregateSummary.receipts_per_sec,
    },
    per_plateau: plateauResults,
    ended_at: new Date().toISOString(),
    duration_sec: aggregateSummary.duration_sec,
  };
}
