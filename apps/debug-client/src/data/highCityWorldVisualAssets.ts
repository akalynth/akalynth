import highCityClayRoofOverlayImage from '../../../../data/assets-src/sprites/world/high_city/high_city_clay_roof_overlay.png?url';
import highCityCobbleVar02Image from '../../../../data/assets-src/sprites/world/high_city/high_city_cobble_var_02.png?url';
import highCityCobbleVar03Image from '../../../../data/assets-src/sprites/world/high_city/high_city_cobble_var_03.png?url';
import highCityCrystalFountainImage from '../../../../data/assets-src/sprites/world/high_city/high_city_crystal_fountain.png?url';
import highCityGrassEdgeImage from '../../../../data/assets-src/sprites/world/high_city/high_city_grass_edge.png?url';
import highCityHalfTimberWallNImage from '../../../../data/assets-src/sprites/world/high_city/high_city_half_timber_wall_n.png?url';
import highCityLanternPostImage from '../../../../data/assets-src/sprites/world/high_city/high_city_lantern_post.png?url';
import highCityMerchantCrateImage from '../../../../data/assets-src/sprites/world/high_city/high_city_merchant_crate.png?url';
import highCityPlotStakeImage from '../../../../data/assets-src/sprites/world/high_city/high_city_plot_stake.png?url';
import highCitySigilBannerBlueImage from '../../../../data/assets-src/sprites/world/high_city/high_city_sigil_banner_blue.png?url';
import highCitySigilBannerRedImage from '../../../../data/assets-src/sprites/world/high_city/high_city_sigil_banner_red.png?url';
import highCityTempleBrazierImage from '../../../../data/assets-src/sprites/world/high_city/high_city_temple_brazier.png?url';
import highCityWitnessLanternImage from '../../../../data/assets-src/sprites/world/high_city/high_city_witness_lantern.png?url';
import type { WorldVisualAssetDef } from './worldVisualAssets';

export type HighCityWorldVisualAssetId =
  | 'high_city_lantern_post'
  | 'high_city_sigil_banner_blue'
  | 'high_city_sigil_banner_red'
  | 'high_city_crystal_fountain'
  | 'high_city_half_timber_wall_n'
  | 'high_city_clay_roof_overlay'
  | 'high_city_plot_stake'
  | 'high_city_cobble_var_02'
  | 'high_city_cobble_var_03'
  | 'high_city_witness_lantern'
  | 'high_city_merchant_crate'
  | 'high_city_temple_brazier'
  | 'high_city_grass_edge';

function highCityDef(
  id: HighCityWorldVisualAssetId,
  def: Omit<WorldVisualAssetDef, 'id'>,
): WorldVisualAssetDef {
  return { id: id as WorldVisualAssetDef['id'], ...def };
}

export const HIGH_CITY_WORLD_VISUAL_ASSETS: Record<HighCityWorldVisualAssetId, WorldVisualAssetDef> = {
  high_city_lantern_post: highCityDef('high_city_lantern_post', {
    assetType: 'world_object',
    src: highCityLanternPostImage,
    frame: { width: 32, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [16, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  }),
  high_city_sigil_banner_blue: highCityDef('high_city_sigil_banner_blue', {
    assetType: 'world_object',
    src: highCitySigilBannerBlueImage,
    frame: { width: 32, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [16, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  }),
  high_city_sigil_banner_red: highCityDef('high_city_sigil_banner_red', {
    assetType: 'world_object',
    src: highCitySigilBannerRedImage,
    frame: { width: 32, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [16, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  }),
  high_city_crystal_fountain: highCityDef('high_city_crystal_fountain', {
    assetType: 'world_object',
    src: highCityCrystalFountainImage,
    frame: { width: 32, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [16, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  }),
  high_city_half_timber_wall_n: highCityDef('high_city_half_timber_wall_n', {
    assetType: 'wall_overlay',
    src: highCityHalfTimberWallNImage,
    frame: { width: 32, height: 32 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'tile_top_left', sourcePixels: [0, 0] },
      layer: 'object_overlay',
      zPolicy: 'fixed_layer',
    },
    mechanics: null,
  }),
  high_city_clay_roof_overlay: highCityDef('high_city_clay_roof_overlay', {
    assetType: 'world_object',
    src: highCityClayRoofOverlayImage,
    frame: { width: 32, height: 32 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'tile_top_left', sourcePixels: [0, 0] },
      layer: 'object_overlay',
      zPolicy: 'fixed_above_building',
    },
    mechanics: null,
  }),
  high_city_plot_stake: highCityDef('high_city_plot_stake', {
    assetType: 'world_object',
    src: highCityPlotStakeImage,
    frame: { width: 32, height: 32 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [16, 28] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  }),
  high_city_cobble_var_02: highCityDef('high_city_cobble_var_02', {
    assetType: 'floor_overlay',
    src: highCityCobbleVar02Image,
    frame: { width: 32, height: 32 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'tile_top_left', sourcePixels: [0, 0] },
      layer: 'floor_overlay',
      zPolicy: 'fixed_layer',
    },
    mechanics: null,
  }),
  high_city_cobble_var_03: highCityDef('high_city_cobble_var_03', {
    assetType: 'floor_overlay',
    src: highCityCobbleVar03Image,
    frame: { width: 32, height: 32 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'tile_top_left', sourcePixels: [0, 0] },
      layer: 'floor_overlay',
      zPolicy: 'fixed_layer',
    },
    mechanics: null,
  }),
  high_city_witness_lantern: highCityDef('high_city_witness_lantern', {
    assetType: 'world_object',
    src: highCityWitnessLanternImage,
    frame: { width: 32, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [16, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  }),
  high_city_merchant_crate: highCityDef('high_city_merchant_crate', {
    assetType: 'world_object',
    src: highCityMerchantCrateImage,
    frame: { width: 32, height: 32 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [16, 28] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  }),
  high_city_temple_brazier: highCityDef('high_city_temple_brazier', {
    assetType: 'world_object',
    src: highCityTempleBrazierImage,
    frame: { width: 32, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [16, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  }),
  high_city_grass_edge: highCityDef('high_city_grass_edge', {
    assetType: 'terrain_tile',
    src: highCityGrassEdgeImage,
    frame: { width: 32, height: 32 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'tile_top_left', sourcePixels: [0, 0] },
      layer: 'terrain',
      zPolicy: 'fixed_layer',
    },
    mechanics: null,
  }),
};