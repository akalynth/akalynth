import type { CharacterSex } from '../types';
import { type CharacterSpriteId, isCharacterSpriteId } from './characterSprites';

export interface CharacterOutfitPreview {
  outfitId: string;
  sex: CharacterSex;
  /** Registry / protocol sprite label shown under preview (may lack bundled PNG). */
  spriteLabel: string;
  /** Bundled sheet id used when PNG exists under characterSprites. */
  bundledSpriteId: CharacterSpriteId;
}

const OUTFIT_PREVIEW: CharacterOutfitPreview[] = [
  { outfitId: 'male_wanderer', sex: 'male', spriteLabel: 'base_human_male_01', bundledSpriteId: 'base_human_male_01' },
  { outfitId: 'male_guard', sex: 'male', spriteLabel: 'guard_city_01', bundledSpriteId: 'guard_city_01' },
  { outfitId: 'male_mage', sex: 'male', spriteLabel: 'mage_apprentice_01', bundledSpriteId: 'mage_apprentice_01' },
  { outfitId: 'female_wanderer', sex: 'female', spriteLabel: 'base_human_female_01', bundledSpriteId: 'base_human_male_01' },
  { outfitId: 'female_guard', sex: 'female', spriteLabel: 'guard_city_female_01', bundledSpriteId: 'guard_city_01' },
  { outfitId: 'female_mage', sex: 'female', spriteLabel: 'mage_apprentice_female_01', bundledSpriteId: 'mage_apprentice_01' },
];

const DEFAULT_OUTFIT: Record<CharacterSex, string> = {
  male: 'male_wanderer',
  female: 'female_wanderer',
};

export function defaultOutfitIdForSex(sex: CharacterSex): string {
  return DEFAULT_OUTFIT[sex];
}

export function resolveOutfitPreview(outfitId: string, sex: CharacterSex): CharacterOutfitPreview {
  const match =
    OUTFIT_PREVIEW.find((entry) => entry.outfitId === outfitId) ??
    OUTFIT_PREVIEW.find((entry) => entry.outfitId === defaultOutfitIdForSex(sex));
  if (match) return match;
  return {
    outfitId,
    sex,
    spriteLabel: 'base_human_male_01',
    bundledSpriteId: 'base_human_male_01',
  };
}

export function isKnownCreateOutfitId(id: string): boolean {
  return OUTFIT_PREVIEW.some((entry) => entry.outfitId === id);
}

export function bundledSpriteForPreview(outfitId: string, sex: CharacterSex): CharacterSpriteId {
  const preview = resolveOutfitPreview(outfitId, sex);
  return isCharacterSpriteId(preview.bundledSpriteId) ? preview.bundledSpriteId : 'base_human_male_01';
}