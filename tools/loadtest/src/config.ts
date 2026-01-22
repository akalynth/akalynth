/**
 * Load Test Configuration Schema
 *
 * Defines the configuration types and validation for authorized load testing.
 * Safety envelope enforced: only local/staging environments allowed.
 *
 * Safety layers:
 * 1. Production environment refusal (NODE_ENV, AKALYNTH_ENV)
 * 2. Pre-resolve hostname allowlist
 * 3. Post-resolve IP validation (loopback + staging IPs only)
 */

import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import { lookup } from 'dns/promises';

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

// Pre-resolve hostname allowlist
const ALLOWED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',  // Allowed but normalized to 127.0.0.1 for client connections
]);

// Post-resolve IP allowlist (loopback ranges)
const LOOPBACK_IPV4_PREFIX = '127.';
const LOOPBACK_IPV6 = '::1';

// Allow staging IPs via environment variable (IPs only, not hostnames)
function getStagingIPs(): Set<string> {
  const ips = new Set<string>();
  const staging = process.env.LOADTEST_STAGING_HOSTS;
  if (staging) {
    for (const entry of staging.split(',')) {
      const trimmed = entry.trim();
      // Validate it looks like an IP (simple check)
      if (isIPLiteral(trimmed)) {
        ips.add(trimmed);
      } else {
        throw new Error(
          `SAFETY: LOADTEST_STAGING_HOSTS must contain IP addresses only, not hostnames. ` +
          `Got '${trimmed}'. Use IP literals for staging hosts.`
        );
      }
    }
  }
  return ips;
}

function isIPLiteral(s: string): boolean {
  // Simple check: IPv4 has dots, IPv6 has colons
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(s) || s.includes(':');
}

function isLoopbackIP(ip: string): boolean {
  return ip.startsWith(LOOPBACK_IPV4_PREFIX) || ip === LOOPBACK_IPV6;
}

function isAllowedIP(ip: string, stagingIPs: Set<string>): boolean {
  return isLoopbackIP(ip) || stagingIPs.has(ip);
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

/**
 * Validate server address with three-layer safety:
 * 1. Parse URL and extract hostname
 * 2. Check hostname against pre-resolve allowlist
 * 3. Resolve hostname and validate IPs against loopback + staging allowlist
 *
 * Also normalizes 0.0.0.0 to 127.0.0.1 for unambiguous behavior.
 */
export async function validateServerAddress(addr: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(addr);
  } catch {
    throw new Error(`Invalid server address: ${addr}`);
  }

  const host = url.hostname;

  // Layer 1: Pre-resolve hostname allowlist
  if (!ALLOWED_HOSTNAMES.has(host)) {
    // Not in default allowlist, must be a staging IP
    const stagingIPs = getStagingIPs();
    if (!stagingIPs.has(host)) {
      throw new Error(
        `SAFETY: Server address '${host}' not in allowed list. ` +
        `Allowed hostnames: ${Array.from(ALLOWED_HOSTNAMES).join(', ')}. ` +
        `Set LOADTEST_STAGING_HOSTS to add staging IPs (IP literals only).`
      );
    }
  }

  // Layer 2: Normalize 0.0.0.0 → 127.0.0.1 for unambiguous client behavior
  // 0.0.0.0 means "all interfaces" for binding but is ambiguous as a destination
  if (host === '0.0.0.0') {
    url.hostname = '127.0.0.1';
    return url.toString();
  }

  // Layer 3: Post-resolve IP validation
  // Skip for IP literals (already validated above)
  if (!isIPLiteral(host)) {
    const stagingIPs = getStagingIPs();
    try {
      // Resolve hostname to IP addresses
      const result = await lookup(host, { all: true });
      const resolvedIPs = result.map(r => r.address);

      // Validate all resolved IPs
      for (const ip of resolvedIPs) {
        if (!isAllowedIP(ip, stagingIPs)) {
          throw new Error(
            `SAFETY: Hostname '${host}' resolves to '${ip}' which is not in allowed IP list. ` +
            `Only loopback (127.x.x.x, ::1) and staging IPs are permitted. ` +
            `Resolved IPs: ${resolvedIPs.join(', ')}`
          );
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('SAFETY:')) {
        throw err;
      }
      throw new Error(
        `SAFETY: Failed to resolve hostname '${host}': ${err instanceof Error ? err.message : err}`
      );
    }
  }

  return addr;
}

// Synchronous pre-check for validation command (doesn't do DNS lookup)
export function validateServerAddressSync(addr: string): void {
  let url: URL;
  try {
    url = new URL(addr);
  } catch {
    throw new Error(`Invalid server address: ${addr}`);
  }

  const host = url.hostname;

  if (!ALLOWED_HOSTNAMES.has(host)) {
    const stagingIPs = getStagingIPs();
    if (!stagingIPs.has(host)) {
      throw new Error(
        `SAFETY: Server address '${host}' not in allowed list. ` +
        `Allowed hostnames: ${Array.from(ALLOWED_HOSTNAMES).join(', ')}. ` +
        `Set LOADTEST_STAGING_HOSTS to add staging IPs (IP literals only).`
      );
    }
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

// Synchronous config builder for validation (pre-flight check)
export function buildRunConfigSync(opts: CLIOptions): RunConfig {
  validateEnvironment();
  const serverAddr = opts.server || 'ws://127.0.0.1:3000';
  validateServerAddressSync(serverAddr);
  return buildConfigInternal(opts, serverAddr);
}

// Async config builder with full validation including DNS resolution
export async function buildRunConfig(opts: CLIOptions): Promise<RunConfig> {
  validateEnvironment();
  const serverAddr = opts.server || 'ws://127.0.0.1:3000';
  const normalizedAddr = await validateServerAddress(serverAddr);
  return buildConfigInternal(opts, normalizedAddr);
}

function buildConfigInternal(opts: CLIOptions, serverAddr: string): RunConfig {
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

  // Collect env flags for reproducibility (redact secrets)
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
    rate_caps: { ...DEFAULT_RATE_CAPS },
    random_seed: opts.seed ?? Math.floor(Math.random() * 1_000_000),
    server_addr: serverAddr,
    env_flags: envFlags,
    started_at: new Date().toISOString(),
    harness_version: HARNESS_VERSION,
    slo_thresholds: { ...DEFAULT_SLO_THRESHOLDS },
    plateau_config: plateauConfig,
  };
}
