// Player-facing lore for map landmarks and tutorial tiles.
//
// Display-only flavor. This data is never sent to the server and changes no
// mechanic — it mirrors the world docs (docs/WORLD_ROOKGUARD.md,
// docs/WORLD_AZURA.md) and accurately describes existing server behavior.

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
    body: 'A hall raised before there were guilds to fill it. The doors do not open yet.',
  },
  plaza: {
    title: 'Central Plaza',
    body:
      'The heart of the city and its gathering ground — built for standing ' +
      'still: chat, meeting, waiting.',
  },
  house_plots: {
    title: 'House Plot',
    body: 'A marked plot just below the Guild Hall, waiting for an owner.',
  },
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
    title: 'Gate to Azura',
    body: 'Opens once the tutorial checklist is complete. Step through to enter Azura.',
  },
};
