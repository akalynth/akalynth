#!/usr/bin/env tsx
/**
 * Unit tests for asset registry ID helpers.
 * Run: npx tsx packages/shared/test/assetRegistry.test.ts
 */
import {
  canonicalWorldAssetId,
  worldShortIdFromAssetId,
  WORLD_ASSET_ID_PREFIX,
} from '../assetRegistry.js';

let failed = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

check(
  'canonicalWorldAssetId prefixes short id',
  canonicalWorldAssetId('grass_01') === `${WORLD_ASSET_ID_PREFIX}grass_01`,
);
check(
  'canonicalWorldAssetId is idempotent when prefix present',
  canonicalWorldAssetId(`${WORLD_ASSET_ID_PREFIX}grass_01`) === `${WORLD_ASSET_ID_PREFIX}grass_01`,
);
check(
  'worldShortIdFromAssetId strips prefix',
  worldShortIdFromAssetId(`${WORLD_ASSET_ID_PREFIX}notice_board`) === 'notice_board',
);
check(
  'worldShortIdFromAssetId leaves non-world ids unchanged',
  worldShortIdFromAssetId('akalynth_prop_tree_001') === 'akalynth_prop_tree_001',
);
check(
  'round-trip short id',
  worldShortIdFromAssetId(canonicalWorldAssetId('bench')) === 'bench',
);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nOK — assetRegistry ID helpers');