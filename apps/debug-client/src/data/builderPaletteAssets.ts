// Builder palette thumbnails — reuse public site + codex plates (A1).
import rookguardThumb from '../../../../../akalynth-site/assets/akalynth/visuals/thumbs/02-rookguard-gate.thumb-480x720.webp';
import gameLoopPoster from '../../../../../akalynth-codex/assets/out/akalynth-game-loop-bible-poster-v1.png';

export const BUILDER_PALETTE_ASSETS = {
  sign: rookguardThumb,
  runestone: rookguardThumb,
  clue_shard: rookguardThumb,
  vocation_lectern: rookguardThumb,
  spawn_anchor: rookguardThumb,
  'builder-surface-hero': gameLoopPoster,
} as const;

export type BuilderPaletteAssetId = keyof typeof BUILDER_PALETTE_ASSETS;

export function resolvePaletteIcon(id: string): string | undefined {
  if (id in BUILDER_PALETTE_ASSETS) {
    return BUILDER_PALETTE_ASSETS[id as BuilderPaletteAssetId];
  }
  return undefined;
}