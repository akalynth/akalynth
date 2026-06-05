import { useMemo } from 'react';
import { TileCode, type MapData, type PlayerPublic } from '@shared/types';
import { getMap } from '../data/maps';
import { MapCanvas, type CharacterFrameOverride, type MapDebugOverlay } from './MapCanvas';
import {
  VISUAL_PRESET_SPRITE_IDS,
  type CharacterSpriteId,
  type Direction,
  type SmokeTestCharacterId,
} from '../data/characterSprites';
import {
  BUILDING_OVERLAY_REVIEW_FIXTURES,
  overlayVisibilityForReview,
  type OverlayVisibility,
} from '../data/floorOverlayReview';
import type { WorldVisualAssetId, WorldVisualObjectPlacement, WorldVisualVisibility } from '../data/worldVisualAssets';
import {
  runtimeProjectionDebugOverlaysForScenario,
  runtimeProjectionRefinedScenarioFor,
  type RuntimeProjectionSmokeScenario,
} from '../data/runtimeProjectionReview';

type VisualSmokeScenario =
  | 'idle_south'
  | 'walk_south'
  | 'walk_north'
  | 'walk_east'
  | 'walk_west'
  | 'scale_on_map'
  | 'placement_cobble'
  | 'placement_wall'
  | 'placement_door'
  | 'placement_crowd'
  | 'placement_walk_cycle'
  | 'placement_scale_compare'
  | 'npc_presets_lineup'
  | 'npc_presets_market'
  | 'npc_presets_castle'
  | 'npc_presets_sewer'
  | 'npc_presets_creatures'
  | 'npc_presets_crowd_scale'
  | 'world_scale_doors'
  | 'world_scale_walls'
  | 'world_scale_market'
  | 'world_scale_interior'
  | 'world_scale_castle'
  | 'world_scale_sewer'
  | 'world_scale_all_compare'
  | 'building_small_house'
  | 'building_small_house_door_threshold'
  | 'building_market_shop'
  | 'building_castle_meeting_hall'
  | 'building_z_order_wall_door'
  | 'building_character_walk_space'
  | 'roof_small_house_outside'
  | 'roof_small_house_hidden'
  | 'roof_small_house_faded'
  | 'roof_market_shop_outside'
  | 'roof_castle_meeting_hall_outside'
  | 'roof_z_order_entry_threshold'
  | 'overlay_visibility_small_house_outside'
  | 'overlay_visibility_small_house_doorway'
  | 'overlay_visibility_small_house_inside'
  | 'overlay_visibility_market_shop_outside'
  | 'overlay_visibility_market_shop_inside'
  | 'overlay_visibility_castle_hall_inside'
  | 'high_city_block_overview'
  | 'high_city_block_gate_public_space'
  | 'high_city_block_market_shop'
  | 'high_city_block_house_threshold'
  | 'high_city_block_castle_room'
  | 'high_city_block_sewer_hint'
  | 'high_city_refined_overview'
  | 'high_city_refined_gate_to_plaza'
  | 'high_city_refined_market_lane'
  | 'high_city_refined_house_block'
  | 'high_city_refined_castle_meeting'
  | 'high_city_refined_sewer_hint'
  | 'runtime_projection_overview'
  | 'runtime_projection_collision_walkability'
  | 'runtime_projection_door_house'
  | 'runtime_projection_transitions'
  | 'runtime_projection_overlay_visibility'
  | 'runtime_projection_combined_review';

const SCENARIO_LABEL: Record<VisualSmokeScenario, string> = {
  idle_south: '01 idle south',
  walk_south: '02 walk south',
  walk_north: '03 walk north',
  walk_east: '04 walk east',
  walk_west: '05 walk west',
  scale_on_map: '06 scale on map',
  placement_cobble: '01 placement cobble',
  placement_wall: '02 placement wall',
  placement_door: '03 placement door',
  placement_crowd: '04 placement crowd',
  placement_walk_cycle: '05 placement walk cycle',
  placement_scale_compare: '06 placement scale compare',
  npc_presets_lineup: '01 npc presets lineup',
  npc_presets_market: '02 npc presets market',
  npc_presets_castle: '03 npc presets castle',
  npc_presets_sewer: '04 npc presets sewer',
  npc_presets_creatures: '05 npc presets creatures',
  npc_presets_crowd_scale: '06 npc presets crowd scale',
  world_scale_doors: '01 world scale doors',
  world_scale_walls: '02 world scale walls',
  world_scale_market: '03 world scale market',
  world_scale_interior: '04 world scale interior',
  world_scale_castle: '05 world scale castle',
  world_scale_sewer: '06 world scale sewer',
  world_scale_all_compare: '07 world scale all compare',
  building_small_house: '01 building small house',
  building_small_house_door_threshold: '02 building door threshold',
  building_market_shop: '03 building market shop',
  building_castle_meeting_hall: '04 building castle meeting hall',
  building_z_order_wall_door: '05 building z order wall door',
  building_character_walk_space: '06 building character walk space',
  roof_small_house_outside: '01 roof small house outside',
  roof_small_house_hidden: '02 roof small house hidden',
  roof_small_house_faded: '03 roof small house faded',
  roof_market_shop_outside: '04 roof market shop outside',
  roof_castle_meeting_hall_outside: '05 roof castle meeting hall outside',
  roof_z_order_entry_threshold: '06 roof z order entry threshold',
  overlay_visibility_small_house_outside: '01 overlay visible outside',
  overlay_visibility_small_house_doorway: '02 overlay faded doorway',
  overlay_visibility_small_house_inside: '03 overlay hidden inside',
  overlay_visibility_market_shop_outside: '04 overlay market visible outside',
  overlay_visibility_market_shop_inside: '05 overlay market hidden inside',
  overlay_visibility_castle_hall_inside: '06 overlay castle hidden inside',
  high_city_block_overview: '01 high city block overview',
  high_city_block_gate_public_space: '02 high city gate public space',
  high_city_block_market_shop: '03 high city market shop',
  high_city_block_house_threshold: '04 high city house threshold',
  high_city_block_castle_room: '05 high city castle room',
  high_city_block_sewer_hint: '06 high city sewer hint',
  high_city_refined_overview: '01 refined high city overview',
  high_city_refined_gate_to_plaza: '02 refined gate to plaza',
  high_city_refined_market_lane: '03 refined market lane',
  high_city_refined_house_block: '04 refined house block',
  high_city_refined_castle_meeting: '05 refined castle meeting',
  high_city_refined_sewer_hint: '06 refined sewer hint',
  runtime_projection_overview: '01 runtime projection overview',
  runtime_projection_collision_walkability: '02 runtime projection collision walkability',
  runtime_projection_door_house: '03 runtime projection door house',
  runtime_projection_transitions: '04 runtime projection transitions',
  runtime_projection_overlay_visibility: '05 runtime projection overlay visibility',
  runtime_projection_combined_review: '06 runtime projection combined review',
};

const CHARACTER_BY_PLAYER: Record<string, SmokeTestCharacterId> = {
  'placement-base-human': 'base_human_male_01',
  'placement-guard': 'guard_city_01',
  'placement-mage': 'mage_apprentice_01',
  'placement-skeleton': 'skeleton_warrior_01',
  'smoke-base-human': 'base_human_male_01',
  'smoke-guard': 'guard_city_01',
  'smoke-mage': 'mage_apprentice_01',
  'smoke-skeleton': 'skeleton_warrior_01',
};

const VISUAL_PRESET_ID_SET = new Set<CharacterSpriteId>(VISUAL_PRESET_SPRITE_IDS);

function asScenario(raw: string | null): VisualSmokeScenario {
  // SCENARIO_LABEL is keyed by every VisualSmokeScenario, so membership in it is
  // the single source of truth for "is this a known scenario?".
  return raw && raw in SCENARIO_LABEL ? (raw as VisualSmokeScenario) : 'idle_south';
}

function player(id: string, name: string, x: number, y: number): PlayerPublic {
  return { id, name, x, y, status: 'alive' };
}

