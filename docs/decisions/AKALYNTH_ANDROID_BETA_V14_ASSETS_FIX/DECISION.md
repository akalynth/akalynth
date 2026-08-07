# AKALYNTH_ANDROID_BETA_V14_ASSETS_FIX

Status: authorized emergency fix for bugged v13 beta APK (missing world art assets).

## Effect

- Advance direct-Android beta from v13 → **v14**
- version_name: `0.1.12-beta-ui-chrome-assets-fix`
- Restores full assets pack from known-good v12 packaging + UI chrome v2 overlays
- Does not expand cohort or claim production readiness

## Cause (v13)

Worktree `apps/android/app/src/main/assets` was incomplete (~1.4MB / no `sprites/art/*`),
so `assembleBeta` shipped an APK without world art (~13MB vs ~42MB v12).
