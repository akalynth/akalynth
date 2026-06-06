# Android App

Android client for Akalynth (Kotlin + Jetpack Compose). It connects to the
authoritative server over WebSocket/HTTP.

## Overview

- Standalone Gradle project (`com.akalynth.client`, `:app` module).
- `minSdk` 26, `compileSdk` / `targetSdk` 35.
- Server endpoints are injected per build type via `BuildConfig`:
  - `debug` → `ws://10.0.2.2:3000` / `http://10.0.2.2:3000` (emulator loopback)
  - `beta` → `wss://beta-api.akalynth.com` / `https://beta-api.akalynth.com`
  - `staging` → `wss://staging-api.akalynth.com` / `https://staging-api.akalynth.com`
  - `release` → `wss://api.akalynth.com` / `https://api.akalynth.com`

## Build

From `apps/android/`:

```bash
./gradlew assembleDebug      # debug APK (emulator endpoints)
./gradlew assembleBeta       # beta APK (beta server endpoints)
./gradlew assembleStaging    # staging APK (staging server endpoints)
./gradlew assembleRelease    # release APK (minified; production endpoints)
./gradlew test               # unit tests
```

Build outputs are written under `app/build/outputs/`.

## Layout

```
android/
  app/                       # :app module
    build.gradle.kts         # module config, build types, BuildConfig endpoints
    proguard-rules.pro       # release minification rules
    src/main/java/com/akalynth/client/   # Kotlin sources
    src/main/res/                         # resources (icons, values)
    src/beta/                             # beta build-type sources
    src/test/                             # unit tests
  build.gradle.kts           # root build script
  settings.gradle.kts        # project name + module includes
  gradle/libs.versions.toml  # version catalog
  gradlew                    # Gradle wrapper
```

## Related docs

- [Client Contract v0.1 (Frozen)](../../docs/CLIENT_CONTRACT_V0_1.md) - wire compatibility contract
- [UI Implementation Proposal](../../docs/UI_IMPLEMENTATION_PROPOSAL.md) - normative Android UI guidance
- [UI Regression Matrix](../../docs/UI_REGRESSION_MATRIX.md) - behavioral contract mapped to tests
- [Infra README](../../infra/README.md) - beta/staging APK lane and host-runtime notes
- [Archived APK Distribution Checklist](../../docs/archive/APK_DISTRIBUTION_CHECKLIST.md) - historical ship-and-observe checklist
