# Threshold Authority Model

A threshold is a candidate boundary between two movement contexts. It may look like a door, gate, sewer cover, stair, or passage, but the visual asset is not the authority.

## Draft Threshold Classes

- building_door_threshold
- city_gate_threshold
- interior_room_threshold
- sewer_transition_candidate
- stair_transition_candidate
- reserved_dynamic_blocker

## Draft States

The design reserves these future states without implementing them:

- open
- closed
- locked
- unlocked
- permission_gated
- blocked_by_runtime_actor
- reserved_unknown

## Resolution Rule

A reserved conditional collision/walkability tile may only be resolved by a future authority record. The authority record must explicitly name:

- threshold id
- tile and floor
- authority plane
- allowed runtime states
- owning system
- permission source, if any
- promotion receipt that made it runtime-valid

Until that exists, reserved conditionals remain draft candidates.
