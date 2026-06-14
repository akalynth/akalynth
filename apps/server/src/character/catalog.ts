// Server-owned world + outfit catalogs (E4). Web, Android, and the game client
// all read these so they agree on options. V1 uses discrete full sprites per the
// product decision; female sprites are PENDING the E7 art lane (sprite_id: null),
// but the catalog entries exist so the create flow is complete end to end.
import type { CharacterSex } from '../persist/types.js';

export interface WorldOption {
  world_id: string;
  name: string;
  description: string;
  tagline: string;
  districts: string[];
}

export const WORLDS: WorldOption[] = [
  {
    world_id: 'rookguard',
    name: 'Rookguard',
    tagline: 'Threshold keep',
    description: 'The threshold keep where every journey begins.',
    districts: ['Plaza', 'Training Yard', 'Guild Hall', 'Canal'],
  },
  {
    world_id: 'high_city',
    name: 'High City',
    tagline: 'First planned city',
    description: 'The city of plazas, halls, and landmarks beyond the gate.',
    districts: ['Market Spine', 'Temple Steps', 'Craft Quarter', 'House Rows'],
  },
];

export interface OutfitOption {
  outfit_id: string;
  sex: CharacterSex;
  name: string;
  /** Character sprite to render. null = art pending (E7 discrete full sprites). */
  sprite_id: string | null;
}

export const OUTFITS: OutfitOption[] = [
  { outfit_id: 'male_wanderer', sex: 'male', name: 'Wanderer', sprite_id: 'base_human_male_01' },
  { outfit_id: 'male_guard', sex: 'male', name: 'City Guard', sprite_id: 'guard_city_01' },
  { outfit_id: 'male_mage', sex: 'male', name: 'Apprentice Mage', sprite_id: 'mage_apprentice_01' },
  // Female sprites pending E7 — entries exist so sex/outfit selection is complete.
  { outfit_id: 'female_wanderer', sex: 'female', name: 'Wanderer', sprite_id: null },
  { outfit_id: 'female_guard', sex: 'female', name: 'City Guard', sprite_id: null },
  { outfit_id: 'female_mage', sex: 'female', name: 'Apprentice Mage', sprite_id: null },
];

export const SEXES: CharacterSex[] = ['male', 'female'];

export function isSex(v: unknown): v is CharacterSex {
  return v === 'male' || v === 'female';
}
export function worldById(id: string): WorldOption | undefined {
  return WORLDS.find((w) => w.world_id === id);
}
export function outfitById(id: string): OutfitOption | undefined {
  return OUTFITS.find((o) => o.outfit_id === id);
}
export function outfitsForSex(sex: CharacterSex): OutfitOption[] {
  return OUTFITS.filter((o) => o.sex === sex);
}
