# Asset registry normalization spec

Normative types: `packages/shared/assetRegistry.ts`  
Compiled output schema: `tools/atlas/schema.json`  
Output path: `data/assets-built/registry.json`

The registry unifies heterogeneous authored sources into a single `AssetRegistryEntry[]`. Pixels and manifests are **display-only**; `mechanics` is always `null` (server-metadata lockstep).

## Pipeline

1. `npm run verify:assets` validates each source in its native schema.
2. `compile-registry.mjs` (PR-005) reads only verified sources and emits `registry.json`.
3. Optional atlas build (PR-003) may append `atlas` UV rects per entry.

## ID canonicalization

| Source | Native ID field | Registry `asset_id` rule |
|--------|-----------------|--------------------------|
| Factory sidecar | `asset_id` | Verbatim (`akalynth_prop_tree_001`) |
| UI pack entry | `asset_id` | Verbatim (`akalynth_ui_ui_panel_frame`) |
| World sidecar | `id` (short) | `akalynth_world_` + short id (`grass_01` → `akalynth_world_grass_01`) |
| Item manifest | `asset_id` | Verbatim; `item_type` is the runtime index key |

**Collision rule:** if two sources resolve to the same `asset_id`, compilation **fails**.

**Short ID at runtime:** placement JSON uses short world ids (`notice_board`). Loaders map via `canonicalWorldAssetId()` / `worldShortIdFromAssetId()` in `assetRegistry.ts`.

## Field mapping

### Factory sidecar (`sprites/<class>__<name>.json`)

| Source field | Registry field | Notes |
|--------------|----------------|-------|
| `asset_id` | `asset_id` | Unchanged |
| — | `source` | `"factory"` |
| `asset_type` | `asset_type` | Unchanged |
| `cleaned_file` | `file` | Repo-relative path under `data/assets-src/` (e.g. `sprites/props__tree.png`) |
| `dimensions_px[0]`, `dimensions_px[1]` | `frame.w`, `frame.h` | `[w,h]` tuple → `{ w, h }` |
| `style_contract` | `style_contract` | Required on factory entries |
| `mechanics` | `mechanics` | Must be `null` |
| `item_type` (PR-002) | `item_type` | Required when `asset_type === "item"` |
| `chronicle_kind` (PR-002) | `chronicle_kind` | Optional on `asset_type === "effect"` chronicle glyphs |
| Atlas manifest (PR-003) | `atlas` | Optional `{ sheet, x, y, w, h }` |

Factory `status` gates **atlas packing** (`tilemap_tested`, `human_reviewed`, `promoted`, `legacy`) but not registry inclusion—all verified factory sidecars are indexed.

### UI pack (`sprites/ui/ui_gameplay_v1.json`)

| Source field | Registry field | Notes |
|--------------|----------------|-------|
| `asset_id` | `asset_id` | Unchanged |
| — | `source` | `"ui_pack"` |
| — | `asset_type` | `"ui"` |
| `file` | `file` | Prefixed `ui/` (e.g. `ui/ui_panel_frame.png`) |
| `dimensions_px[0]`, `dimensions_px[1]` | `frame.w`, `frame.h` | |
| `kind` | `kind` | `nine_slice` \| `circle` \| `bar` \| `sprite` |
| `slice_px` | `slice_px` | Nine-slice inset; `0` for circle assets |
| `style_contract` | `style_contract` | |
| `mechanics` | `mechanics` | Must be `null` |

### World sidecar (`sprites/world/**/*.json`)

| Source field | Registry field | Notes |
|--------------|----------------|-------|
| `id` | `asset_id` | `akalynth_world_<id>` |
| — | `source` | `"world_sidecar"` |
| `asset_type` | `asset_type` | `terrain_tile`, `wall_overlay`, etc. |
| `image` + sidecar directory | `file` | `world/<subdir>/<image>` (e.g. `world/terrain/grass_01.png`) |
| `frame.width`, `frame.height` | `frame.w`, `frame.h` | |
| — | `style_contract` | Injected `AKALYNTH_STYLE_CONTRACT` (world sidecars omit this field) |
| `rendering.*` | `rendering` | Copied snake_case block; see below |
| `mechanics` | `mechanics` | Must be `null` |

World sidecars have **no factory `status`**; inclusion requires PNG + A-10 rules in `verify-assets.ts`.

#### `rendering` block (world only)

| Source (`rendering`) | Registry (`rendering`) |
|----------------------|------------------------|
| `filtering` | `filtering` | Always `"nearest"` |
| `display_only` | `display_only` | Always `true` |
| `draw_scale` | `draw_scale` | Optional positive number |
| `anchor.type` | `anchor.type` | `tile_top_left`, `bottom_center`, `bottom_left`, `center` |
| `anchor.source_pixels` | `anchor.source_pixels` | `[x, y]` tuple |
| `layer` | `layer` | `terrain`, `object_overlay`, `floor_overlay` |
| `z_policy` | `z_policy` | Optional |

### Item manifest (`sprites/item__<name>.json`)

Item manifests use the **factory sidecar** schema with `asset_type: "item"`. Normalization follows the factory table; `item_type` is required (PR-002) and becomes the primary lookup key for `AssetRegistry.itemIcon(itemType)` at runtime.

## Example entries (one per source type)

```json
[
  {
    "asset_id": "akalynth_prop_tree_001",
    "source": "factory",
    "asset_type": "prop",
    "file": "sprites/props__tree.png",
    "frame": { "w": 32, "h": 64 },
    "style_contract": "nostalgic_top_down_mmo_readability_original_akalynth_assets_v1",
    "mechanics": null
  },
  {
    "asset_id": "akalynth_ui_ui_panel_frame",
    "source": "ui_pack",
    "asset_type": "ui",
    "file": "ui/ui_panel_frame.png",
    "frame": { "w": 48, "h": 48 },
    "kind": "nine_slice",
    "slice_px": 8,
    "style_contract": "nostalgic_top_down_mmo_readability_original_akalynth_assets_v1",
    "mechanics": null
  },
  {
    "asset_id": "akalynth_world_grass_01",
    "source": "world_sidecar",
    "asset_type": "terrain_tile",
    "file": "world/terrain/grass_01.png",
    "frame": { "w": 32, "h": 32 },
    "rendering": {
      "filtering": "nearest",
      "display_only": true,
      "draw_scale": 1,
      "anchor": { "type": "tile_top_left", "source_pixels": [0, 0] },
      "layer": "terrain",
      "z_policy": "fixed_layer"
    },
    "style_contract": "nostalgic_top_down_mmo_readability_original_akalynth_assets_v1",
    "mechanics": null
  },
  {
    "asset_id": "akalynth_item_torch_001",
    "source": "factory",
    "asset_type": "item",
    "file": "sprites/item__torch.png",
    "frame": { "w": 32, "h": 32 },
    "item_type": "torch",
    "style_contract": "nostalgic_top_down_mmo_readability_original_akalynth_assets_v1",
    "mechanics": null
  }
]
```

## Compiled manifest envelope

```json
{
  "schema_version": 1,
  "entries": [ "... AssetRegistryEntry objects ..." ]
}
```

## Non-goals (this spec)

- Placement coordinates (`placements/*.json`) — separate schema (PR-006).
- Character/creature spritesheet sidecars — not unified into this registry in MVP.
- Protocol `icon_sprite_id` — deferred PR-030; MVP uses `item_type` index only.