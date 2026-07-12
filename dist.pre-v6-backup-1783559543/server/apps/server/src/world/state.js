import fs from 'node:fs';
import path from 'node:path';
export function loadSharedMap(filename) {
    const mapPath = path.resolve(process.cwd(), '../../packages/shared/maps', filename);
    const raw = fs.readFileSync(mapPath, 'utf-8');
    return JSON.parse(raw);
}
export function createWorldState(map) {
    return { map, players: new Map() };
}
export function toPublicPlayer(p, includeDeadUntil = false) {
    return {
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        status: p.status ?? 'alive',
        dead_until_ms: includeDeadUntil ? p.dead_until_ms : undefined,
        hp: p.hp,
        max_hp: p.max_hp,
        reputation: p.reputation,
        sprite_id: p.sprite_id ?? null,
        // Sovereign presence (cosmetic only)
        title: p.title ?? null,
        badges: p.badges ?? [],
        mark: p.mark ?? null,
    };
}
