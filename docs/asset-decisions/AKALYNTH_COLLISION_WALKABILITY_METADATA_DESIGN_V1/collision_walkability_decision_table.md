# Collision And Walkability Decision Table

Status: draft design decision table.

| Visual thing | Collision candidate | Walkability candidate | Notes |
| --- | --- | --- | --- |
| cobble plaza floor | clear | walkable | Candidate only |
| grass outside city | clear or unknown | walkable or unknown | Depends on later map design |
| stone wall | blocked | not_walkable | Must be explicit |
| roof overlay | none | none | Presentation-only |
| open-looking doorway | reserved_conditional | reserved_conditional | Future door/entry gate |
| closed-looking door | reserved_conditional | reserved_conditional | Visual state does not decide |
| market stall | blocked or reserved_conditional | not_walkable or reserved_conditional | Must be explicit |
| table/chair | blocked or clear | not_walkable or walkable | Depends on intended traversal |
| sewer grate | reserved_conditional | reserved_conditional | Future transition/underworld gate |
| NPC-looking sprite | none in static layer | none in static layer | Future dynamic actor/content layer |
| rat-looking sprite | none in static layer | none in static layer | Future mob layer |

The table prevents accidental inference. It is not a production map.
