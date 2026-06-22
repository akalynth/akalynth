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

## Loose-PNG client sync (PR-004)

MVP path before atlas packing (PR-003) or full `compile-registry` (PR-005).

| Script | Purpose |
|--------|---------|
| `npm run sync:assets` | Runs `verify:assets`, copies verified loose PNGs + registry stub to `data/assets-built/` and client mirrors |
| `npm run verify:asset-sync` | SHA256 drift check: `data/assets-built/` vs Android `assets/` and debug-client `public/atlas/` |

**Mirrors:**

- `data/assets-built/` — canonical built loose PNGs + `registry.json`
- `apps/android/app/src/main/assets/` — Android bundle
- `apps/debug-client/public/atlas/` — web atlas mirror (nearest-neighbor; CLASSIC_32)

Registry stub is emitted inline by `sync-to-clients.mjs` using `NORMALIZATION.md` rules until PR-005 `compile-registry.mjs` lands.
