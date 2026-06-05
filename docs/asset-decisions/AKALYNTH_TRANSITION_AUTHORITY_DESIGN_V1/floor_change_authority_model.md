# Floor Change Authority Model

Floor changes affect player location, map region, visibility, and server movement authority. They therefore need explicit transition authority rather than visual inference.

## Draft Floor Terms

- source_floor: the floor/index where activation begins
- destination_floor: the floor/index where the actor may arrive
- floor_delta: reserved draft description of vertical change
- floor_visibility_binding: future presentation relationship, not movement authority

## Directionality

A future transition may be:

- one_way
- two_way
- gated_by_state
- gated_by_permission
- reserved_unknown

Directionality is never inferred from art orientation.

## Safety Policy

Future transition records must define safety policy explicitly. Draft reserved shapes include:

- destination_must_exist
- destination_must_be_walkable
- destination_must_not_spawn_inside_blocker
- destination_must_preserve_lockstep_authority
- destination_may_require_receipt

This design only reserves the vocabulary. It does not validate runtime destinations.
