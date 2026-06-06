# High City Claim Boundary

## Accepted Narrow Claim For This Lane

The COSMIC_ROOT/VaultCore first-city material has been inspected and adapted into Akalynth design documents for High City as the proposed first-city concept.

## Canonical Naming Decision

Use:

- Akalynth: world/game/project name
- High City: first city concept
- VaultCore / COSMIC_ROOT: source inspiration only

Avoid:

- Azura as the new first city name
- Akalynth as the first city name
- VaultCore as runtime dependency
- COSMIC_ROOT as game runtime content

## Explicit Non-Claims

This lane does not:

- import COSMIC_ROOT code
- execute VaultCore scripts
- rename runtime Azura
- modify `packages/shared/maps/*.json`
- modify shared protocol or shared types
- modify server movement, collision, walkability, NPCs, mobs, shops, economy, ownership, or transitions
- promote a production map
- create player-facing canonical lore in runtime
- deploy anything

## Current Reality

Runtime Akalynth may still refer to Azura in maps, docs, tests, Android assets, property ids, and protocol-adjacent examples. Those references are not changed by this lane.

## Review Status

Status after implementation:

`implemented_pending_review`

Valid accepted status after review:

`accepted_high_city_source_extraction_design`

## Required Later Gates

Before High City can replace Azura in production, it needs separate lanes for:

1. naming migration design
2. runtime map id strategy
3. Rookguard gate target strategy
4. property id migration strategy
5. docs and player-facing copy migration
6. production map promotion candidate
7. beta deploy verification

## Core Rule

High City is a design target now, not a live map name.
