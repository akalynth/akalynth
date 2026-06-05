# AKALYNTH_MAP_OBJECT_METADATA_DESIGN_V1

Status: implemented_pending_design_review

Scope: metadata boundary design only.

This gate designs the separation between visual placement metadata and future gameplay authority. It does not promote a production map and does not create runtime collision, walkability, interaction, ownership, NPC, mob, shop, dialogue, spawn, AI, combat, or protocol behavior.

## Input

Primary input receipt:

- AKALYNTH_HIGH_CITY_BLOCK_LAYOUT_REFINEMENT_V1

That receipt accepts a refined high-city block as a visual layout candidate with minor visual notes. This design gate does not convert that candidate into a shared production map.

## Problem

The main failure mode is visual inference: a thing looks like a wall, door, shop, sewer, NPC, or creature, so the engine treats it as blocking, openable, sellable, enterable, talkable, hostile, or server-authoritative.

That inference is forbidden. The engine must only grant authority from the plane that owns that authority.

## Planes

The metadata model is split into independent planes:

1. Visual object plane
2. Overlay presentation plane
3. Collision plane
4. Walkability plane
5. Interaction plane
6. NPC/mob/content plane
7. Ownership/permission plane
8. Production map plane

No plane inherits authority from another plane. A production map candidate must explicitly cite the accepted visual layout receipt and then add separate evidence for collision, walkability, interaction, ownership, and content authority.

## Visual Object Plane

The visual object plane owns only draw placement. It answers:

- Which display-only visual asset is referenced?
- Which tile/floor anchor is used?
- Which render layer, anchor, scale, and z policy should the debug client use?

It does not answer:

- Can a player walk there?
- Does the sprite block movement?
- Is the sprite usable, openable, talkable, sellable, or enterable?
- Is the sprite a server NPC, mob, shop, spawn, door, house, or ownership object?

All visual map objects must use `mechanics: null` and explicit `authority` values of `none` for collision, walkability, interaction, server entity, NPC, mob, shop, dialogue, spawn, AI, combat, ownership, and door permissions.

## Overlay Presentation Plane

The overlay plane owns only presentation states such as visible, faded, and hidden. For this design gate, overlay context such as `interior_footprint`, `doorway_tiles`, and simulated `playerTile` remains review metadata only.

An overlay footprint is not a house zone. A doorway tile is not a permission model. A faded roof is not a server-authoritative floor visibility rule.

## Future Authority Planes

The collision, walkability, interaction, NPC/mob/content, ownership/permission, and production map planes are reserved for later gates. Draft schemas may name their intended shape, but no runtime package consumes them in this gate.

Future production work should remain staged:

1. AKALYNTH_VISUAL_MAP_OBJECT_FIXTURE_EXPORT_V1
2. AKALYNTH_COLLISION_WALKABILITY_METADATA_DESIGN_V1
3. AKALYNTH_DOOR_AND_HOUSE_AUTHORITY_DESIGN_V1
4. AKALYNTH_PRODUCTION_MAP_PROMOTION_CANDIDATE_V1

## Non-Inference Rules

- A wall sprite does not imply collision.
- A door sprite does not imply open or close behavior.
- A shop stall sprite does not imply shop inventory.
- A bed sprite does not imply sleep behavior.
- A sewer grate sprite does not imply travel or teleport behavior.
- A roof overlay does not imply house ownership or entry.
- An NPC-looking sprite does not imply a server NPC.
- A creature-looking sprite does not imply a server mob.
- A visual footprint does not imply walkability or blocking.
- A visual z-order rule does not imply physical priority or collision.

## Artifacts

- `authority_boundary_matrix.md`
- `draft_schemas/visual_map_object.schema.draft.json`
- `draft_schemas/visual_overlay_zone.schema.draft.json`
- `draft_schemas/collision_layer.schema.draft.json`
- `draft_schemas/interaction_layer.schema.draft.json`
- `examples/refined_high_city_visual_objects.draft.json`
- `examples/small_house_visual_objects.draft.json`
- `examples/market_shop_visual_objects.draft.json`
- `examples/castle_meeting_room_visual_objects.draft.json`
- `examples/sewer_hint_visual_objects.draft.json`
- `validation_plan.md`
- `map_object_metadata_design_receipt.json`

## Boundary

This gate is docs and draft schemas only. It must not modify shared production maps, shared protocol/types, server NPC or mob behavior, collision registries, walkability registries, ownership systems, house systems, dialogue, shops, factions, spawns, AI, or combat systems.
