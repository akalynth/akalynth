# Atlas Tool

Builds sprite atlases for runtime use.

> **Status:** PR-003 atlas builder implemented (`build-atlas.mjs`). Produces
> category sheets under `data/assets-built/atlas/` and patches `registry.json`
> with UV rects. Loose PNG sync remains the fallback when atlas is skipped.

## Intended inputs/outputs

- Input: `data/assets-src/sprites/` (authored sprite sources)
- Output: `data/assets-built/atlas/` (runtime-ready atlas)

Per the repo convention, editors write to `data/*-src/` and compilers emit
`data/*-built/`; runtime consumes only `*-built/`.

## Registry (PR-001)

Canonical compiled metadata for all runtime sprite lookups.

| Artifact | Purpose |
|----------|---------|
| [`packages/shared/assetRegistry.ts`](../../packages/shared/assetRegistry.ts) | TypeScript types (`AssetRegistryEntry`, `AssetManifest`) and ID helpers |
| [`NORMALIZATION.md`](./NORMALIZATION.md) | Source → registry field mapping, ID rules, example entries |
| [`schema.json`](./schema.json) | JSON Schema for `data/assets-built/registry.json` |
| `data/assets-built/registry.json` | Compiled output (emitted by `compile-registry.mjs`, PR-005) |

Run ID helper tests: `npx tsx packages/shared/test/assetRegistry.test.ts`

## World placements (PR-006)

Map overlay coordinates are authored separately from registry metadata.

| Artifact | Purpose |
|----------|---------|
| [`docs/ASSET_MANIFEST.md`](../../docs/ASSET_MANIFEST.md) | Authoritative 38 MVP + 13 deferred short ID lists |
| [`placement.schema.json`](./placement.schema.json) | JSON Schema for `data/assets-built/placements/*.json` |
| [`packages/shared/worldVisual.ts`](../../packages/shared/worldVisual.ts) | Shared placement types + ID constants |

Run manifest ID tests: `npx tsx packages/shared/test/worldVisual.test.ts`

## Registry compile + client sync (PR-005)

| Script | Purpose |
|--------|---------|
| `npm run build:assets` | `compile-registry.mjs` then `sync-to-clients.mjs --use-compiled-registry` |
| `npm run build:assets:loose` | Loose PNG sync only (inline registry compile; no atlas) |
| `npm run sync:assets` | Alias for `build:assets:loose` |
| `npm run verify:asset-sync` | SHA256 drift check: `data/assets-built/` vs Android `assets/` and debug-client `public/atlas/` |

**Mirrors:**

- `data/assets-built/` — canonical built loose PNGs + `registry.json`
- `apps/android/app/src/main/assets/` — Android bundle
- `apps/debug-client/public/atlas/` — web atlas mirror (nearest-neighbor; CLASSIC_32)

`compile-registry.mjs` writes `data/assets-built/registry.json`; `sync-to-clients.mjs` mirrors loose PNGs and the registry (compiled or inline) to client bundles.

**Git policy:** see [`docs/ASSET_SYNC_POLICY.md`](../../docs/ASSET_SYNC_POLICY.md) for what to commit in `data/assets-built/` vs client mirrors and the contributor sync workflow.

## Atlas packer (PR-003)

| Script | Purpose |
|--------|---------|
| `npm run build:atlas` | Pack UI/items/chronicle/world sheets (2048² max, 2px padding, nearest-neighbor) |
| `npm run bench:atlas-decode` | Decode-time harness per sheet (append `--out=receipt.json` for CI receipts) |

**Outputs:** `data/assets-built/atlas/{ui,items,chronicle,world}.png`, `atlas/manifest.json`, registry `atlas` UV rects.

**MVP sheet scope:** 13 UI + 20 items + 9 chronicle glyphs + 38 Rookguard world overlays.

**Dependency:** `sharp@^0.33` (root devDependency). Fallback: continue with `build:assets:loose` if `sharp` unavailable on a target arch.