function presetPlayer(spriteId: CharacterSpriteId, name: string, x: number, y: number, instance = 0): PlayerPublic {
  return player('preset:' + spriteId + ':' + instance, name, x, y);
}

function spriteForPlayerId(playerId: string): CharacterSpriteId | null {
  if (playerId.startsWith('preset:')) {
    const candidate = playerId.split(':')[1] as CharacterSpriteId | undefined;
    return candidate && VISUAL_PRESET_ID_SET.has(candidate) ? candidate : null;
  }
  return CHARACTER_BY_PLAYER[playerId] ?? null;
}

function override(direction: Direction, frameColumn: number): CharacterFrameOverride {
  return { direction, frameColumn };
}

function writeTile(map: MapData, x: number, y: number, tile: TileCode) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.tiles[y * map.width + x] = tile;
}

type ReviewMapKind =
  | 'plain'
  | 'cobble'
  | 'wall'
  | 'door'
  | 'scale'
  | 'market'
  | 'castle'
  | 'sewer'
  | 'creature'
  | 'world_doors'
  | 'world_walls'
  | 'world_market'
  | 'world_interior'
  | 'world_castle'
  | 'world_sewer'
  | 'world_all_compare'
  | 'building_small_house'
  | 'building_small_house_door_threshold'
  | 'building_market_shop'
  | 'building_castle_meeting_hall'
  | 'building_z_order_wall_door'
  | 'building_character_walk_space'
  | 'high_city_block'
  | 'high_city_refined_block';

function reviewMap(kind: ReviewMapKind): MapData {
  const source = getMap('Rookguard');
  const map: MapData = {
    ...source,
    name: 'VisualSmoke-' + kind,
    spawn: { x: 3, y: 3 },
    landmarks: {},
    tiles: [...source.tiles],
  };

  for (let y = 4; y <= 16; y += 1) {
    for (let x = 4; x <= 18; x += 1) {
      writeTile(map, x, y, TileCode.Grass);
    }
  }

  if (
    kind === 'cobble' || kind === 'door' || kind === 'scale' || kind === 'market' || kind === 'castle' || kind === 'sewer' ||
    kind === 'world_doors' || kind === 'world_walls' || kind === 'world_market' || kind === 'world_interior' ||
    kind === 'world_castle' || kind === 'world_sewer' || kind === 'world_all_compare' ||
    kind === 'building_small_house' || kind === 'building_small_house_door_threshold' || kind === 'building_market_shop' ||
    kind === 'building_castle_meeting_hall' || kind === 'building_z_order_wall_door' || kind === 'building_character_walk_space' ||
    kind === 'high_city_block' || kind === 'high_city_refined_block'
  ) {
    for (let y = 6; y <= 15; y += 1) {
      for (let x = 6; x <= 17; x += 1) writeTile(map, x, y, TileCode.Stone);
    }
  }

  if (kind === 'wall' || kind === 'scale' || kind === 'castle') {
    for (let x = 5; x <= 17; x += 1) writeTile(map, x, 5, TileCode.Wall);
    for (let y = 5; y <= 15; y += 1) writeTile(map, 5, y, TileCode.Wall);
  }

  if (kind === 'door' || kind === 'scale' || kind === 'market' || kind === 'castle') {
    for (let x = 5; x <= 17; x += 1) writeTile(map, x, 5, TileCode.Wall);
    writeTile(map, 10, 5, TileCode.Door);
  }

  if (kind === 'market') {
    for (let x = 7; x <= 16; x += 3) {
      writeTile(map, x, 9, TileCode.Wall);
      writeTile(map, x, 12, TileCode.Wall);
    }
  }

  if (kind === 'sewer' || kind === 'world_sewer') {
    for (let x = 6; x <= 17; x += 1) {
      writeTile(map, x, 11, TileCode.Water);
      writeTile(map, x, 12, TileCode.Water);
    }
    for (let y = 6; y <= 15; y += 1) writeTile(map, 5, y, TileCode.Wall);
  }

  if (kind === 'high_city_block') {
    for (let y = 3; y <= 25; y += 1) {
      for (let x = 2; x <= 30; x += 1) writeTile(map, x, y, TileCode.Grass);
    }
    for (let y = 5; y <= 24; y += 1) {
      for (let x = 3; x <= 29; x += 1) writeTile(map, x, y, TileCode.Stone);
    }
    for (let y = 21; y <= 24; y += 1) {
      for (let x = 22; x <= 29; x += 1) writeTile(map, x, y, TileCode.Water);
    }
  }

  if (kind === 'high_city_refined_block') {
    for (let y = 2; y <= 29; y += 1) {
      for (let x = 1; x <= 30; x += 1) writeTile(map, x, y, TileCode.Grass);
    }
    for (let y = 4; y <= 26; y += 1) {
      for (let x = 3; x <= 29; x += 1) writeTile(map, x, y, TileCode.Stone);
    }
    for (let y = 5; y <= 18; y += 1) {
      writeTile(map, 14, y, TileCode.Stone);
      writeTile(map, 15, y, TileCode.Stone);
      writeTile(map, 16, y, TileCode.Stone);
    }
    for (let y = 22; y <= 26; y += 1) {
      for (let x = 23; x <= 30; x += 1) writeTile(map, x, y, TileCode.Water);
    }
  }

  if (kind === 'creature') {
    for (let y = 9; y <= 12; y += 1) {
      for (let x = 7; x <= 16; x += 1) writeTile(map, x, y, TileCode.Stone);
    }
    for (let x = 7; x <= 16; x += 1) writeTile(map, x, 13, TileCode.Water);
  }

  return map;
}

function basePlacementPlayers(): { me: PlayerPublic; others: PlayerPublic[] } {
  const me = player('placement-base-human', 'base', 8, 9);
  return {
    me,
    others: [
      player('placement-guard', 'guard', 10, 9),
      player('placement-mage', 'mage', 8, 11),
      player('placement-skeleton', 'skeleton', 10, 11),
    ],
  };
}

function placementPlayersForScenario(scenario: VisualSmokeScenario): { me: PlayerPublic; others: PlayerPublic[] } {
  if (scenario === 'placement_wall') {
    const me = player('placement-base-human', 'base', 6, 6);
    return {
      me,
      others: [
        player('placement-guard', 'guard', 8, 6),
        player('placement-mage', 'mage', 6, 8),
        player('placement-skeleton', 'skeleton', 8, 8),
      ],
    };
  }

  if (scenario === 'placement_door') {
    const me = player('placement-base-human', 'base', 9, 6);
    return {
      me,
      others: [
        player('placement-guard', 'guard', 8, 6),
        player('placement-mage', 'mage', 10, 6),
        player('placement-skeleton', 'skeleton', 9, 8),
      ],
    };
  }

  if (scenario === 'placement_crowd') {
    const me = player('placement-base-human', 'base', 8, 9);
    return {
      me,
      others: [
        player('placement-guard', 'guard', 9, 9),
        player('placement-mage', 'mage', 8, 10),
        player('placement-skeleton', 'skeleton', 9, 10),
      ],
    };
  }

  if (scenario === 'placement_scale_compare') {
    const me = player('placement-base-human', 'base', 7, 7);
    return {
      me,
      others: [
        player('placement-guard', 'guard', 11, 7),
        player('placement-mage', 'mage', 7, 11),
        player('placement-skeleton', 'skeleton', 11, 11),
      ],
    };
  }

  return basePlacementPlayers();
}

