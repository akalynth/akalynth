# Akalynth Asset Manifest (sidecar) schema — Factory v1

Every cleaned asset under `data/assets-src/sprites/` carries a **sidecar JSON**
next to its PNG: `<class>__<name>.png` → `<class>__<name>.json`. The sidecar gives
each asset lineage (prompt + raw + cleaned + hash), a lifecycle gate, and a hard
**server-metadata-lockstep** marker. Validated by `npm run verify:assets`
(`tools/asset-gen/verify-assets.ts`). See `FACTORY.md` for the lifecycle.

## Fields

| Field | Type | Notes |
|---|---|---|
| `asset_id` | string | `akalynth_<asset_type>_<name>_NNN` (e.g. `akalynth_prop_wooden_chest_001`). |
| `game` | string | Always `"Akalynth"`. |
| `asset_type` | enum | `ground` \| `border` \| `structure` \| `prop` \| `creature` \| `character` \| `npc` \| `building` \| `effect` \| `ui` \| `tile` \| `item`. (`item` = inventory/equipment/consumable/loot icons.) |
| `biome` | string \| null | Optional grouping (`town`, `swamp`, …); `null` if none. |
| `status` | enum | Lifecycle: `prompt_written` \| `raw_generated` \| `cleaned_png` \| `manifest_recorded` \| `tilemap_tested` \| `human_reviewed` \| `promoted` \| `legacy`. |
| `dimensions_px` | [int,int] \| null | Actual cleaned-PNG size; `null` before a cleaned PNG exists. Each value a multiple of 32. |
| `dimensions_target_px` | [int,int] | Intended size (multiple of 32: 32x32 / 32x64 / 64x64). |
| `camera` | string | `"top_down_slight_isometric"`. |
| `background` | string | `"transparent"` for cut-out objects/sprites; `"opaque"` for seamless terrain tiles (full fill, matches `generate.ts --background opaque`). |
| `style_contract` | string | `"nostalgic_top_down_mmo_readability_original_akalynth_assets_v1"`. |
| `prompt_file` | string \| null | Path under `data/assets-src/prompts/…`, or `null` for hand-authored. |
| `raw_file` | string \| null | Raw generator output under `data/assets-src/_raw/…` (gitignored), or `null`. |
| `cleaned_file` | string \| null | Tracked cleaned PNG path (repo-relative), or `null` until cleaned. |
| `sha256` | string \| null | Hex sha256 of the **cleaned PNG**; `null` until `status` reaches `cleaned_png`. Validator recomputes and compares. |
| `tilemap_test` | string \| null | Path to the test-map placement that proved it in-world; `null` until `tilemap_tested`. |
| `license_status` | enum | `hand_authored` \| `original_generated_asset`. |
| `review_status` | enum | `needs_human_review` \| `approved` \| `legacy`. |
| `tile_code` | int \| null | Optional display-only link to a `TileCode` (0–8, packages/shared/types.ts) for ground/structure tiles. **Never authority.** |
| `mechanics` | null | **MUST be `null`.** Lockstep: art never asserts collision/walkability/zone/etc.; mechanics live server-side. |
| `copyright_boundary` | string | e.g. `"original generated asset; no copied third-party sprite, UI, logo, or map layout"`. |
| `notes` | string | Design intent / originality note. |

## Example (first-asset, prompt stage)

```json
{
  "asset_id": "akalynth_prop_wooden_chest_001",
  "game": "Akalynth",
  "asset_type": "prop",
  "biome": "town",
  "status": "prompt_written",
  "dimensions_px": null,
  "dimensions_target_px": [32, 32],
  "camera": "top_down_slight_isometric",
  "background": "transparent",
  "style_contract": "nostalgic_top_down_mmo_readability_original_akalynth_assets_v1",
  "prompt_file": "data/assets-src/prompts/props/akalynth_prop_wooden_chest_001.txt",
  "raw_file": null,
  "cleaned_file": null,
  "sha256": null,
  "tilemap_test": null,
  "license_status": "original_generated_asset",
  "review_status": "needs_human_review",
  "tile_code": null,
  "mechanics": null,
  "copyright_boundary": "original generated asset; no copied third-party sprite, UI, logo, or map layout",
  "notes": "Closed dark-oak chest; crescent lock + small blue crystal motif; subtle moss."
}
```

## Lockstep reminder

`mechanics` is always `null`. A tile that *looks* solid is not solid until the
server says so (`WALKABLE_TILES` / map metadata in `packages/shared`). Any real
effect is routed through server + verification work, never the art manifest.
