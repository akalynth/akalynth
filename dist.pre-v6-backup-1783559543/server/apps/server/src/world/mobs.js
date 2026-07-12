// Akalynth Mob System v0 — Static training mobs
// Mobs appear in nearby_players as PlayerPublic (id prefix 'mob:').
// Server-authoritative HP. Players attack via existing attack_intent.
// No AI, no movement. Respawn after fixed delay.
// ============================================================================
// Definitions
// ============================================================================
const ROOKGUARD_TRAINING_SLIME_SPRITE_ID = 'akalynth_creature_rookguard_training_slime_001';
const MOB_DEFS = [
    {
        mob_type: 'training_slime',
        display_name: 'Training Slime',
        max_hp: 3,
        map: 'Rookguard',
        x: 14,
        y: 14,
        sprite_id: ROOKGUARD_TRAINING_SLIME_SPRITE_ID,
        respawn_ms: 30_000,
    },
    {
        mob_type: 'city_rat',
        display_name: 'City Rat',
        max_hp: 5,
        map: 'Azura',
        x: 40,
        y: 20,
        respawn_ms: 45_000,
    },
];
// ============================================================================
// State
// ============================================================================
const mobsByMap = new Map();
export function initMobs() {
    for (const def of MOB_DEFS) {
        if (!mobsByMap.has(def.map))
            mobsByMap.set(def.map, new Map());
        const mob = {
            mob_id: `mob:${def.mob_type}`,
            def,
            hp: def.max_hp,
            dead_until_ms: null,
        };
        mobsByMap.get(def.map).set(mob.mob_id, mob);
    }
}
// ============================================================================
// Queries
// ============================================================================
export function getAliveMobsForMap(map) {
    const mobs = mobsByMap.get(map);
    if (!mobs)
        return [];
    return Array.from(mobs.values()).filter(m => m.dead_until_ms === null);
}
// All mobs on a map (alive and dead corpses awaiting respawn).
export function getMobsForMap(map) {
    const mobs = mobsByMap.get(map);
    if (!mobs)
        return [];
    return Array.from(mobs.values());
}
export function getMobById(mobId) {
    for (const mobs of mobsByMap.values()) {
        const mob = mobs.get(mobId);
        if (mob)
            return mob;
    }
    return null;
}
export function mobToPublicPlayer(mob) {
    if (mob.dead_until_ms !== null) {
        const secs = Math.max(0, Math.ceil((mob.dead_until_ms - Date.now()) / 1000));
        return {
            id: mob.mob_id,
            name: `${mob.def.display_name} ☠ ${secs}s`,
            x: mob.def.x,
            y: mob.def.y,
            status: 'dead',
            sprite_id: mob.def.sprite_id ?? null,
            badges: ['mob'],
            mark: 'training_mob',
        };
    }
    const hpStr = `${'♥'.repeat(mob.hp)}${'·'.repeat(Math.max(0, mob.def.max_hp - mob.hp))}`;
    return {
        id: mob.mob_id,
        name: `${mob.def.display_name} ${hpStr}`,
        x: mob.def.x,
        y: mob.def.y,
        status: 'alive',
        sprite_id: mob.def.sprite_id ?? null,
        badges: ['mob'],
        mark: 'training_mob',
    };
}
// ============================================================================
// Mutation
// ============================================================================
export function hitMob(mobId, damage) {
    for (const mobs of mobsByMap.values()) {
        const mob = mobs.get(mobId);
        if (!mob)
            continue;
        if (mob.dead_until_ms !== null)
            return null; // already dead
        mob.hp = Math.max(0, mob.hp - damage);
        if (mob.hp === 0) {
            mob.dead_until_ms = Date.now() + mob.def.respawn_ms;
        }
        return { dead: mob.hp === 0, hp: mob.hp, mob };
    }
    return null;
}
export function tickMobRespawns() {
    const now = Date.now();
    const revived = [];
    for (const mobs of mobsByMap.values()) {
        for (const mob of mobs.values()) {
            if (mob.dead_until_ms !== null && now >= mob.dead_until_ms) {
                mob.hp = mob.def.max_hp;
                mob.dead_until_ms = null;
                revived.push(mob);
            }
        }
    }
    return revived;
}
/**
 * Spawn one mob-loot world item and emit its `item_minted` receipt.
 *
 * Emitting `item_minted` (instead of the old `mob_loot_spawned`) triggers the
 * existing `handleItemMinted` materializer, which runs
 * `INSERT OR IGNORE INTO items (item_id, item_type, created_at, genesis_receipt, meta_json)`.
 * This means mob-loot items gain a durable `items` DB row at spawn time — before
 * any pickup — matching how shop and legendary items work.
 *
 * The item_id is DERIVED from the receipt hash (the same convention as
 * `item_minted` shop/legendary mints, see persist/materializers `generateItemId`)
 * — NOT from wall-clock time. This makes the id deterministic, replay-safe, and
 * unique per spawn (each receipt's content differs, so each hash differs). Because
 * the id is derived from the hash, the receipt body must NOT carry `item_id`
 * (that would be a hash cycle).
 *
 * Pure: it writes a receipt and returns the derived loot; the caller is
 * responsible for placing the world item and broadcasting it.
 */
export function spawnMobLoot(attackerId, itemType, map, x, y, deps) {
    const meta = deps.meta ?? null;
    const receipt = deps.writeReceipt({
        player_id: attackerId,
        action: 'item_minted',
        inputs: { item_type: itemType, meta, map, x, y },
        result: 'ok',
    });
    const itemId = deps.generateItemId(deps.computeReceiptHash(receipt));
    return { itemId, itemType, map, x, y, meta: meta ?? undefined };
}