function npcPresetPlayersForScenario(scenario: VisualSmokeScenario): { me: PlayerPublic; others: PlayerPublic[] } {
  let players: PlayerPublic[];
  if (scenario === 'npc_presets_market') {
    players = [
      presetPlayer('merchant_food_01', 'food', 8, 8),
      presetPlayer('merchant_cloth_01', 'cloth', 11, 8),
      presetPlayer('blacksmith_01', 'smith', 14, 8),
      presetPlayer('noble_male_01', 'noble', 9, 11),
      presetPlayer('priest_01', 'priest', 12, 11),
    ];
  } else if (scenario === 'npc_presets_castle') {
    players = [
      presetPlayer('castle_guard_red_01', 'guard', 8, 7),
      presetPlayer('noble_male_01', 'noble', 11, 8),
      presetPlayer('priest_01', 'priest', 14, 8),
      presetPlayer('blacksmith_01', 'smith', 10, 11),
      presetPlayer('rat_hunter_01', 'hunter', 13, 11),
    ];
  } else if (scenario === 'npc_presets_sewer') {
    players = [
      presetPlayer('sewer_worker_01', 'worker', 8, 8),
      presetPlayer('rat_hunter_01', 'hunter', 11, 8),
      presetPlayer('rat_small_01', 'rat s', 9, 13),
      presetPlayer('rat_large_01', 'rat l', 12, 13),
      presetPlayer('diseased_rat_01', 'rat d', 15, 13),
    ];
  } else if (scenario === 'npc_presets_creatures') {
    players = [
      presetPlayer('rat_small_01', 'rat s', 8, 9),
      presetPlayer('rat_large_01', 'rat l', 10, 9),
      presetPlayer('diseased_rat_01', 'rat d', 12, 9),
      presetPlayer('dog_01', 'dog', 14, 9),
      presetPlayer('cat_01', 'cat', 16, 9),
    ];
  } else if (scenario === 'npc_presets_crowd_scale') {
    players = [
      presetPlayer('castle_guard_red_01', 'guard', 7, 7),
      presetPlayer('merchant_food_01', 'food', 9, 7),
      presetPlayer('merchant_cloth_01', 'cloth', 11, 7),
      presetPlayer('blacksmith_01', 'smith', 13, 7),
      presetPlayer('priest_01', 'priest', 7, 9),
      presetPlayer('noble_male_01', 'noble', 9, 9),
      presetPlayer('sewer_worker_01', 'worker', 11, 9),
      presetPlayer('rat_hunter_01', 'hunter', 13, 9),
      presetPlayer('rat_small_01', 'rat s', 7, 11),
      presetPlayer('rat_large_01', 'rat l', 9, 11),
      presetPlayer('diseased_rat_01', 'rat d', 11, 11),
      presetPlayer('dog_01', 'dog', 13, 11),
      presetPlayer('cat_01', 'cat', 15, 11),
    ];
  } else {
    players = [
      presetPlayer('castle_guard_red_01', 'guard', 6, 8),
      presetPlayer('merchant_food_01', 'food', 8, 8),
      presetPlayer('merchant_cloth_01', 'cloth', 10, 8),
      presetPlayer('blacksmith_01', 'smith', 12, 8),
      presetPlayer('priest_01', 'priest', 14, 8),
      presetPlayer('noble_male_01', 'noble', 6, 11),
      presetPlayer('sewer_worker_01', 'worker', 8, 11),
      presetPlayer('rat_hunter_01', 'hunter', 10, 11),
    ];
  }

  return { me: players[0], others: players.slice(1) };
}

function worldScalePlayersForScenario(scenario: VisualSmokeScenario): { me: PlayerPublic; others: PlayerPublic[] } {
  let players: PlayerPublic[];
  if (scenario === 'world_scale_doors') {
    players = [
      presetPlayer('base_human_male_01', 'base', 8, 11),
      presetPlayer('guard_city_01', 'guard', 11, 11),
      presetPlayer('mage_apprentice_01', 'mage', 14, 11),
    ];
  } else if (scenario === 'world_scale_walls') {
    players = [
      presetPlayer('base_human_male_01', 'base', 7, 11),
      presetPlayer('guard_city_01', 'guard', 10, 11),
      presetPlayer('skeleton_warrior_01', 'skel', 13, 11),
    ];
  } else if (scenario === 'world_scale_market') {
    players = [
      presetPlayer('merchant_food_01', 'food', 8, 12),
      presetPlayer('merchant_cloth_01', 'cloth', 13, 12),
      presetPlayer('base_human_male_01', 'base', 16, 12),
    ];
  } else if (scenario === 'world_scale_interior') {
    players = [
      presetPlayer('base_human_male_01', 'base', 8, 12),
      presetPlayer('mage_apprentice_01', 'mage', 11, 12),
      presetPlayer('guard_city_01', 'guard', 14, 12),
    ];
  } else if (scenario === 'world_scale_castle') {
    players = [
      presetPlayer('guard_city_01', 'guard', 8, 12),
      presetPlayer('base_human_male_01', 'base', 11, 12),
      presetPlayer('skeleton_warrior_01', 'skel', 14, 12),
    ];
  } else if (scenario === 'world_scale_sewer') {
    players = [
      presetPlayer('sewer_worker_01', 'worker', 8, 9),
      presetPlayer('rat_hunter_01', 'hunter', 11, 9),
      presetPlayer('rat_large_01', 'rat', 14, 13),
    ];
  } else {
    players = [
      presetPlayer('base_human_male_01', 'base', 7, 13),
      presetPlayer('guard_city_01', 'guard', 10, 13),
      presetPlayer('mage_apprentice_01', 'mage', 13, 13),
      presetPlayer('skeleton_warrior_01', 'skel', 16, 13),
    ];
  }
  return { me: players[0], others: players.slice(1) };
}

function buildingAssemblyPlayersForScenario(scenario: VisualSmokeScenario): { me: PlayerPublic; others: PlayerPublic[] } {
  let players: PlayerPublic[];
  if (scenario === 'building_market_shop') {
    players = [
      presetPlayer('merchant_food_01', 'food', 8, 12),
      presetPlayer('merchant_cloth_01', 'cloth', 13, 12),
      presetPlayer('base_human_male_01', 'base', 16, 13),
    ];
  } else if (scenario === 'building_castle_meeting_hall') {
    players = [
      presetPlayer('guard_city_01', 'guard', 8, 13),
      presetPlayer('noble_male_01', 'noble', 11, 12),
      presetPlayer('mage_apprentice_01', 'mage', 14, 13),
      presetPlayer('skeleton_warrior_01', 'skel', 17, 13),
    ];
  } else if (scenario === 'building_z_order_wall_door') {
    players = [
      presetPlayer('base_human_male_01', 'front', 10, 14),
      presetPlayer('guard_city_01', 'inside', 10, 12),
      presetPlayer('mage_apprentice_01', 'wall', 7, 10),
    ];
  } else if (scenario === 'building_character_walk_space') {
    players = [
      presetPlayer('base_human_male_01', 'south', 9, 13),
      presetPlayer('guard_city_01', 'east', 11, 12),
      presetPlayer('mage_apprentice_01', 'north', 13, 10),
      presetPlayer('skeleton_warrior_01', 'west', 15, 12),
    ];
  } else {
    players = [
      presetPlayer('base_human_male_01', 'base', 9, 13),
      presetPlayer('guard_city_01', 'guard', 11, 11),
      presetPlayer('mage_apprentice_01', 'mage', 13, 13),
    ];
  }
  return { me: players[0], others: players.slice(1) };
}

function roofReviewPlayersForScenario(scenario: VisualSmokeScenario): { me: PlayerPublic; others: PlayerPublic[] } {
  let players: PlayerPublic[];
  if (scenario === 'roof_small_house_outside') {
    players = [
      presetPlayer('base_human_male_01', 'outside', 10, 15),
      presetPlayer('guard_city_01', 'guard', 13, 15),
    ];
  } else if (scenario === 'roof_market_shop_outside') {
    players = [
      presetPlayer('merchant_food_01', 'food', 8, 15),
      presetPlayer('merchant_cloth_01', 'cloth', 13, 15),
      presetPlayer('base_human_male_01', 'base', 16, 15),
    ];
  } else if (scenario === 'roof_castle_meeting_hall_outside') {
    players = [
      presetPlayer('guard_city_01', 'guard', 9, 16),
      presetPlayer('noble_male_01', 'noble', 12, 16),
      presetPlayer('mage_apprentice_01', 'mage', 15, 16),
    ];
  } else if (scenario === 'roof_z_order_entry_threshold') {
    players = [
      presetPlayer('base_human_male_01', 'entry', 10, 14),
      presetPlayer('guard_city_01', 'inside', 10, 12),
      presetPlayer('mage_apprentice_01', 'outside', 12, 15),
    ];
  } else {
    players = [
      presetPlayer('base_human_male_01', 'inside', 10, 12),
      presetPlayer('guard_city_01', 'guard', 12, 11),
      presetPlayer('mage_apprentice_01', 'door', 10, 14),
    ];
  }
  return { me: players[0], others: players.slice(1) };
}

