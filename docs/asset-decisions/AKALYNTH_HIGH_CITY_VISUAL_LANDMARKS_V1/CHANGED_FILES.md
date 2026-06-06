# Changed Files

Lane: `AKALYNTH_HIGH_CITY_VISUAL_LANDMARKS_V1`

## Included In This Lane

- `apps/debug-client/src/App.tsx`
- `apps/debug-client/src/components/ActionsPanel.tsx`
- `apps/debug-client/src/data/highCityVisualLandmarks.ts`
- `docs/asset-decisions/AKALYNTH_HIGH_CITY_VISUAL_LANDMARKS_V1/receipt.md`
- `docs/asset-decisions/AKALYNTH_HIGH_CITY_VISUAL_LANDMARKS_V1/CHANGED_FILES.md`
- `docs/asset-decisions/AKALYNTH_HIGH_CITY_VISUAL_LANDMARKS_V1/BOUNDARY_CHECK.md`
- `docs/asset-decisions/AKALYNTH_HIGH_CITY_VISUAL_LANDMARKS_V1/VERIFICATION.md`

## Change Summary

- Added a reusable High City visual landmark overlay list for the legacy
  `Azura` map.
- Passed those display-only overlays to `MapCanvas`.
- Used existing `VITE_DEFAULT_MAP` config as the debug-client initial map.
- Unified objective fallback copy so offline High City previews say
  `Arrive in High City` instead of `Enter Rookguard`.

## Explicitly Not Included

- `packages/shared/maps/`
- `packages/shared/maps/azura.json`
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
