// packages/shared/paths.ts
// Canonical path resolution for receipt chain and signing key
// Single source of truth - all tools/server import from here

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ChainPaths {
  receiptsPath: string; // absolute
  keyPath: string | null; // absolute or null
  dbPath: string; // absolute
  markerPath: string; // absolute
}

export interface PathConfig {
  requireKey?: boolean; // if true, throw if key not configured
}

/**
 * True if NODE_ENV=production OR AKALYNTH_ENV=production
 */
export function isProductionMode(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.AKALYNTH_ENV === 'production'
  );
}

/**
 * Resolve canonical chain paths from environment.
 *
 * Env precedence for receipts:
 *  1) AKALYNTH_RECEIPT_CHAIN_PATH
 *  2) AKALYNTH_RECEIPTS_PATH (legacy)
 *  3) default: audit/receipts.jsonl (relative to repoRoot)
 *
 * Env for key:
 *  - CHRONICLE_KEY_PATH
 *
 * @param repoRoot - Absolute path to repo root (use process.cwd() from CLIs)
 * @param config - Optional configuration
 */
export function resolveChainPaths(
  repoRoot: string,
  config?: PathConfig
): ChainPaths {
  const receiptsRel =
    process.env.AKALYNTH_RECEIPT_CHAIN_PATH ??
    process.env.AKALYNTH_RECEIPTS_PATH ??
    'audit/receipts.jsonl';

  const keyRel = process.env.CHRONICLE_KEY_PATH ?? null;

  // These defaults match runtime conventions
  const dbRel = process.env.AKALYNTH_DB_PATH ?? 'data/akalynth.db';
  const markerRel =
    process.env.AKALYNTH_REPLAY_MARKER_PATH ?? 'data/replay_marker.json';

  const receiptsPath = path.resolve(repoRoot, receiptsRel);
  const dbPath = path.resolve(repoRoot, dbRel);
  const markerPath = path.resolve(repoRoot, markerRel);
  const keyPath = keyRel ? path.resolve(repoRoot, keyRel) : null;

  if (config?.requireKey && !keyPath) {
    throw new Error('CHRONICLE_KEY_PATH is required but not configured.');
  }

  return { receiptsPath, keyPath, dbPath, markerPath };
}

/**
 * Validate key exists and has secure permissions (0600 or stricter) on POSIX.
 * Throws on failure. On Windows, logs warning but does not enforce permissions.
 */
export function validateKeyFile(keyPath: string): void {
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Signing key not found: ${keyPath}`);
  }

  // Permissions only make sense on POSIX. On Windows, fs.stat().mode exists but semantics vary.
  if (process.platform !== 'win32') {
    const st = fs.statSync(keyPath);
    const mode = st.mode & 0o777;
    // Require 0600 or stricter => group/other bits must be 0
    if ((mode & 0o077) !== 0) {
      throw new Error(
        `Signing key permissions too open: ${keyPath} (mode ${mode.toString(8)}). Require 0600 or stricter.`
      );
    }
  } else {
    console.warn(
      `[paths] Skipping key permission check on Windows: ${keyPath}`
    );
  }
}

/**
 * Log resolved paths once at boot.
 * Stable + grep-friendly format.
 */
export function logResolvedPaths(p: ChainPaths): void {
  console.log(`[paths] receipts=${p.receiptsPath}`);
  console.log(`[paths] db=${p.dbPath}`);
  console.log(`[paths] marker=${p.markerPath}`);
  console.log(`[paths] key=${p.keyPath ?? '(unset)'}`);
}
