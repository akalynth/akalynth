# AKALYNTH_ANDROID_BETA_V13_UI_CHROME

Status: **authorized for direct-Android beta v13 candidate preparation** by project
owner on 2026-08-07 (active Grok lane: bump version + prep next beta APK on
`agent/ui-chrome-art-perf-lane` / PR #413).

Target lane: controlled live beta only.

## Decision effect

Authorizes advancing the direct-Android beta distribution identity from **v12**
to **v13**:

| Field | Value |
|---|---|
| version_code | `13` |
| version_name | `0.1.11-beta-ui-chrome-self-update` |
| immutable URL | `https://beta.akalynth.com/download/akalynth-beta-v13.apk` |

### Includes

- Bumping `apps/android` `versionCode` / `versionName`.
- Building `assembleBeta` APK and writing matching
  `infra/android/beta-client-update.json`.
- Replacing the accepted distribution identity pin used by
  `scripts/verify_beta_android_distribution.sh`.
- Self-update hardening already on this branch (check on every STARTED +
  install-permission resume).

### Does not include (separate custody)

- Live host APK copy / Caddy publish
- Setting `AKALYNTH_ANDROID_BETA_UPDATE_JSON` on beta-api and restart
- Cohort expansion, Play Store, F-Droid, production claims
- Receipt or player-data mutation

## Machine-readable identity

After the APK is built, the sealed identity is:

[`android-distribution-identity.v13.json`](./android-distribution-identity.v13.json)

The distribution verifier must match the live update manifest to that file
(digest-pinned in `scripts/verify_beta_android_distribution.sh`).

## Publish after merge (operator)

See `docs/android-self-update.md` and the footer printed by
`./scripts/build-publish-beta-apk.sh`.
