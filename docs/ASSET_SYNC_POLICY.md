# Asset Sync Policy

Status: contributor policy for the Classic 32 asset pipeline (PR-004/PR-005).

This document defines **what is tracked in git**, **how built artifacts flow to client
bundles**, and **which verification gates enforce parity**. It complements the authored
source rules in `data/assets-src/FACTORY.md` and the registry contract in
`tools/atlas/NORMALIZATION.md`.

## Pipeline overview

```
data/assets-src/sprites/     authored PNGs + JSON sidecars (source of truth)
        │
        │  npm run verify:assets
        ▼
data/assets-built/           canonical built mirror (loose PNGs + registry.json)
        │
        │  npm run sync:assets  (or npm run build:assets)
        ▼
client mirrors:
  apps/android/app/src/main/assets/
  apps/debug-client/public/atlas/
```

**Rule:** editors write under `data/*-src/`; compilers emit `data/*-built/`; runtime
clients consume **built** artifacts only. Do not wire imports directly to `assets-src/`
in shipping client bundles.

## Git tracking policy

| Path | Tracked? | Role | CI when `assets_changed` |
| --- | --- | --- | --- |
| `data/assets-src/**` | Yes | Authored sprites, manifests, prompts, packs | `verify:assets` |
| `data/assets-built/**` | Yes | Canonical built loose PNGs, `registry.json`, `sync-manifest.json` | `verify:assets`, `verify:asset-sync` |
| `apps/android/app/src/main/assets/**` | Yes (synced subset + maps) | Android runtime bundle | `verify:asset-sync` |
| `apps/debug-client/public/atlas/**` | Yes | Web debug-client atlas mirror | `verify:asset-sync` |
| `data/assets-src/**/_raw/` | **No** (gitignored) | Regenerable AI/raw dumps | — |
| `data/assets-built/atlas/` | Not yet (scaffold) | Future packed atlas sheets (PR-003) | — |

### Canonical vs mirrors

- **`data/assets-built/`** is the **canonical built tree**. `sync-manifest.json` lists
  every synced loose PNG with an expected SHA256. `registry.json` is the compiled
  runtime lookup index.
- **Client mirrors** are **copies**, not second sources of truth. Android and
  debug-client paths above must byte-match `data/assets-built/` for every path listed
  in `sync-manifest.json`, plus `registry.json` and `sync-manifest.json` themselves.

### Android assets that are not sync-managed

`apps/android/app/src/main/assets/` also ships **map JSON** and other bundle files
that are **outside** the loose-PNG sync manifest (for example `maps/*.json`). Those
files are tracked independently. Changing them does not satisfy an asset-factory PR;
changing synced PNGs/registry without running the sync scripts **does** fail
`verify:asset-sync`.

## Contributor workflow

### Adding or changing a sprite

1. Edit the cleaned PNG and sidecar under `data/assets-src/sprites/`.
2. Run manifest/lineage validation:
   ```bash
   npm run verify:assets
   ```
3. Rebuild the canonical tree and mirror to clients:
   ```bash
   npm run build:assets
   ```
   For loose-PNG-only changes without recompiling registry from disk:
   ```bash
   npm run sync:assets
   ```
4. Confirm mirrors are in sync:
   ```bash
   npm run verify:asset-sync
   ```
5. Commit **all** of:
   - `data/assets-src/**` changes
   - `data/assets-built/**` updates
   - `apps/android/app/src/main/assets/**` synced files
   - `apps/debug-client/public/atlas/**` synced files

### Do not

- Hand-edit PNGs in a client mirror without updating `assets-src` and re-running sync.
- Commit `assets-built/` or mirror changes without the matching `assets-src` lineage.
- Copy sprites from `drop/` or third-party games into runtime paths (see
  `docs/CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md` legal boundary).
- Treat `sync-manifest.json` as hand-editable; it is emitted by `sync-to-clients.mjs`.

### Fixing `verify:asset-sync` failures

Typical drift messages:

```
data/assets-built/sprites/foo.png: sha256 drift (manifest … vs disk …)
android:sprites/foo.png: sha256 drift (source … vs mirror …)
```

**Fix:** from repo root, run `npm run build:assets` (or `npm run sync:assets`), then
`npm run verify:asset-sync`. If the manifest itself is missing, sync has not been run
since the last asset change.

## npm scripts

| Script | Purpose |
| --- | --- |
| `npm run verify:assets` | Validate `assets-src` manifests, lineage, and PNG hashes |
| `npm run compile-registry` | Write `data/assets-built/registry.json` from verified sources |
| `npm run sync:assets` | Copy loose PNGs + registry/manifest to built + client mirrors |
| `npm run build:assets` | `compile-registry` then `sync:assets --use-compiled-registry` |
| `npm run verify:asset-sync` | SHA256 drift check across built tree and both client mirrors |

Implementation: `tools/atlas/sync-to-clients.mjs`, `tools/atlas/verify-sync.mjs`.

## CI gate split

| Workflow | When | Asset gates |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Pull requests (fast merge gate) | `verify:assets` + `verify:asset-sync` when `assets_changed=true` |
| `.github/workflows/verify.yml` | Push to `main`, manual dispatch, nightly | `verify:asset-sync` (deep spine alongside other verifiers) |

### `assets_changed` trigger paths

The CI classifier sets `assets_changed=true` when a PR touches any of:

- `data/assets-src/**`
- `data/assets-built/**`
- `tools/asset-gen/**`
- `tools/atlas/**`
- `apps/android/app/src/main/assets/**`
- `apps/debug-client/public/atlas/**`

## Related docs

- `data/assets-src/FACTORY.md` — asset lifecycle and manifest rules
- `tools/atlas/README.md` — sync/compile script entry points
- `tools/atlas/NORMALIZATION.md` — registry field mapping
- `docs/CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md` — art direction and legal boundary