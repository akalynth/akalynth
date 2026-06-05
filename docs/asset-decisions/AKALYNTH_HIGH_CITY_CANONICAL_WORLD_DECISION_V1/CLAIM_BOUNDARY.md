# Claim Boundary

## Accepted Narrow Claim For This Lane

High City has been ratified, in a docs-only decision record, as the canonical first
city of Akalynth, with an owner-provided canonical district structure. Akalynth
remains the world/app/site name. Azura remains a legacy runtime identifier pending a
separate migration.

## What Is Proven

- A single canonical-world decision record now exists.
- The decision is consistent with the lore bible, the VaultCore world-bible lane, and
  the Azura identifier migration plan (see `DECISION_INPUTS_AND_PRECEDENT.md`).
- The owner's canonical High City district tree is recorded as authoritative.
- Open reconciliation items (Flamebound placement, Sky Spires, Ley Core, world-bible
  name alignment) are recorded explicitly and deferred, not silently resolved.

## Explicit Non-Claims

This lane does not:

- rename Azura in runtime
- modify `packages/shared/maps/*.json`
- modify shared protocol or shared types
- change server movement, collision, walkability, spawns, NPCs, mobs, shops,
  economy, quests, ownership, transitions, or character creation
- create or change any map object, district geometry, or tile
- implement factions, classes, origins, puzzles, rituals, or law systems
- promote any High City map into production
- bump the protocol version
- deploy anything
- execute or import any COSMIC_ROOT / VaultCore code

## Runtime Reality

Runtime Akalynth still refers to Azura in maps, tile names, ids, tests, Android
assets, and examples. This lane intentionally leaves all of that unchanged.

## Valid Closure

Closure target:

`closed_high_city_canonical_world_decided_no_runtime_mutation`
