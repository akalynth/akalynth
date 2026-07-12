export const WORLDS = [
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
export const OUTFITS = [
    { outfit_id: 'male_wanderer', sex: 'male', name: 'Wanderer', sprite_id: 'base_human_male_01' },
    { outfit_id: 'male_guard', sex: 'male', name: 'City Guard', sprite_id: 'guard_city_01' },
    { outfit_id: 'male_mage', sex: 'male', name: 'Apprentice Mage', sprite_id: 'mage_apprentice_01' },
    // Female sprites pending E7 — entries exist so sex/outfit selection is complete.
    { outfit_id: 'female_wanderer', sex: 'female', name: 'Wanderer', sprite_id: null },
    { outfit_id: 'female_guard', sex: 'female', name: 'City Guard', sprite_id: null },
    { outfit_id: 'female_mage', sex: 'female', name: 'Apprentice Mage', sprite_id: null },
];
export const SEXES = ['male', 'female'];
export function isSex(v) {
    return v === 'male' || v === 'female';
}
export function worldById(id) {
    return WORLDS.find((w) => w.world_id === id);
}
export function outfitById(id) {
    return OUTFITS.find((o) => o.outfit_id === id);
}
export function outfitsForSex(sex) {
    return OUTFITS.filter((o) => o.sex === sex);
}
