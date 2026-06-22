// Builder palette thumbnails — vendored for lane builds (A1).
import rookguardThumb from '../assets/builder/rookguard-gate.thumb.webp';
import gameLoopPoster from '../assets/builder/game-loop-poster-v1.png';

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