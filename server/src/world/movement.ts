import type { Direction, MapData, Player, Position } from '../../../shared/types.js';
import { DIRECTION_OFFSETS, WALKABLE_TILES } from '../../../shared/types.js';

export type MoveRejectReason = 'tile_blocked' | 'out_of_bounds';

export interface MoveResult {
  ok: boolean;
  x: number;
  y: number;
  reason: MoveRejectReason | null;
}

export function indexFor(map: MapData, pos: Position): number {
  return pos.y * map.width + pos.x;
}

export function isWalkable(map: MapData, pos: Position): boolean {
  if (pos.x < 0 || pos.y < 0 || pos.x >= map.width || pos.y >= map.height) return false;
  const tile = map.tiles[indexFor(map, pos)];
  return WALKABLE_TILES.has(tile);
}

export function tryMove(map: MapData, player: Player, direction: Direction): MoveResult {
  const off = DIRECTION_OFFSETS[direction];
  const next: Position = { x: player.x + off.x, y: player.y + off.y };

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

