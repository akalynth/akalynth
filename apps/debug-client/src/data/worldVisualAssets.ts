import prisonBarsImage from '../../../../data/assets-src/sprites/world/castle/prison_bars.png?url';
import stoneColumnImage from '../../../../data/assets-src/sprites/world/castle/stone_column.png?url';
import throneImage from '../../../../data/assets-src/sprites/world/castle/throne.png?url';
import weaponRackImage from '../../../../data/assets-src/sprites/world/castle/weapon_rack.png?url';
import bannerBlueImage from '../../../../data/assets-src/sprites/world/city_objects/banner_blue.png?url';
import bannerRedImage from '../../../../data/assets-src/sprites/world/city_objects/banner_red.png?url';
import benchImage from '../../../../data/assets-src/sprites/world/city_objects/bench.png?url';
import fountainImage from '../../../../data/assets-src/sprites/world/city_objects/fountain.png?url';
import noticeBoardImage from '../../../../data/assets-src/sprites/world/city_objects/notice_board.png?url';
import rookguardAmberLanternImage from '../../../../data/assets-src/sprites/world/city_objects/rookguard_amber_lantern.png?url';
import rookguardBaitCrateImage from '../../../../data/assets-src/sprites/world/city_objects/rookguard_bait_crate.png?url';
import rookguardCanalReedsImage from '../../../../data/assets-src/sprites/world/city_objects/rookguard_canal_reeds.png?url';
import rookguardFishingPostImage from '../../../../data/assets-src/sprites/world/city_objects/rookguard_fishing_post.png?url';
import rookguardSupplySackImage from '../../../../data/assets-src/sprites/world/city_objects/rookguard_supply_sack.png?url';
import rookguardWaymarkerImage from '../../../../data/assets-src/sprites/world/city_objects/rookguard_waymarker.png?url';
import doorWoodClosedEastImage from '../../../../data/assets-src/sprites/world/doors/door_wood_closed_east.png?url';
import doorWoodClosedSouthImage from '../../../../data/assets-src/sprites/world/doors/door_wood_closed_south.png?url';
import doorWoodOpenEastImage from '../../../../data/assets-src/sprites/world/doors/door_wood_open_east.png?url';
import doorWoodOpenSouthImage from '../../../../data/assets-src/sprites/world/doors/door_wood_open_south.png?url';
import bedSingleImage from '../../../../data/assets-src/sprites/world/interior/bed_single.png?url';
import bookshelfImage from '../../../../data/assets-src/sprites/world/interior/bookshelf.png?url';
import chairWoodImage from '../../../../data/assets-src/sprites/world/interior/chair_wood.png?url';
import chestSmallImage from '../../../../data/assets-src/sprites/world/interior/chest_small.png?url';
import fireplaceImage from '../../../../data/assets-src/sprites/world/interior/fireplace.png?url';
import tableSmallImage from '../../../../data/assets-src/sprites/world/interior/table_small.png?url';
import marketClothStallImage from '../../../../data/assets-src/sprites/world/market/market_cloth_stall.png?url';
import marketFoodStallImage from '../../../../data/assets-src/sprites/world/market/market_food_stall.png?url';
import marketAwningOverlayImage from '../../../../data/assets-src/sprites/world/roofs/market_awning_overlay.png?url';
import roofCastleOverlayImage from '../../../../data/assets-src/sprites/world/roofs/roof_castle_overlay.png?url';
import roofRedLargeOverlayImage from '../../../../data/assets-src/sprites/world/roofs/roof_red_large_overlay.png?url';
import roofRedSmallOverlayImage from '../../../../data/assets-src/sprites/world/roofs/roof_red_small_overlay.png?url';
import sewerGrateImage from '../../../../data/assets-src/sprites/world/sewer/sewer_grate.png?url';
import sewerPipeImage from '../../../../data/assets-src/sprites/world/sewer/sewer_pipe.png?url';
import slimePoolImage from '../../../../data/assets-src/sprites/world/sewer/slime_pool.png?url';
import floorCobble01Image from '../../../../data/assets-src/sprites/world/terrain/floor_cobble_01.png?url';
import floorStone01Image from '../../../../data/assets-src/sprites/world/terrain/floor_stone_01.png?url';
import floorWood01Image from '../../../../data/assets-src/sprites/world/terrain/floor_wood_01.png?url';
import grass01Image from '../../../../data/assets-src/sprites/world/terrain/grass_01.png?url';
import wallStoneCornerNeImage from '../../../../data/assets-src/sprites/world/walls/wall_stone_corner_ne.png?url';
import wallStoneCornerNwImage from '../../../../data/assets-src/sprites/world/walls/wall_stone_corner_nw.png?url';
import wallStoneNorthImage from '../../../../data/assets-src/sprites/world/walls/wall_stone_north.png?url';
import wallStoneSouthImage from '../../../../data/assets-src/sprites/world/walls/wall_stone_south.png?url';

