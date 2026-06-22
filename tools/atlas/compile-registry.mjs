#!/usr/bin/env node
/**
 * PR-005: Compile data/assets-built/registry.json from verified asset sources.
 *
 * Runs verify:assets first, merges factory/ui/world sources per NORMALIZATION.md,
 * fails on asset_id collisions, writes registry.json under data/assets-built/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSETS_BUILT, REGISTRY_PATH } from './lib/loose-sync.mjs';
import {
  buildRegistryManifest,
  compileRegistryEntries,
} from './lib/registry-compile.mjs';
import { runVerifyAssets } from './lib/run-verify-assets.mjs';

function main() {
  const skipVerify = process.argv.includes('--skip-verify');
  if (!skipVerify) runVerifyAssets();

  let entries;
  try {
    entries = compileRegistryEntries();
  } catch (err) {
    console.error(`✗ compile-registry — ${err.message}`);
    process.exit(1);
  }

  const registry = buildRegistryManifest(entries);
  const registryJson = `${JSON.stringify(registry, null, 2)}\n`;
  const outAbs = join(ASSETS_BUILT, REGISTRY_PATH);

  mkdirSync(ASSETS_BUILT, { recursive: true });
  writeFileSync(outAbs, registryJson, 'utf8');

  console.log(
    `✓ compile-registry — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} → data/assets-built/${REGISTRY_PATH}`,
  );
}

main();