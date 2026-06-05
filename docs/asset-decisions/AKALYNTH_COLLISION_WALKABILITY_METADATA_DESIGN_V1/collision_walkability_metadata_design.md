# AKALYNTH_COLLISION_WALKABILITY_METADATA_DESIGN_V1

Status: implemented_pending_design_review

Scope: design-only.

This gate designs how Akalynth will represent collision and walkability as separate draft metadata planes without deriving either plane from visual art. It does not implement runtime collision, runtime walkability, server movement logic, production map object metadata, door authority, house ownership, sewer transitions, NPC or mob behavior, shops, dialogue, factions, spawns, AI, combat, or protocol changes.

## Purpose

Design separate draft collision and walkability metadata planes without deriving movement authority from visual objects.

Core rule:

A visual object may guide human review, but it never grants collision or walkability authority.

So:

- wall sprite does not equal blocked tile
- floor sprite does not equal walkable tile
- door sprite does not equal passable doorway
- sewer hole sprite does not equal transition
- chair sprite does not equal blocking furniture

Those meanings must come from separate metadata gates.

## Input Receipts

- AKALYNTH_MAP_OBJECT_METADATA_DESIGN_V1
- AKALYNTH_VISUAL_MAP_OBJECT_FIXTURE_EXPORT_V1

The visual fixture export may suggest where reviewers should inspect. It is not movement authority.

## Plane Separation

| Plane | Owns | Must not own |
| --- | --- | --- |
| visual object | sprite placement, draw layer, anchor, scale | movement blocking, traversal, interaction |
| overlay presentation | visible/faded/hidden presentation | house entry, floor authority, access permissions |
| collision | static occupancy blocking candidate | visual rendering, shop/dialogue, ownership |
| walkability | tile traversal candidate | collision by implication, visual rendering |
| interaction | future usable/openable/talkable triggers | blocking by implication |
| transition | future stairs/sewers/doors/teleports | walkability by implication |
| NPC/mob content | future server actors | visual preset import by implication |
| production map | future accepted runtime composition | debug fixture assumptions |

Collision and walkability should be related but not merged.

## Coordinate Contract

Draft candidate metadata uses this coordinate frame:

```json
{
  "coordinate_system": {
    "origin": "top_left",
    "unit": "tile",
    "tile_size_px": 32,
    "axes": {
      "x": "east",
      "y": "south"
    },
    "floor": {
      "default": 0,
      "meaning": "visual/debug floor index only until production promotion"
    }
  }
}
```

This does not change runtime maps. It only defines how candidate metadata is written.

## Collision Layer

Collision answers: can an actor occupy this tile from a static obstruction standpoint?

Allowed collision states:

- `blocked`
- `clear`
- `reserved_conditional`
- `unknown`

`reserved_conditional` is for doors, stairs, sewer entrances, future transitions, and future dynamic blockers. This gate does not solve them.

## Walkability Layer

Walkability answers: may an actor traverse this tile in the map design?

Allowed walkability states:

- `walkable`
- `not_walkable`
- `reserved_conditional`
- `unknown`

Again, `reserved_conditional` is for future door, stair, sewer, and transition gates.

## Consistency Rules

- `collision.blocked` plus `walkability.walkable` is invalid.
- `collision.clear` plus `walkability.not_walkable` is allowed, but must have a reason.
- `collision.unknown` plus any walkability state is a warning.
- `walkability.walkable` without a collision entry is a warning in draft and invalid in production candidate.
- `collision.blocked` on a doorway candidate is a warning unless the tile is `reserved_conditional`.
- Doorway and threshold tiles should be `reserved_conditional` until door authority is designed.
- Sewer entrances should be `reserved_conditional` until transition authority is designed.
- Visual object references are evidence only, never authority.

Allowed:

- visual reference helps reviewer locate the object

Forbidden:

- visual reference automatically determines collision or walkability

## Boundary

This gate may create docs, draft schemas, examples, validation cases, and validation reports only. It must not touch protected runtime files or shared production maps.
