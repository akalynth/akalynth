# Akalynth Cinderwatch Frontier Source Intake v1

Status: reviewed source intake; no runtime promotion.

This document indexes `drop/AKALYNTH_CINDERWATCH_FRONTIER_SLICE_V1/` as design
source for a future frontier/survival slice. It does not make raw drop data
authoritative, and it does not publish the slice through `infra/web`. Runtime
truth remains with reviewed code, receipts, verifiers, and docs under `apps/`,
`packages/`, and `docs/`.

## Source Read

Docs:

- `README.md`
- `docs/AKALYNTH_CINDERWATCH_FRONTIER_SLICE_V1.md`
- `docs/AKALYNTH_ASHWARDEN_FRONTIER_GAMEPLAY_V1.md`
- `docs/AKALYNTH_CINDERWATCH_CAMP_STATE_V1.md`
- `docs/AKALYNTH_CREATURE_TRACKING_SYSTEM_V1.md`
- `docs/AKALYNTH_CARAVAN_ESCORT_SYSTEM_V1.md`
- `docs/AKALYNTH_FRONTIER_PATROL_CONTRACTS_V1.md`
- `docs/AKALYNTH_FRONTIER_FORTIFICATION_SYSTEM_V1.md`
- `docs/AKALYNTH_NAVIGATOR_GUILDS_INTRODUCTION_V1.md`
- `docs/AKALYNTH_GLASSFANG_BROOD_V1.md`
- `docs/AKALYNTH_GLASSFANG_MATRIARCH_BOSS_V1.md`
- `docs/AKALYNTH_FRONTIER_ASHFALL_EVENT_SEED_V1.md`
- `docs/AKALYNTH_CINDERWATCH_FRONTIER_CHRONICLE_ENTRY_V1.md`
- `docs/AKALYNTH_CINDERWATCH_FRONTIER_UI_AND_SYSTEMS_V1.md`
- `docs/AKALYNTH_CINDERWATCH_FRONTIER_PRODUCTION_CHECKLIST_V1.md`
- `docs/AKALYNTH_CINDERWATCH_FRONTIER_RELEASE_GATES_V1.md`
- `docs/AKALYNTH_CINDERWATCH_FRONTIER_IMPLEMENTATION_NOTES_V1.md`

Data and registries:

- `data/cinderwatch_frontier_summary.json`
- `data/locations.json`
- `data/origin_roles.json`
- `data/factions.json`
- `data/acts.json`
- `data/camp_states.json`
- `data/patrol_contracts.json`
- `data/creature_tracks.json`
- `data/creature_states.json`
- `data/caravan_events.json`
- `data/fortification_projects.json`
- `data/boss.json`
- `data/final_choices.json`
- `data/event_seed.json`
- `data/ui_additions.json`
- `data/systems_added.json`
- `data/production_checklist.json`
- `data/release_gates.json`
- `data/success_criteria.json`
- `registry/akalynthCinderwatchFrontierSliceRegistry.ts`

Prompts and manifests:

- `prompts/AKALYNTH_CINDERWATCH_FRONTIER_SLICE_POSTER_V1.prompt.md`
- `prompts/CLAUDE_CODE_AKALYNTH_CINDERWATCH_FRONTIER_SLICE_WEBSITE_UPDATE.prompt.md`
- `prompts/CLAUDE_CODE_AKALYNTH_CINDERWATCH_FRONTIER_PROTOTYPE_DATA.prompt.md`
- `MANIFEST.md`
- `MANIFEST.csv`
- `CHECKSUMS_SHA256.txt`

## Slice Coverage

The source package describes a 1-3 hour frontier slice with:

- prerequisite source context from `AKALYNTH_FIRST_PLAYABLE_SLICE_V1` and
  `AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1`
- region frame: Cinderwatch Frontier between the reopened Ember Road and the
  Cindervale outer approach
- primary gameplay: patrol contracts, creature tracking, caravan/refugee
  escort, camp fortification, and survival policy
- supported origin roles: Ashwarden, Flamekeeper, Archivist, Dreamwalker, and
  Tide Navigator
- faction presences for Ashwardens, Navigator Guilds, Oathbound, Flamebound,
  Codexborn, and frontier refugees
