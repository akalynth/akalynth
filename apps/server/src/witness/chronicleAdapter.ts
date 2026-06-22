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
 *   CHRONICLE_NATIVE=0      Disable in-process N-API preference (default: prefer native)
 *   CHRONICLE_NATIVE_PATH   Optional explicit path to chronicle-native.node
 *
 * Usage:
 *   import { chronicleAppend, isChronicleEnabled } from './witness/chronicleAdapter.js';
 *
 *   if (isChronicleEnabled()) {
 *     const receipt = chronicleAppend({ tick, event_type: 'spawn', ... });
 *   }
 */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

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
  /** If true, throw on failure even when chronicle is disabled */
  strict?: boolean;
}

type NativeChronicle = {
  mode: 'native';
  append: (event: object) => ChronicleReceipt;
  verify: () => unknown;
};

export type ChronicleBackendMode = NativeChronicle['mode'] | 'disabled' | 'unavailable';

let chronicleHandle: { key: string; handle: NativeChronicle } | null = null;
const chronicleFailedKeys = new Set<string>();

function uniquePaths(paths: Array<string | undefined>): string[] {
  return [...new Set(paths.filter((p): p is string => Boolean(p)))];
}

function repoRootCandidates(): string[] {
  return uniquePaths([
    process.env.AKALYNTH_SOURCE_REPO,
    resolve(process.cwd(), '../..'),
    process.cwd(),
    // apps/server/src/witness -> repo root in source; dist/server/apps/server/src/witness -> dist/server.
    resolve(import.meta.dirname, '../../../..'),
  ]);
}

function findRepoFile(relativePath: string): string {
  const candidates = repoRootCandidates().map((root) => resolve(root, relativePath));

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Fall back to the first candidate so error messages and smoke tests stay deterministic.
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

function shouldPreferNativeChronicle(): boolean {
  return process.env.CHRONICLE_NATIVE !== '0';
}

function getChronicleHandle(logPath: string, keyPath: string): NativeChronicle | null {
  const preferNative = shouldPreferNativeChronicle();
  const cacheKey = `${logPath}\0${keyPath}\0${preferNative ? 'native' : 'disabled-native'}`;
  if (chronicleHandle?.key === cacheKey) return chronicleHandle.handle;
  if (chronicleFailedKeys.has(cacheKey)) return null;

  try {
    const { openChronicle } = require(findRepoFile('crates/chronicle/napi/loader.cjs')) as {
      openChronicle: (opts: {
        logPath: string;
        keyPath: string;
        preferNative?: boolean;
        allowCliFallback?: boolean;
      }) => NativeChronicle;
    };
    const handle = openChronicle({ logPath, keyPath, preferNative, allowCliFallback: false });
    chronicleHandle = { key: cacheKey, handle };
    return handle;
  } catch (err) {
    chronicleFailedKeys.add(cacheKey);
    console.warn(`chronicle: Rust loader unavailable (${(err as Error).message})`);
    return null;
  }
}

function resolvedOptions(opts: Pick<ChronicleAppendOptions, 'logPath' | 'keyPath'>) {
  return {
    logPath: opts.logPath ?? defaultLogPath(),
    keyPath: opts.keyPath ?? defaultKeyPath(),
  };
}

/**
 * Eagerly open the Chronicle backend once during server boot.
 *
 * This is intentionally mode-only: it proves which backend is active without
 * appending an event or mutating the log. Key creation follows the same behavior
 * as the first append, only earlier in process lifetime.
 */
export function initChronicleBackend(
  opts: Pick<ChronicleAppendOptions, 'logPath' | 'keyPath'> = {}
): ChronicleBackendMode {
  if (!isChronicleEnabled()) return 'disabled';
  const { logPath, keyPath } = resolvedOptions(opts);
  return getChronicleHandle(logPath, keyPath)?.mode ?? 'unavailable';
}

/**
 * Append an event to the chronicle log
 *
 * When ENABLE_CHRONICLE is not set to "1", returns null (no-op).
 * When enabled, appends through the long-lived Rust loader handle. The loader
 * prefers the in-process N-API addon and fails closed when it is unavailable.
 * The old CLI auditor path is intentionally not reachable from server runtime.
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

  const { logPath, keyPath } = resolvedOptions(opts);

  const handle = getChronicleHandle(logPath, keyPath);
  if (handle) return handle.append(event);

  throw new Error('chronicle native backend unavailable');
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

  const { logPath, keyPath } = resolvedOptions(opts);

  const handle = getChronicleHandle(logPath, keyPath);
  if (handle) return JSON.stringify(handle.verify());

  throw new Error('chronicle native backend unavailable');
}
