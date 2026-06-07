# AKALYNTH_ANDROID_HIGH_CITY_VISUAL_LANDMARKS_PARITY_V1

status: implemented_committed_local_green
mechanical_class: android_display_only_no_runtime_semantics_change

branch: codex/android-high-city-visual-landmarks-parity-v1
implementation_commit: 03083308952ce05c1fcedc9808dd9b74d4a7bfc7

## Summary

Android High City now renders display-only landmark parity for the visual layer
introduced in the debug client. The Compose `GameCanvas` draws High City civic
overlays when the current map is `Azura` or `HighCity`.

This adds Android presentation for:

- Guild Hall facade
- arrival/spawn court
- Central Plaza monument
- civic banners
- benches and notice boards
- house plot claim markers
- cobble, stone, and wood display-only paving

## Changed Files

- `apps/android/app/src/main/java/com/akalynth/client/ui/components/GameCanvas.kt`
- `apps/android/app/src/main/java/com/akalynth/client/ui/components/HighCityVisualLandmarks.kt`
- `apps/android/app/src/test/java/com/akalynth/client/ui/components/HighCityVisualLandmarksTest.kt`

## Boundary Summary

- `packages/shared/maps/` untouched
- `apps/android/app/src/main/assets/maps/` untouched
- `packages/shared/http.ts` untouched
- `packages/shared/protocol.ts` untouched
- server world/protocol files untouched
- no collision, spawn, tile array, map JSON, house price, property, NPC, event, server, protocol, or gameplay behavior changed
- Android client still sends intent-only actions and does not derive or submit authority/state truth from the visual overlay

## Verification Summary

- `git diff --check -- apps/android/app/src/main/java/com/akalynth/client/ui/components/GameCanvas.kt apps/android/app/src/main/java/com/akalynth/client/ui/components/HighCityVisualLandmarks.kt apps/android/app/src/test/java/com/akalynth/client/ui/components/HighCityVisualLandmarksTest.kt`: PASS
- `./gradlew testDebugUnitTest --tests com.akalynth.client.ui.components.HighCityVisualLandmarksTest`: PASS
- `./gradlew assembleDebug`: PASS

## Caveat

The repo had unrelated dirty server files before this lane. Those files are not
part of this receipt and were not cleaned, included, or modified for this lane.
