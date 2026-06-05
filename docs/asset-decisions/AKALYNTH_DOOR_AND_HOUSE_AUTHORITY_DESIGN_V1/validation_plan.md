# Validation Plan

This design gate validates documents and draft schemas only.

## Future Required Checks

- Door authority records must reference reserved conditional threshold candidates.
- Door authority records must not be created from visual door sprites alone.
- Door records must not imply ownership unless an explicit house/access policy record exists.
- House authority records must define inside/outside regions explicitly.
- House regions must not be derived from roof overlays or debug-client visual footprints.
- Overlay visibility bindings may reference authoritative inside/outside state only after a future runtime gate.
- Access policies must not be implied by lock state, visual art, or ownership labels.
- Collision/walkability candidates must remain reserved conditional until a future authority gate resolves them.
- Negative fixtures must flag visual-to-authority leakage.

## Protected Runtime Boundary

This gate may not change server maps, protocol, runtime collision, runtime walkability, NPCs, mobs, shops, dialogue, factions, spawns, AI, combat, ownership, access lists, or door systems.
