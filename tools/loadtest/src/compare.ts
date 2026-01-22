#!/usr/bin/env node
/**
 * Load Test Run Comparison
 *
 * Compares metrics between two load test runs.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { RunConfig } from './config.js';
import { RunResults } from './artifacts.js';
import { Percentiles } from './metrics.js';

interface RunBundle {
  config: RunConfig;
  results: RunResults;
}

function loadRun(runDir: string): RunBundle {
  const configPath = join(runDir, 'RUN.json');
  const resultsPath = join(runDir, 'RESULTS.json');

  if (!existsSync(configPath)) {
    throw new Error(`Run config not found: ${configPath}`);
  }
  if (!existsSync(resultsPath)) {
    throw new Error(`Run results not found: ${resultsPath}`);
  }

  return {
    config: JSON.parse(readFileSync(configPath, 'utf-8')),
    results: JSON.parse(readFileSync(resultsPath, 'utf-8')),
  };
}

function formatPercentiles(p: Percentiles): string {
  return `p50=${p.p50.toFixed(1)} p95=${p.p95.toFixed(1)} p99=${p.p99.toFixed(1)} max=${p.max.toFixed(1)}`;
}

function compareMetric(
  name: string,
  a: Percentiles,
  b: Percentiles
): void {
  const diff95 = b.p95 - a.p95;
  const diffPercent = a.p95 > 0 ? ((diff95 / a.p95) * 100).toFixed(1) : 'N/A';
  const indicator = diff95 > 0 ? '↑' : diff95 < 0 ? '↓' : '→';

  console.log(`\n${name}:`);
  console.log(`  Run A: ${formatPercentiles(a)}`);
  console.log(`  Run B: ${formatPercentiles(b)}`);
  console.log(`  Delta: ${indicator} ${diff95.toFixed(1)}ms (${diffPercent}%)`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.log('Usage: loadtest:compare <run-dir-a> <run-dir-b>');
    console.log('');
    console.log('Compares metrics between two load test runs.');
    process.exit(1);
  }

  const [dirA, dirB] = args;

  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Load Test Run Comparison                     ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');

  try {
    const runA = loadRun(dirA);
    const runB = loadRun(dirB);

    console.log('Run A:');
    console.log(`  ID: ${runA.config.run_id}`);
    console.log(`  Git SHA: ${runA.config.git_sha}`);
    console.log(`  Scenario: ${runA.config.scenario}`);
    console.log(`  Verdict: ${runA.results.verdict}`);

    console.log('\nRun B:');
    console.log(`  ID: ${runB.config.run_id}`);
    console.log(`  Git SHA: ${runB.config.git_sha}`);
    console.log(`  Scenario: ${runB.config.scenario}`);
    console.log(`  Verdict: ${runB.results.verdict}`);

    // Compare key metrics
    console.log('\n=== Metric Comparison ===');

    compareMetric(
      'Message Latency (ms)',
      runA.results.metrics_summary.message_latency_ms,
      runB.results.metrics_summary.message_latency_ms
    );

    compareMetric(
      'Tick Duration (ms)',
      runA.results.metrics_summary.tick_duration_ms,
      runB.results.metrics_summary.tick_duration_ms
    );

    // Compare throughput
    console.log('\n=== Throughput ===');
    console.log(`  Run A: ${runA.results.metrics_summary.total_messages_sent} sent, ${runA.results.metrics_summary.total_messages_received} recv`);
    console.log(`  Run B: ${runB.results.metrics_summary.total_messages_sent} sent, ${runB.results.metrics_summary.total_messages_received} recv`);

    // Compare errors
    console.log('\n=== Reliability ===');
    console.log(`  Run A: ${runA.results.metrics_summary.total_errors} errors, ${runA.results.metrics_summary.total_disconnects} disconnects`);
    console.log(`  Run B: ${runB.results.metrics_summary.total_errors} errors, ${runB.results.metrics_summary.total_disconnects} disconnects`);

    // Summary
    console.log('\n=== Summary ===');
    if (runA.results.verdict === runB.results.verdict) {
      console.log(`Both runs: ${runA.results.verdict.toUpperCase()}`);
    } else {
      console.log(`Run A: ${runA.results.verdict.toUpperCase()}`);
      console.log(`Run B: ${runB.results.verdict.toUpperCase()}`);
      if (runB.results.verdict === 'fail' && runA.results.verdict === 'pass') {
        console.log('⚠️  REGRESSION: Run B failed where Run A passed');
      } else if (runB.results.verdict === 'pass' && runA.results.verdict === 'fail') {
        console.log('✓  IMPROVEMENT: Run B passed where Run A failed');
      }
    }

  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
