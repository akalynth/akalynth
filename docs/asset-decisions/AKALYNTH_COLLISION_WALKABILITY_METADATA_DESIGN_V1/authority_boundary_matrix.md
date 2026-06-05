# Collision And Walkability Authority Boundary Matrix

Status: draft design for AKALYNTH_COLLISION_WALKABILITY_METADATA_DESIGN_V1.

| Plane | Owns | Must not own |
| --- | --- | --- |
| Visual object export | Display asset id, tile position, render layer, visual anchor | Blocking, traversal, movement permissions, door state |
| Review annotation | A non-authoritative pointer to inspect a tile or footprint | Collision, walkability, transitions, door behavior |
| Collision layer | Physical blocking and edge blocking, after later authority approval | Visual placement, shop behavior, dialogue, ownership, traversal by implication |
| Walkability layer | Tile traversal eligibility, after later authority approval | Visual art semantics, collision by implication, door/house permissions |
| Interaction layer | Use/talk/open/shop triggers, after later authority approval | Collision or walkability by implication |
| Door/house authority | Door state, access, ownership, lock and permission rules, after later authority approval | Visual overlay visibility or review footprints |
| Transition/floor-stack authority | Stairs, sewer travel, floor changes, underpasses, if later authorized | Visual grates, stairs, roofs, bridges by implication |
| Production map plane | Final runtime map composition after promotion | Debug fixture assumptions |

## Contract

Collision and walkability are never inherited from visual source assets, visual map objects, overlay footprints, review screenshots, NPC-looking sprites, creature-looking sprites, or object z-order.
