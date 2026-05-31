import { useEffect, useRef, useState } from 'react';
import { TileCode } from '@shared/types';

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
};

/**
 * Loads the committed Classic-32 tile sprites once and returns them keyed by
 * TileCode. `ready` increments as each image finishes loading so consumers can
 * include it in a redraw dependency list (canvas drawing is imperative, so a
 * mutable Map plus a version counter is the simplest way to trigger redraws).
 */
export function useTileSprites(): { images: Map<number, HTMLImageElement>; ready: number } {
  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const [ready, setReady] = useState(0);

  useEffect(() => {
    let cancelled = false;
    for (const [code, src] of Object.entries(TILE_SPRITE_SRC)) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        imagesRef.current.set(Number(code), img);
        setReady((n) => n + 1);
      };
      img.src = src;
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return { images: imagesRef.current, ready };
}
