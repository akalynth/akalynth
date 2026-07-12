import { outfitById } from './catalog.js';
export function accountCharacterLoginProjection(row) {
    return {
        map: row?.world_id === 'high_city' ? 'Azura' : 'Rookguard',
        sprite_id: row ? outfitById(row.outfit_id)?.sprite_id ?? null : null,
    };
}
