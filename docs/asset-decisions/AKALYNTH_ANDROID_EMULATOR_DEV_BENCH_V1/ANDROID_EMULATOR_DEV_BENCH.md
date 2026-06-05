# AKALYNTH_ANDROID_EMULATOR_DEV_BENCH_V1

Status: implemented_with_app_cleartext_policy_blocker

Scope: local developer Android emulator bench only.

This lane set up and verified a local Android emulator bench for Akalynth Android parity testing. It did not change Android app behavior, server behavior, protocol contracts, shared maps, shared types, production runtime, beta/staging deployment, signing, or release packaging.

## Evidence Summary

- `/dev/kvm` is present.
- CPU virtualization support is present (`vmx`).
- `sovereign` has been added to the `kvm` group.
- Current shell can access KVM through `sg kvm`.
- Android SDK command-line tools are installed under `/home/sovereign/Android/Sdk`.
- `adb`, `emulator`, `sdkmanager`, and `avdmanager` are available through the SDK path.
- AVD `akalynth_pixel_api35` exists.
- The emulator boots and reports `sys.boot_completed=1`.
- The local server is reachable from the emulator through `10.0.2.2:3000`.
- `apps/android` debug APK builds.
- The APK installs and `com.akalynth.client/.MainActivity` launches.

## App-Level Connectivity Finding

The Android app currently attempts the expected local debug path, but Android blocks the cleartext connection:

`CLEARTEXT communication to 10.0.2.2 not permitted by network security policy`

That is not an emulator bench failure. It is an Android debug app network-security configuration issue. This lane intentionally did not change Android app behavior, so the app-level connection remains unresolved for a later bounded lane.

## Screenshots

- `screenshots/02_android_app_main_activity.png`: app launch screen focused in emulator.
- `screenshots/04_android_after_connect_button.png`: app-level connect attempt showing cleartext policy blocker.

`screenshots/01_android_debug_app_launched.png` and `screenshots/03_android_after_connect_tap.png` are superseded captures from the earlier coordinate pass.

## Boundary

No server, protocol, shared map, shared type, Android behavior, deployment, production runtime, signing, Play Store, gameplay authority, collision, walkability, NPC, mob, economy, combat, pickup, inventory, or transition behavior was changed.

## Next Recommended Lane

`AKALYNTH_ANDROID_DEBUG_LOCAL_CLEAR_TEXT_POLICY_V1`

Purpose: make the Android debug build explicitly allow local development traffic to `10.0.2.2:3000`, without affecting release networking or server authority.
