#!/usr/bin/env tsx
/**
 * Unit tests for asset registry ID helpers.
 * Run: npx tsx packages/shared/test/assetRegistry.test.ts
 */
import { buildItemIconSpriteIndex, canonicalWorldAssetId, itemIconSpriteIdForType, worldShortIdFromAssetId, WORLD_ASSET_ID_PREFIX, } from '../assetRegistry.js';
let failed = 0;
function check(name, cond) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
    if (!cond)
        failed++;
}
check('canonicalWorldAssetId prefixes short id', canonicalWorldAssetId('grass_01') === `${WORLD_ASSET_ID_PREFIX}grass_01`);
check('canonicalWorldAssetId is idempotent when prefix present', canonicalWorldAssetId(`${WORLD_ASSET_ID_PREFIX}grass_01`) === `${WORLD_ASSET_ID_PREFIX}grass_01`);
check('worldShortIdFromAssetId strips prefix', worldShortIdFromAssetId(`${WORLD_ASSET_ID_PREFIX}notice_board`) === 'notice_board');
check('worldShortIdFromAssetId leaves non-world ids unchanged', worldShortIdFromAssetId('akalynth_prop_tree_001') === 'akalynth_prop_tree_001');
check('round-trip short id', worldShortIdFromAssetId(canonicalWorldAssetId('bench')) === 'bench');
const manifest = {
    schema_version: 1,
    entries: [
        {
            asset_id: 'akalynth_item_torch_001',
            source: 'factory',
            asset_type: 'item',
            file: 'sprites/item__torch.png',
            frame: { w: 32, h: 32 },
            item_type: 'torch',
            style_contract: 'nostalgic_top_down_mmo_readability_original_akalynth_assets_v1',
            mechanics: null,
        },
        {
            asset_id: 'akalynth_world_grass_001',
            source: 'world_sidecar',
            asset_type: 'ground',
            file: 'sprites/grass.png',
            frame: { w: 32, h: 32 },
            style_contract: 'nostalgic_top_down_mmo_readability_original_akalynth_assets_v1',
            mechanics: null,
        },
    ],
};
const iconIndex = buildItemIconSpriteIndex(manifest);
check('buildItemIconSpriteIndex maps item_type to asset_id', iconIndex.get('torch') === 'akalynth_item_torch_001');
check('buildItemIconSpriteIndex skips non-item entries', !iconIndex.has('grass'));
check('itemIconSpriteIdForType resolves known item_type', itemIconSpriteIdForType('torch', iconIndex) === 'akalynth_item_torch_001');
check('itemIconSpriteIdForType returns undefined for unknown item_type', itemIconSpriteIdForType('missing', iconIndex) === undefined);
if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
}
console.log('\nOK — assetRegistry ID helpers');
