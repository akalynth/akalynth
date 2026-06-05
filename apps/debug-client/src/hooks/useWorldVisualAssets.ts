import { WORLD_VISUAL_ASSETS, type WorldVisualAssetId } from '../data/worldVisualAssets';
import { useImagePreloader } from './useImagePreloader';

const WORLD_VISUAL_ENTRIES = Object.values(WORLD_VISUAL_ASSETS).map((def) => ({
  key: def.id,
  src: def.src,
}));

export function useWorldVisualAssets(): { images: Map<WorldVisualAssetId, HTMLImageElement>; ready: number } {
  return useImagePreloader<WorldVisualAssetId>(WORLD_VISUAL_ENTRIES);
}
