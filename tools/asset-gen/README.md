# tools/asset-gen — Akalynth Asset Factory

Generation + validation for Akalynth game assets. Style is governed by the
**Visual Contract v1** (`docs/CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md`) and the
lifecycle/rules in `data/assets-src/FACTORY.md`.

> Status: `generate.ts` is a runnable scaffold (needs an API key to produce art);
> `verify-assets.ts` is fully runnable. No generated PNGs are committed by these
> tools — assets enter the tree only after hand cleanup + manifest + human review.

## Commands

```
# Validate all asset manifests + pack specs (read-only):
npm run verify:assets

# Preview the request for one asset (no network, no key needed):
tsx tools/asset-gen/generate.ts --prompt data/assets-src/prompts/props/akalynth_prop_wooden_chest_001.txt \
  --id akalynth_prop_wooden_chest_001 --dry-run

# Generate one raw asset (requires OPENAI_API_KEY):
OPENAI_API_KEY=... tsx tools/asset-gen/generate.ts --prompt <file> --id <asset_id>
```

`generate.ts` makes **no network call without a key** — it stops with a clear
message. With a key it writes one raw PNG to `data/assets-src/_raw/` (gitignored).

## Pipeline (one asset at a time — see FACTORY.md)

1. `prompt_written` — author `data/assets-src/prompts/<class>/<id>.txt`.
2. `raw_generated` — `generate.ts` → `_raw/<id>_raw.png` (gitignored).
3. `cleaned_png` — **by hand** (Aseprite/Photopea): normalize to the Classic 32
   base (32x32 / 32x64 / 64x64), clean silhouette + transparency, save as
   `data/assets-src/sprites/<class>__<name>.png`.
4. `manifest_recorded` — write the sidecar (`MANIFEST_SCHEMA.md`), including the
   cleaned-PNG `sha256`. `npm run verify:assets` must pass.
5. `tilemap_tested` — place into a test map under `data/assets-src/test-maps/`.
6. `human_reviewed` — a human accepts it; produce a pack screenshot receipt.
7. `promoted` — wire into the game (e.g. `apps/debug-client` tile/sprite map) in a
   **separate** integration lane.

## Boundaries

- **Legal:** never prompt for or reproduce Tibia/CipSoft art, names, layouts, item
  silhouettes, creatures, or UI. Describe constraints + the Akalynth identity.
- **Server-metadata lockstep:** art is display-only; manifests carry
  `mechanics: null`. Collision/walkability/zone/etc. live server-side.
- Config: `OPENAI_API_KEY` (+ optional `OPENAI_IMAGE_MODEL`) via `.env` — never
  committed. See `.env.example`.
