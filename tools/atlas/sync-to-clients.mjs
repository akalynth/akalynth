#!/usr/bin/env node
/**
 * PR-004: Copy verified loose PNGs + registry stub from data/assets-src to
 * data/assets-built and client mirrors (Android assets/, debug-client public/atlas/).
 *
 * Runs verify:assets first; refuses to sync when verification fails.
 * Registry stub follows tools/atlas/NORMALIZATION.md (compile-registry lands in PR-005).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  CLIENT_MIRRORS,
  REPO_ROOT,
  collectLooseSyncPlan,
  mirrorPng,
  writeSyncArtifacts,
} from './lib/loose-sync.mjs';

function resolveVerifyCommand() {
  let dir = REPO_ROOT;
  for (let depth = 0; depth < 6; depth += 1) {
    const tsx = join(dir, 'node_modules/.bin/tsx');
    if (existsSync(tsx)) {
      return { cmd: tsx, args: ['tools/asset-gen/verify-assets.ts'] };
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { cmd: 'npx', args: ['tsx', 'tools/asset-gen/verify-assets.ts'] };
}

function runVerifyAssets() {
  const { cmd, args } = resolveVerifyCommand();
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const skipVerify = process.argv.includes('--skip-verify');
  if (!skipVerify) runVerifyAssets();

  const { pngFiles, registryEntries } = collectLooseSyncPlan();
  const fileHashes = [];

  for (const png of pngFiles) {
    const { builtRel, sha256 } = mirrorPng(png);
    fileHashes.push({ path: builtRel, sha256 });
  }

  const { registryCount, pngCount } = writeSyncArtifacts({ registryEntries, fileHashes });

  console.log(
    `✓ sync:assets — ${pngCount} loose PNG(s) + registry stub (${registryCount} entries) → data/assets-built/`,
  );
  for (const { name, root } of CLIENT_MIRRORS) {
    console.log(`  mirrored → ${root.replace(`${REPO_ROOT}/`, '')} (${name})`);
  }
}

main();