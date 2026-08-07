# AKALYNTH_ANDROID_BETA_LONG_VERSION_V1

## Player question
Do I need to keep checking for updates?
**No.** Beta self-update runs automatically on every app start (and on resume after install-permission).

## Version number scheme (this decision)
Stop using tiny sequential codes (13…17). Use long monotonic integers:

| Field | Format | Example |
|-------|--------|---------|
| `versionCode` | `YYYYMMDDNN` (UTC date + 2-digit daily build 01–99) | `2026080701` |
| `versionName` | `0.Y.Z-beta.YYYYMMDDNN-<tag>` | `0.1.15-beta.2026080701-item-icons` |
| APK file | `akalynth-beta-v{versionCode}.apk` | `akalynth-beta-v2026080701.apk` |

Self-update compares `versionCode` only (integer). Longer codes must always increase.

## Why
- Short codes (v13–v17) were hard to track across hosts/screenshots.
- Date-stamped codes make support/debug unambiguous without checking a table.
