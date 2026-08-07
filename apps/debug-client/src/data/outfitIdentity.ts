/**
 * Client-side outfit → world sprite identity lock.
 * Must stay aligned with apps/server/src/character/catalog.ts OUTFITS.
 *
 * Contract: CLIENT_PLAY_SURFACE_CONTRACT_V1 §2.6
 * - Catalog outfit_id maps to the same protocol sprite_id the world uses for self.
 * - When server sprite_id is null (art pending), use a labeled fallback sprite for
 *   create preview only — never a different outfit's identity without labeling.
 */

import type { CharacterSex } from '../types';
import { type CharacterSpriteId, isCharacterSpriteId } from './characterSprites';

export interface OutfitIdentity {
  outfitId: string;
  sex: CharacterSex;
  /** Player-facing outfit name (server catalog). */
  name: string;
  /**
   * Protocol / world sprite_id when art exists.
   * null = server catalog has no sprite yet (female E7 pending).
   */
  protocolSpriteId: string | null;
  /**
   * Bundled PNG sheet for create preview / local draw when protocol sprite is null
   * or not yet in the client atlas. Must not be presented as a different outfit.
   */
  bundledSpriteId: CharacterSpriteId;
  /** True when bundledSpriteId is a temporary stand-in, not the final art. */
  fallbackArt: boolean;
}

/** Single table — create preview, identity strip, and audits all use this. */
export const OUTFIT_IDENTITY_TABLE: OutfitIdentity[] = [
  {
    outfitId: 'male_wanderer',
    sex: 'male',
    name: 'Wanderer',
    protocolSpriteId: 'base_human_male_01',
    bundledSpriteId: 'base_human_male_01',
    fallbackArt: false,
  },
  {
    outfitId: 'male_guard',
    sex: 'male',
    name: 'City Guard',
    protocolSpriteId: 'guard_city_01',
    bundledSpriteId: 'guard_city_01',
    fallbackArt: false,
  },
  {
    outfitId: 'male_mage',
    sex: 'male',
    name: 'Apprentice Mage',
    protocolSpriteId: 'mage_apprentice_01',
    bundledSpriteId: 'mage_apprentice_01',
    fallbackArt: false,
  },
  {
    outfitId: 'female_wanderer',
    sex: 'female',
    name: 'Wanderer',
    protocolSpriteId: null,
    // Pending E7; preview uses male sheet as labeled stand-in (spriteLabel remains female id).
    bundledSpriteId: 'base_human_male_01',
    fallbackArt: true,
  },
  {
    outfitId: 'female_guard',
    sex: 'female',
    name: 'City Guard',
    protocolSpriteId: null,
    bundledSpriteId: 'guard_city_01',
    fallbackArt: true,
  },
  {
    outfitId: 'female_mage',
    sex: 'female',
    name: 'Apprentice Mage',
    protocolSpriteId: null,
    bundledSpriteId: 'mage_apprentice_01',
    fallbackArt: true,
  },
];

const DEFAULT_OUTFIT: Record<CharacterSex, string> = {
  male: 'male_wanderer',
  female: 'female_wanderer',
};

export function defaultOutfitIdForSex(sex: CharacterSex): string {
  return DEFAULT_OUTFIT[sex];
}

export function outfitIdentityById(outfitId: string): OutfitIdentity | undefined {
  return OUTFIT_IDENTITY_TABLE.find((o) => o.outfitId === outfitId);
}

export function resolveOutfitIdentity(outfitId: string, sex: CharacterSex): OutfitIdentity {
  return (
    outfitIdentityById(outfitId) ??
    outfitIdentityById(defaultOutfitIdForSex(sex)) ??
    OUTFIT_IDENTITY_TABLE[0]
  );
}

/** Protocol/world sprite id for an outfit (null if art pending). */
export function protocolSpriteForOutfit(outfitId: string): string | null {
  return outfitIdentityById(outfitId)?.protocolSpriteId ?? null;
}

/**
 * Label for identity strip from world sprite_id (authoritative after enter world)
 * or outfit_id fallback.
 */
export function identityLabel(input: {
  name?: string | null;
  outfitId?: string | null;
  spriteId?: string | null;
}): string {
  const parts: string[] = [];
  if (input.name && input.name.trim()) parts.push(input.name.trim());
  if (input.outfitId) {
    const id = outfitIdentityById(input.outfitId);
    if (id) {
      const art = id.fallbackArt ? `${id.name} (preview art)` : id.name;
      parts.push(art);
    } else {
      parts.push(input.outfitId);
    }
  } else if (input.spriteId) {
    const bySprite = OUTFIT_IDENTITY_TABLE.find(
      (o) => o.protocolSpriteId === input.spriteId || o.bundledSpriteId === input.spriteId,
    );
    parts.push(bySprite ? bySprite.name : input.spriteId);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Adventurer';
}

/** Bundled sheet for create preview — never throws. */
export function bundledSpriteForOutfit(outfitId: string, sex: CharacterSex): CharacterSpriteId {
  const id = resolveOutfitIdentity(outfitId, sex).bundledSpriteId;
  return isCharacterSpriteId(id) ? id : 'base_human_male_01';
}

/**
 * Expected world sprite after create for male catalog outfits (non-null protocol sprites).
 * Female catalog returns null protocol sprite (server truth) — client must not invent female art as final.
 */
export function expectedWorldSpriteId(outfitId: string): string | null {
  return protocolSpriteForOutfit(outfitId);
}
