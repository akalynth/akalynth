# Validation Plan

This gate validates draft design artifacts only.

## Future Required Checks

- Transition authority records must reject visual-only transition declarations.
- Walkability records must reject transition_to fields.
- Door/house candidates must reject teleport or floor-change targets.
- Transition candidates must include source and destination shape before runtime promotion.
- Floor changes must include explicit floor policy before runtime promotion.
- Runtime-enabled transitions require a later runtime gate and promotion receipt.
- Destination map or region references must be validated by a future production candidate gate.
- Transition records must not grant spawn, AI, combat, shop, dialogue, or mob behavior.

## Protected Runtime Boundary

This gate may not change server maps, protocol, runtime collision, runtime walkability, transition runtime registries, door/house systems, NPCs, mobs, shops, dialogue, factions, spawns, AI, or combat systems.
