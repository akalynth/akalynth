#!/usr/bin/env tsx
/**
 * Unit tests for world visual manifest ID lists (PR-006).
 * Run: npx tsx packages/shared/test/worldVisual.test.ts
 */
import {
  ALL_WORLD_VISUAL_ASSET_IDS,
  DEFERRED_WORLD_ASSET_IDS,
  MVP_ROOKGUARD_WORLD_ASSET_IDS,
  canonicalPlacementAssetId,
  isDeferredWorldAsset,
  isMvpRookguardAsset,
  isWorldVisualAssetId,
} from '../worldVisual.js';
import { WORLD_ASSET_ID_PREFIX } from '../assetRegistry.js';

let failed = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

check('MVP count is 38', MVP_ROOKGUARD_WORLD_ASSET_IDS.length === 38);
check('deferred count is 13', DEFERRED_WORLD_ASSET_IDS.length === 13);
check('total registry is 51', ALL_WORLD_VISUAL_ASSET_IDS.length === 51);

const mvpDeferredOverlap = MVP_ROOKGUARD_WORLD_ASSET_IDS.filter((id) =>
  DEFERRED_WORLD_ASSET_IDS.includes(id as (typeof DEFERRED_WORLD_ASSET_IDS)[number]),
);
check('MVP and deferred are disjoint', mvpDeferredOverlap.length === 0);

check(
  'castle props are deferred only',
  isDeferredWorldAsset('prison_bars') &&
    isDeferredWorldAsset('throne') &&
    !isMvpRookguardAsset('prison_bars'),
);
check(
  'rookguard props are MVP',
  isMvpRookguardAsset('rookguard_waymarker') && isMvpRookguardAsset('notice_board'),
);
check(
  'swamp extended ids are deferred',
  isDeferredWorldAsset('swamp_reeds') && isDeferredWorldAsset('prop_tree'),
);

check(
  'canonical placement id prefixes world assets',
  canonicalPlacementAssetId('grass_01') === `${WORLD_ASSET_ID_PREFIX}grass_01`,
);
check('isWorldVisualAssetId accepts all registry ids', ALL_WORLD_VISUAL_ASSET_IDS.every(isWorldVisualAssetId));
check('isWorldVisualAssetId rejects unknown', !isWorldVisualAssetId('not_a_real_asset'));

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nOK — worldVisual manifest IDs');