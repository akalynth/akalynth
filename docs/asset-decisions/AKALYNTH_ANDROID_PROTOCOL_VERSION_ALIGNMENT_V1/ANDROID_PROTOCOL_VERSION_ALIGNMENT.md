# AKALYNTH_ANDROID_PROTOCOL_VERSION_ALIGNMENT_V1

Status: `closed_android_protocol_version_aligned_local_debug_no_gameplay_authority_change`

## Accepted Claim

The Android emulator debug client can connect to a current-source local debug server with a matching protocol version.

This does not claim Android UI parity, production server compatibility, release build readiness, gameplay authority changes, or production deploy changes.

## Cause

Shared protocol and Android already declared protocol `1.1.0`.

The server WebSocket welcome path used the server app `VERSION` constant (`0.1.0`) instead of the shared protocol `PROTOCOL_VERSION` constant. That made Android report:

`Protocol mismatch: server v0.1.0, client v1.1.0`

The fix keeps health/build app version reporting separate from WebSocket protocol version reporting.

## Evidence

- Shared protocol: `packages/shared/protocol.ts` exports `PROTOCOL_VERSION = '1.1.0'`.
- Android protocol: `Protocol.kt` declares `PROTOCOL_VERSION = "1.1.0"`.
- Android parity test expects `1.1.0`.
- Current-source server WebSocket probe returned `{"type":"welcome","version":"1.1.0"}`.
- Android emulator screenshot shows `Connected` as `Guest_d305`.

## Local Test Target

Port `3000` was already occupied locally, so this lane did not mutate it.

For validation, a current-source server was started on port `3010` with receipt, database, marker, and signing-key outputs redirected to `/tmp/akalynth-android-protocol-v1`.

The Android debug app used its existing saved server URL setting:

`ws://10.0.2.2:3010`

## Boundary

No gameplay semantics changed. No protocol message shape changed. No production deploy, beta/staging mutation, Android UI parity work, shared map change, shared type change, collision/walkability change, NPC/mob change, economy change, or combat change was introduced.

## Screenshots

- `screenshots/01_android_login_protocol_target.png`
- `screenshots/02_android_after_connect_attempt.png`
- `screenshots/03_android_retry_screen_state.png`
- `screenshots/04_android_connected_protocol_aligned.png`
