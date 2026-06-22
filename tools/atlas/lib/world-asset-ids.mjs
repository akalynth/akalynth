/**
 * World visual short IDs mirrored from packages/shared/worldVisual.ts (PR-006).
 * Keep in sync when MVP/deferred lists change.
 */

/** MVP Rookguard subset (38) — atlas world sheet scope for PR-003. */
export const MVP_ROOKGUARD_WORLD_ASSET_IDS = [
  'banner_blue',
  'banner_red',
  'bench',
  'bed_single',
  'bookshelf',
  'chair_wood',
  'chest_small',
  'door_wood_closed_east',
  'door_wood_closed_south',
  'door_wood_open_east',
  'door_wood_open_south',
  'fireplace',
  'floor_cobble_01',
  'floor_stone_01',
  'floor_wood_01',
  'fountain',
  'grass_01',
  'market_awning_overlay',
  'market_cloth_stall',
  'market_food_stall',
  'notice_board',
  'roof_castle_overlay',
  'roof_red_large_overlay',
  'roof_red_small_overlay',
  'rookguard_amber_lantern',
  'rookguard_bait_crate',
  'rookguard_canal_reeds',
  'rookguard_fishing_post',
  'rookguard_supply_sack',
  'rookguard_waymarker',
  'sewer_grate',
  'sewer_pipe',
  'slime_pool',
  'table_small',
  'wall_stone_corner_ne',
  'wall_stone_corner_nw',
  'wall_stone_north',
  'wall_stone_south',
];

/** Post-MVP deferred (13) — packed in PR-011 extension. */
export const DEFERRED_WORLD_ASSET_IDS = [
  'prison_bars',
  'stone_column',
  'throne',
  'weapon_rack',
  'prop_tree',
  'swamp_bog_slime',
  'swamp_bog_water',
  'swamp_dead_tree',
  'swamp_frog',
  'swamp_log',
  'swamp_mud',
  'swamp_mushroom',
  'swamp_reeds',
];

const MVP_SET = new Set(MVP_ROOKGUARD_WORLD_ASSET_IDS);
const DEFERRED_SET = new Set(DEFERRED_WORLD_ASSET_IDS);

/** @param {string} assetId canonical akalynth_world_<short> or short id */
export function worldShortIdFromAssetId(assetId) {
  const prefix = 'akalynth_world_';
  return assetId.startsWith(prefix) ? assetId.slice(prefix.length) : assetId;
}

export function isMvpRookguardWorldAsset(assetId) {
  return MVP_SET.has(worldShortIdFromAssetId(assetId));
}

export function isDeferredWorldAsset(assetId) {
  return DEFERRED_SET.has(worldShortIdFromAssetId(assetId));
}

export function isAtlasWorldAsset(assetId) {
  return isMvpRookguardWorldAsset(assetId) || isDeferredWorldAsset(assetId);
}