type OverlayReviewScenarioConfig = {
  buildingId: keyof typeof BUILDING_OVERLAY_REVIEW_FIXTURES;
  position: 'outside' | 'doorway' | 'inside';
};

const FLOOR_OVERLAY_VISIBILITY_SCENARIOS: Partial<Record<VisualSmokeScenario, OverlayReviewScenarioConfig>> = {
  overlay_visibility_small_house_outside: { buildingId: 'small_house_01', position: 'outside' },
  overlay_visibility_small_house_doorway: { buildingId: 'small_house_01', position: 'doorway' },
  overlay_visibility_small_house_inside: { buildingId: 'small_house_01', position: 'inside' },
  overlay_visibility_market_shop_outside: { buildingId: 'market_shop_01', position: 'outside' },
  overlay_visibility_market_shop_inside: { buildingId: 'market_shop_01', position: 'inside' },
  overlay_visibility_castle_hall_inside: { buildingId: 'castle_meeting_hall_01', position: 'inside' },
};

function floorOverlayScenarioConfig(scenario: VisualSmokeScenario): OverlayReviewScenarioConfig | null {
  return FLOOR_OVERLAY_VISIBILITY_SCENARIOS[scenario] ?? null;
}

function floorOverlayVisibilityPlayersForScenario(scenario: VisualSmokeScenario): { me: PlayerPublic; others: PlayerPublic[] } {
  const config = floorOverlayScenarioConfig(scenario);
  if (!config) return buildingAssemblyPlayersForScenario('building_small_house');
  const fixture = BUILDING_OVERLAY_REVIEW_FIXTURES[config.buildingId];
  const position = fixture.reviewPositions[config.position];
  const visibility = overlayVisibilityForReview(position, fixture.interiorFootprint, fixture.doorwayTiles);
  const me = presetPlayer('base_human_male_01', visibility, position.x, position.y);
  const others: PlayerPublic[] = [];
  if (config.position === 'inside') {
    const doorway = fixture.reviewPositions.doorway;
    others.push(presetPlayer('guard_city_01', 'doorway', doorway.x, doorway.y));
  }
  if (config.position === 'outside') {
    others.push(presetPlayer('mage_apprentice_01', 'nearby', position.x + 2, position.y));
  }
  return { me, others };
}

function spriteOverridesFor(players: PlayerPublic[]): Map<string, CharacterSpriteId> {
  const overrides = new Map<string, CharacterSpriteId>();
  for (const p of players) {
    const sprite = spriteForPlayerId(p.id);
    if (sprite) overrides.set(p.id, sprite);
  }
  return overrides;
}

function placementFrameOverrides(players: PlayerPublic[], scenario: VisualSmokeScenario): Map<string, CharacterFrameOverride> {
  const [base, guard, mage, skeleton] = players;
  const frames = scenario === 'placement_walk_cycle'
    ? [override('south', 0), override('east', 1), override('north', 2), override('west', 3)]
    : [override('south', 0), override('east', 0), override('north', 0), override('west', 0)];

  return new Map<string, CharacterFrameOverride>([
    [base.id, frames[0]],
    [guard.id, frames[1]],
    [mage.id, frames[2]],
    [skeleton.id, frames[3]],
  ]);
}

function presetFrameOverrides(players: PlayerPublic[], scenario: VisualSmokeScenario): Map<string, CharacterFrameOverride> {
  const directions: Direction[] = scenario === 'npc_presets_lineup'
    ? ['south']
    : ['south', 'east', 'north', 'west'];
  const animated = scenario === 'npc_presets_creatures' || scenario === 'npc_presets_crowd_scale';
  return new Map<string, CharacterFrameOverride>(players.map((p, i) => [
    p.id,
    override(directions[i % directions.length], animated ? i % 4 : 0),
  ]));
}

function worldFrameOverrides(players: PlayerPublic[], scenario: VisualSmokeScenario): Map<string, CharacterFrameOverride> {
  const directions: Direction[] = ['south', 'east', 'north', 'west'];
  const animated = scenario === 'world_scale_all_compare';
  return new Map<string, CharacterFrameOverride>(players.map((p, i) => [
    p.id,
    override(directions[i % directions.length], animated ? i % 4 : 0),
  ]));
}

function obj(assetId: WorldVisualAssetId, x: number, y: number, instance = 0): WorldVisualObjectPlacement {
  return { id: assetId + ':' + x + ':' + y + ':' + instance, assetId, x, y };
}

function floorOverlay(assetId: WorldVisualAssetId, x: number, y: number, visibility: WorldVisualVisibility = 'visible'): WorldVisualObjectPlacement {
  return { id: assetId + ':' + x + ':' + y + ':' + visibility, assetId, x, y, visibility };
}

function row(assetId: WorldVisualAssetId, x1: number, x2: number, y: number): WorldVisualObjectPlacement[] {
  const out: WorldVisualObjectPlacement[] = [];
  for (let x = x1; x <= x2; x += 1) out.push(obj(assetId, x, y));
  return out;
}

function col(assetId: WorldVisualAssetId, x: number, y1: number, y2: number): WorldVisualObjectPlacement[] {
  const out: WorldVisualObjectPlacement[] = [];
  for (let y = y1; y <= y2; y += 1) out.push(obj(assetId, x, y));
  return out;
}

function floorPatch(assetId: WorldVisualAssetId, x1: number, y1: number, x2: number, y2: number): WorldVisualObjectPlacement[] {
  const out: WorldVisualObjectPlacement[] = [];
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) out.push(obj(assetId, x, y));
  }
  return out;
}

function worldObjectsForScenario(scenario: VisualSmokeScenario): WorldVisualObjectPlacement[] {
  if (scenario === 'world_scale_doors') {
    return [
      ...floorPatch('floor_stone_01', 5, 7, 16, 13),
      ...row('wall_stone_north', 6, 15, 7),
      obj('wall_stone_corner_nw', 5, 7),
      obj('wall_stone_corner_ne', 16, 7),
      obj('door_wood_closed_south', 7, 8),
      obj('door_wood_open_south', 10, 8),
      obj('door_wood_closed_east', 13, 8),
      obj('door_wood_open_east', 15, 10),
    ];
  }

  if (scenario === 'world_scale_walls') {
    return [
      ...floorPatch('floor_cobble_01', 5, 7, 16, 13),
      ...row('wall_stone_north', 6, 15, 7),
      ...row('wall_stone_south', 6, 15, 9),
      obj('wall_stone_corner_nw', 5, 7),
      obj('wall_stone_corner_ne', 16, 7),
      obj('stone_column', 6, 12),
      obj('stone_column', 15, 12),
    ];
  }

  if (scenario === 'world_scale_market') {
    return [
      ...floorPatch('floor_cobble_01', 5, 7, 17, 14),
      obj('market_food_stall', 8, 10),
      obj('market_cloth_stall', 13, 10),
      obj('bench', 7, 14),
      obj('notice_board', 11, 14),
      obj('banner_blue', 15, 14),
      obj('banner_red', 17, 14),
      obj('fountain', 16, 8),
    ];
  }

  if (scenario === 'world_scale_interior') {
    return [
      ...floorPatch('floor_wood_01', 5, 7, 17, 14),
      obj('bed_single', 7, 9),
      obj('table_small', 10, 10),
      obj('chair_wood', 10, 12),
      obj('chest_small', 13, 9),
      obj('bookshelf', 15, 9),
      obj('fireplace', 16, 12),
    ];
  }

  if (scenario === 'world_scale_castle') {
    return [
      ...floorPatch('floor_stone_01', 5, 7, 17, 14),
      ...row('wall_stone_north', 6, 16, 7),
      obj('throne', 11, 9),
      obj('stone_column', 7, 11),
      obj('stone_column', 15, 11),
      obj('weapon_rack', 8, 14),
      obj('prison_bars', 14, 14),
      obj('banner_blue', 9, 8),
      obj('banner_red', 13, 8),
    ];
  }

  if (scenario === 'world_scale_sewer') {
    return [
      ...floorPatch('floor_stone_01', 6, 6, 17, 14),
      obj('sewer_pipe', 7, 9),
      obj('sewer_pipe', 15, 9),
      obj('sewer_grate', 9, 13),
      obj('sewer_grate', 12, 13),
      obj('slime_pool', 15, 13),
      obj('wall_stone_south', 6, 6),
      obj('wall_stone_south', 17, 6),
    ];
  }

  if (scenario === 'world_scale_all_compare') {
    return [
      ...floorPatch('floor_cobble_01', 5, 7, 17, 14),
      obj('door_wood_closed_south', 6, 9),
      obj('wall_stone_north', 7, 8),
      obj('market_food_stall', 10, 9),
      obj('fountain', 15, 9),
      obj('bed_single', 6, 13),
      obj('chest_small', 9, 13),
      obj('stone_column', 12, 13),
      obj('sewer_grate', 15, 13),
      obj('slime_pool', 17, 13),
    ];
  }

  return [];
}

