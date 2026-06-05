# Transition Boundary Matrix

| Plane | Owns | Must Not Own |
| --- | --- | --- |
| Visual object | Sprite placement and visual asset id | Transition target, floor change, teleport behavior |
| Collision candidate | Draft obstruction state | Destination validity, activation, floor transfer |
| Walkability candidate | Draft traversal intent | Transition target, destination map, teleport behavior |
| Door/house candidate | Door and house boundary candidates | Sewer/stair/floor-change authority |
| Transition authority | Future source/destination/floor-change binding | Visual rendering, shop/dialogue, NPC/mob behavior |
| Transition policy | Future activation, one-way/two-way, safety rules | Collision by implication, ownership by implication |
| Floor-change binding | Future server floor/index transition shape | Visual floor index by implication |
| Production map | Future accepted runtime composition | Debug fixture assumptions |

## Non-Inference Rules

- A sewer grate visual does not create a sewer transition.
- A stair visual does not create a floor transfer.
- A ladder visual does not create climb behavior.
- A hole visual does not create teleport behavior.
- A walkable tile does not imply a transition target.
- A reserved conditional tile does not imply destination validity.
- A door candidate does not imply teleport or floor transfer.
- A transition candidate does not imply spawn, AI, encounter, or mob behavior.
