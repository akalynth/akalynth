# World: Azura

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
