# Boundary Check

Lane: `AKALYNTH_HIGH_CITY_VISUAL_LANDMARKS_V1`

## Confirmed Unchanged

- `packages/shared/maps/` was not changed.
- `packages/shared/maps/azura.json` was not changed.
- `GateToAzura` was not renamed or migrated.
- `Azura` remains the legacy runtime id.
- `apps/server/src/world/npcs.ts` was not changed.
- `akalynth-site` was not changed.

## Mechanics Not Changed

This lane did not change:

- tile arrays
- collision
- spawn coordinates
- house plot IDs
- house plot prices
- property ownership semantics
- auctions or listings
- drops
- mobs
- work contracts
- Witness Moth Bloom behavior
- Guild Hall enter logic
- rewards
- progression
- verification claims
- server behavior
- WebSocket or HTTP protocol contracts

## Display-Only Contract

The new High City landmarks are debug-client presentation overlays only.

They use existing `WorldVisualObjectPlacement` entries and existing world visual
asset definitions whose mechanics field is `null`.

The overlays are selected only when the current map name is the legacy runtime
map name `Azura`.

## Boundary Commands Used

```bash
git diff --name-only -- packages/shared/maps packages/shared/http.ts packages/shared/protocol.ts apps/server/src/world/npcs.ts apps/server/src/world/world-events.ts
```

Result: no output.

```bash
git status --short -- packages/shared/maps packages/shared/http.ts packages/shared/protocol.ts apps/server/src/world/npcs.ts apps/server/src/world/world-events.ts
```

Result: no output.
