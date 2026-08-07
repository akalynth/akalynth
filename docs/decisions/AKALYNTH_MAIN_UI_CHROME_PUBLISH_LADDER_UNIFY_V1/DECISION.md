# AKALYNTH_MAIN_UI_CHROME_PUBLISH_LADDER_UNIFY_V1

**Date:** 2026-08-07  
**Status:** APPROVED (implement via PR into `main`)  
**Live ladder at decision:** Android `version_code` **2026080702**

## Problem

Beta `/play/` and the direct APK were shipping from `agent/ui-chrome-art-perf-lane`
(and short `deploy/*` branches) while `main` still reported `versionCode = 10` and
lacked PlayHotbar chrome. That made “merge to main and ship” unsafe (self-update
regression + chrome regression).

## Decision

1. **Merge** the live deploy tip (`deploy/p0-play-apk-2026080702` = ui-chrome + P0
   stop/death + identity `2026080702`) into **`main`**.
2. **`main` is the only long-lived ship source** for beta client surfaces after merge.
3. Document player UX parity in **`CLIENT_PLAY_SURFACE_CONTRACT_V1`**.
4. Document the publish path in **`docs/runbooks/beta-client-publish-ladder-v1.md`**.

## Non-decisions

- Does not refresh beta **server** runtime commit.
- Does not unblock F-Droid.
- Does not force 8-dir D-pad or full gather map-marker parity (called out as gaps).

## Verify

- `main` contains `versionCode = 2026080702` and matching `infra/android/beta-client-update.json`.
- `apps/debug-client` has PlayHotbar components and no `.dpad-stop` source.
- Android WorldScreen D-pad has center stop; death toast/recap wired.
