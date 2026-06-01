# Akalynth Asset Factory v1

> Wallpaper = presentation. **Asset = reusable game material. Manifest = lineage.
> Tilemap placement = proof it works in the game world.**

The factory rule keeps Akalynth from becoming a folder of nice images with no game
lineage:

- One asset at a time.
- One prompt per asset.
- One raw image per asset.
- One cleaned PNG per asset.
- One manifest per asset.
- One tilemap placement per promoted asset.
- One screenshot/proof receipt per pack.

Art is display-only. Visual style follows the **Visual Contract v1**
(`docs/CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md`): Classic 32 (32px authored),
upper-left lighting, Akalynth motifs, legal boundary, **server-metadata lockstep**.

## Asset lifecycle (manifest `status`)

| # | status | meaning |
|---|---|---|
| 1 | `prompt_written` | Asset has a controlled generation prompt. |
| 2 | `raw_generated` | First generated image exists (`_raw/`). |
| 3 | `cleaned_png` | Background/size/silhouette/transparency cleaned → tracked PNG. |
| 4 | `manifest_recorded` | Manifest has id, type, dims, prompt link, **sha256**. |
| 5 | `tilemap_tested` | Placed into a test map. |
| 6 | `human_reviewed` | A human accepted it visually. |
| 7 | `promoted` | Allowed in game builds. |

Do **not** call an asset "game-ready" before `tilemap_tested` + `human_reviewed`.
`legacy` is allowed for assets that predate the factory (the original 12 sprites).

## Production loop

1. Generate one asset (`tools/asset-gen/generate.ts`, needs `OPENAI_API_KEY`).
2. Remove background / crop / resize to the 32px base.
3. Fix the silhouette by hand if needed (Aseprite, per the direction doc).
4. Save as a transparent PNG under `sprites/`.
5. Hash the cleaned PNG (sha256) → manifest.
6. Write/finish the manifest sidecar.
7. Place it into a small test map.
8. Take a screenshot (pack receipt).
9. Accept / reject / revise (human review).
10. Only then promote it into the asset library.

## Folder shape (factory → repo mapping)

The factory's canonical dirs map onto the repo's existing `data/*-src` convention
(authored under `*-src/`, compiled under `*-built/`; runtime consumes built only):

| Factory dir | Akalynth location | Tracked? |
|---|---|---|
| `prompts/<class>/` | `data/assets-src/prompts/<class>/` | yes |
| `raw/<class>/` | `data/assets-src/_raw/<class>/` | **no** (gitignored: `data/assets-src/**/_raw/`) |
| `cleaned/<class>/` | `data/assets-src/sprites/<class>__<name>.png` | yes |
| `manifests/assets/` | sidecar next to each cleaned PNG: `sprites/<class>__<name>.json` | yes |
| `tilemaps/test_maps/` | `data/assets-src/test-maps/` | yes (spec) / placements gitignored if built |
| `receipts/asset_packs/` | `data/assets-src/packs/<pack>.json` (+ screenshot receipts) | yes |

Manifests are **co-located sidecars** (next to the cleaned PNG) rather than a
separate `manifests/` tree — simpler lineage and what `verify:assets` checks.

## Validation

`npm run verify:assets` (`tools/asset-gen/verify-assets.ts`) enforces: every tracked
cleaned PNG has a schema-valid sidecar; lifecycle `status` is valid; dimensions are
32-multiples; naming is `<class>__<name>`; `mechanics` is `null` (lockstep);
`sha256` matches the cleaned PNG once `status` is past `cleaned_png`; referenced
prompt files exist. See `MANIFEST_SCHEMA.md`.

This gate runs in **CI**: the `assets` verifier is registered in the verification
spine and included in the `quick` profile that CI executes, so the manifest/lineage
rules are enforced before merge — not only locally.

## Current state

- The **12 original sprites** are `legacy`/`promoted` (predate the factory); their
  manifests are backfilled with real `sha256` + lineage notes.
- The first town pack (`packs/town-starter-v1.json`) is defined at `prompt_written`
  with prompts authored; raw generation, cleanup, tilemap test, and human review
  require the API key + a human and are **not** done here.
