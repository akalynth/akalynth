/**
 * Character create preview — thin adapter over outfitIdentity (single mapping table).
 * Keeps PR-025 export surface stable for verifiers.
 */
import type { CharacterSex } from '../types';
import { type CharacterSpriteId, isCharacterSpriteId } from './characterSprites';
import {
  defaultOutfitIdForSex,
  resolveOutfitIdentity,
  type OutfitIdentity,
} from './outfitIdentity';

export interface CharacterOutfitPreview {
  outfitId: string;
  sex: CharacterSex;
  /** Registry / protocol sprite label shown under preview (may lack bundled PNG). */
  spriteLabel: string;
  /** Bundled sheet id used when PNG exists under characterSprites. */
  bundledSpriteId: CharacterSpriteId;
}

function toPreview(entry: OutfitIdentity): CharacterOutfitPreview {
  return {
    outfitId: entry.outfitId,
    sex: entry.sex,
    // Prefer protocol id when set; else the pending female art label used historically.
    spriteLabel:
      entry.protocolSpriteId ??
      (entry.sex === 'female' && entry.outfitId.includes('wanderer')
        ? 'base_human_female_01'
        : entry.sex === 'female' && entry.outfitId.includes('guard')
          ? 'guard_city_female_01'
          : entry.sex === 'female'
            ? 'mage_apprentice_female_01'
            : entry.bundledSpriteId),
    bundledSpriteId: entry.bundledSpriteId,
  };
}

/** @deprecated Prefer OUTFIT_IDENTITY_TABLE — retained for verify-character-create-preview. */
export const OUTFIT_PREVIEW: CharacterOutfitPreview[] = [
  toPreview(resolveOutfitIdentity('male_wanderer', 'male')),
  toPreview(resolveOutfitIdentity('male_guard', 'male')),
  toPreview(resolveOutfitIdentity('male_mage', 'male')),
  toPreview(resolveOutfitIdentity('female_wanderer', 'female')),
  toPreview(resolveOutfitIdentity('female_guard', 'female')),
  toPreview(resolveOutfitIdentity('female_mage', 'female')),
];

export { defaultOutfitIdForSex };

export function resolveOutfitPreview(outfitId: string, sex: CharacterSex): CharacterOutfitPreview {
  return toPreview(resolveOutfitIdentity(outfitId, sex));
}

export function isKnownCreateOutfitId(id: string): boolean {
  return OUTFIT_PREVIEW.some((entry) => entry.outfitId === id);
}

export function bundledSpriteForPreview(outfitId: string, sex: CharacterSex): CharacterSpriteId {
  const preview = resolveOutfitPreview(outfitId, sex);
  return isCharacterSpriteId(preview.bundledSpriteId) ? preview.bundledSpriteId : 'base_human_male_01';
}
