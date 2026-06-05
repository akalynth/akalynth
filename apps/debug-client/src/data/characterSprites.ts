import baseHumanMaleSheet from '../../../../data/assets-src/sprites/characters/base_human_male_01.png?url';
import guardCitySheet from '../../../../data/assets-src/sprites/characters/guard_city_01.png?url';
import mageApprenticeSheet from '../../../../data/assets-src/sprites/characters/mage_apprentice_01.png?url';
import skeletonWarriorSheet from '../../../../data/assets-src/sprites/characters/skeleton_warrior_01.png?url';
import castleGuardRedSheet from '../../../../data/assets-src/sprites/characters/castle_guard_red_01.png?url';
import merchantFoodSheet from '../../../../data/assets-src/sprites/characters/merchant_food_01.png?url';
import merchantClothSheet from '../../../../data/assets-src/sprites/characters/merchant_cloth_01.png?url';
import blacksmithSheet from '../../../../data/assets-src/sprites/characters/blacksmith_01.png?url';
import priestSheet from '../../../../data/assets-src/sprites/characters/priest_01.png?url';
import nobleMaleSheet from '../../../../data/assets-src/sprites/characters/noble_male_01.png?url';
import sewerWorkerSheet from '../../../../data/assets-src/sprites/characters/sewer_worker_01.png?url';
import ratHunterSheet from '../../../../data/assets-src/sprites/characters/rat_hunter_01.png?url';
import ratSmallSheet from '../../../../data/assets-src/sprites/creatures/rat_small_01.png?url';
import ratLargeSheet from '../../../../data/assets-src/sprites/creatures/rat_large_01.png?url';
import diseasedRatSheet from '../../../../data/assets-src/sprites/creatures/diseased_rat_01.png?url';
import dogSheet from '../../../../data/assets-src/sprites/creatures/dog_01.png?url';
import catSheet from '../../../../data/assets-src/sprites/creatures/cat_01.png?url';

export type Direction = 'south' | 'north' | 'east' | 'west';

export type SmokeTestCharacterId =
  'base_human_male_01'
  | 'guard_city_01'
  | 'mage_apprentice_01'
  | 'skeleton_warrior_01';

export type NpcVisualPresetId =
  'castle_guard_red_01'
  | 'merchant_food_01'
  | 'merchant_cloth_01'
  | 'blacksmith_01'
  | 'priest_01'
  | 'noble_male_01'
  | 'sewer_worker_01'
  | 'rat_hunter_01';

export type CreatureVisualPresetId =
  'rat_small_01'
  | 'rat_large_01'
  | 'diseased_rat_01'
  | 'dog_01'
  | 'cat_01';

export type CharacterSpriteId = SmokeTestCharacterId | NpcVisualPresetId | CreatureVisualPresetId;
export type SpriteAssetType = 'character' | 'creature';

export const DIRECTION_ROW: Record<Direction, number> = {
  south: 0,
  north: 1,
  east: 2,
  west: 3,
};

export const FRAME_SIZE = 64;
export const FEET_ANCHOR = { x: 32, y: 54 } as const;

export interface CharacterSpriteDef {
  id: CharacterSpriteId;
  assetType: SpriteAssetType;
  src: string;
  displayOnly: true;
}

export const SMOKE_TEST_CHARACTER_IDS: SmokeTestCharacterId[] = [
  'base_human_male_01',
  'guard_city_01',
  'mage_apprentice_01',
  'skeleton_warrior_01',
];

export const NPC_VISUAL_PRESET_IDS: NpcVisualPresetId[] = [
  'castle_guard_red_01',
  'merchant_food_01',
  'merchant_cloth_01',
  'blacksmith_01',
  'priest_01',
  'noble_male_01',
  'sewer_worker_01',
  'rat_hunter_01',
];

export const CREATURE_VISUAL_PRESET_IDS: CreatureVisualPresetId[] = [
  'rat_small_01',
  'rat_large_01',
  'diseased_rat_01',
  'dog_01',
  'cat_01',
];

export const VISUAL_PRESET_SPRITE_IDS: CharacterSpriteId[] = [
  ...SMOKE_TEST_CHARACTER_IDS,
  ...NPC_VISUAL_PRESET_IDS,
  ...CREATURE_VISUAL_PRESET_IDS,
];

export const CHARACTER_SPRITES: Record<CharacterSpriteId, CharacterSpriteDef> = {
  base_human_male_01: { id: 'base_human_male_01', assetType: 'character', src: baseHumanMaleSheet, displayOnly: true },
  guard_city_01: { id: 'guard_city_01', assetType: 'character', src: guardCitySheet, displayOnly: true },
  mage_apprentice_01: { id: 'mage_apprentice_01', assetType: 'character', src: mageApprenticeSheet, displayOnly: true },
  skeleton_warrior_01: { id: 'skeleton_warrior_01', assetType: 'character', src: skeletonWarriorSheet, displayOnly: true },
  castle_guard_red_01: { id: 'castle_guard_red_01', assetType: 'character', src: castleGuardRedSheet, displayOnly: true },
  merchant_food_01: { id: 'merchant_food_01', assetType: 'character', src: merchantFoodSheet, displayOnly: true },
  merchant_cloth_01: { id: 'merchant_cloth_01', assetType: 'character', src: merchantClothSheet, displayOnly: true },
  blacksmith_01: { id: 'blacksmith_01', assetType: 'character', src: blacksmithSheet, displayOnly: true },
  priest_01: { id: 'priest_01', assetType: 'character', src: priestSheet, displayOnly: true },
  noble_male_01: { id: 'noble_male_01', assetType: 'character', src: nobleMaleSheet, displayOnly: true },
  sewer_worker_01: { id: 'sewer_worker_01', assetType: 'character', src: sewerWorkerSheet, displayOnly: true },
  rat_hunter_01: { id: 'rat_hunter_01', assetType: 'character', src: ratHunterSheet, displayOnly: true },
  rat_small_01: { id: 'rat_small_01', assetType: 'creature', src: ratSmallSheet, displayOnly: true },
  rat_large_01: { id: 'rat_large_01', assetType: 'creature', src: ratLargeSheet, displayOnly: true },
  diseased_rat_01: { id: 'diseased_rat_01', assetType: 'creature', src: diseasedRatSheet, displayOnly: true },
  dog_01: { id: 'dog_01', assetType: 'creature', src: dogSheet, displayOnly: true },
  cat_01: { id: 'cat_01', assetType: 'creature', src: catSheet, displayOnly: true },
};

export function characterSpriteById(id: CharacterSpriteId): CharacterSpriteDef {
  return CHARACTER_SPRITES[id];
}

export function characterSpriteForPlayer(playerId: string, isSelf: boolean): CharacterSpriteDef {
  if (isSelf) return CHARACTER_SPRITES.base_human_male_01;
  let hash = 0;
  for (let i = 0; i < playerId.length; i += 1) {
    hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0;
  }
  return CHARACTER_SPRITES[SMOKE_TEST_CHARACTER_IDS[hash % SMOKE_TEST_CHARACTER_IDS.length]];
}
