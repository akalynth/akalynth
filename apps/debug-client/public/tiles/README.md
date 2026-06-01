# Classic-32 tile sprites (display-only)

32x32 pixel-art tiles served at `/tiles/*.png` and drawn by
`src/components/MapCanvas.tsx` via `src/hooks/useTileSprites.ts`.

- **Display-only.** These images never decide gameplay. Walkability,
  collision, and interaction are server-authoritative (see
  `packages/shared/types.ts` `WALKABLE_TILES` and the server movement logic).
- **Coverage.** Only tile codes with committed art are mapped: Grass, Stone,
  Wall, Water, Door. Tutorial/gate codes (5-8) have no sprite yet and fall back
  to flat color + glyph in `MapCanvas`.
- **Source.** Original Akalynth Classic-32 art (see
  `docs/CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md`). When adding tiles from
  external packs, use only CC0 / CC-BY sources and record attribution here.

To add a tile: drop `<base>__<name>.png` here and map its TileCode in
`useTileSprites.ts`.
