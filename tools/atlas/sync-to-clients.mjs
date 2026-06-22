#!/usr/bin/env node
/**
 * PR-004: Copy verified loose PNGs + registry from data/assets-src to
 * data/assets-built and client mirrors (Android assets/, debug-client public/atlas/).
 *
 * Runs verify:assets first; refuses to sync when verification fails.
 * Registry entries come from compile-registry (PR-005) when --use-compiled-registry
 * is passed; otherwise compiled inline via shared registry-compile helpers.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSETS_BUILT,
  CLIENT_MIRRORS,
  REGISTRY_PATH,
  REPO_ROOT,
  collectLooseSyncPlan,
  mirrorPng,
  mirrorPlacementArtifacts,
  writeSyncArtifacts,
} from './lib/loose-sync.mjs';
import { readCompiledRegistry } from './lib/registry-compile.mjs';
import { runVerifyAssets } from './lib/run-verify-assets.mjs';

function main() {
  const skipVerify = process.argv.includes('--skip-verify');
  const useCompiledRegistry = process.argv.includes('--use-compiled-registry');

  if (!skipVerify) runVerifyAssets();

  const { pngFiles } = collectLooseSyncPlan();
  let registryEntries;

  if (useCompiledRegistry) {
    const registryAbs = join(ASSETS_BUILT, REGISTRY_PATH);
    if (!existsSync(registryAbs)) {
      console.error(
        `✗ sync:assets — missing compiled ${REGISTRY_PATH} under data/assets-built/ (run compile-registry first)`,
      );
      process.exit(1);
    }
    try {
      registryEntries = readCompiledRegistry(registryAbs);
    } catch (err) {
      console.error(`✗ sync:assets — ${err.message}`);
      process.exit(1);
    }
  } else {
    ({ registryEntries } = collectLooseSyncPlan());
  }

  const fileHashes = [];

  for (const png of pngFiles) {
    const { builtRel, sha256 } = mirrorPng(png);
    fileHashes.push({ path: builtRel, sha256 });
  }

  const { registryCount, pngCount } = writeSyncArtifacts({ registryEntries, fileHashes });

  const registryLabel = useCompiledRegistry ? 'compiled registry' : 'registry';
  console.log(
    `✓ sync:assets — ${pngCount} loose PNG(s) + ${registryLabel} (${registryCount} entries) → data/assets-built/`,
  );
  for (const { name, root } of CLIENT_MIRRORS) {
    console.log(`  mirrored → ${root.replace(`${REPO_ROOT}/`, '')} (${name})`);
  }

  const { placementFiles } = mirrorPlacementArtifacts();
  if (placementFiles > 0) {
    console.log(`  mirrored placements — ${placementFiles} file(s) → client assets/placements/`);
  }
}

main();