function smallHouseObjects(openDoor: boolean): WorldVisualObjectPlacement[] {
  return [
    ...floorPatch('floor_wood_01', 7, 8, 13, 13),
    ...floorPatch('floor_cobble_01', 9, 14, 11, 14),
    ...row('wall_stone_north', 7, 13, 8),
    ...row('wall_stone_south', 7, 8, 13),
    ...row('wall_stone_south', 11, 13, 13),
    ...col('stone_column', 6, 9, 12),
    ...col('stone_column', 14, 9, 12),
    obj('wall_stone_corner_nw', 6, 8),
    obj('wall_stone_corner_ne', 14, 8),
    obj(openDoor ? 'door_wood_open_south' : 'door_wood_closed_south', 10, 13),
    obj('bed_single', 8, 10),
    obj('table_small', 11, 11),
    obj('chair_wood', 11, 12),
    obj('chest_small', 13, 10),
    obj('fireplace', 13, 12),
  ];
}

function marketShopObjects(): WorldVisualObjectPlacement[] {
  return [
    ...floorPatch('floor_wood_01', 6, 7, 17, 14),
    ...floorPatch('floor_cobble_01', 9, 15, 13, 15),
    ...row('wall_stone_north', 6, 17, 7),
    ...row('wall_stone_south', 6, 9, 14),
    ...row('wall_stone_south', 13, 17, 14),
    ...col('stone_column', 5, 8, 13),
    ...col('stone_column', 18, 8, 13),
    obj('wall_stone_corner_nw', 5, 7),
    obj('wall_stone_corner_ne', 18, 7),
    obj('door_wood_open_south', 11, 14),
    obj('market_food_stall', 8, 10),
    obj('market_cloth_stall', 14, 10),
    obj('notice_board', 17, 12),
    obj('bench', 7, 14),
    obj('chest_small', 15, 14),
  ];
}

function castleMeetingHallObjects(): WorldVisualObjectPlacement[] {
  return [
    ...floorPatch('floor_stone_01', 5, 6, 18, 15),
    ...row('wall_stone_north', 5, 18, 6),
    ...row('wall_stone_south', 5, 9, 15),
    ...row('wall_stone_south', 13, 18, 15),
    ...col('stone_column', 4, 7, 14),
    ...col('stone_column', 19, 7, 14),
    obj('wall_stone_corner_nw', 4, 6),
    obj('wall_stone_corner_ne', 19, 6),
    obj('door_wood_open_south', 11, 15),
    obj('throne', 11, 9),
    obj('table_small', 10, 12),
    obj('table_small', 12, 12),
    obj('chair_wood', 9, 13),
    obj('chair_wood', 13, 13),
    obj('banner_blue', 7, 8),
    obj('banner_red', 16, 8),
    obj('weapon_rack', 6, 14),
    obj('prison_bars', 17, 14),
  ];
}

function buildingObjectsForScenario(scenario: VisualSmokeScenario): WorldVisualObjectPlacement[] {
  if (scenario === 'building_small_house') return smallHouseObjects(false);
  if (scenario === 'building_small_house_door_threshold') return smallHouseObjects(true);
  if (scenario === 'building_market_shop') return marketShopObjects();
  if (scenario === 'building_castle_meeting_hall') return castleMeetingHallObjects();
  if (scenario === 'building_z_order_wall_door') {
    return [
      ...smallHouseObjects(true),
      obj('bookshelf', 7, 11),
      obj('notice_board', 10, 15),
    ];
  }
  if (scenario === 'building_character_walk_space') {
    return [
      ...floorPatch('floor_wood_01', 7, 8, 17, 14),
      ...row('wall_stone_north', 7, 17, 8),
      ...row('wall_stone_south', 7, 9, 14),
      ...row('wall_stone_south', 13, 17, 14),
      ...col('stone_column', 6, 9, 13),
      ...col('stone_column', 18, 9, 13),
      obj('wall_stone_corner_nw', 6, 8),
      obj('wall_stone_corner_ne', 18, 8),
      obj('door_wood_open_south', 11, 14),
      obj('bed_single', 8, 10),
      obj('bookshelf', 17, 10),
      obj('table_small', 15, 11),
      obj('chair_wood', 15, 12),
      obj('chest_small', 8, 13),
      obj('fireplace', 17, 13),
    ];
  }
  return [];
}

function roofObjectsForScenario(scenario: VisualSmokeScenario): WorldVisualObjectPlacement[] {
  if (scenario === 'roof_small_house_outside') {
    return [...smallHouseObjects(false), floorOverlay('roof_red_small_overlay', 6, 7, 'visible')];
  }
  if (scenario === 'roof_small_house_hidden') {
    return [...smallHouseObjects(true), floorOverlay('roof_red_small_overlay', 6, 7, 'hidden')];
  }
  if (scenario === 'roof_small_house_faded') {
    return [...smallHouseObjects(true), floorOverlay('roof_red_small_overlay', 6, 7, 'faded')];
  }
  if (scenario === 'roof_market_shop_outside') {
    return [...marketShopObjects(), floorOverlay('market_awning_overlay', 6, 7, 'visible')];
  }
  if (scenario === 'roof_castle_meeting_hall_outside') {
    return [...castleMeetingHallObjects(), floorOverlay('roof_castle_overlay', 4, 6, 'visible')];
  }
  if (scenario === 'roof_z_order_entry_threshold') {
    return [...smallHouseObjects(true), obj('notice_board', 10, 15), floorOverlay('roof_red_small_overlay', 6, 7, 'faded')];
  }
  return [];
}

function buildingObjectsForId(buildingId: keyof typeof BUILDING_OVERLAY_REVIEW_FIXTURES): WorldVisualObjectPlacement[] {
  if (buildingId === 'small_house_01') return smallHouseObjects(true);
  if (buildingId === 'market_shop_01') return marketShopObjects();
  return castleMeetingHallObjects();
}

function floorOverlayVisibilityObjectsForScenario(scenario: VisualSmokeScenario): WorldVisualObjectPlacement[] {
  const config = floorOverlayScenarioConfig(scenario);
  if (!config) return [];
  const fixture = BUILDING_OVERLAY_REVIEW_FIXTURES[config.buildingId];
  const playerTile = fixture.reviewPositions[config.position];
  const visibility: OverlayVisibility = overlayVisibilityForReview(playerTile, fixture.interiorFootprint, fixture.doorwayTiles);
  return [
    ...buildingObjectsForId(config.buildingId),
    ...fixture.overlays.map((overlay) => floorOverlay(overlay.assetId, overlay.anchorTile.x, overlay.anchorTile.y, visibility)),
  ];
}


