# AKALYNTH_HIGH_CITY_VISUAL_LANDMARKS_V1

status: implemented_pending_review
mechanical_class: display_only_no_runtime_semantics_change

## Summary

High City now has display-only visual landmarks in the debug client so the
legacy `Azura` map reads as a city instead of an empty test field.

This lane adds presentation overlays for:

- Guild Hall facade
- arrival/spawn court
- Central Plaza monument
- civic banners
- benches and notice boards
- house plot claim markers
- cobble and stone civic roads

## Changed Files

- `apps/debug-client/src/App.tsx`
- `apps/debug-client/src/components/ActionsPanel.tsx`
- `apps/debug-client/src/data/highCityVisualLandmarks.ts`

## Boundary Summary

- `packages/shared/maps/` untouched
- `packages/shared/maps/azura.json` untouched
- `GateToAzura` unchanged
- `Azura` runtime id unchanged
- no collision, spawn, tile array, house price, property, NPC, event, server, protocol, or gameplay behavior changed
- overlays use existing display-only world visual assets with `mechanics: null`

## Screenshot Evidence

- `/tmp/akalynth-high-city-visual-landmarks-desktop.png`
- `/tmp/akalynth-high-city-visual-landmarks-mobile.png`

Screenshots were captured from a temporary offline High City preview:

```bash
VITE_DEFAULT_MAP=Azura VITE_HTTP_BASE=http://127.0.0.1:3999 VITE_WS_BASE=ws://127.0.0.1:3999 npm -w apps/debug-client run build
npm -w apps/debug-client run preview -- --host 127.0.0.1 --port 4173
```

The preview intentionally used dead server URLs so it could show the High City
visual layer without depending on live travel state. The `error` connection
state in screenshots is expected for that capture mode.

## Verification Summary

- `git diff --check -- apps/debug-client/src/App.tsx apps/debug-client/src/components/ActionsPanel.tsx apps/debug-client/src/data/highCityVisualLandmarks.ts`: PASS
- `npm -w apps/debug-client run build`: PASS
- `npm run verify:quick`: PASS, 9/9 verifiers

## Caveat

The repo had unrelated dirty server files before this lane. Those files are not
part of this receipt and were not cleaned, included, or modified for this lane.
