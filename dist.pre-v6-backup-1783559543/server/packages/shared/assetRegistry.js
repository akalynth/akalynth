// Akalynth compiled asset registry types.
// Normalized output of tools/atlas/compile-registry.mjs (see tools/atlas/NORMALIZATION.md).
export const ASSET_REGISTRY_SCHEMA_VERSION = 1;
/** Canonical style contract injected when a source omits style_contract (world sidecars). */
export const AKALYNTH_STYLE_CONTRACT = 'nostalgic_top_down_mmo_readability_original_akalynth_assets_v1';
export const WORLD_ASSET_ID_PREFIX = 'akalynth_world_';
/** item_type → registry asset_id for promoted item icons (PR-030). */
export function buildItemIconSpriteIndex(manifest) {
    const index = new Map();
    for (const entry of manifest.entries) {
        if (entry.asset_type === 'item' && entry.item_type) {
            index.set(entry.item_type, entry.asset_id);
        }
    }
    return index;
}
export function itemIconSpriteIdForType(itemType, index) {
    return index.get(itemType);
}
/** Resolve canonical world asset_id from a short placement id (e.g. grass_01). */
export function canonicalWorldAssetId(shortId) {
    return shortId.startsWith(WORLD_ASSET_ID_PREFIX)
        ? shortId
        : `${WORLD_ASSET_ID_PREFIX}${shortId}`;
}
/** Strip akalynth_world_ prefix when present; returns input unchanged for non-world ids. */
export function worldShortIdFromAssetId(assetId) {
    return assetId.startsWith(WORLD_ASSET_ID_PREFIX)
        ? assetId.slice(WORLD_ASSET_ID_PREFIX.length)
        : assetId;
}
