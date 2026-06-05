import { TileCode } from '@shared/types';
import { useImagePreloader } from './useImagePreloader';

// Classic-32 tile art served from public/tiles/. Only the tile codes that have
// committed art appear here; codes without a sprite fall back to flat color +
// glyph in MapCanvas. Art is original/CC0 32x32 pixel art; the server remains
// authoritative for walkability — these images are display-only.
const TILE_SPRITE_SRC: Partial<Record<TileCode, string>> = {
  [TileCode.Grass]: '/tiles/ground__grass.png',
  [TileCode.Stone]: '/tiles/ground__stone_floor.png',
  [TileCode.Wall]: '/tiles/structures__stone_wall.png',
  [TileCode.Water]: '/tiles/ground__water.png',
  [TileCode.Door]: '/tiles/structures__door.png',
  // Tutorial/gate tiles have no bespoke art yet. Render the walkable ground they
  // sit on — grass for the tutorial zones, stone for the gate threshold — so the
  // whole map reads as pixel art. MapCanvas still draws the glyph (M/S/T/G) and
  // the landmark markers on top to identify them.
  [TileCode.TutorialMove]: '/tiles/ground__grass.png',
  [TileCode.TutorialChat]: '/tiles/ground__grass.png',
  [TileCode.TutorialTem]: '/tiles/ground__grass.png',
  [TileCode.GateToAzura]: '/tiles/ground__stone_floor.png',
};

const TILE_SPRITE_ENTRIES = Object.entries(TILE_SPRITE_SRC).map(([code, src]) => ({
  key: Number(code),
  src: src as string,
}));

/**
 * Loads the committed Classic-32 tile sprites once and returns them keyed by
 * TileCode. `ready` increments as each image finishes loading so consumers can
 * include it in a redraw dependency list (canvas drawing is imperative, so a
 * mutable Map plus a version counter is the simplest way to trigger redraws).
 */
export function useTileSprites(): { images: Map<number, HTMLImageElement>; ready: number } {
  return useImagePreloader<number>(TILE_SPRITE_ENTRIES);
}
