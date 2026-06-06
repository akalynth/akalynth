// Player-facing lore for map landmarks and tutorial tiles.
//
// Display-only flavor. This data is never sent to the server and changes no
// mechanic — it mirrors the world docs (docs/WORLD_ROOKGUARD.md,
// docs/WORLD_HIGH_CITY.md) and accurately describes existing server behavior.

import { TileCode } from '@shared/types';

export interface LoreEntry {
  title: string;
  body: string;
}

// Keyed by landmark key in the map JSON (`map.landmarks`). For the
// `house_plots` array, every plot shares the array-key entry.
export const LANDMARK_LORE: Record<string, LoreEntry> = {
  runestone_table: {
    title: 'Runestone Table',
    body:
      'Step beside it and the stone exhales one element — Fire, Water, Earth, ' +
      'Air, Light, or Shadow. There is no winning face: the roll is the ' +
      "server's, witnessed by everyone nearby.",
  },
  legend_stone: {
    title: 'Legend Stone',
    body:
      'A weathered marker for the names and deeds the keep remembers — the ' +
      "first hint of the Origin Act, each player's first sealed consequence.",
  },
  guild_hall: {
    title: 'Guild Hall',
    body: 'The hall is ready before the oath is. Its doors do not open yet.',
  },
  plaza: {
    title: 'Central Plaza',
    body: 'The plaza is built for standing still: for chat, meeting, waiting, and being seen.',
  },
  house_plots: {
    title: 'House Plot',
    body:
      'Three marked plots wait below the Guild Hall. A plot becomes more than ' +
      'ground only when the city resolves the claim and the record holds.',
  },
};

// The spawn point (map.spawn) is not a landmark, so it carries its own lore,
// keyed by map name with a generic fallback for any future map.
export const SPAWN_LORE: Record<string, LoreEntry> = {
  Rookguard: {
    title: 'Spawn',
    body: 'Where every guest first wakes in Rookguard, at the head of the tutorial corridor.',
  },
  Azura: {
    title: 'Spawn',
    body:
      'Rookguard has opened. High City receives you at its center, where the ' +
      'first stones were raised and the record begins to widen.',
  },
  HighCity: {
    title: 'Spawn',
    body:
      'Rookguard has opened. High City receives you at its center, where the ' +
      'first stones were raised and the record begins to widen.',
  },
};

export const DEFAULT_SPAWN_LORE: LoreEntry = {
  title: 'Spawn',
  body: 'Where players enter this map.',
};

export function spawnLore(mapName: string): LoreEntry {
  return SPAWN_LORE[mapName] ?? DEFAULT_SPAWN_LORE;
}

// Marker glyph + color for the spawn point.
export const SPAWN_MARKER = { glyph: '★', color: '#8ec6ff' };

// Visible map markers for landmarks, keyed by landmark key. A marker makes the
// landmark (and its tooltip) discoverable; multi-tile landmarks get one pin
// centered on the box, arrays (house_plots) get one pin per entry.
export const LANDMARK_MARKERS: Record<string, { glyph: string; color: string }> = {
  runestone_table: { glyph: 'R', color: '#f0c83c' },
  legend_stone: { glyph: '!', color: '#61d8c6' },
  guild_hall: { glyph: 'G', color: '#c98bdb' },
  plaza: { glyph: 'P', color: '#7fd1a6' },
  house_plots: { glyph: 'H', color: '#e0a86b' },
};

// Keyed by tile code. Describes the tutorial steps the server enforces.
export const TILE_LORE: Partial<Record<TileCode, LoreEntry>> = {
  [TileCode.TutorialMove]: {
    title: 'Tutorial · Move',
    body: 'Step here to complete the movement lesson.',
  },
  [TileCode.TutorialChat]: {
    title: 'Tutorial · Chat',
    body: 'Stand nearby, then send any chat message.',
  },
  [TileCode.TutorialTem]: {
    title: 'Tutorial · Tem',
    body: 'A friendly Tem challenge. Pass it to continue.',
  },
  [TileCode.GateToAzura]: {
    title: 'Gate to High City',
    body: 'Opens once the tutorial checklist is complete. Step through to enter High City.',
  },
};
