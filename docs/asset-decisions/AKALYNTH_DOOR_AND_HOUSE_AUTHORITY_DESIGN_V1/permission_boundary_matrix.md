# Permission Boundary Matrix

| Plane | Owns | Must Not Own |
| --- | --- | --- |
| Visual object | Sprite placement, draw layer, anchor, scale | Door behavior, lock state, ownership, entry permission |
| Floor/roof overlay | Visible/faded/hidden presentation | House authority, access list, inside/outside truth |
| Collision candidate | Draft obstruction state | Door state, ownership, permission policy |
| Walkability candidate | Draft traversal intent | Door state, entry permission, transition target |
| Door authority | Future threshold state and passability decision | Visual rendering, shop behavior, NPC behavior |
| House authority | Future inside/outside zone and ownership boundary | Visual sprite placement, collision by implication |
| Access policy | Future explicit allow/deny rules | Visual art semantics, collision by implication |
| Lock state | Future open/closed/locked state | Ownership by implication |
| Overlay binding | Future presentation source for hide/fade | Permission, collision, ownership authority |
| Production map | Future accepted runtime composition | Debug fixture assumptions |

## Non-Inference Rules

- A door sprite does not imply door state.
- An open-looking door sprite does not imply passability.
- A closed-looking door sprite does not imply blocking.
- A lock icon or locked-looking door does not imply ownership or access policy.
- A roof overlay does not imply a house zone.
- A building footprint does not imply collision, walkability, ownership, or protection zone.
- A market shop visual does not imply shop interaction or permissions.
- A sewer grate does not imply a transition.
