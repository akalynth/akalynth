# Android beta v13 publish steps

**Candidate prepared on** `agent/ui-chrome-art-perf-lane` (PR #413).  
**Live mutation is operator custody** — not performed by the build script.

## Identity

| Field | Value |
|---|---|
| version_code | 13 |
| version_name | `0.1.11-beta-ui-chrome-self-update` |
| apk | `akalynth-beta-v13.apk` |
| sha256 | `5db6ba29400747457b9cb3dd9494d05fb08cba07582be528cbe44980cc95e181` |
| size_bytes | 13231055 |
| authority | `AKALYNTH_ANDROID_BETA_V13_UI_CHROME` |

## Build artifact location (this worktree)

```text
apps/android/app/build/outputs/apk/beta/app-beta.apk
evidence/android-beta-v13/akalynth-beta-v13.apk
```

Rebuild:

```sh
./scripts/build-publish-beta-apk.sh
```

## Host publish

```sh
# 1) Static APK
scp evidence/android-beta-v13/akalynth-beta-v13.apk \
  ops-dev-01:/var/www/akalynth-beta/download/akalynth-beta-v13.apk
scp evidence/android-beta-v13/akalynth-beta-v13.apk.sha256 \
  ops-dev-01:/var/www/akalynth-beta/download/akalynth-beta-v13.apk.sha256

# 2) Update API manifest (path must match AKALYNTH_ANDROID_BETA_UPDATE_JSON)
scp infra/android/beta-client-update.json \
  ops-dev-01:/etc/akalynth/android/beta-client-update.json
# restart beta-api so it reloads the env-backed manifest

# 3) Verify
curl -sS 'https://beta-api.akalynth.com/v1/client/android-update?lane=beta' | jq .
curl -sSI 'https://beta.akalynth.com/download/akalynth-beta-v13.apk' | head
```

## Client effect

Installed beta clients with `versionCode < 13` self-update on next app start
(`MainActivity` STARTED → `ClientUpdateController.checkAndUpdate()`).
