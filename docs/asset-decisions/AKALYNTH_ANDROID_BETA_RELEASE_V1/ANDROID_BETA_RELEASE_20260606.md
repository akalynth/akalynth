# Akalynth Android Beta Release - 2026-06-06

Status: published beta release note.

This note records the source-side release context for the beta Android APK
published on 2026-06-06. The host-local publication evidence remains in
`/home/sovereign/akalynth-ops/receipts/AKALYNTH_ANDROID_BETA_APK_REFRESH_V1-20260606T093145Z.md`.

## Published Artifact

- Public URL: `https://beta.akalynth.com/download/akalynth-beta.apk`
- Checksum URL: `https://beta.akalynth.com/download/akalynth-beta.apk.sha256`
- SHA-256: `d9a9fc0fcfb2b5da51192d4eab933f345e92eb8b4b306c1c83168cb640ec9704`
- Size: `12762978` bytes
- Source commit: `f4d3a8d8ea0ee48ebf34f79d1eea74ed190fedcb`
- Release commits:
  - `cdc5dbfe2f8857b31b488412402b651affdc1294` (`android: close beta app quick wins`)
  - `f4d3a8d8ea0ee48ebf34f79d1eea74ed190fedcb` (`android: add receipt-backed chronicle proof`)

## Player-Facing Changes

- Beta build badge and lane status on login.
- Server health check, last checked age, reconnect countdown, and reset-to-build-server control.
- Redacted diagnostics and issue-report copy flow.
- In-world Chronicle button and Chronicle sheet.
- Witness Moth Bloom controls remain intent-only and server-authoritative.

## Authority Boundary

- No WebSocket protocol change.
- No server receipt schema change.
- No client-authored truth claims.
- Chronicle rows are displayed from server `chronicle_snapshot` payloads as
  server receipt-backed UI events.
- Legacy runtime zone id `Azura` remains evidence data; UI display helpers may
  render it as `High City`.

## Verification

- Focused Android tests passed for login diagnostics, action buttons,
  diagnostics formatting, Chronicle sheet, and default state.
- Full Android unit/build passed with `./gradlew testDebugUnitTest assembleBeta`.
- Repo verifier passed with `npm run verify` (`28/28`).
- Public APK checksum and beta API health were verified in the host receipt.

## Follow-Up

- Device/emulator install and screenshot proof should be appended to the host
  receipt when captured.
- Future Chronicle work should wire pagination through an explicit protocol
  review rather than inventing client-side load-more behavior.
