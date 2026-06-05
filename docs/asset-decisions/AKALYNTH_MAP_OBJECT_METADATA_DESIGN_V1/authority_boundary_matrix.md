# Authority Boundary Matrix

Status: draft design for AKALYNTH_MAP_OBJECT_METADATA_DESIGN_V1.

| Plane | Owns | Must not own |
| --- | --- | --- |
| Visual asset sidecar | Render dimensions, asset id, frame info, display-only hints | Collision, walkability, interaction, ownership |
| Visual map object | Where a visual sprite is drawn | Blocking, door behavior, shop behavior, spawn behavior |
| Overlay zone | Visible, faded, and hidden presentation | House ownership, entry permissions, floor-stack authority |
| Collision layer | Physical blocking, if later authorized | Visual asset placement |
| Walkability layer | Tile traversal, if later authorized | Visual art semantics |
| Interaction layer | Usable, openable, talkable, shop triggers, if later authorized | Collision by implication |
| NPC/mob layer | Server-authored entity behavior | Visual preset import by implication |
| Ownership/permission layer | House, door, lock, access, and protection authority, if later authorized | Overlay or doorway review hints |
| Production map plane | Final accepted runtime map composition | Debug-client fixture assumptions |

## Explicit Prohibitions

Visual metadata may not contain fields named or shaped like:

- `blocking`
- `walkable`
- `collision` as a behavior field outside explicit `authority.collision: "none"`
- `collisionShape`
- `interactionType`
- `shopInventory`
- `dialogueTree`
- `spawnTable`
- `ai` as a behavior field outside explicit `authority.ai: "none"`
- `combat` as a behavior field outside explicit `authority.combat: "none"`
- `ownership` as a behavior field outside explicit `authority.ownership: "none"`
- `accessList`
- `doorPermissions`
- `houseZone`
- `serverEntity`

The draft visual schemas encode this by allowing only a narrow field set and by requiring authority fields to be explicit `none` values.

## Promotion Rule

Production map promotion requires a separate promotion candidate. A visual layout candidate can be cited as input evidence, but it cannot carry collision, walkability, interaction, ownership, NPC, mob, or content authority forward by itself.
