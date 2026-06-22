// Akalynth world visual manifest types (PR-006).
// Authoritative short registry IDs for placement JSON and registry cross-checks.
// Placement files use snake_case; debug-client runtime adapters use camelCase.

import { canonicalWorldAssetId } from './assetRegistry.js';

export const WORLD_PLACEMENT_SCHEMA_VERSION = 1 as const;

export type WorldVisualAssetKind =
  | 'door_overlay'
  | 'floor_overlay'
  | 'terrain_tile'
  | 'wall_overlay'
  | 'world_object';

export type WorldVisualAnchorType =
  | 'tile_top_left'
  | 'bottom_center'
  | 'bottom_left'
  | 'center';

export type WorldVisualLayer = 'floor_overlay' | 'object_overlay' | 'terrain';

export type WorldVisualZPolicy =
  | 'fixed_above_building'
  | 'fixed_layer'
  | 'sort_by_anchor_y';

export type WorldVisualVisibility = 'visible' | 'hidden' | 'faded';

/** Short placement / registry id (matches debug-client WorldVisualAssetId + extended). */
export type WorldVisualAssetId =
  | 'prison_bars'
  | 'stone_column'
  | 'throne'
  | 'weapon_rack'
  | 'banner_blue'
  | 'banner_red'
  | 'bench'
  | 'fountain'
  | 'notice_board'
  | 'rookguard_amber_lantern'
  | 'rookguard_bait_crate'
  | 'rookguard_canal_reeds'
  | 'rookguard_fishing_post'
  | 'rookguard_supply_sack'
  | 'rookguard_waymarker'
  | 'door_wood_closed_east'
  | 'door_wood_closed_south'
  | 'door_wood_open_east'
  | 'door_wood_open_south'
  | 'bed_single'
  | 'bookshelf'
  | 'chair_wood'
  | 'chest_small'
  | 'fireplace'
  | 'table_small'
  | 'market_cloth_stall'
  | 'market_food_stall'
  | 'market_awning_overlay'
  | 'roof_castle_overlay'
  | 'roof_red_large_overlay'
  | 'roof_red_small_overlay'
  | 'sewer_grate'
  | 'sewer_pipe'
  | 'slime_pool'
  | 'floor_cobble_01'
  | 'floor_stone_01'
  | 'floor_wood_01'
  | 'grass_01'
  | 'wall_stone_corner_ne'
  | 'wall_stone_corner_nw'
  | 'wall_stone_north'
  | 'wall_stone_south'
  | 'prop_tree'
  | 'swamp_bog_slime'
  | 'swamp_bog_water'
  | 'swamp_dead_tree'
  | 'swamp_frog'
  | 'swamp_log'
  | 'swamp_mud'
  | 'swamp_mushroom'
  | 'swamp_reeds';

/**
 * MVP Rookguard subset: 38 base world visuals (excludes 4 High City castle/prison props).
 * Ported from apps/debug-client/src/data/worldVisualAssets.ts WORLD_VISUAL_ASSET_IDS.
 */
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
] as const satisfies readonly WorldVisualAssetId[];

/**
 * Post-MVP deferred assets (13): High City castle/prison (4) + swamp extended (9).
 * Ported from extendedWorldVisualAssets.ts + excluded base castle props.
 */
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
] as const satisfies readonly WorldVisualAssetId[];

/** Full debug-client registry: 42 base + 9 extended = 51. */
export const ALL_WORLD_VISUAL_ASSET_IDS = [
  ...MVP_ROOKGUARD_WORLD_ASSET_IDS,
  ...DEFERRED_WORLD_ASSET_IDS,
] as const satisfies readonly WorldVisualAssetId[];

const MVP_ROOKGUARD_SET = new Set<string>(MVP_ROOKGUARD_WORLD_ASSET_IDS);
const DEFERRED_SET = new Set<string>(DEFERRED_WORLD_ASSET_IDS);
const ALL_SET = new Set<string>(ALL_WORLD_VISUAL_ASSET_IDS);

export interface WorldPlacementEntry {
  id: string;
  asset_id: WorldVisualAssetId;
  x: number;
  y: number;
  visibility?: WorldVisualVisibility;
}

export interface WorldPlacementManifest {
  map: string;
  schema_version: typeof WORLD_PLACEMENT_SCHEMA_VERSION;
  mechanics: null;
  placements: WorldPlacementEntry[];
}

export function isMvpRookguardAsset(id: string): id is (typeof MVP_ROOKGUARD_WORLD_ASSET_IDS)[number] {
  return MVP_ROOKGUARD_SET.has(id);
}

export function isDeferredWorldAsset(id: string): id is (typeof DEFERRED_WORLD_ASSET_IDS)[number] {
  return DEFERRED_SET.has(id);
}

export function isWorldVisualAssetId(id: string): id is WorldVisualAssetId {
  return ALL_SET.has(id);
}

/** Resolve placement short id to canonical registry asset_id (akalynth_world_<id>). */
export function canonicalPlacementAssetId(shortId: WorldVisualAssetId): string {
  return canonicalWorldAssetId(shortId);
}