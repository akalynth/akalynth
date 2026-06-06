# Akalynth Asset Library Source Intake v1

Status: reviewed source intake; no runtime promotion.

This document indexes `drop/AKALYNTH_ASSET_LIBRARY_V1/` as local visual and
lore source material. It does not make raw drop files authoritative. Runtime
truth stays in reviewed repo files, verifiers, receipts, and code paths under
`apps/`, `packages/`, and `docs/`.

## Source Read

Manifests:

- `manifests/MANIFEST.md`
- `manifests/MANIFEST.csv`
- `manifests/SHA256SUMS.txt`

Image collections:

- `images/00_source_inputs/AKALYNTH_WORLD_BIBLE_PAGE_2_SOURCE.png`
- `images/01_world_bible/AKALYNTH_WORLD_BIBLE_SMALL_ASSET_EXTRACTION_DRAFT.png`
- `images/01_world_bible/AKALYNTH_WORLD_BIBLE_EXTRACTION_V1_HIGH_DETAIL_VARIANT_A.png`
- `images/01_world_bible/AKALYNTH_WORLD_BIBLE_EXTRACTION_V1_CLEAN_VARIANT_B.png`
- `images/02_city_region_atlas/HIGH_CITY_CHARTER_V1.png`
- `images/02_city_region_atlas/EMBERWILDS_ATLAS_V1.png`
- `images/02_city_region_atlas/HIGH_CITY_CROSS_SECTION_V1.png`
- `images/03_creature_codex/CHRONOSHELL_TURTLE_CODEX_V1.png`
- `images/03_creature_codex/DREAMWEAVER_CODEX_V1.png`
- `images/03_creature_codex/ECHO_STALKER_CODEX_V1.png`
- `images/03_creature_codex/MEMORY_SERPENT_CODEX_V1.png`
- `images/03_creature_codex/VOID_WHALE_CODEX_V1.png`
- `images/03_creature_codex/WITNESS_MOTH_CODEX_V1.png`
- `images/03_creature_codex/WITNESS_MOTH_CODEX_V2.png`
- `images/04_collection_posters/AKALYNTH_ARTIFACTS_CODEX_POSTER_V1.png`
- `images/04_collection_posters/AKALYNTH_CHRONICLE_OF_AGES_POSTER_V1.png`
- `images/04_collection_posters/AKALYNTH_DUNGEON_CODEX_POSTER_V1.png`
- `images/04_collection_posters/AKALYNTH_FACTIONS_CODEX_POSTER_V1.png`
- `images/04_collection_posters/AKALYNTH_HEROES_CODEX_POSTER_V1.png`

Text codices:

- `markdown/AKALYNTH_ASSET_LIBRARY_INDEX.md`
- `markdown/AKALYNTH_ARTIFACTS_CODEX_V1.md`
- `markdown/AKALYNTH_CHRONICLE_OF_AGES_V1.md`
- `markdown/AKALYNTH_CITIES_SUMMARY_V1.md`
- `markdown/AKALYNTH_CREATURES_SUMMARY_V1.md`
- `markdown/AKALYNTH_DUNGEON_CODEX_V1.md`
- `markdown/AKALYNTH_FACTIONS_CODEX_V1.md`
- `markdown/AKALYNTH_HEROES_CODEX_V1.md`
- `markdown/AKALYNTH_VILLAINS_CODEX_V1.md`

## Reconciliation

- High City is player-facing first-city language, but these assets do not
  promote a `high_city` runtime map id, collision plane, district schema, or
  NPC placement.
- Witness Moth visual and lore material supports the existing Bloom source
  intake, but it does not add mobs, combat behavior, rewards, or event phases.
- First Archive, dungeon, creature, faction, artifact, hero, villain, and
  chronicle material remains future canon/design input until accepted by a
  separate content, map, or runtime authority packet.
- Images are not normalized into the Classic 32 pipeline here and are not copied
  into application asset folders.

## Promotion Candidates

Future lanes may review:

- High City charter and cross-section images for canonical city visual language.
- Witness Moth codex images for event art or UI flavor.
- Creature and faction summaries for content-designer intake.
- Dungeon and Chronicle codices for First Archive/Lower Vault planning.

Each promotion must name whether it is lore-only, visual asset, map authority,
content data, protocol, receipt, economy, or runtime behavior.

## Non-Claims

This intake adds no gameplay consequences, no economy values, no drop tables, no
mob stats, no map collision/walkability, no Android or debug-client assets, no
receipt schema, and no server/client import from `drop/`.

## Verification Boundary

Expected checks after edits that reference this intake:

- `git diff --check`
- no runtime imports from `drop/` under `apps/` or `packages/`
- `npm run verify`
