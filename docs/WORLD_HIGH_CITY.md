# World: High City

> **Purpose:** Reference for the current first-city map: High City in player-facing
> copy, backed by the legacy `Azura` runtime id for compatibility. Source of
> truth is `packages/shared/maps/azura.json`; this doc must stay consistent with
> it until the runtime-id migration lane replaces the file/protocol identifiers.
> Historical receipts and server WebSocket payloads may still contain `Azura`.

High City is the **first city** a traveler reaches after Rookguard opens its
gate. Rookguard proves a living hand is present. High City asks what that hand
will leave behind.

The player-facing name is **High City**. The current runtime map id remains the
legacy `Azura` compatibility id, and the Rookguard gate tile remains the legacy
`GateToAzura` identifier until a separate migration lane changes them.

## Map Specifications

- **Size**: 64x64 tiles
- **Tile size**: Logical units (rendered by client)
- **Coordinate system**: (0,0) is top-left, X increases right, Y increases down

## Layout Overview

```
    0         16        32        48        63
    ├─────────┼─────────┼─────────┼─────────┤
  0 │ ████████████████████████████████████ │ (walls)
    │ █                                  █ │
    │ █   [GUILD HALL]                   █ │
 16 │ █       ┌───┐                      █ │
    │ █       │ G │                      █ │
    │ █       └───┘                      █ │
    │ █                                  █ │
    │ █   [HOUSE PLOTS]                  █ │
 32 │ █   ┌─┐ ┌─┐ ┌─┐     ★ SPAWN        █ │
    │ █   │H│ │H│ │H│       (32,32)      █ │
    │ █   └─┘ └─┘ └─┘                    █ │
    │ █                                  █ │
    │ █              [PLAZA]             █ │
 48 │ █           ┌─────────┐            █ │
    │ █           │ CENTRAL │            █ │
    │ █           │  PLAZA  │            █ │
    │ █           └─────────┘            █ │
 63 │ ████████████████████████████████████ │
    └─────────────────────────────────────┘
```

## Key Locations

### Spawn Point

- **Coordinates**: (32, 32)
- **Description**: Arrival point after Rookguard. Newcomers enter at the center
  of High City, close enough to see the plaza, the hall, and the marked plots
  without being promised access, ownership, reward, or progression.

### Guild Hall (Placeholder)

- **Coordinates**: (16, 10) to (24, 18)
- **Status**: Placeholder - the building exists, but its doors do not open and
  there is no enter logic.
- **Future**: Guild use requires a later server-authoritative feature lane.

### House Plots

| Plot | Coordinates | Status |
|------|-------------|--------|
| H1 | (10, 32) to (12, 34) | Property plot |
| H2 | (14, 32) to (16, 34) | Property plot |
| H3 | (18, 32) to (20, 34) | Property plot |

Players can buy, list, unlist, resell, and run resale auctions for these three
property plots through server-authoritative property systems. The plots are
addresses on the city floor, not implemented interiors.

### Central Plaza

- **Coordinates**: (26, 48) to (38, 56)
- **Description**: Open civic floor for arrival, gathering, chat, waiting, and
  being seen after Rookguard.
- **Features**: All walkable tiles

## Lore & Flavor (Player-Facing)

> Narrative framing only. The coordinates, tile codes, spawn, landmark statuses,
> property systems, work contracts, events, and runtime identifiers above remain
> the source of truth. Nothing in this section changes movement, spawns, zones,
> access control, prices, ownership, drops, mob behavior, event behavior, or any
> mechanic. Placeholder buildings remain placeholders until enter-logic is built
> and routed through server-authoritative systems.

High City is the first city a traveler reaches after Rookguard opens its gate.
Rookguard proves a living hand is present. High City asks what that hand will
leave behind.

The city receives newcomers at its center, under old walls and open sky. Its
hall is visible but closed. Its three plots are marked as civic addresses, not
rooms to enter. Its plaza is wide enough for strangers to become a public memory
before they become a faction, owner, worker, or legend.

### The Central Plaza — `(26, 48)` to `(38, 56)`