- eight location nodes including Cinderwatch Camp, Ember Road East, Ashen Mile,
  Broken Watchtower, Glassfang Nest, Refugee Crossing, Old Signal Beacon, and
  Cindervale Outer Approach
- Glassfang Brood pressure and The Glassfang Matriarch boss candidate
- Fortify Camp / Keep Route Open / Track Storm Source final policy source
  outcomes
- Frontier Ashfall event seed and an Ashline Frontier Chronicle entry source

These are indexed for future work only. They do not create live frontier travel,
patrol contracts, tracking state, camp condition, caravan escort, refugee
pressure, fortification projects, boss behavior, faction outcomes, rewards,
Chronicle output, or world-event scheduling in this pass.

## Current Handling

| Source element | Current handling |
| --- | --- |
| Cinderwatch Frontier region | Source-only. Needs map/transition authority and server-side access rules before runtime travel. |
| Patrol contracts | Source-only. Needs server-authoritative contract state, anti-abuse rules, and receipts before repeatable use. |
| Creature tracking | Source-only. Needs evidence state, confidence rules, and client intent boundaries before playable tracking. |
| Caravan and refugee escort | Source-only. Needs escort state, failure rules, route pressure, and receipt-backed outcome changes. |
| Camp condition and fortification | Source-only. Needs persistent camp state, material/reward review, visible-state rules, and receipts before derived state changes. |
| Glassfang Brood and Matriarch | Source-only encounter/boss candidate. Needs combat rules, anti-cheat review, failure receipts, and deterministic validation before runtime. |
| Frontier policy choice | Source-only consequence model. Any faction, route, item, event, or Chronicle effect needs a receipt before derived state changes. |
| Frontier Ashfall seed | Source-only future event seed. Needs world-event scheduling, aftermath, rewards, and receipt review before live use. |

## Economy And Rewards Boundary

The source package names rewards such as `Ashwarden fortification mark`,
`Navigator route license`, and `Ashfall scout report`. These names are design
vocabulary only. This intake adds no item definitions, drop tables, currency
values, XP, crafting inputs, market behavior, reputation yields, contract
rewards, or repeatable reward loop.

## Review Flags

Any future implementation from this package needs explicit review lanes:

- `protocol-guardian` if clients need camp state, patrol board, tracking,
  caravan, boss, policy, Chronicle, or event UI surfaces.
- `receipt-chain-steward` for patrol completion, evidence recovery, escort
  outcomes, fortification changes, boss outcomes, policy choices, Chronicle
  records, or event seeds.
- `economy-steward` for fortification materials, route-license rewards,
  contract rewards, supplies, trade effects, XP, currency, reputation, or
  repeatable reward sources/sinks.
- `anti-cheat-steward` for repeatable patrol farming, escort automation,
  tracking spoofing, route-pressure manipulation, boss combat pressure, or
  event-contribution abuse.
- `content-designer` for any later region, NPC, patrol, track, caravan, camp,
  creature, boss, or Chronicle implementation.

## Promotion Checklist

Before promoting any Cinderwatch element:

1. Choose one minimum path, such as one patrol contract or one creature-track
   recovery.
2. Name the authoritative server state and receipt emitted before derived state
   changes.
3. Reconcile Cinderwatch travel with the current Rookguard to High City
   player-facing path, Forgehold route source intake, and legacy `Azura`
   runtime id boundary.
4. Keep Android and debug-client inputs intent-only.
5. Define rewards, faction effects, and repeatable contract outputs only after
   economy review.
6. Add a focused verifier or smoke test before marking the path playable.

## Non-Claims

This intake adds no runtime frontier region, no map authority, no protocol
surface, no receipt schema, no persistent camp state, no patrol board, no
tracking state, no escort system, no mob stats, no boss, no drop rate, no
economy reward, no faction reputation, no world-event schedule, no anti-cheat
threshold, no APK or website publication, and no server/client import from
`drop/`.

## Verification Boundary

Expected checks after edits that reference this intake:

- `git diff --check`
- no runtime imports from `drop/` under `apps/` or `packages/`
- focused runtime verifier only after a future implementation promotes one
  concrete patrol, tracking, escort, camp, fortification, boss, policy,
  Chronicle, reward, or event path
