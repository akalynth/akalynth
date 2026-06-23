import { EXTENDED_WORLD_VISUAL_ASSETS, type ExtendedWorldVisualAssetId } from './extendedWorldVisualAssets';
import { HIGH_CITY_WORLD_VISUAL_ASSETS, type HighCityWorldVisualAssetId } from './highCityWorldVisualAssets';
import {
  WORLD_VISUAL_ASSETS,
  type WorldVisualAssetDef,
  type WorldVisualAssetId,
  type WorldVisualObjectPlacement,
} from './worldVisualAssets';

export type RegistryWorldVisualAssetId =
  | WorldVisualAssetId
  | ExtendedWorldVisualAssetId
  | HighCityWorldVisualAssetId;

export const REGISTRY_WORLD_VISUAL_ASSETS: Record<RegistryWorldVisualAssetId, WorldVisualAssetDef> = {
  ...WORLD_VISUAL_ASSETS,
  ...EXTENDED_WORLD_VISUAL_ASSETS,
  ...HIGH_CITY_WORLD_VISUAL_ASSETS,
};

export type RegistryWorldVisualPlacement = Omit<WorldVisualObjectPlacement, 'assetId'> & {
  assetId: RegistryWorldVisualAssetId;
};

export function registryWorldVisualDef(assetId: RegistryWorldVisualAssetId): WorldVisualAssetDef | undefined {
  return REGISTRY_WORLD_VISUAL_ASSETS[assetId];
}