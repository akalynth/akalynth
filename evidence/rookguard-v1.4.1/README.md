# Rookguard v1.4.1 stabilization evidence

## Task A — build identity

| Artifact | Evidence |
|---|---|
| Live update API | `version_code=14`, `version_name=0.1.12-beta-ui-chrome-assets-fix` |
| Live APK | `/var/www/akalynth-beta/download/akalynth-beta-v14.apk` |
| SHA-256 | `cdcffed438e61a61aa0d4c61be52ba51287adb4e2a7d0cb3e2877c1509ceb635` |
| Art pack in APK | 9 files under `assets/sprites/art/` (v13 had 0) |
| Device PackageInfo | **Not pinned** — no `adb` device; screenshot layout matches Android `WorldScreen` |

Product label “v1.4” ≠ package `versionName`; do not rename packages for branding.

## Task B — The Gate Remembers

See `gate-remembers-e2e.json`.

| Step | Result |
|---|---|
| Authoritative quest | `rookguard_city_codex_path_v1` / title `The Gate Remembers` |
| Next action (move incomplete) | Stand on tutorial.move tile **(3,2)** via `move_intent` |
| Move step advance | **PASS** — `move_result` ok (3,2); objective → chat |
| Chat step advance | **PASS** — `loop_update` event `rookguard_chat_complete`; objective → training yard |
| Codex meter | `complete_steps / steps.size` (not renamed) |

Nearby HUD: `playerCount = state.world.otherPlayers.size` only.

## Task C — layout

| Change | File |
|---|---|
| Actions bottom-end only (no horizontal stretch) | `GameHUD.kt` |
| Hotbar pinned bottom-center (`margin=112.dp`) | `GameHUD.kt` |
| Objective compact max 2 lines / 280dp | `ObjectiveBanner.kt` |
| Next routes collapsed by default; Show/Hide | `WorldScreen.kt` `OnwardRoutesPanel` |

## v15 live publish (layout slice)

| Field | Value |
|---|---|
| version_code | 15 |
| version_name | `0.1.13-beta-rookguard-v1.4.1-layout` |
| sha256 | `a569938524dadfb2493464fcbb9726d3b25033bc8cb1cf4b13b5da6519ab4c7b` |
| size | 41711283 |
| published | host download + beta-api restart verified |
| backup | `/var/backups/akalynth-beta-android-v15-*` |
