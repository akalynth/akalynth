// Akalynth compiled asset registry types.
// Normalized output of tools/atlas/compile-registry.mjs (see tools/atlas/NORMALIZATION.md).

export const ASSET_REGISTRY_SCHEMA_VERSION = 1 as const;

/** Canonical style contract injected when a source omits style_contract (world sidecars). */
export const AKALYNTH_STYLE_CONTRACT =
  'nostalgic_top_down_mmo_readability_original_akalynth_assets_v1' as const;

export const WORLD_ASSET_ID_PREFIX = 'akalynth_world_' as const;

export type AssetRegistrySource = 'factory' | 'ui_pack' | 'world_sidecar';

export type UiAssetKind = 'nine_slice' | 'circle' | 'bar' | 'sprite';

export type WorldVisualAnchorType =
  | 'tile_top_left'
  | 'bottom_center'
  | 'bottom_left'
  | 'center';

export type WorldVisualLayer = 'terrain' | 'object_overlay' | 'floor_overlay';

export type WorldVisualZPolicy =
  | 'fixed_layer'
  | 'sort_by_anchor_y'
  | 'fixed_above_building';

export interface AssetFrame {
  w: number;
  h: number;
}

export interface AtlasRect {
  sheet: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorldVisualAnchor {
  type: WorldVisualAnchorType;
  source_pixels: [number, number];
}

/** World sidecar rendering block after registry normalization (snake_case JSON). */
export interface WorldVisualRendering {
  filtering: 'nearest';
  display_only: true;
  draw_scale: number;
  anchor: WorldVisualAnchor;
  layer: WorldVisualLayer;
  z_policy?: WorldVisualZPolicy;
}

export interface AssetRegistryEntry {
  asset_id: string;
  source: AssetRegistrySource;
  asset_type: string;
  file: string;
  frame: AssetFrame;
  style_contract: string;
  mechanics: null;
  atlas?: AtlasRect;
  slice_px?: number;
  kind?: UiAssetKind;
  rendering?: WorldVisualRendering;
  item_type?: string;
  chronicle_kind?: string;
}

export interface AssetManifest {
  schema_version: typeof ASSET_REGISTRY_SCHEMA_VERSION;
  entries: AssetRegistryEntry[];
}

/** Resolve canonical world asset_id from a short placement id (e.g. grass_01). */
export function canonicalWorldAssetId(shortId: string): string {
  return shortId.startsWith(WORLD_ASSET_ID_PREFIX)
    ? shortId
    : `${WORLD_ASSET_ID_PREFIX}${shortId}`;
}

/** Strip akalynth_world_ prefix when present; returns input unchanged for non-world ids. */
export function worldShortIdFromAssetId(assetId: string): string {
  return assetId.startsWith(WORLD_ASSET_ID_PREFIX)
    ? assetId.slice(WORLD_ASSET_ID_PREFIX.length)
    : assetId;
}