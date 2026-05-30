# World: Azura

> **Purpose:** Reference for the Azura city map — the first major destination after onboarding. Source of truth is `packages/shared/maps/azura.json`; this doc must stay consistent with it.

Azura is the **first major city** after players complete the Rookguard onboarding zone. All guests must clear the tutorial checklist in Rookguard before the server transfers them here.

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
- **Description**: Center of the city, where new players appear

### Guild Hall (Placeholder)

- **Coordinates**: (16, 10) to (24, 18)
- **Status**: Placeholder - building exists but no enter logic
- **Future**: Guilds can claim and customize

### House Plots (Placeholders)

| Plot | Coordinates | Status |
|------|-------------|--------|
| H1 | (10, 32) to (12, 34) | Placeholder |
| H2 | (14, 32) to (16, 34) | Placeholder |
| H3 | (18, 32) to (20, 34) | Placeholder |

**Future**: Players can buy and enter houses.

### Central Plaza

- **Coordinates**: (26, 48) to (38, 56)
- **Description**: Open area for gathering and chat
- **Features**: All walkable tiles

## Lore & Flavor (Player-Facing)

> Narrative framing only. The coordinates, tile codes, spawn, and landmark statuses above are the source of truth; nothing in this section changes movement, spawns, zones, access control, or any mechanic. Placeholder buildings remain placeholders until enter-logic is built and routed through server + verification work.

Azura is the first city a player reaches after the keep at Rookguard opens its gate. After the closed quiet of onboarding, the world widens: walls give way to open ground and the city receives newcomers at its center.

### The Central Plaza — `(26, 48)` to `(38, 56)`

The heart of the city and its designated gathering ground. All tiles here are walkable; it is built for standing still — for chat, meeting, and waiting — rather than for passing through. If Akalynth's culture forms before its content (see `docs/WORLD_EVOLUTION.md`), this is the floor it forms on.

### The Guild Hall — `(16, 10)` to `(24, 18)`

A hall raised before there were guilds to fill it. The doors do not open yet.

- **Status:** placeholder — the building exists in the map but has no enter logic. Documented as flavor; claiming and customization are future, server-authoritative features.

### The House Plots — `H1`–`H3`

Three marked plots along the northern residential row, waiting for owners.

- **Status:** placeholders. No buy, enter, or ownership mechanic exists yet. Reserved coordinates only.

Azura is intentionally unfinished. Its empty plots and silent hall are not gaps to apologize for — they are room left for players to become the reason a hall has a guild and a plot has a name.

## Tile Types

| Type | Code | Walkable | Description |
|------|------|----------|-------------|
| Grass | 0 | Yes | Standard walkable ground |
| Stone | 1 | Yes | Paved areas (plaza) |
| Wall | 2 | No | City boundary, building walls |
| Water | 3 | No | Decorative (future) |
| Door | 4 | No | Building entrances (future) |

## Map Data Format

The map is stored in `packages/shared/maps/azura.json`:

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
