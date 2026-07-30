import type { AccountCharacterRow } from '../persist/types.js';
import { outfitById } from './catalog.js';

export type AccountCharacterRuntimeMap = 'Rookguard' | 'Azura';

export interface AccountCharacterLoginProjection {
  map: AccountCharacterRuntimeMap;
  sprite_id: string | null;
}

export function accountCharacterLoginProjection(row: AccountCharacterRow | undefined): AccountCharacterLoginProjection {
  return {
    // world_id is a destination affinity, not permission to bypass the
    // receipt-backed Rookguard opening. index.ts promotes a returning
    // character to Azura only after tutorial completion has been replayed.
    map: 'Rookguard',
    sprite_id: row ? outfitById(row.outfit_id)?.sprite_id ?? null : null,
  };
}
