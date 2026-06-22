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
