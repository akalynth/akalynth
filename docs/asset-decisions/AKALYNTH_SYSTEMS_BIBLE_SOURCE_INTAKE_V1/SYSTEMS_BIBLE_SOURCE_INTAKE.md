# Akalynth Systems Bible Source Intake v1

Status: reviewed source intake; no runtime promotion.

This document indexes `drop/AKALYNTH_SYSTEMS_BIBLE_V1/` as design source for
future progression, combat, economy, crafting, reputation, world-state,
death/failure, social-organization, and first-playable systems work. It does
not make raw drop data authoritative. Runtime truth remains with reviewed code,
receipts, verifiers, and docs under `apps/`, `packages/`, and `docs/`.

## Source Read

Docs:

- `README.md`
- `docs/AKALYNTH_SYSTEMS_BIBLE_V1.md`
- `docs/AKALYNTH_PROGRESSION_SYSTEM_V1.md`
- `docs/AKALYNTH_COMBAT_SYSTEM_V1.md`
- `docs/AKALYNTH_ECONOMY_AND_CRAFTING_SYSTEM_V1.md`
- `docs/AKALYNTH_REPUTATION_AND_AUTHORITY_SYSTEM_V1.md`
- `docs/AKALYNTH_WORLD_STATE_AND_EVENTS_SYSTEM_V1.md`
- `docs/AKALYNTH_DEATH_AND_FAILURE_STATES_V1.md`
- `docs/AKALYNTH_SOCIAL_ORGANIZATIONS_SYSTEM_V1.md`
- `docs/AKALYNTH_FIRST_PLAYABLE_SLICE_SPEC_V1.md`
- `docs/AKALYNTH_SYSTEMS_DECISION_MATRIX_V1.md`

Data and registries:

- `data/systems_decisions.json`
- `data/progression_tracks.json`
- `data/reputation_layers.json`
- `data/resource_families.json`
- `data/world_state_phases.json`
- `data/prototype_scope.json`
- `data/release_gates.json`
- `registry/akalynthSystemsRegistry.ts`

Prompts and manifests:

- `prompts/AKALYNTH_SYSTEMS_BIBLE_POSTER_V1.prompt.md`
- `prompts/CLAUDE_CODE_AKALYNTH_SYSTEMS_WEBSITE_UPDATE.prompt.md`
- `MANIFEST.md`
- `MANIFEST.csv`
- `CHECKSUMS_SHA256.txt`

## Systems Coverage

The source package describes a broad mechanical layer:

- mastery, origin memory, profession, faction, city, dungeon, artifact,
  Chronicle, and organization progression tracks
- combat as party-capable field, dungeon, crisis, and boss support
- economy and crafting with resource families, controlled sinks, regional
  supply, profession specialization, and utility-focused outputs
- reputation and authority layers across factions, cities, professions, and
  organizations
- world-state phases from anomaly detection through player contribution,
  resolution, and Chronicle record
- death and failure states including durability, memory instability, route
  rollback, dungeon failure, and social consequences
- social organizations as long-lived group identity and authority carriers
- a first-playable systems slice that should remain bounded until explicit
  runtime promotion lanes select one narrow path

These are indexed for future work only. They do not create live progression,
combat rules, crafting recipes, reputation unlocks, world-state schedules,
death penalties, social organizations, rewards, route access, or first-playable
systems in this pass.

## Current Handling

| Source element | Current handling |
| --- | --- |
| Progression stack | Source-only. Current release claims remain bounded by `docs/CURRENT_STAGE.md`; any progression state needs server authority, receipts, and client compatibility review. |
| Combat and encounter model | Source-only. Existing combat code is implemented-but-not-release-claimed; new roles, party rules, boss mechanics, or failure behavior need focused verification. |
| Economy and crafting | Source-only. Materials, sinks, regional supply, recipes, outputs, quality, market effects, and rewards need economy review before runtime. |
| Reputation and authority | Source-only. Any faction, city, profession, or organization standing needs receipt-backed state before it can unlock access. |
| World-state phases and events | Source-only. Current promoted seed remains Witness Moth Bloom only; broader regional phases need protocol, persistence, and receipt review. |
| Death and failure states | Source-only unless already implemented and named by current verifiers. New durability, memory, rollback, or penalty effects need receipt and replay coverage. |
| Social organizations | Source-only. Organization halls, roles, privileges, and collective standing need account/identity, authority, and abuse review before runtime. |
| First playable systems slice | Source-only. Use existing first-playable intake and current High City/Rookguard boundary before promoting any system path. |

## Economy And Rewards Boundary

The source package names resource families, crafting outputs, utility items,
market behavior, controlled sinks, prices, progression benefits, and rewards as
systems vocabulary. This intake adds no item definitions, drop tables, currency
values, XP, recipes, durability math, reward schedules, market modifiers,
crafting quality, or progression boosts.

## Review Flags

Any future implementation from this package needs explicit review lanes:

- `protocol-guardian` if clients need progression, combat, crafting,
  reputation, world-state, death/failure, organization, or event UI/API
  surfaces.
- `receipt-chain-steward` for progression advancement, reputation changes,
  crafting outputs, world-state transitions, death/failure effects,
  organization privileges, or Chronicle records.
- `economy-steward` for resources, recipes, sinks, prices, market effects,
  reward loops, durability costs, crafting quality, XP, or currency changes.
- `anti-cheat-steward` for combat farming, crafting automation, progression
  spam, reputation abuse, route/event farming, or organization privilege abuse.
- `content-designer` for any later mob, encounter, dungeon, region, profession,
  item, recipe, route, event, boss, or social-organization implementation.
- `gameplay-loop-designer` for selecting a narrow player action loop before any
  broad systems layer is promoted.

## Promotion Checklist

Before promoting any Systems Bible element:

1. Choose one minimum path, such as one progression action, one reputation
   grant, one recipe, or one world-state transition.
2. Name the authoritative server state and receipt emitted before derived state
   changes.
3. Reconcile High City and future route/region language with the current
   Rookguard onboarding and legacy `Azura` runtime id boundary.
4. Keep Android and debug-client inputs intent-only.
5. Define economy, rewards, and penalties only after economy and anti-cheat
   review.
6. Add a focused verifier or smoke test before marking the path playable.

## Non-Claims

This intake adds no runtime progression, no combat rule, no recipe, no material
economy, no reputation layer, no world-state phase, no death penalty, no social
organization, no first-playable system, no item definition, no drop table, no
currency value, no XP, no protocol surface, no receipt schema, no anti-cheat
threshold, no APK or website publication, and no server/client import from
`drop/`.

## Verification Boundary

Expected checks after edits that reference this intake:

- `git diff --check`
- no runtime imports from `drop/` under `apps/` or `packages/`
- focused runtime verifier only after a future implementation promotes one
  concrete progression, combat, crafting, reputation, world-state, failure,
  organization, reward, or first-playable system path
