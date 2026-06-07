# Boundary Check

Lane: `AKALYNTH_ANDROID_HIGH_CITY_VISUAL_LANDMARKS_PARITY_V1`

Status: `implemented_committed_local_green`

Branch: `codex/android-high-city-visual-landmarks-parity-v1`

Implementation commit: `03083308952ce05c1fcedc9808dd9b74d4a7bfc7`

## Confirmed Unchanged

- `packages/shared/maps/` was not changed.
- `apps/android/app/src/main/assets/maps/` was not changed.
- `GateToAzura` was not renamed or migrated.
- `Azura` remains the legacy runtime id.
- server world/protocol files were not changed.
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

The new Android High City landmarks are Compose presentation only.

They are selected by `MapName.isHighCityCompatible` and drawn inside
`GameCanvas` before players. The overlay never changes `MapData`, walkability,
movement, authority, protocol payloads, or server state.

## Boundary Commands Used

```bash
git diff --name-only -- packages/shared/maps packages/shared/http.ts packages/shared/protocol.ts apps/server/src/world apps/server/src/protocol apps/android/app/src/main/assets/maps
```

Result: no output.
