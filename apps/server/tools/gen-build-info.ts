#!/usr/bin/env tsx
/**
 * Generates dist/server/BUILD_INFO.json with git provenance at build time.
 * Runs as the server `postbuild` step. Never fails the build: when git is
 * unavailable (e.g. a tarball deploy with no .git) it falls back to the
 * AKALYNTH_BUILD_COMMIT / AKALYNTH_BUILD_REF env vars, then to 'unknown'.
 *
 * Issue #145 (deploy provenance).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

function resolved(args: string[], envFallback: string | undefined): string {
  const v = git(args);
  if (v && v !== 'unknown') return v;
  return envFallback && envFallback.trim() ? envFallback.trim() : 'unknown';
}

const commit = resolved(['rev-parse', 'HEAD'], process.env.AKALYNTH_BUILD_COMMIT);
const commitShortGit = git(['rev-parse', '--short', 'HEAD']);
const commit_short =
  commitShortGit !== 'unknown'
    ? commitShortGit
    : commit !== 'unknown'
      ? commit.slice(0, 12)
      : 'unknown';

const buildInfo = {
  commit,
  commit_short,
  ref: resolved(['rev-parse', '--abbrev-ref', 'HEAD'], process.env.AKALYNTH_BUILD_REF),
  built_at: new Date().toISOString(),
};

// tools/ -> apps/server -> apps -> repo root, then dist/server (tsconfig outDir).
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../../dist/server');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'BUILD_INFO.json');
writeFileSync(outFile, JSON.stringify(buildInfo, null, 2) + '\n');
console.log(`[gen-build-info] ${outFile} commit=${buildInfo.commit_short} ref=${buildInfo.ref}`);
