#!/usr/bin/env bash
# Build the debug Android client on ops-dev-01 and install it on the Pixel VM.
set -euo pipefail

REMOTE_HOST="${AKALYNTH_PIXEL_REMOTE_HOST:-ops-dev-01}"
REMOTE_REPO="${AKALYNTH_PIXEL_REMOTE_REPO:-/home/sovereign/akalynth-ops/repos/akalynth}"
ADB_SERIAL="${AKALYNTH_PIXEL_SERIAL:-127.0.0.1:15575}"
PACKAGE_NAME="${AKALYNTH_ANDROID_PACKAGE:-com.akalynth.client}"
BUILD_TASK="${AKALYNTH_ANDROID_BUILD_TASK:-assembleDebug}"

usage() {
  cat <<'USAGE'
Usage: scripts/akalynth-install-to-pixel.sh

Builds apps/android on ops-dev-01, copies app-debug.apk locally, installs it
on the Pixel emulator, and launches com.akalynth.client.

Environment overrides:
  AKALYNTH_PIXEL_REMOTE_HOST   SSH host for the source tree (default: ops-dev-01)
  AKALYNTH_PIXEL_REMOTE_REPO   remote repo path
  AKALYNTH_PIXEL_SERIAL        ADB serial (default: 127.0.0.1:15575)
  AKALYNTH_ANDROID_BUILD_TASK  Gradle task (default: assembleDebug)
  AKALYNTH_PIXEL_SKIP_CONNECT=1  skip `pixel vm-connect`
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v adb >/dev/null 2>&1; then
  printf 'Pixel install failed: adb is not installed.\n' >&2
  exit 1
fi

if [[ "${AKALYNTH_PIXEL_SKIP_CONNECT:-0}" != "1" ]]; then
  if command -v pixel >/dev/null 2>&1; then
    printf 'Connecting Pixel bridge: pixel vm-connect\n'
    pixel vm-connect
  else
    printf 'Pixel helper not found; start `pixel vm` or `pixel vm-connect`, then rerun.\n' >&2
    exit 1
  fi
fi

if ! adb -s "$ADB_SERIAL" get-state >/dev/null 2>&1; then
  printf 'Pixel install failed: ADB device %s is not reachable.\n' "$ADB_SERIAL" >&2
  exit 1
fi

printf 'Building Android client on %s:%s\n' "$REMOTE_HOST" "$REMOTE_REPO"
ssh -o BatchMode=yes "$REMOTE_HOST" \
  "cd '$REMOTE_REPO/apps/android' && ./gradlew '$BUILD_TASK'"

tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT

apk_path="$tmp_dir/akalynth-debug.apk"
scp -q \
  "$REMOTE_HOST:$REMOTE_REPO/apps/android/app/build/outputs/apk/debug/app-debug.apk" \
  "$apk_path"

printf 'Installing %s on %s\n' "$PACKAGE_NAME" "$ADB_SERIAL"
adb -s "$ADB_SERIAL" install -r -t -d "$apk_path"

if ! adb -s "$ADB_SERIAL" shell pm list packages | grep -Fqi "$PACKAGE_NAME"; then
  printf 'Pixel install failed: package %s is not installed.\n' "$PACKAGE_NAME" >&2
  exit 1
fi

printf 'Launching %s\n' "$PACKAGE_NAME"
adb -s "$ADB_SERIAL" shell monkey -p "$PACKAGE_NAME" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 1
printf 'device=%s\n' "$ADB_SERIAL"
printf 'package=%s\n' "$PACKAGE_NAME"
printf 'process=%s\n' "$(adb -s "$ADB_SERIAL" shell pidof "$PACKAGE_NAME" | tr -d '\r')"
printf 'status=installed_and_launched\n'
