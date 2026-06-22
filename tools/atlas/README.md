# Atlas Tool

Builds sprite atlases for runtime use.

> **Status:** Scaffold. This directory currently holds only this README; the
> atlas builder is not implemented yet. The sections below describe the intended
> contract once the tool lands. Do not assume a runnable command exists.

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
