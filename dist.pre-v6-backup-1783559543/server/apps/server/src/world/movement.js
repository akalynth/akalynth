import { DIRECTION_OFFSETS, WALKABLE_TILES } from '../../../../packages/shared/types.js';
export function indexFor(map, pos) {
    return pos.y * map.width + pos.x;
}
export function isWalkable(map, pos) {
    if (pos.x < 0 || pos.y < 0 || pos.x >= map.width || pos.y >= map.height)
        return false;
    const tile = map.tiles[indexFor(map, pos)];
    return WALKABLE_TILES.has(tile);
}
export function tryMove(map, player, direction) {
    const off = DIRECTION_OFFSETS[direction];
    const next = { x: player.x + off.x, y: player.y + off.y };
    if (next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height) {
        return { ok: false, x: player.x, y: player.y, reason: 'out_of_bounds' };
    }
    if (!isWalkable(map, next)) {
        return { ok: false, x: player.x, y: player.y, reason: 'tile_blocked' };
    }
    player.x = next.x;
    player.y = next.y;
    return { ok: true, x: player.x, y: player.y, reason: null };
}
