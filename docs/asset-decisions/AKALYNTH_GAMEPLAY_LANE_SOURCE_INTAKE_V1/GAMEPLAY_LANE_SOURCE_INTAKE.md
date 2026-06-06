# Akalynth Gameplay Lane Source Intake v1

Status: reviewed source intake; no runtime promotion.

This document indexes `drop/AKALYNTH_GAMEPLAY_LANE_V1/` as design source for
future origins, professions, equipment, regions, progression, campaign, and raid
work. It does not make raw drop data authoritative. Runtime truth remains with
reviewed code, receipts, verifiers, and docs under `apps/`, `packages/`, and
`docs/`.

## Source Read

Docs:

- `README.md`
- `docs/AKALYNTH_ORIGINS_CODEX_V1.md`
- `docs/AKALYNTH_PROFESSIONS_CODEX_V1.md`
- `docs/AKALYNTH_EQUIPMENT_CODEX_V1.md`
- `docs/AKALYNTH_WORLD_MAP_V2.md`
- `docs/AKALYNTH_CAMPAIGN_BOOK_V1.md`
- `docs/AKALYNTH_RAID_BOSSES_CODEX_V1.md`
- `docs/AKALYNTH_PLAYER_PROGRESSION_MATRIX_V1.md`
- `docs/AKALYNTH_GAMEPLAY_LANE_GRAPH.mmd`

Data and registries:

- `SUMMARY.json`
- `data/origins.json`
- `data/profession_families.json`
- `data/legendary_professions.json`
- `data/equipment_sets.json`
- `data/materials.json`
- `data/world_regions.json`
- `data/raid_bosses.json`
- `data/progression_matrix.json`
- `data/akalynthGameplayLaneRegistry.ts`

Prompts and manifests:

- `prompts/CLAUDE_CODE_WEBSITE_GAMEPLAY_LANE_UPDATE_V1.md`
- `prompts/image_briefs/AKALYNTH_ORIGINS_CODEX_POSTER_V1.prompt.md`
- `prompts/image_briefs/AKALYNTH_PROFESSIONS_CODEX_POSTER_V1.prompt.md`
- `prompts/image_briefs/AKALYNTH_EQUIPMENT_CODEX_POSTER_V1.prompt.md`
- `prompts/image_briefs/AKALYNTH_WORLD_MAP_V2_POSTER.prompt.md`
- `prompts/image_briefs/AKALYNTH_RAID_BOSSES_CODEX_POSTER_V1.prompt.md`
- `MANIFEST.md`
- `MANIFEST.csv`
- `SHA256SUMS.txt`

## Lane Coverage

The source package describes:

- six origins: Archivist, Flamekeeper, Dreamwalker, Ashwarden, Tide Navigator,
  and Convergence Adept
- six profession families spanning archive, forge, dream, frontier, maritime,
  and convergence domains
- five legendary profession candidates: Witness Keeper, Vault Diver,
  Chronographer, Void Cartographer, and Accord Master
- six equipment-set candidates with named gear slots, material vocabulary, and
  special effects
- materials such as Soulsteel, Memory Glass, Moon Silver, Ashhide, Veridium
  Pearl, Leythread, and Void-Iron
- world-region source entries including High City, Forgehold, Cindervale,
  Veridium Port, Moonspire, Emberwilds, Silent Expanse, and Shattered
  Observatory
- raid-boss candidates with phases, signature mechanics, and loot names
- a player progression matrix connecting origins, profession paths, hooks, and
  first major locations

These are indexed for future work only. They do not create live origins,
profession progression, gear, materials, region travel, campaign stages, raid
encounters, loot, or progression rewards in this pass.

## Current Handling

| Source element | Current handling |
| --- | --- |
| Origins and starting cities | Source-only. Needs account/character, map, onboarding, and protocol review before runtime. Current player-facing first-city language still reconciles through Rookguard -> High City over the legacy `Azura` runtime id boundary. |
| Profession families and legendary professions | Source-only. Needs server-authoritative progression state, receipts, anti-abuse rules, and client intent boundaries before playable use. |
| Equipment sets and materials | Source-only. Needs economy review for item definitions, crafting inputs, outputs, quality, pricing, drops, and rewards. |
| World regions and travel | Source-only. Needs map authority, transition rules, collision/walkability, receipt coverage, and client compatibility before runtime. |
| Campaign and progression matrix | Source-only. Needs scoped implementation packets with explicit receipts and verifiers before any stage affects state. |
| Raid bosses and loot names | Source-only. Needs combat, encounter, anti-cheat, failure, reward, and receipt review before runtime. |

## Economy And Rewards Boundary

The source package names materials, gear, special effects, raid loot, and
profession unlocks. These names are design vocabulary only. This intake adds no
item definitions, drop tables, currency values, XP, crafting recipes, equipment
stats, market behavior, progression rewards, or raid loot.

## Review Flags

Any future implementation from this package needs explicit review lanes:

- `protocol-guardian` if clients need new character, origin, profession,
  equipment, map, progression, raid, or reward surfaces.
- `receipt-chain-steward` for origin selection, profession advancement, item
  creation, route unlocks, raid completion, loot, or Chronicle records.
- `economy-steward` for materials, gear, recipes, loot tables, prices, XP,
  currency, market effects, or repeatable reward loops.
- `anti-cheat-steward` for progression farming, crafting automation, travel
  abuse, raid mechanics, loot abuse, or profession-spam pressure.
- `content-designer` for any later origin, profession, region, campaign, mob,
  encounter, raid, equipment, or material implementation.

## Promotion Checklist

Before promoting any Gameplay Lane element:

1. Choose one minimum path, such as one origin intro or one profession action.
2. Name the authoritative server state and receipt emitted before derived state
   changes.
3. Reconcile High City and future starting-city language with the current
   Rookguard onboarding and legacy `Azura` runtime id boundary.
4. Keep Android and debug-client inputs intent-only.
5. Define rewards, materials, and progression only after economy review.
6. Add a focused verifier or smoke test before marking the path playable.

## Non-Claims

This intake adds no runtime origin, no profession tree, no equipment, no
material economy, no world-region travel, no campaign stage, no raid boss, no
mob stats, no loot table, no drop rate, no currency, no XP, no protocol surface,
no receipt schema, no anti-cheat threshold, no APK or website publication, and
no server/client import from `drop/`.

## Verification Boundary

Expected checks after edits that reference this intake:

- `git diff --check`
- no runtime imports from `drop/` under `apps/` or `packages/`
- focused runtime verifier only after a future implementation promotes one
  concrete origin, profession, equipment, material, region, progression, raid,
  reward, or campaign path
