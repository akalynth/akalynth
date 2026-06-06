# Akalynth Forgehold Route Source Intake v1

Status: reviewed source intake; no runtime promotion.

This document indexes `drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1/` as design
source for a future route-expansion slice. It does not make raw drop data
authoritative, and it does not publish the slice through `infra/web`. Runtime
truth remains with reviewed code, receipts, verifiers, and docs under `apps/`,
`packages/`, and `docs/`.

## Source Read

Docs:

- `README.md`
- `docs/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1.md`
- `docs/AKALYNTH_FORGEHOLD_ROUTE_PREMISE_V1.md`
- `docs/AKALYNTH_FORGEHOLD_ROUTE_ORIGIN_CONTINUATIONS_V1.md`
- `docs/AKALYNTH_EMBER_ROAD_ROUTE_SPEC_V1.md`
- `docs/AKALYNTH_FORGEHOLD_ROUTE_EVIDENCE_OBJECTS_V1.md`
- `docs/AKALYNTH_SOULSTEEL_STABILIZATION_V1.md`
- `docs/AKALYNTH_HEARTFORGE_TRIAL_CHAMBER_DUNGEON_V1.md`
- `docs/AKALYNTH_OATHLESS_FORGE_BOSS_V1.md`
- `docs/AKALYNTH_FINAL_TEMPERING_CHOICES_V1.md`
- `docs/AKALYNTH_FORGEHOLD_ROUTE_CHRONICLE_ENTRY_V1.md`
- `docs/AKALYNTH_FORGEHOLD_ROUTE_UI_AND_SYSTEMS_V1.md`
- `docs/AKALYNTH_FORGEHOLD_ROUTE_PRODUCTION_CHECKLIST_V1.md`
- `docs/AKALYNTH_FORGEHOLD_ROUTE_RELEASE_GATES_V1.md`
- `docs/AKALYNTH_FORGEHOLD_ROUTE_IMPLEMENTATION_NOTES_V1.md`

Data and registries:

- `data/forgehold_route_summary.json`
- `data/locations.json`
- `data/route_states.json`
- `data/origin_roles.json`
- `data/factions.json`
- `data/acts.json`
- `data/evidence_objects.json`
- `data/profession_tasks.json`
- `data/crafting_quality.json`
- `data/dungeon_rooms.json`
- `data/boss.json`
- `data/final_choices.json`
- `data/route_unlocks.json`
- `data/ui_additions.json`
- `data/systems_added.json`
- `data/production_checklist.json`
- `data/release_gates.json`
- `data/success_criteria.json`
- `registry/akalynthForgeholdRouteSliceRegistry.ts`

Prompts and manifests:

- `prompts/AKALYNTH_FORGEHOLD_ROUTE_SLICE_POSTER_V1.prompt.md`
- `prompts/CLAUDE_CODE_AKALYNTH_FORGEHOLD_ROUTE_SLICE_WEBSITE_UPDATE.prompt.md`
- `prompts/CLAUDE_CODE_AKALYNTH_FORGEHOLD_ROUTE_PROTOTYPE_DATA.prompt.md`
- `MANIFEST.md`
- `MANIFEST.csv`
- `CHECKSUMS_SHA256.txt`

## Slice Coverage

The source package describes a 1-3 hour route slice with:

- prerequisite: `AKALYNTH_FIRST_PLAYABLE_SLICE_V1`
- route: High City -> Ember Road -> Forgehold Outer Gate
- locations including High City South Gate, Ember Road Mileposts, Burned
  Caravan Site, Ashglass Ravine, Cinderwatch Camp, Old Flame Shrine, Forgehold
  Outer Gate, and Heartforge Trial Chamber Entrance
- six acts from missing-shipment handoff through Forgehold Outer Gate decision
- route-based evidence objects and a missing Flamebound shipment investigation
- Soulsteel stabilization and first crafting-quality variation
- Heartforge Trial Chamber as the next dungeon candidate
- The Oathless Forge boss with evidence, heat, fake-material, pathing, and
  final-tempering beats
- Lantern / Shield / Blade final choice source outcomes
- route unlock source entries for Cinderwatch travel, Cinderwatch contracts,
  Forgehold Outer Gate access, Heartforge Trial repeat access, and first
  Soulsteel crafting recipes

These are indexed for future work only. They do not create live route travel,
hazards, crafting, dungeon access, boss behavior, faction outcomes, rewards, or
repeatable contracts in this pass.

## Current Handling

| Source element | Current handling |
| --- | --- |
| Route unlock state | Source-only. Needs map/transition authority, server state, and receipt-backed unlock rules before runtime. |
| Environmental hazards and route danger | Source-only. Needs server-side encounter rules and anti-cheat review before hazards affect movement, damage, or pressure. |
| Soulsteel stabilization and crafting quality | Source-only. Requires economy review for recipes, inputs, outputs, quality tiers, and rewards. |
| Heartforge Trial Chamber | Source-only dungeon candidate. Needs content rules, map/collision authority, entry receipts, failure receipts, and a focused verifier before playable use. |
| The Oathless Forge | Source-only boss candidate. Needs combat rules, anti-cheat thresholds, receipt coverage, and deterministic validation before runtime. |
| Lantern / Shield / Blade choice | Source-only consequence model. Any faction, route, item, or Chronicle effect needs a receipt before derived state changes. |
| Repeatable route contracts | Source-only. Needs economy and anti-cheat review before repeatable rewards or farming loops are live. |

## Economy And Rewards Boundary

The source package names rewards such as `improved Memory Lantern frame`,
`Ember Road defender mark`, and `unfinished Soulsteel weapon core`. These names
are design vocabulary only. This intake adds no item definitions, drop tables,
currency values, XP, crafting outputs, market behavior, or repeatable reward
loop.

## Review Flags

Any future implementation from this package needs explicit review lanes:

- `protocol-guardian` if clients need new route, dungeon, crafting, hazard,
  choice, or UI state.
- `receipt-chain-steward` for route unlocks, dungeon entry, failure, rewards,
  Chronicle records, or final-choice consequences.
- `economy-steward` for Soulsteel inputs, recipes, reward items, contracts,
  currency, XP, markets, or repeatable sources/sinks.
- `anti-cheat-steward` for route farming, hazards, combat pressure, movement
  checks, crafting validation, or contract abuse.
- `content-designer` for any later mob, NPC, dungeon, route, evidence, or boss
  implementation.

## Promotion Checklist

Before promoting any Forgehold element:

1. Choose one minimum path, such as burned-caravan evidence or route unlock.
2. Name the authoritative server state and receipt emitted before derived state
   changes.
3. Reconcile High City player-facing language with the current Rookguard
   onboarding and legacy `Azura` runtime id boundary.
4. Keep Android and debug-client inputs intent-only.
5. Define rewards only after economy review.
6. Add a focused verifier or smoke test before marking the path playable.

## Non-Claims

This intake adds no runtime route, no map authority, no protocol surface, no
receipt schema, no mob stats, no dungeon, no boss, no drop rate, no economy
reward, no faction reputation, no anti-cheat threshold, no APK or website
publication, and no server/client import from `drop/`.

## Verification Boundary

Expected checks after edits that reference this intake:

- `git diff --check`
- no runtime imports from `drop/` under `apps/` or `packages/`
- focused runtime verifier only after a future implementation promotes one
  concrete route, dungeon, crafting, boss, reward, or choice path
