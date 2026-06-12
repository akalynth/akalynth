import type { AccountCharacterRow } from '../persist/types.js';
import { outfitById } from './catalog.js';

export type AccountCharacterRuntimeMap = 'Rookguard' | 'Azura';

export interface AccountCharacterLoginProjection {
  map: AccountCharacterRuntimeMap;
  sprite_id: string | null;
}

export function accountCharacterLoginProjection(row: AccountCharacterRow | undefined): AccountCharacterLoginProjection {
  return {
    map: row?.world_id === 'high_city' ? 'Azura' : 'Rookguard',
    sprite_id: row ? outfitById(row.outfit_id)?.sprite_id ?? null : null,
  };
}