export type WorldVisualAssetKind =
  | 'door_overlay'
  | 'floor_overlay'
  | 'terrain_tile'
  | 'wall_overlay'
  | 'world_object';

export type WorldVisualAnchor = 'tile_top_left' | 'bottom_center' | 'bottom_left' | 'center';
export type WorldVisualLayer = 'floor_overlay' | 'object_overlay' | 'terrain';
export type WorldVisualZPolicy = 'fixed_above_building' | 'fixed_layer' | 'sort_by_anchor_y';
export type WorldVisualVisibility = 'visible' | 'hidden' | 'faded';

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
  | 'wall_stone_south';

export interface WorldVisualAssetDef {
  id: WorldVisualAssetId;
  assetType: WorldVisualAssetKind;
  src: string;
  frame: { width: number; height: number };
  rendering: {
    filtering: 'nearest';
    displayOnly: true;
    drawScale: number;
    anchor: { type: WorldVisualAnchor; sourcePixels: readonly [number, number] };
    layer: WorldVisualLayer;
    zPolicy: WorldVisualZPolicy;
    visibilityModes?: readonly WorldVisualVisibility[];
  };
  mechanics: null;
}

export interface WorldVisualObjectPlacement {
  id: string;
  assetId: WorldVisualAssetId;
  x: number;
  y: number;
  visibility?: WorldVisualVisibility;
}

export const WORLD_VISUAL_ASSET_IDS: WorldVisualAssetId[] = [
  'prison_bars',
  'stone_column',
  'throne',
  'weapon_rack',
  'banner_blue',
  'banner_red',
  'bench',
  'fountain',
  'notice_board',
  'rookguard_amber_lantern',
  'rookguard_bait_crate',
  'rookguard_canal_reeds',
  'rookguard_fishing_post',
  'rookguard_supply_sack',
  'rookguard_waymarker',
  'door_wood_closed_east',
  'door_wood_closed_south',
  'door_wood_open_east',
  'door_wood_open_south',
  'bed_single',
  'bookshelf',
  'chair_wood',
  'chest_small',
  'fireplace',
  'table_small',
  'market_cloth_stall',
  'market_food_stall',
  'market_awning_overlay',
  'roof_castle_overlay',
  'roof_red_large_overlay',
  'roof_red_small_overlay',
  'sewer_grate',
  'sewer_pipe',
  'slime_pool',
  'floor_cobble_01',
  'floor_stone_01',
  'floor_wood_01',
  'grass_01',
  'wall_stone_corner_ne',
  'wall_stone_corner_nw',
  'wall_stone_north',
  'wall_stone_south',
];

