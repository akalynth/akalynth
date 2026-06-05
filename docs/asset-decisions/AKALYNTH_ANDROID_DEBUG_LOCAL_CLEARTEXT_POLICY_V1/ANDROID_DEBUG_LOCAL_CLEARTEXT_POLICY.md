# AKALYNTH_ANDROID_DEBUG_LOCAL_CLEARTEXT_POLICY_V1

Status: closed_android_debug_local_cleartext_allowed_debug_only_no_release_policy_weakened

Scope: Android debug configuration only.

This lane permits the Android debug build to use the emulator local-development endpoint `10.0.2.2:3000` without weakening release network policy.

## Change

Added a debug-only Android network security config:

- `apps/android/app/src/debug/AndroidManifest.xml`
- `apps/android/app/src/debug/res/xml/network_security_config.xml`

The config permits cleartext traffic only to `10.0.2.2`.

## Validation Summary

- `./gradlew assembleDebug`: pass
- Debug APK installs in the emulator: pass
- App launches: pass
- Emulator reaches `http://10.0.2.2:3000/v1/health`: pass
- App no longer shows the cleartext network security blocker: pass
- App reaches connected state: pass
- Merged debug manifest contains `android:networkSecurityConfig`: pass
- Merged release manifest contains no cleartext or network security config reference: pass
- Main and beta source sets contain no cleartext or network security config reference: pass

## Remaining Non-Blocking Finding

After the cleartext blocker was removed, the Android debug app reached the server and displayed:

`Protocol mismatch: server v0.1.0, client v1.1.0. Update the app.`

That is a separate Android/server protocol compatibility issue. It is not part of this cleartext-policy lane.

## Boundary

No release cleartext enablement, production API downgrade, server change, protocol change, shared map/type change, gameplay authority change, deploy/runtime mutation, or Android UI parity work was added.

## Screenshot

- `screenshots/03_debug_connect_clean_retest.png`: app connected to the local server, with protocol mismatch surfaced after connection.

`screenshots/01_debug_connect_after_cleartext_policy.png` captures a transient emulator System UI ANR during the first post-change run and is not used as acceptance evidence.
