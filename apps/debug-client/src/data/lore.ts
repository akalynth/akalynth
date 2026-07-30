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
  canal: {
    title: 'Old Canal',
    body:
      'A quiet edge of the keep where patience matters more than profit. Stand ' +
      'beside the fishing post to cast; the water promises no tradeable catch.',
  },
  guild_hall: {
    title: 'Guild Hall',
    body:
      'A civic hall for server-backed choices. In Rookguard it holds the ' +
      'starter vocation lesson; in High City it is the first place where work, ' +
      'property, and civic receipts become visible.',
  },
  plaza: {
    title: 'Central Plaza',
    body:
      'The public floor of a city. Rookguard uses it for arrival and guidance; ' +
      'High City uses it as the first open square after the gate.',
  },
  tutorial: {
    title: 'Tutorial Corridor',
    body:
      'The opening proof lane: movement, chat, and Tem checks must be completed ' +
      'before the server lets the character cross into High City.',
  },
  gate_to_azura: {
    title: 'Gate to High City',
    body:
      'The server-owned transition from Rookguard into High City. It opens only ' +
      'after the tutorial checklist is complete and records the arrival path.',
  },
  profession_hall: {
    title: 'Profession Hall',
    body:
      'The end-of-Rookguard choice point. Warden, Cantor, Hexer, and Reaver bind ' +
      'Heroes Codex roles through the existing vocation receipt.',
  },
  quest_board: {
    title: 'Quest Board',
    body:
      'A planning board for starter quests. It describes training-yard proof; ' +
      'it does not grant rewards by itself.',
  },
  training_yard: {
    title: 'Training Yard',
    body:
      'A safe yard for starter monster practice. Server mobs, hits, deaths, ' +
      'and loot stay authoritative.',
  },
  codex_arch: {
    title: 'Codex Arch',
    body:
      'A record arch beside the profession hall. Heroes, Chronicle, Factions, ' +
      'Artifacts, Dungeon, and Emberwilds shelves frame the first Codex-style choice.',
  },
  house_plots: {
    title: 'House Plot',
    body:
      'Three marked addresses wait below the Guild Hall. A plot becomes more ' +
      'than ground only when the city resolves the claim and the record holds.',
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
    title: 'High City · Azura',
    body:
      'Rookguard has opened. Ley motes glimmer on the stones nearby — gather one, ' +
      'attune it at the stand, and deliver a keystone to the curation post.',
  },
  HighCity: {
    title: 'Spawn',
    body:
      'Rookguard has opened. High City receives you at its center and asks ' +
      'what your living hand will leave behind.',
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
  tutorial: { glyph: 'T', color: '#61d8c6' },
  gate_to_azura: { glyph: 'A', color: '#9db4ff' },
  profession_hall: { glyph: 'V', color: '#e8d56f' },
  quest_board: { glyph: 'Q', color: '#e0a86b' },
  training_yard: { glyph: 'Y', color: '#d87963' },
  codex_arch: { glyph: 'C', color: '#9db4ff' },
  house_plots: { glyph: 'H', color: '#e0a86b' },
};

// Keyed by tile code. Describes the tutorial steps the server enforces.
export const TILE_LORE: Partial<Record<TileCode, LoreEntry>> = {
  [TileCode.TutorialMove]: {
    title: 'Tutorial · Move',
    body:
      'A moss-bright step rune. The tile is only a marker; the server records ' +
      'the movement lesson when your character actually crosses it.',
  },
  [TileCode.TutorialChat]: {
    title: 'Tutorial · Chat',
    body:
      'A blue speech rune for the first public signal. Stand nearby, then send ' +
      'any chat message so the server can mark the lesson.',
  },
  [TileCode.TutorialTem]: {
    title: 'Tutorial · Tem',
    body:
      'A witness-eye rune for the friendly Tem check. Pass it to continue; the ' +
      'image itself grants nothing.',
  },
  [TileCode.GateToAzura]: {
    title: 'Gate to High City',
    body:
      'A sealed threshold mark. It opens only after the server sees movement, ' +
      'chat, Tem, training, and vocation receipts.',
  },
};
