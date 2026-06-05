# Akalynth First Playable Source Intake v1

Status: reviewed source intake; partial runtime promotion only.

This document indexes `drop/AKALYNTH_FIRST_PLAYABLE_SLICE_V1/` and the related
`drop/AKALYNTH_WORLD_EVENTS_ENGINE_V1/` package as design source. It does not
make raw drop data authoritative. Runtime truth stays in reviewed repo files,
receipts, verifiers, and code paths under `apps/`, `packages/`, and `docs/`.

## Source Read

- `AKALYNTH_FIRST_PLAYABLE_SLICE_V1/README.md`
- `data/playable_slice_summary.json`
- `data/systems_required.json`
- `data/release_gates.json`
- `data/field_fragments.json`
- `data/dungeon_rooms.json`
- `data/boss.json`
- `AKALYNTH_WORLD_EVENTS_ENGINE_V1/README.md`
- `data/canon_events.json`
- `data/integration_matrix.json`
- `data/release_gates.json`

## Reconciliation

The source package describes High City Outskirts as the first playable region.
Current runtime authority still exposes only `Rookguard` and `Azura`.

- Rookguard remains Act 0 onboarding: movement, chat signal, Tem, and the gate.
- Azura is the current archive/civic stand-in for first-playable experiments.
- High City, High City Outskirts, and First Archive are future map/canon names
  until a separate map/protocol/runtime authority pass expands `MapName`.
- Source factions and origin starts remain narrative/design input, not live
  progression or reputation systems.

## Accepted Runtime Seed

Only one first-playable element is promoted now: Witness Moth Bloom as a small
server-authoritative world event prototype.

Runtime behavior:

- The Bloom can start when a player reaches Azura and talks to the Azura herald.
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
no economy reward, no new map name, and no raw drop-source import.

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
