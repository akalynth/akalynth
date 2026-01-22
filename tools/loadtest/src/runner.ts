/**
 * Step Test Runner
 *
 * Orchestrates load test execution with progressive plateau discovery.
 */

import { RunConfig } from './config.js';
import { LoadTestClient } from './client.js';
import { MetricsCollector, MetricsSample, SLOBreachInfo } from './metrics.js';
import { getScenario, Scenario } from './scenarios/index.js';
import {
  ArtifactWriter,
  PlateauResult,
  buildResults,
  RunResults,
} from './artifacts.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RunnerOptions {
  verbose?: boolean;
  verifyTem?: boolean;
}

// -----------------------------------------------------------------------------
// Seeded Random for Runner
// -----------------------------------------------------------------------------

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

export class LoadTestRunner {
  private config: RunConfig;
  private scenario: Scenario;
  private metrics: MetricsCollector;
  private artifacts: ArtifactWriter;
  private clients: LoadTestClient[] = [];
  private rng: SeededRandom;
  private options: RunnerOptions;
  private running = false;
  private aborted = false;

  constructor(
    config: RunConfig,
    baseDir: string,
    options: RunnerOptions = {}
  ) {
    this.config = config;
    this.scenario = getScenario(config.scenario);
    this.metrics = new MetricsCollector();
    this.artifacts = new ArtifactWriter(baseDir, config.run_id);
    this.rng = new SeededRandom(config.random_seed);
    this.options = options;
  }

  async run(): Promise<RunResults> {
    this.log(`Starting load test run: ${this.config.run_id}`);
    this.log(`Scenario: ${this.scenario.config.name}`);
    this.log(`Schedule: ${this.config.client_schedule.join(' → ')} clients`);

    // Write initial config
    this.artifacts.writeRunConfig(this.config);

    const plateauResults: PlateauResult[] = [];
    this.running = true;

    try {
      for (const targetClients of this.config.client_schedule) {
        if (this.aborted) break;

        this.log(`\n=== Plateau: ${targetClients} clients ===`);

        const plateauResult = await this.runPlateau(targetClients);
        plateauResults.push(plateauResult);

        if (plateauResult.verdict === 'fail') {
          this.log(`Breaking point reached at ${targetClients} clients`);
          this.log(`Reason: ${plateauResult.breach_reason}`);
          break;
        }

        this.log(`Plateau ${targetClients} passed`);
      }

      // Build and write results
      const summary = this.metrics.computeSummary();
      const results = buildResults(this.config, plateauResults, summary);

      this.artifacts.writeResults(results);
      const hashes = this.artifacts.finalize();

      this.log(`\n=== Run Complete ===`);
      this.log(`Verdict: ${results.verdict}`);
      this.log(`Root hash: ${hashes.run_json_hash.slice(0, 16)}...`);
      this.log(`Artifacts: ${this.artifacts.getRunDir()}`);

      return results;
    } finally {
      await this.cleanup();
      this.running = false;
    }
  }

  private async runPlateau(targetClients: number): Promise<PlateauResult> {
    const { warmup_sec, hold_sec, cooldown_sec } = this.config.plateau_config;

    // Reset metrics for this plateau
    this.metrics.reset();

    // Warmup: ramp to target client count
    this.log(`Warmup: ramping to ${targetClients} clients (${warmup_sec}s)`);
    await this.rampClients(targetClients, warmup_sec * 1000);

    // Hold: steady state measurement
    this.log(`Hold: measuring for ${hold_sec}s`);
    const breachInfo = await this.holdPlateau(hold_sec * 1000);

    // Cooldown: graceful disconnect of excess clients
    this.log(`Cooldown: ${cooldown_sec}s`);
    await this.sleep(cooldown_sec * 1000);

    // Compute plateau result
    const summary = this.metrics.computeSummary();

    if (breachInfo) {
      return {
        client_count: targetClients,
        verdict: 'fail',
        breach_reason: `${breachInfo.metric}: ${breachInfo.value.toFixed(2)} > ${breachInfo.threshold} for ${breachInfo.sustained_sec.toFixed(1)}s`,
        metrics: summary,
      };
    }

    return {
      client_count: targetClients,
      verdict: 'pass',
      metrics: summary,
    };
  }

  private async rampClients(target: number, durationMs: number): Promise<void> {
    const current = this.clients.length;
    const toAdd = Math.max(0, target - current);

    if (toAdd === 0) return;

    const intervalMs = durationMs / toAdd;

    for (let i = 0; i < toAdd && !this.aborted; i++) {
      const client = new LoadTestClient(
        {
          id: this.clients.length,
          serverAddr: this.config.server_addr,
          seed: this.config.random_seed + this.clients.length,
          maxMsgPerSec: this.config.rate_caps.per_client_msg_sec,
          verbose: this.options.verbose,
        },
        this.metrics
      );

      try {
        await client.connect();
        await client.login();
        await client.enterWorld();
        this.clients.push(client);

        // Start client activity loop
        this.startClientLoop(client);
      } catch (err) {
        this.log(`Failed to connect client ${this.clients.length}: ${err}`);
        this.metrics.recordError();
      }

      await this.sleep(intervalMs);
    }
  }

  private startClientLoop(client: LoadTestClient): void {
    const loop = async () => {
      while (this.running && !this.aborted && client.isConnected()) {
        try {
          const action = this.scenario.getNextAction(
            () => this.rng.next(),
            { inWorld: client.isInWorld() }
          );

          await client.performAction(action);

          // Think time
          const thinkMs = this.rng.nextInt(
            this.scenario.config.thinkTime.min_ms,
            this.scenario.config.thinkTime.max_ms
          );
          await this.sleep(thinkMs);
        } catch {
          // Ignore errors in client loop
        }
      }
    };

    // Run in background (don't await)
    loop().catch(() => {});
  }

  private async holdPlateau(durationMs: number): Promise<SLOBreachInfo | null> {
    const endTime = Date.now() + durationMs;
    const sampleInterval = 1000; // 1 sample per second

    while (Date.now() < endTime && !this.aborted) {
      // Collect system metrics
      const sample = this.collectSystemSample();
      this.metrics.recordSample(sample);
      this.artifacts.appendMetricsSample(sample);

      // Check for SLO breach
      const breach = this.metrics.checkSLOBreach(this.config.slo_thresholds);
      if (breach) {
        return breach;
      }

      await this.sleep(sampleInterval);
    }

    return null;
  }

  private collectSystemSample(): MetricsSample {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    // Approximate CPU percent (this is rough, but sufficient for trends)
    const cpuPercent =
      ((cpu.user + cpu.system) / 1000 / process.uptime()) * 100;

    return {
      timestamp: Date.now(),
      heap_used_mb: mem.heapUsed / 1024 / 1024,
      cpu_percent: Math.min(cpuPercent, 100),
      active_connections: this.clients.filter((c) => c.isConnected()).length,
    };
  }

  private async cleanup(): Promise<void> {
    this.log('Cleaning up clients...');

    const disconnectPromises = this.clients.map((c) =>
      c.disconnect().catch(() => {})
    );
    await Promise.all(disconnectPromises);

    this.clients = [];
  }

  abort(): void {
    this.aborted = true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString().slice(11, 23);
    console.log(`[${timestamp}] ${message}`);
  }
}