function shiftObjects(objects: WorldVisualObjectPlacement[], dx: number, dy: number, scope: string): WorldVisualObjectPlacement[] {
  return objects.map((placement, index) => ({
    ...placement,
    id: scope + ':' + index + ':' + placement.id,
    x: placement.x + dx,
    y: placement.y + dy,
  }));
}

function highCityBaseObjects(): WorldVisualObjectPlacement[] {
  return [
    ...floorPatch('floor_cobble_01', 3, 5, 29, 24),
    ...floorPatch('floor_stone_01', 12, 5, 16, 13),
    ...floorPatch('floor_stone_01', 22, 21, 29, 24),
    ...row('wall_stone_north', 4, 12, 5),
    ...row('wall_stone_north', 16, 28, 5),
    ...row('wall_stone_south', 4, 28, 24),
    ...col('stone_column', 3, 6, 23),
    ...col('stone_column', 30, 6, 23),
    obj('wall_stone_corner_nw', 3, 5),
    obj('wall_stone_corner_ne', 29, 5),
    obj('door_wood_open_south', 14, 5),
    obj('fountain', 14, 12),
    obj('notice_board', 17, 12),
    obj('bench', 11, 14),
    obj('banner_blue', 12, 7),
    obj('banner_red', 16, 7),
  ];
}

function highCitySmallHouseObjects(visibility: WorldVisualVisibility): WorldVisualObjectPlacement[] {
  return [
    ...shiftObjects(smallHouseObjects(true), 0, 0, 'high-city-house'),
    floorOverlay('roof_red_small_overlay', 6, 7, visibility),
  ];
}

function highCityMarketObjects(visibility: WorldVisualVisibility): WorldVisualObjectPlacement[] {
  return [
    ...shiftObjects(marketShopObjects(), 11, 0, 'high-city-market'),
    floorOverlay('market_awning_overlay', 17, 7, visibility),
  ];
}

function highCityCastleObjects(visibility: WorldVisualVisibility): WorldVisualObjectPlacement[] {
  return [
    ...shiftObjects(castleMeetingHallObjects(), 4, 8, 'high-city-castle'),
    floorOverlay('roof_castle_overlay', 8, 14, visibility),
  ];
}

function highCitySewerHintObjects(): WorldVisualObjectPlacement[] {
  return [
    ...floorPatch('floor_stone_01', 22, 21, 29, 24),
    ...row('wall_stone_south', 22, 29, 21),
    obj('sewer_pipe', 23, 22),
    obj('sewer_pipe', 28, 22),
    obj('sewer_grate', 24, 24),
    obj('sewer_grate', 27, 24),
    obj('slime_pool', 29, 24),
  ];
}

function highCityObjectsForScenario(scenario: VisualSmokeScenario): WorldVisualObjectPlacement[] {
  const houseVisibility: WorldVisualVisibility = scenario === 'high_city_block_house_threshold' ? 'faded' : 'visible';
  const marketVisibility: WorldVisualVisibility = scenario === 'high_city_block_market_shop' ? 'hidden' : 'visible';
  const castleVisibility: WorldVisualVisibility = scenario === 'high_city_block_castle_room' ? 'hidden' : 'visible';
  return [
    ...highCityBaseObjects(),
    ...highCitySmallHouseObjects(houseVisibility),
    ...highCityMarketObjects(marketVisibility),
    ...highCityCastleObjects(castleVisibility),
    ...highCitySewerHintObjects(),
  ];
}

function highCityPlayersForScenario(scenario: VisualSmokeScenario): { me: PlayerPublic; others: PlayerPublic[] } {
  let players: PlayerPublic[];
  if (scenario === 'high_city_block_gate_public_space') {
    players = [
      presetPlayer('base_human_male_01', 'visitor', 14, 11),
      presetPlayer('castle_guard_red_01', 'gate', 12, 8),
      presetPlayer('castle_guard_red_01', 'gate', 16, 8, 1),
      presetPlayer('noble_male_01', 'noble', 18, 11),
      presetPlayer('priest_01', 'priest', 11, 12),
    ];
  } else if (scenario === 'high_city_block_market_shop') {
    players = [
      presetPlayer('merchant_food_01', 'food', 20, 13),
      presetPlayer('merchant_cloth_01', 'cloth', 24, 13),
      presetPlayer('blacksmith_01', 'smith', 27, 14),
      presetPlayer('base_human_male_01', 'buyer', 22, 15),
      presetPlayer('cat_01', 'cat', 19, 16),
      presetPlayer('dog_01', 'dog', 27, 16),
    ];
  } else if (scenario === 'high_city_block_house_threshold') {
    players = [
      presetPlayer('base_human_male_01', 'threshold', 10, 14),
      presetPlayer('guard_city_01', 'inside', 10, 12),
      presetPlayer('mage_apprentice_01', 'street', 13, 15),
      presetPlayer('dog_01', 'dog', 8, 15),
    ];
  } else if (scenario === 'high_city_block_castle_room') {
    players = [
      presetPlayer('castle_guard_red_01', 'guard', 10, 22),
      presetPlayer('noble_male_01', 'noble', 12, 20),
      presetPlayer('priest_01', 'priest', 15, 20),
      presetPlayer('mage_apprentice_01', 'mage', 18, 21),
      presetPlayer('skeleton_warrior_01', 'skel', 20, 23),
    ];
  } else if (scenario === 'high_city_block_sewer_hint') {
    players = [
      presetPlayer('sewer_worker_01', 'worker', 23, 23),
      presetPlayer('rat_hunter_01', 'hunter', 25, 23),
      presetPlayer('rat_small_01', 'rat s', 26, 24),
      presetPlayer('rat_large_01', 'rat l', 28, 23),
      presetPlayer('diseased_rat_01', 'rat d', 29, 24),
    ];
  } else {
    players = [
      presetPlayer('base_human_male_01', 'visitor', 14, 13),
      presetPlayer('castle_guard_red_01', 'gate', 12, 8),
      presetPlayer('castle_guard_red_01', 'gate', 16, 8, 1),
      presetPlayer('merchant_food_01', 'food', 20, 13),
      presetPlayer('merchant_cloth_01', 'cloth', 24, 13),
      presetPlayer('noble_male_01', 'noble', 12, 21),
      presetPlayer('sewer_worker_01', 'worker', 23, 23),
      presetPlayer('rat_small_01', 'rat', 27, 24),
      presetPlayer('cat_01', 'cat', 8, 15),
    ];
  }
  return { me: players[0], others: players.slice(1) };
}


function refinedCityBaseObjects(): WorldVisualObjectPlacement[] {
  return [
    ...floorPatch('floor_cobble_01', 3, 4, 29, 26),
    ...floorPatch('floor_stone_01', 12, 5, 18, 18),
    ...floorPatch('floor_cobble_01', 9, 12, 21, 18),
    ...floorPatch('floor_stone_01', 23, 22, 30, 26),
    ...row('wall_stone_north', 4, 13, 4),
    ...row('wall_stone_north', 17, 29, 4),
    ...row('wall_stone_south', 4, 29, 26),
    ...col('stone_column', 3, 5, 25),
    ...col('stone_column', 30, 5, 25),
    obj('wall_stone_corner_nw', 3, 4),
    obj('wall_stone_corner_ne', 30, 4),
    obj('door_wood_open_south', 15, 4),
    obj('fountain', 15, 14),
    obj('notice_board', 18, 14),
    obj('bench', 10, 16),
    obj('bench', 20, 16, 1),
    obj('banner_blue', 13, 7),
    obj('banner_red', 17, 7),
  ];
}

function refinedHouseObjects(visibility: WorldVisualVisibility): WorldVisualObjectPlacement[] {
  return [
    ...shiftObjects(smallHouseObjects(true), -3, 9, 'refined-house'),
    floorOverlay('roof_red_small_overlay', 3, 16, visibility),
  ];
}

