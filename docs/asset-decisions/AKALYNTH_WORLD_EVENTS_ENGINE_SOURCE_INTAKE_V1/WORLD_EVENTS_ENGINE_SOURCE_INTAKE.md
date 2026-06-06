# Akalynth World Events Engine Source Intake v1

Status: reviewed source intake; partial runtime promotion already exists.

This document indexes `drop/AKALYNTH_WORLD_EVENTS_ENGINE_V1/` as design source
for future world-event work. It does not make raw drop data authoritative. The
only currently promoted runtime seed from this package family is Witness Moth
Bloom, as documented by
`docs/asset-decisions/AKALYNTH_FIRST_PLAYABLE_SOURCE_INTAKE_V1/FIRST_PLAYABLE_SOURCE_INTAKE.md`.
Runtime truth remains with reviewed code, receipts, verifiers, and docs under
`apps/`, `packages/`, and `docs/`.

## Source Read

Docs:

- `README.md`
- `docs/AKALYNTH_WORLD_EVENTS_ENGINE_V1.md`
- `docs/AKALYNTH_EVENT_LIFECYCLE_V1.md`
- `docs/AKALYNTH_EVENT_TYPES_CATALOG_V1.md`
- `docs/AKALYNTH_CANON_EVENT_CARDS_V1.md`
- `docs/AKALYNTH_EVENT_CONTRIBUTION_SCORING_V1.md`
- `docs/AKALYNTH_EVENT_REWARD_STRUCTURE_V1.md`
- `docs/AKALYNTH_EVENT_FAILURE_AND_AFTERMATH_V1.md`
- `docs/AKALYNTH_WITNESS_MOTH_BLOOM_PROTOTYPE_V1.md`
- `docs/AKALYNTH_WORLD_EVENTS_INTEGRATION_MATRIX_V1.md`
- `docs/AKALYNTH_WORLD_EVENTS_RELEASE_GATES_V1.md`

Data and registries:

- `data/event_lifecycle.json`
- `data/event_types.json`
- `data/canon_events.json`
- `data/contribution_types.json`
- `data/reward_tiers.json`
- `data/integration_matrix.json`
- `data/release_gates.json`
- `registry/akalynthWorldEventsRegistry.ts`

Prompts and manifests:

- `prompts/AKALYNTH_WORLD_EVENTS_ENGINE_POSTER_V1.prompt.md`
- `prompts/CLAUDE_CODE_AKALYNTH_WORLD_EVENTS_WEBSITE_UPDATE.prompt.md`
- `MANIFEST.md`
- `MANIFEST.csv`
- `CHECKSUMS_SHA256.txt`

## Event Coverage

The source package describes:

- lifecycle phases: Signal, Investigation, Faction Response, Player
  Contribution, Crisis Phase, Resolution, Chronicle Record, and Aftermath
- event families for memory, void, forge, dream, and frontier events
- canon event cards including Witness Moth Bloom, Void Whale Sighting,
  Forgehold Crisis, Dream Convergence, Frontier Ashfall, and Archive Breach
- contribution categories for combat defense, recovery, crafting,
  verification, logistics, exploration, diplomacy, and dungeon completion
- reward tiers from participation through Chronicle mention eligibility and
  organization rewards
- integration points with cities, factions, creatures, dungeons, artifacts, and
  materials

These are indexed for future work only except for the already reviewed Witness
Moth Bloom runtime seed. They do not create live event schedules, event
families, rewards, failure/aftermath effects, faction consequences, dungeons,
mobs, materials, loot, or recurring contribution loops in this pass.

## Accepted Runtime Seed

Witness Moth Bloom is already promoted as a small server-authoritative prototype
through the first-playable source intake. Current runtime handling:

- existing `use_skill` intents remain the contribution surface
- world-event state changes are receipt-backed
- Chronicle rows and SQLite projection materialize the accepted receipts
- startup hydration restores the event from reviewed derived state
- the runtime module must not import raw `drop/` packages

This source intake does not expand Witness Moth Bloom beyond that accepted
scope.

## Current Handling

| Source element | Current handling |
| --- | --- |
| Event lifecycle | Source-only beyond the current Bloom lifecycle. New phases need state, receipt ordering, projection, hydration, and verifier coverage. |
| Event types and canon cards | Source-only. Each event needs a separate content/runtime packet before live use. |
| Contribution categories | Source-only beyond current Bloom `use_skill` intents. New categories need anti-cheat, scoring, and protocol review. |
| Reward tiers | Source-only. Needs economy review for materials, currency, titles, organization rewards, and Chronicle eligibility. |
| Failure and aftermath | Source-only. Any world-state, access, NPC, route, vendor, dungeon, or future-event consequence needs receipt-chain review before derived state changes. |
| Integration matrix | Source-only. Creature, dungeon, artifact, material, and faction links do not add live content here. |

## Economy And Rewards Boundary

The source package names reward tiers, materials, reputation, titles,
organization rewards, access unlocks, recipes, and Chronicle mention
eligibility. These names are design vocabulary only. This intake adds no item
definitions, material yields, drop tables, currency values, XP, title grants,
reputation points, recipes, vendor changes, organization rewards, or event
reward loops.

## Review Flags

Any future implementation from this package needs explicit review lanes:

- `protocol-guardian` if clients need new event state, contribution categories,
  score surfaces, reward surfaces, aftermath state, or schedule/event APIs.
- `receipt-chain-steward` for event start, contribution, scoring, resolution,
  rewards, failure, aftermath, Chronicle records, projection, or hydration.
- `economy-steward` for reward tiers, materials, recipes, currency, XP, titles,
  reputation, organization rewards, access, sources, sinks, or repeatable event
  loops.
- `anti-cheat-steward` for contribution spam, combat farming, crafting
  automation, logistics abuse, scoring exploits, dungeon repetition, or event
  schedule abuse.
- `content-designer` for any later event, faction, mob, dungeon, route, NPC,
  material, reward, failure, or aftermath implementation.

## Promotion Checklist

Before promoting any new world-event element:

1. Choose one minimum event path, such as one event phase or one contribution
   category.
2. Name the authoritative server state and receipt emitted before derived state
   changes.
3. Keep client inputs as intent-only and reject client truth claims.
4. Define rewards and scoring only after economy and anti-cheat review.
5. Add projection/hydration coverage if the event persists beyond a process.
6. Add a focused verifier before marking the path playable.

## Non-Claims

This intake adds no new runtime event, no event schedule, no event type, no
contribution score, no reward tier, no faction consequence, no failure effect,
no aftermath state, no dungeon, no mob, no material economy, no drop rate, no
currency, no XP, no protocol surface, no receipt schema, no anti-cheat
threshold, no APK or website publication, and no server/client import from
`drop/`.

## Verification Boundary

Expected checks after edits that reference this intake:

- `git diff --check`
- no runtime imports from `drop/` under `apps/` or `packages/`
- `npm -w apps/server run verify:world-events`
- focused runtime verifier only after a future implementation promotes one new
  event, phase, contribution, scoring, reward, failure, aftermath, projection,
  hydration, or schedule path
