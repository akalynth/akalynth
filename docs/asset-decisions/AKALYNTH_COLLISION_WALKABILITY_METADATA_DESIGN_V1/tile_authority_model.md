# Tile Authority Model

Status: draft design model.

A tile can have multiple metadata planes, but each plane owns only its own question.

## Questions By Plane

- Visual object: what should be drawn here?
- Collision: can an actor occupy this tile from a static obstruction standpoint?
- Walkability: may an actor traverse this tile in the map design?
- Interaction: can an actor use, open, talk to, buy from, or trigger something here?
- Transition: does this tile move the actor to another floor, map, sewer, or underpass?
- Production map: has this composition been accepted for runtime use?

No answer transfers between planes automatically.

## Authority Sources

Visual references can be evidence pointers. They cannot be authority sources. Collision and walkability require future accepted receipts before runtime use.

## Candidate Versus Runtime

Candidate metadata is draft review material. Runtime metadata is a later promoted artifact. This gate creates only candidate schemas and examples.

## Coordinate Contract

```json
{
  "coordinate_system": {
    "origin": "top_left",
    "unit": "tile",
    "tile_size_px": 32,
    "axes": {
      "x": "east",
      "y": "south"
    },
    "floor": {
      "default": 0,
      "meaning": "visual/debug floor index only until production promotion"
    }
  }
}
```

The `floor.default` value of `0` remains a visual/debug index until production promotion.
