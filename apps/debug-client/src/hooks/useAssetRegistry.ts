import { useEffect, useState } from 'react';
import {
  ASSET_REGISTRY_SCHEMA_VERSION,
  type AssetManifest,
  type AssetRegistryEntry,
} from '@shared/assetRegistry';
import { atlasPublicUrl } from '../lib/atlasPaths';

const REGISTRY_URL = atlasPublicUrl('registry.json');

export function uiRegistryEntry(
  registry: AssetManifest | null,
  stem: string,
): AssetRegistryEntry | undefined {
  if (!registry) return undefined;
  const assetId = `akalynth_ui_${stem}`;
  return registry.entries.find((entry) => entry.asset_id === assetId);
}

/**
 * Loads compiled registry.json from public/atlas/ (same schema as Android).
 * Returns null registry on fetch/parse failure — callers keep CSS chrome fallback.
 */
export function useAssetRegistry(): {
  registry: AssetManifest | null;
  ready: boolean;
  error: string | null;
} {
  const [registry, setRegistry] = useState<AssetManifest | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(REGISTRY_URL);
        if (!response.ok) {
          throw new Error(`registry fetch ${response.status}`);
        }
        const data = (await response.json()) as AssetManifest;
        if (data.schema_version !== ASSET_REGISTRY_SCHEMA_VERSION) {
          throw new Error(`unsupported registry schema_version ${data.schema_version}`);
        }
        if (!Array.isArray(data.entries)) {
          throw new Error('registry entries missing');
        }
        if (!cancelled) {
          setRegistry(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setRegistry(null);
          setError(err instanceof Error ? err.message : 'registry load failed');
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { registry, ready, error };
}