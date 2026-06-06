import rookguard from '@shared/maps/rookguard.json';
import azura from '@shared/maps/azura.json';
import type { MapData } from '@shared/types';
import type { MapName } from '@shared/http';
import { normalizeMapName } from '@shared/http';

const maps: Record<MapName, MapData> = {
  Rookguard: rookguard,
  Azura: azura,
};

export function getMap(name: MapName | string): MapData {
  const normalized = normalizeMapName(name);
  if (!normalized) throw new Error(`Unknown map: ${name}`);
  return maps[normalized];
}

export function listMaps(): Array<{ name: MapName; width: number; height: number }> {
  return [
    { name: 'Rookguard', width: maps.Rookguard.width, height: maps.Rookguard.height },
    { name: 'Azura', width: maps.Azura.width, height: maps.Azura.height },
  ];
}