function refinedMarketLaneObjects(visibility: WorldVisualVisibility): WorldVisualObjectPlacement[] {
  return [
    ...floorPatch('floor_wood_01', 20, 8, 29, 17),
    ...floorPatch('floor_cobble_01', 23, 18, 27, 18),
    ...row('wall_stone_north', 20, 29, 8),
    ...row('wall_stone_south', 20, 23, 17),
    ...row('wall_stone_south', 27, 29, 17),
    ...col('stone_column', 19, 9, 16),
    ...col('stone_column', 30, 9, 16),
    obj('wall_stone_corner_nw', 19, 8),
    obj('wall_stone_corner_ne', 30, 8),
    obj('door_wood_open_south', 25, 17),
    obj('market_food_stall', 21, 12),
    obj('market_cloth_stall', 27, 12),
    obj('notice_board', 29, 14),
    obj('bench', 20, 17),
    obj('chest_small', 28, 17),
    floorOverlay('market_awning_overlay', 19, 8, visibility),
  ];
}

function refinedCastleMeetingObjects(visibility: WorldVisualVisibility): WorldVisualObjectPlacement[] {
  return [
    ...shiftObjects(castleMeetingHallObjects(), -1, -1, 'refined-castle'),
    floorOverlay('roof_castle_overlay', 3, 5, visibility),
  ];
}

function refinedSewerHintObjects(): WorldVisualObjectPlacement[] {
  return [
    ...floorPatch('floor_stone_01', 23, 22, 30, 26),
    ...row('wall_stone_south', 23, 30, 22),
    obj('sewer_pipe', 24, 23),
    obj('sewer_pipe', 29, 23),
    obj('sewer_grate', 25, 26),
    obj('sewer_grate', 28, 26),
    obj('slime_pool', 30, 26),
    obj('notice_board', 23, 25),
  ];
}

function highCityRefinedObjectsForScenario(scenario: VisualSmokeScenario): WorldVisualObjectPlacement[] {
  const houseVisibility: WorldVisualVisibility = scenario === 'high_city_refined_house_block' ? 'faded' : 'visible';
  const marketVisibility: WorldVisualVisibility = scenario === 'high_city_refined_market_lane' ? 'hidden' : 'faded';
  const castleVisibility: WorldVisualVisibility = scenario === 'high_city_refined_castle_meeting' ? 'hidden' : 'faded';
  return [
    ...refinedCityBaseObjects(),
    ...refinedCastleMeetingObjects(castleVisibility),
    ...refinedMarketLaneObjects(marketVisibility),
    ...refinedHouseObjects(houseVisibility),
    ...refinedSewerHintObjects(),
  ];
}

function highCityRefinedPlayersForScenario(scenario: VisualSmokeScenario): { me: PlayerPublic; others: PlayerPublic[] } {
  let players: PlayerPublic[];
  if (scenario === 'high_city_refined_gate_to_plaza') {
    players = [
      presetPlayer('base_human_male_01', 'visitor', 15, 11),
      presetPlayer('castle_guard_red_01', 'gate', 13, 7),
      presetPlayer('castle_guard_red_01', 'gate', 17, 7, 1),
      presetPlayer('noble_male_01', 'plaza', 18, 13),
      presetPlayer('priest_01', 'plaza', 12, 14),
    ];
  } else if (scenario === 'high_city_refined_market_lane') {
    players = [
      presetPlayer('merchant_food_01', 'food', 22, 15),
      presetPlayer('merchant_cloth_01', 'cloth', 27, 15),
      presetPlayer('blacksmith_01', 'smith', 29, 17),
      presetPlayer('base_human_male_01', 'buyer', 25, 18),
      presetPlayer('cat_01', 'cat', 21, 18),
      presetPlayer('dog_01', 'dog', 29, 18),
    ];
  } else if (scenario === 'high_city_refined_house_block') {
    players = [
      presetPlayer('base_human_male_01', 'threshold', 7, 23),
      presetPlayer('guard_city_01', 'inside', 7, 21),
      presetPlayer('mage_apprentice_01', 'street', 11, 24),
      presetPlayer('dog_01', 'dog', 5, 24),
    ];
  } else if (scenario === 'high_city_refined_castle_meeting') {
    players = [
      presetPlayer('castle_guard_red_01', 'guard', 8, 13),
      presetPlayer('noble_male_01', 'noble', 11, 11),
      presetPlayer('priest_01', 'priest', 14, 11),
      presetPlayer('mage_apprentice_01', 'mage', 17, 13),
      presetPlayer('skeleton_warrior_01', 'skel', 19, 15),
    ];
  } else if (scenario === 'high_city_refined_sewer_hint') {
    players = [
      presetPlayer('sewer_worker_01', 'worker', 24, 25),
      presetPlayer('rat_hunter_01', 'hunter', 26, 24),
      presetPlayer('rat_small_01', 'rat s', 27, 26),
      presetPlayer('rat_large_01', 'rat l', 29, 25),
      presetPlayer('diseased_rat_01', 'rat d', 30, 26),
    ];
  } else {
    players = [
      presetPlayer('base_human_male_01', 'visitor', 15, 15),
      presetPlayer('castle_guard_red_01', 'gate', 13, 7),
      presetPlayer('castle_guard_red_01', 'gate', 17, 7, 1),
      presetPlayer('merchant_food_01', 'food', 22, 15),
      presetPlayer('merchant_cloth_01', 'cloth', 27, 15),
      presetPlayer('noble_male_01', 'noble', 11, 12),
      presetPlayer('sewer_worker_01', 'worker', 24, 25),
      presetPlayer('rat_small_01', 'rat', 28, 26),
      presetPlayer('cat_01', 'cat', 5, 24),
    ];
  }
  return { me: players[0], others: players.slice(1) };
}

function mapKindForScenario(scenario: VisualSmokeScenario): ReviewMapKind {
  switch (scenario) {
    case 'placement_wall':
      return 'wall';
    case 'placement_door':
      return 'door';
    case 'placement_scale_compare':
    case 'npc_presets_crowd_scale':
      return 'scale';
    case 'npc_presets_market':
      return 'market';
    case 'npc_presets_castle':
      return 'castle';
    case 'npc_presets_sewer':
      return 'sewer';
    case 'npc_presets_creatures':
      return 'creature';
    case 'world_scale_doors':
      return 'world_doors';
    case 'world_scale_walls':
      return 'world_walls';
    case 'world_scale_market':
      return 'world_market';
    case 'world_scale_interior':
      return 'world_interior';
    case 'world_scale_castle':
      return 'world_castle';
    case 'world_scale_sewer':
      return 'world_sewer';
    case 'world_scale_all_compare':
      return 'world_all_compare';
    case 'building_small_house':
      return 'building_small_house';
    case 'building_small_house_door_threshold':
      return 'building_small_house_door_threshold';
    case 'building_market_shop':
      return 'building_market_shop';
    case 'building_castle_meeting_hall':
      return 'building_castle_meeting_hall';
    case 'building_z_order_wall_door':
      return 'building_z_order_wall_door';
    case 'building_character_walk_space':
      return 'building_character_walk_space';
    case 'roof_small_house_outside':
    case 'roof_small_house_hidden':
    case 'roof_small_house_faded':
      return 'building_small_house';
    case 'roof_market_shop_outside':
      return 'building_market_shop';
    case 'roof_castle_meeting_hall_outside':
      return 'building_castle_meeting_hall';
    case 'roof_z_order_entry_threshold':
      return 'building_z_order_wall_door';
    case 'overlay_visibility_small_house_outside':
    case 'overlay_visibility_small_house_doorway':
    case 'overlay_visibility_small_house_inside':
      return 'building_small_house';
    case 'overlay_visibility_market_shop_outside':
    case 'overlay_visibility_market_shop_inside':
      return 'building_market_shop';
    case 'overlay_visibility_castle_hall_inside':
      return 'building_castle_meeting_hall';
    case 'high_city_block_overview':
    case 'high_city_block_gate_public_space':
    case 'high_city_block_market_shop':
    case 'high_city_block_house_threshold':
    case 'high_city_block_castle_room':
    case 'high_city_block_sewer_hint':
      return 'high_city_block';
    case 'high_city_refined_overview':
    case 'high_city_refined_gate_to_plaza':
    case 'high_city_refined_market_lane':
    case 'high_city_refined_house_block':
    case 'high_city_refined_castle_meeting':
    case 'high_city_refined_sewer_hint':
    case 'runtime_projection_overview':
    case 'runtime_projection_collision_walkability':
    case 'runtime_projection_door_house':
    case 'runtime_projection_transitions':
    case 'runtime_projection_overlay_visibility':
    case 'runtime_projection_combined_review':
      return 'high_city_refined_block';
    case 'placement_cobble':
    case 'placement_crowd':
    case 'placement_walk_cycle':
    case 'npc_presets_lineup':
      return 'cobble';
    default:
      return 'plain';
  }
}

