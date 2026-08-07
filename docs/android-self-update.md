# Android beta/staging self-update

Every **beta** and **staging** app launch checks the lane API for a newer APK,
downloads it, verifies SHA-256, and opens the system installer.

## Player path (automatic)

```text
App onStart
  → GET {HTTP_BASE_URL}/v1/client/android-update?lane={beta|staging}
  → if manifest.version_code > BuildConfig.VERSION_CODE
       download apk_url → verify apk_sha256 → install via FileProvider
  → else continue to login
```

- Overlay blocks login while checking / downloading / installing.
- If Android blocks install, overlay prompts **Open install permission**;
  after the player grants it and returns, install resumes.
- **debug** builds skip self-update (`ClientUpdateState.Skipped`).

## Live beta (current)

| Piece | Value |
|---|---|
| Manifest API | `https://beta-api.akalynth.com/v1/client/android-update?lane=beta` |
| Example APK | `https://beta.akalynth.com/download/akalynth-beta-v12.apk` |
| Env on API host | `AKALYNTH_ANDROID_BETA_UPDATE_JSON` → path to JSON |

## Operator: publish a new Android build

1. Bump `versionCode` / `versionName` in `apps/android/app/build.gradle.kts`
   (must be **greater** than the published manifest `version_code`).
2. Run:

```sh
./scripts/build-publish-beta-apk.sh
```

3. Follow the script’s publish steps:
   - copy `app-beta.apk` → `ops-dev-01:/var/www/akalynth-beta/download/akalynth-beta-v{N}.apk`
   - copy `.sha256` sidecar next to it
   - set `AKALYNTH_ANDROID_BETA_UPDATE_JSON` to the refreshed
     `infra/android/beta-client-update.json` and restart beta-api

4. Existing installs with lower `versionCode` self-update on **next app start**.

## Manifest contract

```json
{
  "ok": true,
  "lane": "beta",
  "version_code": 12,
  "version_name": "0.1.10-beta-self-update-identity",
  "apk_url": "https://beta.akalynth.com/download/akalynth-beta-v12.apk",
  "apk_sha256": "<64 hex>",
  "size_bytes": 42341209,
  "required": false,
  "published_at": "2026-07-09T00:10:00.000Z"
}
```

Server validation: HTTPS only, hostname `beta.akalynth.com`, path
`/download/akalynth-beta-v{version_code}.apk` for beta lane.

## Code map

| File | Role |
|---|---|
| `MainActivity` | `onStart` → `checkAndUpdate()` |
| `ClientUpdateController` | fetch / download / verify / install |
| `ClientUpdateApi` | HTTP manifest client |
| `ApkInstaller` | FileProvider + install permission |
| `apps/server/src/android-client-update.ts` | API handler |
| `scripts/build-publish-beta-apk.sh` | build + manifest refresh |
