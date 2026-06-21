import { REGISTRY_WORLD_VISUAL_ASSETS, type RegistryWorldVisualAssetId } from '../data/worldVisualRegistry';
import { useImagePreloader } from './useImagePreloader';

const WORLD_VISUAL_ENTRIES = Object.values(REGISTRY_WORLD_VISUAL_ASSETS).map((def) => ({
  key: def.id as RegistryWorldVisualAssetId,
  src: def.src,
}));

export function useWorldVisualAssets(): { images: Map<RegistryWorldVisualAssetId, HTMLImageElement>; ready: number } {
  return useImagePreloader<RegistryWorldVisualAssetId>(WORLD_VISUAL_ENTRIES);
}