export const WORLD_VISUAL_ASSETS: Record<WorldVisualAssetId, WorldVisualAssetDef> = {
  prison_bars: {
    id: 'prison_bars',
    assetType: 'world_object',
    src: prisonBarsImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1.1,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  stone_column: {
    id: 'stone_column',
    assetType: 'world_object',
    src: stoneColumnImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1.15,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  throne: {
    id: 'throne',
    assetType: 'world_object',
    src: throneImage,
    frame: { width: 64, height: 96 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [32, 90] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  weapon_rack: {
    id: 'weapon_rack',
    assetType: 'world_object',
    src: weaponRackImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  banner_blue: {
    id: 'banner_blue',
    assetType: 'world_object',
    src: bannerBlueImage,
    frame: { width: 64, height: 96 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.75,
      anchor: { type: 'bottom_center', sourcePixels: [32, 90] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  banner_red: {
    id: 'banner_red',
    assetType: 'world_object',
    src: bannerRedImage,
    frame: { width: 64, height: 96 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.75,
      anchor: { type: 'bottom_center', sourcePixels: [32, 90] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  bench: {
    id: 'bench',
    assetType: 'world_object',
    src: benchImage,
    frame: { width: 96, height: 48 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.85,
      anchor: { type: 'bottom_center', sourcePixels: [48, 42] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  fountain: {
    id: 'fountain',
    assetType: 'world_object',
    src: fountainImage,
    frame: { width: 128, height: 128 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.9,
      anchor: { type: 'bottom_center', sourcePixels: [64, 122] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  notice_board: {
    id: 'notice_board',
    assetType: 'world_object',
    src: noticeBoardImage,
    frame: { width: 128, height: 96 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.8,
      anchor: { type: 'bottom_center', sourcePixels: [64, 90] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  rookguard_amber_lantern: {
    id: 'rookguard_amber_lantern',
    assetType: 'world_object',
    src: rookguardAmberLanternImage,
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
  },
  rookguard_bait_crate: {
    id: 'rookguard_bait_crate',
    assetType: 'world_object',
    src: rookguardBaitCrateImage,
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
  },
  rookguard_canal_reeds: {
    id: 'rookguard_canal_reeds',
    assetType: 'world_object',
    src: rookguardCanalReedsImage,
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
  },
  rookguard_fishing_post: {
    id: 'rookguard_fishing_post',
    assetType: 'world_object',
    src: rookguardFishingPostImage,
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
  },
  rookguard_supply_sack: {
    id: 'rookguard_supply_sack',
    assetType: 'world_object',
    src: rookguardSupplySackImage,
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
  },
  rookguard_waymarker: {
    id: 'rookguard_waymarker',
    assetType: 'world_object',
    src: rookguardWaymarkerImage,
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
  },
  door_wood_closed_east: {
    id: 'door_wood_closed_east',
    assetType: 'door_overlay',
    src: doorWoodClosedEastImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1.15,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  door_wood_closed_south: {
    id: 'door_wood_closed_south',
    assetType: 'door_overlay',
    src: doorWoodClosedSouthImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1.15,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  door_wood_open_east: {
    id: 'door_wood_open_east',
    assetType: 'door_overlay',
    src: doorWoodOpenEastImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1.15,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  door_wood_open_south: {
    id: 'door_wood_open_south',
    assetType: 'door_overlay',
    src: doorWoodOpenSouthImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1.15,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  bed_single: {
    id: 'bed_single',
    assetType: 'world_object',
    src: bedSingleImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  bookshelf: {
    id: 'bookshelf',
    assetType: 'world_object',
    src: bookshelfImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  chair_wood: {
    id: 'chair_wood',
    assetType: 'world_object',
    src: chairWoodImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.75,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  chest_small: {
    id: 'chest_small',
    assetType: 'world_object',
    src: chestSmallImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.75,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  fireplace: {
    id: 'fireplace',
    assetType: 'world_object',
    src: fireplaceImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  table_small: {
    id: 'table_small',
    assetType: 'world_object',
    src: tableSmallImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.9,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  market_cloth_stall: {
    id: 'market_cloth_stall',
    assetType: 'world_object',
    src: marketClothStallImage,
    frame: { width: 160, height: 128 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.9,
      anchor: { type: 'bottom_center', sourcePixels: [80, 122] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  market_food_stall: {
    id: 'market_food_stall',
    assetType: 'world_object',
    src: marketFoodStallImage,
    frame: { width: 160, height: 128 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.9,
      anchor: { type: 'bottom_center', sourcePixels: [80, 122] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  market_awning_overlay: {
    id: 'market_awning_overlay',
    assetType: 'floor_overlay',
    src: marketAwningOverlayImage,
    frame: { width: 384, height: 160 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'tile_top_left', sourcePixels: [0, 0] },
      layer: 'floor_overlay',
      zPolicy: 'fixed_above_building',
      visibilityModes: ["visible","faded","hidden"],
    },
    mechanics: null,
  },
  roof_castle_overlay: {
    id: 'roof_castle_overlay',
    assetType: 'floor_overlay',
    src: roofCastleOverlayImage,
    frame: { width: 512, height: 320 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'tile_top_left', sourcePixels: [0, 0] },
      layer: 'floor_overlay',
      zPolicy: 'fixed_above_building',
      visibilityModes: ["visible","faded","hidden"],
    },
    mechanics: null,
  },
  roof_red_large_overlay: {
    id: 'roof_red_large_overlay',
    assetType: 'floor_overlay',
    src: roofRedLargeOverlayImage,
    frame: { width: 384, height: 224 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'tile_top_left', sourcePixels: [0, 0] },
      layer: 'floor_overlay',
      zPolicy: 'fixed_above_building',
      visibilityModes: ["visible","faded","hidden"],
    },
    mechanics: null,
  },
  roof_red_small_overlay: {
    id: 'roof_red_small_overlay',
    assetType: 'floor_overlay',
    src: roofRedSmallOverlayImage,
    frame: { width: 256, height: 160 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'tile_top_left', sourcePixels: [0, 0] },
      layer: 'floor_overlay',
      zPolicy: 'fixed_above_building',
      visibilityModes: ["visible","faded","hidden"],
    },
    mechanics: null,
  },
  sewer_grate: {
    id: 'sewer_grate',
    assetType: 'world_object',
    src: sewerGrateImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.8,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  sewer_pipe: {
    id: 'sewer_pipe',
    assetType: 'world_object',
    src: sewerPipeImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  slime_pool: {
    id: 'slime_pool',
    assetType: 'world_object',
    src: slimePoolImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.75,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  floor_cobble_01: {
    id: 'floor_cobble_01',
    assetType: 'terrain_tile',
    src: floorCobble01Image,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.5,
      anchor: { type: 'tile_top_left', sourcePixels: [0, 0] },
      layer: 'terrain',
      zPolicy: 'fixed_layer',
    },
    mechanics: null,
  },
  floor_stone_01: {
    id: 'floor_stone_01',
    assetType: 'terrain_tile',
    src: floorStone01Image,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.5,
      anchor: { type: 'tile_top_left', sourcePixels: [0, 0] },
      layer: 'terrain',
      zPolicy: 'fixed_layer',
    },
    mechanics: null,
  },
  floor_wood_01: {
    id: 'floor_wood_01',
    assetType: 'terrain_tile',
    src: floorWood01Image,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 0.5,
      anchor: { type: 'tile_top_left', sourcePixels: [0, 0] },
      layer: 'terrain',
      zPolicy: 'fixed_layer',
    },
    mechanics: null,
  },
  grass_01: {
    id: 'grass_01',
    assetType: 'terrain_tile',
    src: grass01Image,
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
  },
  wall_stone_corner_ne: {
    id: 'wall_stone_corner_ne',
    assetType: 'wall_overlay',
    src: wallStoneCornerNeImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1.1,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  wall_stone_corner_nw: {
    id: 'wall_stone_corner_nw',
    assetType: 'wall_overlay',
    src: wallStoneCornerNwImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1.1,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  wall_stone_north: {
    id: 'wall_stone_north',
    assetType: 'wall_overlay',
    src: wallStoneNorthImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1.1,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
  wall_stone_south: {
    id: 'wall_stone_south',
    assetType: 'wall_overlay',
    src: wallStoneSouthImage,
    frame: { width: 64, height: 64 },
    rendering: {
      filtering: 'nearest',
      displayOnly: true,
      drawScale: 1.1,
      anchor: { type: 'bottom_center', sourcePixels: [32, 58] },
      layer: 'object_overlay',
      zPolicy: 'sort_by_anchor_y',
    },
    mechanics: null,
  },
};