The heart of the first city and its designated gathering ground. All tiles here
are walkable. It is built for standing still — for chat, meeting, waiting, and
being seen — rather than for passing through.

If Akalynth's culture forms before its content (see `docs/WORLD_EVOLUTION.md`),
this is the floor it forms on. A traveler who reaches the plaza has already
crossed Rookguard's threshold. What follows is no longer onboarding; it is the
beginning of public presence.

### The Guild Hall — `(16, 10)` to `(24, 18)`

A hall raised before there were guilds to fill it. The doors do not open yet,
and no interior is currently implemented.

- **Status:** placeholder — the building exists in the map but has no enter logic. Documented as flavor; claiming and customization are future, server-authoritative features.
- **Player-facing line:** The hall is ready before the oath is. When guilds come, the city will remember who first stood at its doors.

### The House Plots — `H1`–`H3`

Three marked plots along the central residential row, just below the Guild Hall.
They are small on the map by design: first claims, not estates.

- **Status:** property coordinates. Ownership, resale listings, and resale auctions are server-authoritative gameplay/projection systems. Enter-house/interior logic is not implemented.
- **Player-facing line:** These are not empty squares. They are addresses waiting for a name the Chronicle can hold.

### The Herald

The Herald's purpose is orientation, not authority. The Herald should name the
city, acknowledge the traveler has crossed Rookguard, and point attention toward
the plaza, hall, plots, work, and witnessed events without promising access or
reward.

- **Player-facing line:** Rookguard has opened for you, traveler. High City receives every true thread at its center. Speak plainly, move with care, and leave only what you mean to have remembered.

### The Steward

The Steward's purpose is civic explanation, especially around plots and work.
The Steward may describe ownership, listing, resale, and work as city records,
but must not imply client-side authority, guaranteed purchase, guaranteed profit,
or unimplemented interiors.

- **Player-facing line:** A plot is not yours because you stand on it. It is yours when the city resolves the claim and the record holds.

### Witness Moth Bloom

The Witness Moth Bloom belongs to High City's public-memory language: lanterns,
witnessing, gathering, and the difference between being present and being
remembered. Event copy should describe visibility and record, not hidden rewards
or mechanical advantage unless those rewards exist in the authoritative event
implementation.

- **Player-facing line:** Lanterns draw moths. Witness draws memory. When the bloom comes, stand where you mean to be seen.

High City is intentionally unfinished. Its silent hall and still-closed interiors
are not gaps to apologize for — they are room left for players to become the
reason a hall has a guild and a plot has a name.

## Tile Types

| Type | Code | Walkable | Description |
|------|------|----------|-------------|
| Grass | 0 | Yes | Standard walkable ground |
| Stone | 1 | Yes | Paved areas (plaza) |
| Wall | 2 | No | City boundary, building walls |
| Water | 3 | No | Decorative (future) |
| Door | 4 | No | Building entrances (future) |

## Map Data Format

The map is stored in `packages/shared/maps/azura.json` under the legacy
compatibility name `Azura`:

```json
{
  "name": "Azura",
  "width": 64,
  "height": 64,
  "spawn": {"x": 32, "y": 32},
  "tiles": [...],
  "landmarks": {
    "guild_hall": {"x": 16, "y": 10, "width": 8, "height": 8},
    "house_plots": [
      {"id": "H1", "x": 10, "y": 32, "width": 2, "height": 2},
      {"id": "H2", "x": 14, "y": 32, "width": 2, "height": 2},
      {"id": "H3", "x": 18, "y": 32, "width": 2, "height": 2}
    ],
    "plaza": {"x": 26, "y": 48, "width": 12, "height": 8}
  }
}
```

## Rendering Notes (For Client)

- Tiles are rendered in a grid
- Each tile is a fixed pixel size (e.g., 32x32)
- Player sprites are centered on tiles
- Camera follows the player with smooth scrolling

## Future Additions

1. **NPC locations** - Shopkeepers, quest givers
2. **More house plots** - Expand housing district
3. **City gates** - Exits to other zones
4. **Underground** - Sewer system, dungeons
