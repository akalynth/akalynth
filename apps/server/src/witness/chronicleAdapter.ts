/**
 * Chronicle Adapter — Server-side witness integration
 *
 * Provides a feature-flagged interface to the Rust chronicle kernel.
 * When disabled (default), all calls are no-ops returning null.
 *
 * Environment variables:
 *   ENABLE_CHRONICLE=1      Enable witnessing (default: disabled)
 *   CHRONICLE_LOG_PATH      Path to chronicle log file (default: chronicle.log)
 *   CHRONICLE_KEY_PATH      Path to Ed25519 signing key (default: chronicle.key)
 *   CHRONICLE_BIN           Path to chronicle_append binary
 *
 * Usage:
 *   import { chronicleAppend, isChronicleEnabled } from './witness/chronicleAdapter.js';
 *
 *   if (isChronicleEnabled()) {
 *     const receipt = chronicleAppend({ tick, event_type: 'spawn', ... });
 *   }
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import stringify from 'fast-json-stable-stringify';

/**
 * Receipt returned by chronicle_append after successful append
 */
export interface ChronicleReceipt {
  /** Hash of the previous entry (or "genesis") */
  prev_hash: string;
  /** BLAKE3 hash of the canonical JSON */
  event_hash: string;
  /** Ed25519 signature of prev_hash|event_hash (hex) */
  signature: string;
  /** Current Merkle root (latest event_hash for now) */
  root: string;
  /** Sequence number in the log (1-indexed) */
  sequence: number;
}

/**
 * Options for chronicleAppend
 */
export interface ChronicleAppendOptions {
  /** Path to chronicle log file (overrides CHRONICLE_LOG_PATH) */
  logPath?: string;
  /** Path to Ed25519 signing key (overrides CHRONICLE_KEY_PATH) */
  keyPath?: string;
  /** Path to chronicle_append binary (overrides CHRONICLE_BIN) */
  binPath?: string;
  /** If true, throw on failure even when chronicle is disabled */
  strict?: boolean;
}

/**
 * Get the default path to chronicle_append binary
 * Checks both workspace build and local crate build locations
 */
function defaultBinPath(): string {
  // apps/server/src/witness -> repo root
  const repoRoot = resolve(import.meta.dirname, '../../../..');

  const candidates = [
    // Built from repo root: cargo build --release -p chronicle --bin chronicle_append
    resolve(repoRoot, 'target/release/chronicle_append'),

    // Built inside crate: cd crates/chronicle && cargo build --release
    resolve(repoRoot, 'crates/chronicle/target/release/chronicle_append'),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Fall back to the first (so error message is predictable)
  return candidates[0];
}

/**
 * Get the default path to chronicle log file
 */
function defaultLogPath(): string {
  return process.env.CHRONICLE_LOG_PATH ?? 'chronicle.log';
}

/**
 * Get the default path to signing key
 */
function defaultKeyPath(): string {
  return process.env.CHRONICLE_KEY_PATH ?? 'chronicle.key';
}

/**
 * Check if chronicle witnessing is enabled
 */
export function isChronicleEnabled(): boolean {
  return process.env.ENABLE_CHRONICLE === '1';
}

/**
 * Append an event to the chronicle log
 *
 * When ENABLE_CHRONICLE is not set to "1", returns null (no-op).
 * When enabled, serializes the event to canonical JSON and pipes
 * it to the chronicle_append CLI.
 *
 * @param event - Any JSON-serializable event object
 * @param opts - Optional configuration overrides
 * @returns Receipt on success, null if disabled, throws on error
 */
export function chronicleAppend(
  event: object,
  opts: ChronicleAppendOptions = {}
): ChronicleReceipt | null {
  const enabled = isChronicleEnabled();

  // If disabled and not strict, silently return null
  if (!enabled && !opts.strict) {
    return null;
  }

  const bin = opts.binPath ?? process.env.CHRONICLE_BIN ?? defaultBinPath();
  const logPath = opts.logPath ?? defaultLogPath();
  const keyPath = opts.keyPath ?? defaultKeyPath();

  // Check binary exists
  if (!existsSync(bin)) {
    const msg =
      `chronicle_append not found at ${bin}\n` +
      `Build it:\n  cd crates/chronicle && cargo build --release`;

    if (opts.strict) {
      throw new Error(msg);
    }
    if (!enabled) {
      return null;
    }
    throw new Error(msg);
  }

  // Serialize to canonical JSON (sorted keys, no whitespace)
  const canonical = stringify(event);

  // Call chronicle_append via stdin
  const proc = spawnSync(bin, ['--log', logPath, '--key', keyPath], {
    input: canonical,
    encoding: 'utf8',
  });

  if (proc.status !== 0) {
    const err = proc.stderr?.trim() || '(no stderr)';
    const msg = `chronicle_append failed: ${err}`;

    if (opts.strict) {
      throw new Error(msg);
    }
    if (!enabled) {
      return null;
    }
    throw new Error(msg);
  }

  return JSON.parse(proc.stdout.trim()) as ChronicleReceipt;
}

/**
 * Verify the integrity of a chronicle log
 *
 * @param opts - Optional configuration overrides
 * @returns Verification result JSON string, or null if disabled
 */
export function chronicleVerify(
  opts: Omit<ChronicleAppendOptions, 'strict'> = {}
): string | null {
  if (!isChronicleEnabled()) {
    return null;
  }

  const bin = opts.binPath ?? process.env.CHRONICLE_BIN ?? defaultBinPath();
  const logPath = opts.logPath ?? defaultLogPath();
  const keyPath = opts.keyPath ?? defaultKeyPath();

  if (!existsSync(bin)) {
    throw new Error(`chronicle_append not found at ${bin}`);
  }

  const proc = spawnSync(bin, ['--verify', '--log', logPath, '--key', keyPath], {
    encoding: 'utf8',
  });

  if (proc.status !== 0) {
    throw new Error(`chronicle verify failed: ${proc.stderr?.trim() || '(no stderr)'}`);
  }

  return proc.stdout.trim();
}
