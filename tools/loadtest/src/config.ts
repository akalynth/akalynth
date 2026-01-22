/**
 * Load Test Configuration Schema
 *
 * Defines the configuration types and validation for authorized load testing.
 * Safety envelope enforced: only local/staging environments allowed.
 */

import { randomUUID } from 'crypto';
import { execSync } from 'child_process';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RunConfig {
  run_id: string;
  git_sha: string;
  scenario: string;
  client_schedule: number[];
  rate_caps: RateCaps;
  random_seed: number;
  server_addr: string;
  env_flags: string[];
  started_at: string;
  harness_version: string;
  slo_thresholds: SLOThresholds;
  plateau_config: PlateauConfig;
}

export interface RateCaps {
  per_client_msg_sec: number;
  global_msg_sec: number;
  reconnect_per_10s: number;
}

export interface SLOThresholds {
  tick_p95_ms: number;
  receipt_append_p95_ms: number;
  heap_growth_mb_per_min: number;
  cpu_percent_sustained: number;
  cpu_sustained_sec: number;
  disconnect_rate_percent: number;
  disconnect_window_sec: number;
  breach_duration_sec: number;
}

export interface PlateauConfig {
  warmup_sec: number;
  hold_sec: number;
  cooldown_sec: number;
}

export interface CLIOptions {
  scenario: string;
  clients?: number;
  stepTest?: boolean;
  maxClients?: number;
  duration?: string;
  plateauDuration?: string;
  seed?: number;
  server?: string;
  verifyTem?: boolean;
  verbose?: boolean;
}

// -----------------------------------------------------------------------------
// Defaults
// -----------------------------------------------------------------------------

export const DEFAULT_SLO_THRESHOLDS: SLOThresholds = {
  tick_p95_ms: 250,
  receipt_append_p95_ms: 100,
  heap_growth_mb_per_min: 50,
  cpu_percent_sustained: 90,
  cpu_sustained_sec: 30,
  disconnect_rate_percent: 10,
  disconnect_window_sec: 60,
  breach_duration_sec: 10,
};

export const DEFAULT_RATE_CAPS: RateCaps = {
  per_client_msg_sec: 10,
  global_msg_sec: 500,
  reconnect_per_10s: 1,
};

export const DEFAULT_PLATEAU_CONFIG: PlateauConfig = {
  warmup_sec: 10,
  hold_sec: 60,
  cooldown_sec: 10,
};

export const DEFAULT_CLIENT_SCHEDULE = [10, 25, 50, 75, 100];

export const HARNESS_VERSION = '0.1.0';

// -----------------------------------------------------------------------------
// Allowed Addresses (Safety Envelope)
// -----------------------------------------------------------------------------

const ALLOWED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
]);

// Allow staging IPs via environment variable
function getAllowedHosts(): Set<string> {
  const hosts = new Set(ALLOWED_HOSTS);
  const staging = process.env.LOADTEST_STAGING_HOSTS;
  if (staging) {
    staging.split(',').forEach(h => hosts.add(h.trim()));
  }
  return hosts;
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

export function validateEnvironment(): void {
  // Never run in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SAFETY: Load test harness refuses to run in production environment'
    );
  }

  if (process.env.AKALYNTH_ENV === 'production') {
    throw new Error(
      'SAFETY: Load test harness refuses to run with AKALYNTH_ENV=production'
    );
  }
}

export function validateServerAddress(addr: string): void {
  let host: string;
  try {
    const url = new URL(addr);
    host = url.hostname;
  } catch {
    throw new Error(`Invalid server address: ${addr}`);
  }

  const allowed = getAllowedHosts();
  if (!allowed.has(host)) {
    throw new Error(
      `SAFETY: Server address '${host}' not in allowed list. ` +
      `Allowed: ${Array.from(allowed).join(', ')}. ` +
      `Set LOADTEST_STAGING_HOSTS to add staging IPs.`
    );
  }
}

// -----------------------------------------------------------------------------
// Configuration Builder
// -----------------------------------------------------------------------------

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h)?$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use e.g., 60s, 5m, 1h`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2] || 's';
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    default: return value;
  }
}

export function buildRunConfig(opts: CLIOptions): RunConfig {
  // Validate safety envelope
  validateEnvironment();
  const serverAddr = opts.server || 'ws://localhost:3000';
  validateServerAddress(serverAddr);

  // Build client schedule
  let clientSchedule: number[];
  if (opts.stepTest) {
    const maxClients = opts.maxClients || 100;
    clientSchedule = DEFAULT_CLIENT_SCHEDULE.filter(n => n <= maxClients);
  } else if (opts.clients) {
    clientSchedule = [opts.clients];
  } else {
    clientSchedule = [10]; // Default single plateau
  }

  // Parse plateau duration
  const plateauConfig = { ...DEFAULT_PLATEAU_CONFIG };
  if (opts.plateauDuration) {
    plateauConfig.hold_sec = parseDuration(opts.plateauDuration);
  } else if (opts.duration) {
    // For single-plateau runs, use duration as hold time
    plateauConfig.hold_sec = parseDuration(opts.duration);
  }

  // Collect env flags for reproducibility
  const envFlags: string[] = [];
  const relevantEnvVars = [
    'DEBUG',
    'ALLOW_INSECURE_LOCAL',
    'ALLOW_TEST_DEATH',
    'PUBLIC_RECEIPTS_DELAY_MS',
  ];
  for (const key of relevantEnvVars) {
    if (process.env[key]) {
      envFlags.push(`${key}=${process.env[key]}`);
    }
  }

  return {
    run_id: randomUUID(),
    git_sha: getGitSha(),
    scenario: opts.scenario,
    client_schedule: clientSchedule,
    rate_caps: DEFAULT_RATE_CAPS,
    random_seed: opts.seed ?? Math.floor(Math.random() * 1_000_000),
    server_addr: serverAddr,
    env_flags: envFlags,
    started_at: new Date().toISOString(),
    harness_version: HARNESS_VERSION,
    slo_thresholds: DEFAULT_SLO_THRESHOLDS,
    plateau_config: plateauConfig,
  };
}
