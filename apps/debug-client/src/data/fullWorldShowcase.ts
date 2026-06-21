import type { MapName } from '@shared/http';
import type { MapData, PlayerPublic } from '@shared/types';
import { getMap } from './maps';
import { highCityVisualLandmarksForMap } from './highCityVisualLandmarks';
import {
  CHARACTER_SPRITES,
  type CharacterSpriteId,
  type Direction,
  VISUAL_PRESET_SPRITE_IDS,
} from './characterSprites';
import type { RegistryWorldVisualPlacement } from './worldVisualRegistry';
import type { CharacterFrameOverride } from '../components/MapCanvas';

export type WorldShowcaseZone = 'rookguard' | 'high-city' | 'atlas';

function obj(
  assetId: RegistryWorldVisualPlacement['assetId'],
  x: number,
  y: number,
  instance = 0,
  prefix = 'showcase',
): RegistryWorldVisualPlacement {
  return { id: `${prefix}:${assetId}:${x}:${y}:${instance}`, assetId, x, y };
}

function floorPatch(
  assetId: RegistryWorldVisualPlacement['assetId'],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  prefix = 'showcase',
): RegistryWorldVisualPlacement[] {
  const out: RegistryWorldVisualPlacement[] = [];
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) out.push(obj(assetId, x, y, 0, prefix));
  }
  return out;
}

const ROOKGUARD_SHOWCASE_EXTRAS: RegistryWorldVisualPlacement[] = [
  ...floorPatch('floor_wood_01', 20, 20, 24, 24, 'rookguard-extra'),
  obj('bed_single', 21, 22, 0, 'rookguard-extra'),
  obj('chair_wood', 23, 23, 0, 'rookguard-extra'),
  obj('fireplace', 24, 21, 0, 'rookguard-extra'),
  obj('door_wood_open_south', 22, 24, 0, 'rookguard-extra'),
  obj('prop_tree', 26, 4, 0, 'rookguard-extra'),
  obj('prop_tree', 28, 6, 1, 'rookguard-extra'),
];

const HIGH_CITY_SHOWCASE_EXTRAS: RegistryWorldVisualPlacement[] = [
  // Castle keep — display-only throne room; no access or reward authority.
  ...floorPatch('floor_stone_01', 58, 3, 62, 8, 'high-city-castle'),
  obj('roof_castle_overlay', 58, 2, 0, 'high-city-castle'),
  obj('throne', 60, 7, 0, 'high-city-castle'),
  obj('weapon_rack', 58, 6, 0, 'high-city-castle'),
  obj('prison_bars', 62, 5, 0, 'high-city-castle'),
  obj('stone_column', 59, 4, 0, 'high-city-castle'),
  obj('stone_column', 61, 4, 1, 'high-city-castle'),
  obj('banner_red', 60, 4, 0, 'high-city-castle'),

  // Sewer margin — visual hazard hints only.
  ...floorPatch('floor_stone_01', 58, 54, 62, 58, 'high-city-sewer'),
  obj('sewer_grate', 59, 56, 0, 'high-city-sewer'),
  obj('sewer_pipe', 61, 55, 0, 'high-city-sewer'),
  obj('slime_pool', 60, 57, 0, 'high-city-sewer'),
  obj('slime_pool', 62, 57, 1, 'high-city-sewer'),

  // Swamp gallery — biome props from assets-src; no spawn or drop authority.
  ...floorPatch('swamp_mud', 2, 58, 8, 62, 'high-city-swamp'),
  ...floorPatch('swamp_bog_water', 3, 59, 7, 61, 'high-city-swamp'),
  obj('swamp_dead_tree', 2, 58, 0, 'high-city-swamp'),
  obj('swamp_reeds', 4, 60, 0, 'high-city-swamp'),
  obj('swamp_reeds', 6, 61, 1, 'high-city-swamp'),
  obj('swamp_mushroom', 5, 59, 0, 'high-city-swamp'),
  obj('swamp_log', 7, 60, 0, 'high-city-swamp'),
  obj('swamp_frog', 4, 61, 0, 'high-city-swamp'),
  obj('swamp_bog_slime', 6, 59, 0, 'high-city-swamp'),

  // Interior parlor demo.
  ...floorPatch('floor_wood_01', 58, 28, 62, 32, 'high-city-interior'),
  obj('bed_single', 58, 30, 1, 'high-city-interior'),
  obj('bookshelf', 62, 29, 1, 'high-city-interior'),
  obj('table_small', 60, 31, 1, 'high-city-interior'),
  obj('chest_small', 61, 30, 1, 'high-city-interior'),
  obj('chair_wood', 59, 31, 1, 'high-city-interior'),
  obj('fireplace', 62, 31, 0, 'high-city-interior'),
  obj('door_wood_open_east', 62, 30, 0, 'high-city-interior'),

  // Roof overlays on house lane.
  obj('roof_red_small_overlay', 10, 31, 0, 'high-city-roofs'),
  obj('roof_red_large_overlay', 14, 31, 0, 'high-city-roofs'),

  // Park grove.
  obj('prop_tree', 3, 44, 0, 'high-city-grove'),
  obj('prop_tree', 5, 42, 1, 'high-city-grove'),
  obj('prop_tree', 4, 46, 2, 'high-city-grove'),
];

