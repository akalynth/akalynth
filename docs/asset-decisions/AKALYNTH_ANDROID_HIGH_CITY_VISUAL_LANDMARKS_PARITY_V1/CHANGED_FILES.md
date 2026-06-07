# Changed Files

Lane: `AKALYNTH_ANDROID_HIGH_CITY_VISUAL_LANDMARKS_PARITY_V1`

## Included In This Lane

- `apps/android/app/src/main/java/com/akalynth/client/ui/components/GameCanvas.kt`
- `apps/android/app/src/main/java/com/akalynth/client/ui/components/HighCityVisualLandmarks.kt`
- `apps/android/app/src/test/java/com/akalynth/client/ui/components/HighCityVisualLandmarksTest.kt`
- `docs/asset-decisions/AKALYNTH_ANDROID_HIGH_CITY_VISUAL_LANDMARKS_PARITY_V1/receipt.md`
- `docs/asset-decisions/AKALYNTH_ANDROID_HIGH_CITY_VISUAL_LANDMARKS_PARITY_V1/CHANGED_FILES.md`
- `docs/asset-decisions/AKALYNTH_ANDROID_HIGH_CITY_VISUAL_LANDMARKS_PARITY_V1/BOUNDARY_CHECK.md`
- `docs/asset-decisions/AKALYNTH_ANDROID_HIGH_CITY_VISUAL_LANDMARKS_PARITY_V1/VERIFICATION.md`

## Change Summary

- Added Android High City visual landmark coordinate data.
- Added Compose Canvas drawing for floor overlays, Guild Hall facade hints,
  fountain, banners, benches, notice boards, columns, and closed door markers.
- Rendered landmarks only for `Azura` / `HighCity` compatible maps.
- Added a focused unit test proving Rookguard does not receive the overlays and
  High City keeps the core visual anchors.

## Explicitly Not Included

- `packages/shared/maps/`
- `apps/android/app/src/main/assets/maps/`
- server runtime files
- protocol/shared type contracts
- gameplay mechanics
- collision or spawn changes
- new generated art assets
- `akalynth-site`

## Unrelated Dirty Files Left Alone

- `apps/server/package.json`
- `apps/server/src/index.ts`
- `apps/server/src/persist/index.ts`
- `apps/server/src/persist/materializers.ts`
- `apps/server/src/persist/queries.ts`
- `apps/server/src/persist/schema.ts`
- `apps/server/src/persist/types.ts`
- `apps/server/tools/verify-herb-use.ts`
