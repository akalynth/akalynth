# World visual asset manifest (PR-006)

Authoritative inventory of debug-client world visual registry IDs and placement rules for the asset pipeline.

| Field | Value |
|-------|-------|
| **Total registry** | 51 short IDs (42 base + 9 extended) |
| **MVP Rookguard** | 38 IDs |
| **Deferred post-MVP** | 13 IDs (PR-011) |
| **Placement schema** | `tools/atlas/placement.schema.json` |
| **Shared types** | `packages/shared/worldVisual.ts` |
| **Source of truth (client)** | `apps/debug-client/src/data/worldVisualAssets.ts`, `extendedWorldVisualAssets.ts` |

Placements are **display-only** (`mechanics: null`). Pixels never gate movement.

---

## ID resolution

Placement JSON uses **short** ids (e.g. `notice_board`). At runtime, loaders resolve via `canonicalWorldAssetId()` / `canonicalPlacementAssetId()`:

```
placement.asset_id  ("notice_board")
  → akalynth_world_notice_board
  → AssetRegistry.sprite(canonical_id)
```

See `tools/atlas/NORMALIZATION.md` for registry field mapping from world sidecars.

---

## MVP Rookguard subset (38 assets)

All base `WORLD_VISUAL_ASSET_IDS` **except** High City castle/prison props (`prison_bars`, `stone_column`, `throne`, `weapon_rack`).

```
banner_blue
banner_red
bench
bed_single
bookshelf
chair_wood
chest_small
door_wood_closed_east
door_wood_closed_south
door_wood_open_east
door_wood_open_south
fireplace
floor_cobble_01
floor_stone_01
floor_wood_01
fountain
grass_01
market_awning_overlay
market_cloth_stall
market_food_stall
notice_board
roof_castle_overlay
roof_red_large_overlay
roof_red_small_overlay
rookguard_amber_lantern
rookguard_bait_crate
rookguard_canal_reeds
rookguard_fishing_post
rookguard_supply_sack
rookguard_waymarker
sewer_grate
sewer_pipe
slime_pool
table_small
wall_stone_corner_ne
wall_stone_corner_nw
wall_stone_north
wall_stone_south
```

**Consumer:** PR-008 ports `ROOKGUARD_VISUAL_LANDMARKS` from `highCityVisualLandmarks.ts` into `data/assets-built/placements/rookguard-overlays.json`.

**Consumer:** AKALYNTH_HIGH_CITY_SPRITE Phase 1 ports `HIGH_CITY_VISUAL_LANDMARKS` into `data/assets-built/placements/azura-overlays.json`, merges with `azura-deferred-overlays.json` into `azura-all-overlays.json` (Android + bundled clients).

---

## Deferred post-MVP (13 assets)

| Group | IDs | Target PR |
|-------|-----|-----------|
| High City castle / prison | `prison_bars`, `stone_column`, `throne`, `weapon_rack` | PR-011 |
| Swamp extended | `prop_tree`, `swamp_bog_slime`, `swamp_bog_water`, `swamp_dead_tree`, `swamp_frog`, `swamp_log`, `swamp_mud`, `swamp_mushroom`, `swamp_reeds` | PR-011 |

---

## Placement JSON envelope

Compiled placement files live under `data/assets-built/placements/` (e.g. `rookguard-overlays.json`).

```json
{
  "map": "rookguard",
  "schema_version": 1,
  "mechanics": null,
  "placements": [
    {
      "id": "rookguard-notice-board-9-5",
      "asset_id": "notice_board",
      "x": 9,
      "y": 5,
      "visibility": "visible"
    }
  ]
}
```

| Field | Notes |
|-------|-------|
| `map` | Lowercase map key (`rookguard`, `high-city`, …) |
| `schema_version` | `1` for MVP |
| `mechanics` | Must be `null` |
| `placements[].id` | Unique instance id |
| `placements[].asset_id` | Short `WorldVisualAssetId` (not `akalynth_world_*`) |
| `placements[].x`, `y` | Integer tile coordinates (top-left) |
| `placements[].visibility` | Optional: `visible` \| `hidden` \| `faded` |

Validate with `tools/atlas/placement.schema.json`.

---

## Registry parity checklist

- Every short id in this manifest must have a world sidecar under `data/assets-src/sprites/world/**` (or factory prop for `prop_tree`) and appear in compiled `data/assets-built/registry.json` after `npm run build:assets`.
- `packages/shared/worldVisual.ts` exports `MVP_ROOKGUARD_WORLD_ASSET_IDS`, `DEFERRED_WORLD_ASSET_IDS`, and `ALL_WORLD_VISUAL_ASSET_IDS` for compile-time checks and CI.
- debug-client `worldVisualRegistry.ts` remains the runtime image/preload source until PR-007+ registry overlay migration completes on Android.