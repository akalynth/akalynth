# Akalynth First Playable Source Intake v1

Status: reviewed source intake; partial runtime promotion only.

This document indexes `drop/AKALYNTH_FIRST_PLAYABLE_SLICE_V1/` and the related
`drop/AKALYNTH_WORLD_EVENTS_ENGINE_V1/` package as design source. It does not
make raw drop data authoritative. Runtime truth stays in reviewed repo files,
receipts, verifiers, and code paths under `apps/`, `packages/`, and `docs/`.

## Source Read

- `AKALYNTH_FIRST_PLAYABLE_SLICE_V1/README.md`
- `data/playable_slice_summary.json`
- `data/origins.json`
- `data/locations.json`
- `data/acts.json`
- `data/systems_required.json`
- `data/release_gates.json`
- `data/production_checklist.json`
- `data/field_fragments.json`
- `data/dungeon_rooms.json`
- `data/boss.json`
- `data/final_choices.json`
- `data/ui_surfaces.json`
- `docs/AKALYNTH_FIRST_PLAYABLE_SLICE_V1.md`
- `docs/AKALYNTH_ORIGIN_OPENINGS_V1.md`
- `docs/AKALYNTH_WITNESS_MOTH_BLOOM_SLICE_EVENT_V1.md`
- `docs/AKALYNTH_FIRST_ARCHIVE_LOWER_VAULT_DUNGEON_V1.md`
- `docs/AKALYNTH_UNINDEXED_TRUTH_BOSS_V1.md`
- `docs/AKALYNTH_FIRST_PLAYABLE_SLICE_UI_SURFACES_V1.md`
- `docs/AKALYNTH_FIRST_PLAYABLE_SLICE_PRODUCTION_CHECKLIST_V1.md`
- `docs/AKALYNTH_FIRST_PLAYABLE_SLICE_RELEASE_GATES_V1.md`
- `docs/AKALYNTH_FIRST_PLAYABLE_SLICE_IMPLEMENTATION_NOTES_V1.md`
- `registry/akalynthFirstPlayableSliceRegistry.ts`
- `AKALYNTH_WORLD_EVENTS_ENGINE_V1/README.md`
- `data/canon_events.json`
- `data/integration_matrix.json`
- `data/release_gates.json`

## Reconciliation

The source package describes High City Outskirts as the first playable region.
Current runtime authority still exposes `Rookguard` and the legacy `Azura`
runtime id. New player-facing first-city copy should say High City.

- Rookguard remains Act 0 onboarding: movement, chat signal, Tem, and the gate.
- The legacy `Azura` runtime id is the current archive/civic stand-in for
  first-playable experiments.
- High City is the player-facing first-city name. `high_city`, High City
  Outskirts, and First Archive remain future runtime/canon promotions until a
  separate map/protocol/runtime authority pass expands the full map authority.
- Source factions and origin starts remain narrative/design input, not live
  progression or reputation systems.

## Full Slice Coverage

The source package describes a 1-3 hour vertical slice with:

- three origin openings: Archivist, Flamekeeper, and Ashwarden
- High City Outskirts as the first playable region
- field evidence and archive verification beats
- profession utility hooks
- First Archive Lower Vault dungeon
- The Unindexed Truth boss
- Preserve / Suppress / Release final choice
- UI surfaces for origin task, evidence, event phase, dungeon access, boss
  truth state, and final choice
- release gates for origin, evidence, verification, profession, dungeon, boss,
  choice, and Chronicle readiness

These are indexed for future work only. They do not create live origin
selection, dungeon entry, boss mechanics, faction trust, UI state, or final
choice outcomes in this pass.

## Accepted Runtime Seed

Only one first-playable element is promoted now: Witness Moth Bloom as a small
server-authoritative world event prototype.

Runtime behavior:

- The Bloom can start when a player reaches High City and talks to the High City
  herald. In this prep slice that still resolves through the legacy `Azura`
  runtime map/NPC ids.
- The server emits `world_event_started` before changing event state.
- Players contribute through existing `use_skill` intents:
  - `event:witness_moth_bloom:verify_testimony`
  - `event:witness_moth_bloom:craft_lantern_frame`
  - `event:witness_moth_bloom:defend_scribes`
- The server validates map, event phase, and duplicate contributions.
- Accepted contributions emit `world_event_contribution` receipts.
- Completion emits `world_event_resolved` with the deterministic prototype
  outcome `controlled_release`.
- Chronicle rows are derived as `world_event` events from those receipts.
- SQLite schema v17 materializes the event into `world_events`, and startup
  hydration restores the Bloom runtime from that projection.

This promotion adds no new WebSocket message shape, no new client truth claim,
no economy reward, no full `high_city` runtime-id switch, and no raw
drop-source import.

## Deferred Source

The following remain source-only:

- full origin selection and origin-specific starts
- full faction model and faction reputation
- High City / High City Outskirts map authority
- First Archive Lower Vault dungeon
- Unindexed Truth boss
- Preserve / Suppress / Release final choice
- Memory Fragment or Witness Moth material economy rewards
- full world-event reward tiers, failure aftermath, and recurring schedules

## Future Promotion Checklist

Before promoting another element from this slice:

1. Select one minimum path, such as evidence comparison or dungeon access.
2. Name the server state and receipt action that precede any derived state.
3. Keep Android and debug-client inputs intent-only.
4. Reconcile any High City map change with the legacy `Azura` runtime id and
   existing Rookguard onboarding.
5. Add a focused verifier for the promoted behavior before expanding the next
   slice beat.

## Verification Boundary

The promoted slice is verified by:

- `npm -w apps/server run verify:world-events`
- `npm -w apps/server run verify:chronicle`
- `npm -w apps/server run verify:receipt-hygiene`
- `npm run verify`

The verifier proves event order, receipt coverage, Chronicle materialization,
idempotent SQLite projection, startup hydration, and the no-raw-drop runtime
import boundary. It does not claim a content-alpha or production-ready
world-events system.
