# Runtime Authority Boundary Matrix

| Runtime Layer | May Own After Promotion | Must Not Own |
| --- | --- | --- |
| visual_object_layer | Render asset references, draw order, display hints | Collision, walkability, interactions, ownership, transitions |
| overlay_presentation_layer | Presentation overlay visibility inputs | House entry, ownership, permissions, server floor truth |
| collision_layer | Static blocking state | Visual rendering, transition destination, door state |
| walkability_layer | Traversal eligibility | Transition target, door permission, collision by implication |
| door_house_layer | Door state, house zones, ownership, lock/access policy | Visual rendering, transition destination, collision by implication |
| transition_layer | Source/destination/floor-change binding | Visual rendering, spawn/AI/combat, door ownership |
| map_bundle_manifest | Accepted layer versions, hashes, receipts, promotion status | Runtime behavior by implication |

## Runtime Non-Inference Rules

- A visual object id cannot create runtime collision.
- A collision cell cannot create runtime walkability.
- A walkable tile cannot create a transition.
- A door/house candidate cannot create a destination transfer.
- A transition candidate cannot create a destination map.
- Overlay visibility cannot define house entry or ownership.
- Runtime manifests cannot reference unaccepted candidate receipts.
