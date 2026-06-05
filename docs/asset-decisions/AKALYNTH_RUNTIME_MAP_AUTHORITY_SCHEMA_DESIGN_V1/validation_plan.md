# Validation Plan

This design gate validates draft schemas, draft examples, negative cases, and boundary claims only.

## Future Runtime Schema Validator Requirements

- Reject runtime visual objects that contain collision, walkability, door, house, transition, ownership, shop, dialogue, spawn, AI, combat, or server movement fields.
- Reject runtime collision layers that contain visual object placement, transition targets, door state, or shop/dialogue behavior.
- Reject runtime walkability layers that contain transition_to, door permissions, ownership, or destination maps.
- Reject overlay layers that claim house entry, ownership, server floor truth, or player inside/outside authority without an accepted runtime binding.
- Reject door/house layers that infer ownership or passability from visual assets.
- Reject transition layers that enable runtime movement without destination validation and floor policy.
- Reject manifests that set production_map_promoted true without a production promotion receipt.
- Reject manifests that reference unaccepted receipts or mismatched hashes.

## Protected Runtime Boundary

This gate may not change shared maps, protocol files, server movement, runtime collision/walkability registries, door/house systems, transition systems, NPCs, mobs, shops, dialogue, factions, spawns, AI, or combat systems.
