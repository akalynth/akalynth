import fs from 'node:fs';
import path from 'node:path';
import type { MapData, Player, PlayerPublic } from '../../../../packages/shared/types.js';

export interface WorldState {
  map: MapData;
  players: Map<string, Player>;
}

export function loadSharedMap(filename: string): MapData {
  const mapPath = path.resolve(process.cwd(), '../../packages/shared/maps', filename);
  const raw = fs.readFileSync(mapPath, 'utf-8');
  return JSON.parse(raw) as MapData;
}

export function createWorldState(map: MapData): WorldState {
  return { map, players: new Map() };
}

export function toPublicPlayer(p: Player, includeDeadUntil = false): PlayerPublic {
  return {
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    status: p.status ?? 'alive',
    dead_until_ms: includeDeadUntil ? p.dead_until_ms : undefined,
    reputation: p.reputation,
    // Sovereign presence (cosmetic only)
    title: p.title ?? null,
    badges: p.badges ?? [],
    mark: p.mark ?? null,
  };
}
