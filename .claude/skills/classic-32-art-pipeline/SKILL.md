---
name: classic-32-art-pipeline
description: Use when generating, normalizing, packing, or reviewing Akalynth "Classic 32" world art and UI icons — 32x32 top-down pixel-art tiles, sprites, atlases, palettes, and the OpenAI asset pipeline — while keeping the legal boundary and server-metadata lockstep intact.
---

# Classic 32 Art Pipeline

Produce original old-school 32x32 top-down MMO art for Akalynth. Source of truth for direction:
`docs/CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md`.

Image models produce *source* art, never final production data. Deterministic post-processing produces game assets.

## Legal and creative boundary (non-negotiable)

- Never prompt an image model for "Tibia" sprites, "Tibia 7.6 style", or "exact Tibia-style assets".
- Never recreate Rookgaard, Thais, Venore, Svargrond, or other named CipSoft layouts, item silhouettes, creature designs, outfit shapes, or UI panels.
- Describe *constraints* (32x32, top-down square-grid, dark edge pixels, limited earthy palette), not copyrighted style.
- Allowed framing: "original 32x32 top-down MMO", "early 2000s browser RPG constraints".

## Metadata lockstep (non-negotiable)

- Visual walkability must never be inferred from the image alone.
- Collision, blocking, interactability, zone, heat, spawn, and receipt behavior live in map/server metadata, not pixels.
- Any visual tile that implies mechanics must have an explicit mechanical definition. Route mechanical changes through server + verification work (see `map-and-lore-builder`, `content-designer`, `protocol-guardian`).
- Server authority remains absolute: clients send intent, never truth.

## Production rules

- Base tile 32x32; large sprites 32x64 / 64x64 / multi-tile composites.
- Atlas padding 2px minimum; integer-only runtime scaling; nearest-neighbor filtering.
- Palette target 32-64 working colors per biome; usually 1px dark edge outline.
- Animation: 2-4 frames for simple effects, 4 frames for walk cycles.
- Models: current GPT Image family (e.g. `gpt-image-1.5`) for generation/edits; reasoning models for prompt/atlas/metadata tooling.

## Pipeline (do not one-shot a full spritesheet)

1. Generate a style board.
2. Approve one reference tile/sprite.
3. Generate a small coherent asset family.
4. Normalize to 32x32 (or approved multi-tile size).
5. Clean/remove background.
6. Quantize palette.
7. Slice and pack into atlas.
8. Add collision/gameplay metadata.
9. Preview in-game (debug-client or Android `GameCanvas`).
10. Iterate from screenshots.

Build small families, approve, then normalize and expand. First set before world expansion: core ground, borders, structures, props, and the starter creatures/effects listed in the doc.

Repo conventions: authored source art lives under `data/assets-src/sprites/`; runtime atlases are emitted to `data/assets-built/atlas/`; runtime consumes only `*-built/`. Note that `tools/atlas` is currently a scaffold (README only) — the atlas builder is not implemented yet, so step 7 (slice/pack) is not runnable. Do not claim a packed atlas exists until the builder lands.

## Output should name

- Assets produced and their dimensions/palette.
- Whether output is source art or normalized game-ready data.
- Atlas/metadata files touched.
- Any implied mechanics, flagged for server + verification routing.
- Confirmation the legal boundary was respected (no copied prompts/layouts).
