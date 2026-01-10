import fs from 'node:fs';
import path from 'node:path';
import type { MapData, Player, PlayerPublic } from '../../../shared/types';

export interface WorldState {
  map: MapData;
  players: Map<string, Player>;
}

export function loadAzuraMap(): MapData {
  const mapPath = path.resolve(process.cwd(), '../shared/maps/azura.json');
  const raw = fs.readFileSync(mapPath, 'utf-8');
  return JSON.parse(raw) as MapData;
}

export function createWorldState(map: MapData): WorldState {
  return { map, players: new Map() };
}

export function toPublicPlayer(p: Player): PlayerPublic {
  return { id: p.id, name: p.name, x: p.x, y: p.y };
}