export function VisualSmokeReview() {
  const params = new URLSearchParams(window.location.search);
  const scenario = asScenario(params.get('visual-smoke'));
  const nowMs = 1_000;
  const isPlacementReview = scenario.startsWith('placement_');
  const isNpcPresetReview = scenario.startsWith('npc_presets_');
  const isWorldScaleReview = scenario.startsWith('world_scale_');
  const isBuildingAssemblyReview = scenario.startsWith('building_');
  const isRoofReview = scenario.startsWith('roof_');
  const isFloorOverlayVisibilityReview = scenario.startsWith('overlay_visibility_');
  const isHighCityPreview = scenario.startsWith('high_city_block_');
  const isHighCityRefinement = scenario.startsWith('high_city_refined_');
  const isRuntimeProjectionConsumer = scenario.startsWith('runtime_projection_');
  const map = useMemo(() => reviewMap(mapKindForScenario(scenario)), [scenario]);

  const { me, others, overrides, spriteMap, worldObjects, debugOverlays = [] } = useMemo(() => {
    if (isRuntimeProjectionConsumer) {
      const projectionScenario = scenario as RuntimeProjectionSmokeScenario;
      const refinedScenario = runtimeProjectionRefinedScenarioFor(projectionScenario) as VisualSmokeScenario;
      const refined = highCityRefinedPlayersForScenario(refinedScenario);
      const players = [refined.me, ...refined.others];
      return {
        me: refined.me,
        others: refined.others,
        overrides: worldFrameOverrides(players, refinedScenario),
        spriteMap: spriteOverridesFor(players),
        worldObjects: highCityRefinedObjectsForScenario(refinedScenario),
        debugOverlays: runtimeProjectionDebugOverlaysForScenario(projectionScenario) as MapDebugOverlay[],
      };
    }

    if (isHighCityRefinement) {
      const refined = highCityRefinedPlayersForScenario(scenario);
      const players = [refined.me, ...refined.others];
      return {
        me: refined.me,
        others: refined.others,
        overrides: worldFrameOverrides(players, scenario),
        spriteMap: spriteOverridesFor(players),
        worldObjects: highCityRefinedObjectsForScenario(scenario),
      };
    }

    if (isHighCityPreview) {
      const highCity = highCityPlayersForScenario(scenario);
      const players = [highCity.me, ...highCity.others];
      return {
        me: highCity.me,
        others: highCity.others,
        overrides: worldFrameOverrides(players, scenario),
        spriteMap: spriteOverridesFor(players),
        worldObjects: highCityObjectsForScenario(scenario),
      };
    }

    if (isFloorOverlayVisibilityReview) {
      const overlayReview = floorOverlayVisibilityPlayersForScenario(scenario);
      const players = [overlayReview.me, ...overlayReview.others];
      return {
        me: overlayReview.me,
        others: overlayReview.others,
        overrides: worldFrameOverrides(players, scenario),
        spriteMap: spriteOverridesFor(players),
        worldObjects: floorOverlayVisibilityObjectsForScenario(scenario),
      };
    }

    if (isRoofReview) {
      const roofReview = roofReviewPlayersForScenario(scenario);
      const players = [roofReview.me, ...roofReview.others];
      return {
        me: roofReview.me,
        others: roofReview.others,
        overrides: worldFrameOverrides(players, scenario),
        spriteMap: spriteOverridesFor(players),
        worldObjects: roofObjectsForScenario(scenario),
      };
    }

    if (isBuildingAssemblyReview) {
      const building = buildingAssemblyPlayersForScenario(scenario);
      const players = [building.me, ...building.others];
      return {
        me: building.me,
        others: building.others,
        overrides: worldFrameOverrides(players, scenario),
        spriteMap: spriteOverridesFor(players),
        worldObjects: buildingObjectsForScenario(scenario),
      };
    }

    if (isWorldScaleReview) {
      const world = worldScalePlayersForScenario(scenario);
      const players = [world.me, ...world.others];
      return {
        me: world.me,
        others: world.others,
        overrides: worldFrameOverrides(players, scenario),
        spriteMap: spriteOverridesFor(players),
        worldObjects: worldObjectsForScenario(scenario),
      };
    }

    if (isNpcPresetReview) {
      const preset = npcPresetPlayersForScenario(scenario);
      const players = [preset.me, ...preset.others];
      return {
        me: preset.me,
        others: preset.others,
        overrides: presetFrameOverrides(players, scenario),
        spriteMap: spriteOverridesFor(players),
        worldObjects: [],
      };
    }

    if (isPlacementReview) {
      const placement = placementPlayersForScenario(scenario);
      const players = [placement.me, ...placement.others];
      return {
        me: placement.me,
        others: placement.others,
        overrides: placementFrameOverrides(players, scenario),
        spriteMap: spriteOverridesFor(players),
        worldObjects: [],
      };
    }

    if (scenario === 'scale_on_map') {
      const main = player('smoke-base-human', 'base', 7, 7);
      const companions = [
        player('smoke-guard', 'guard', 9, 7),
        player('smoke-mage', 'mage', 7, 9),
        player('smoke-skeleton', 'skeleton', 9, 9),
      ];
      const players = [main, ...companions];
      return {
        me: main,
        others: companions,
        overrides: new Map<string, CharacterFrameOverride>([
          [main.id, override('south', 0)],
          [companions[0].id, override('east', 1)],
          [companions[1].id, override('north', 2)],
          [companions[2].id, override('west', 3)],
        ]),
        spriteMap: spriteOverridesFor(players),
        worldObjects: [],
      };
    }

    const direction: Direction = scenario === 'idle_south' ? 'south' : (scenario.replace('walk_', '') as Direction);
    const frameColumn = scenario === 'idle_south' ? 0 : 2;
    const main = player('smoke-base-human', 'base', 7, 7);
    return {
      me: main,
      others: [],
      overrides: new Map<string, CharacterFrameOverride>([[main.id, override(direction, frameColumn)]]),
      spriteMap: spriteOverridesFor([main]),
      worldObjects: [],
    };
  }, [isNpcPresetReview, isPlacementReview, isWorldScaleReview, isBuildingAssemblyReview, isRoofReview, isFloorOverlayVisibilityReview, isHighCityPreview, isHighCityRefinement, isRuntimeProjectionConsumer, scenario]);

  return (
    <div className="app-shell visual-smoke-review">
      <main className="main">
        <section className="stage stage-map">
          <MapCanvas
            map={map}
            me={me}
            others={others}
            nowMs={nowMs}
            targetId={null}
            fx={[]}
            onSelectTarget={() => {}}
            characterFrameOverrides={overrides}
            characterSpriteOverrides={spriteMap}
            worldVisualObjects={worldObjects}
            debugOverlays={debugOverlays}
          />
          <div className="smoke-review-label" aria-label="visual smoke scenario">
            {SCENARIO_LABEL[scenario]}
          </div>
        </section>
      </main>
    </div>
  );
}