export function fullWorldVisualLandmarksForMap(mapName: MapName): RegistryWorldVisualPlacement[] {
  const base = highCityVisualLandmarksForMap(mapName) as RegistryWorldVisualPlacement[];
  if (mapName === 'Rookguard') return [...base, ...ROOKGUARD_SHOWCASE_EXTRAS];
  if (mapName === 'Azura') return [...base, ...HIGH_CITY_SHOWCASE_EXTRAS];
  return base;
}

export function showcaseMapForZone(zone: Exclude<WorldShowcaseZone, 'atlas'>): MapData & { name: MapName } {
  return getMap(zone === 'rookguard' ? 'Rookguard' : 'Azura') as MapData & { name: MapName };
}

function presetPlayer(spriteId: CharacterSpriteId, name: string, x: number, y: number, instance = 0): PlayerPublic {
  return {
    id: `showcase:preset:${spriteId}:${instance}`,
    name,
    x,
    y,
    status: 'alive',
  };
}

const ROOKGUARD_PARADE: Array<{ spriteId: CharacterSpriteId; name: string; x: number; y: number }> = [
  { spriteId: 'base_human_male_01', name: 'Adventurer', x: 4, y: 4 },
  { spriteId: 'guard_city_01', name: 'City Guard', x: 6, y: 4 },
  { spriteId: 'mage_apprentice_01', name: 'Apprentice', x: 8, y: 4 },
  { spriteId: 'rat_small_01', name: 'Rat', x: 5, y: 6 },
  { spriteId: 'dog_01', name: 'Dog', x: 7, y: 6 },
];

const HIGH_CITY_PARADE: Array<{ spriteId: CharacterSpriteId; name: string; x: number; y: number }> = [
  { spriteId: 'castle_guard_red_01', name: 'Castle Guard', x: 31, y: 50 },
  { spriteId: 'merchant_food_01', name: 'Food Vendor', x: 33, y: 50 },
  { spriteId: 'merchant_cloth_01', name: 'Cloth Vendor', x: 35, y: 50 },
  { spriteId: 'blacksmith_01', name: 'Blacksmith', x: 37, y: 50 },
  { spriteId: 'priest_01', name: 'Priest', x: 31, y: 52 },
  { spriteId: 'noble_male_01', name: 'Noble', x: 33, y: 52 },
  { spriteId: 'sewer_worker_01', name: 'Sewer Worker', x: 35, y: 52 },
  { spriteId: 'rat_hunter_01', name: 'Rat Hunter', x: 37, y: 52 },
  { spriteId: 'skeleton_warrior_01', name: 'Skeleton', x: 32, y: 54 },
  { spriteId: 'rat_large_01', name: 'Large Rat', x: 34, y: 54 },
  { spriteId: 'diseased_rat_01', name: 'Diseased Rat', x: 36, y: 54 },
  { spriteId: 'cat_01', name: 'Cat', x: 38, y: 54 },
];

export function showcasePlayersForZone(zone: Exclude<WorldShowcaseZone, 'atlas'>): {
  me: PlayerPublic;
  others: PlayerPublic[];
} {
  const parade = zone === 'rookguard' ? ROOKGUARD_PARADE : HIGH_CITY_PARADE;
  const players = parade.map((entry, index) =>
    presetPlayer(entry.spriteId, entry.name, entry.x, entry.y, index),
  );
  return { me: players[0], others: players.slice(1) };
}

export function showcaseSpriteOverrides(players: PlayerPublic[]): Map<string, CharacterSpriteId> {
  const out = new Map<string, CharacterSpriteId>();
  for (const player of players) {
    if (!player.id.startsWith('showcase:preset:')) continue;
    const spriteId = player.id.split(':')[2] as CharacterSpriteId;
    if (spriteId in CHARACTER_SPRITES) out.set(player.id, spriteId);
  }
  return out;
}

export function showcaseFrameOverrides(players: PlayerPublic[]): Map<string, CharacterFrameOverride> {
  const directions: Direction[] = ['south', 'east', 'north', 'west'];
  const out = new Map<string, CharacterFrameOverride>();
  players.forEach((player, index) => {
    out.set(player.id, {
      direction: directions[index % directions.length],
      frameColumn: index % 2,
    });
  });
  return out;
}

export const SHOWCASE_SPRITE_COUNT = VISUAL_PRESET_SPRITE_IDS.length;