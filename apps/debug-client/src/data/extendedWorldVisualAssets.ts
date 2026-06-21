import propTreeImage from '../../../../data/assets-src/sprites/props__tree.png?url';
import swampBogSlimeImage from '../../../../data/assets-src/sprites/swamp__bog_slime.png?url';
import swampBogWaterImage from '../../../../data/assets-src/sprites/swamp__bog_water.png?url';
import swampDeadTreeImage from '../../../../data/assets-src/sprites/swamp__dead_tree.png?url';
import swampFrogImage from '../../../../data/assets-src/sprites/swamp__frog.png?url';
import swampLogImage from '../../../../data/assets-src/sprites/swamp__log.png?url';
import swampMudImage from '../../../../data/assets-src/sprites/swamp__mud.png?url';
import swampMushroomImage from '../../../../data/assets-src/sprites/swamp__mushroom.png?url';
import swampReedsImage from '../../../../data/assets-src/sprites/swamp__reeds.png?url';
import type { WorldVisualAssetDef } from './worldVisualAssets';

export type ExtendedWorldVisualAssetId =
  | 'prop_tree'
  | 'swamp_bog_slime'
  | 'swamp_bog_water'
  | 'swamp_dead_tree'
  | 'swamp_frog'
  | 'swamp_log'
  | 'swamp_mud'
  | 'swamp_mushroom'
  | 'swamp_reeds';

function extendedDef(
  id: ExtendedWorldVisualAssetId,
  def: Omit<WorldVisualAssetDef, 'id'>,
): WorldVisualAssetDef {
  return { id: id as WorldVisualAssetDef['id'], ...def };
}

export const EXTENDED_WORLD_VISUAL_ASSETS: Record<ExtendedWorldVisualAssetId, WorldVisualAssetDef> = {
  prop_tree: extendedDef('prop_tree', {
    assetType: 'world_object',
    src: propTreeImage,
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
  swamp_bog_slime: extendedDef('swamp_bog_slime', {
    assetType: 'world_object',
    src: swampBogSlimeImage,
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
  swamp_bog_water: extendedDef('swamp_bog_water', {
    assetType: 'terrain_tile',
    src: swampBogWaterImage,
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
  swamp_dead_tree: extendedDef('swamp_dead_tree', {
    assetType: 'world_object',
    src: swampDeadTreeImage,
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
  swamp_frog: extendedDef('swamp_frog', {
    assetType: 'world_object',
    src: swampFrogImage,
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
  swamp_log: extendedDef('swamp_log', {
    assetType: 'world_object',
    src: swampLogImage,
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
  swamp_mud: extendedDef('swamp_mud', {
    assetType: 'terrain_tile',
    src: swampMudImage,
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
  swamp_mushroom: extendedDef('swamp_mushroom', {
    assetType: 'world_object',
    src: swampMushroomImage,
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
  swamp_reeds: extendedDef('swamp_reeds', {
    assetType: 'world_object',
    src: swampReedsImage,
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
};