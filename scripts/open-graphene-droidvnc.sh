#!/usr/bin/env bash
set -euo pipefail

ADB="${ADB:-adb}"
SERIAL="${ANDROID_SERIAL:-emulator-5576}"
ACTIVITY="${DROIDVNC_ACTIVITY:-net.christianbeier.droidvnc_ng/.MainActivity}"

pick_serial() {
  if "$ADB" -s "$SERIAL" get-state >/dev/null 2>&1; then
    printf '%s\n' "$SERIAL"
    return 0
  fi
  "$ADB" devices | awk 'NR > 1 && $2 == "device" { print $1; exit }'
}

SERIAL="$(pick_serial)"
if [[ -z "$SERIAL" ]]; then
  echo "No connected Android emulator/device found." >&2
  exit 1
fi

"$ADB" -s "$SERIAL" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
"$ADB" -s "$SERIAL" shell wm dismiss-keyguard >/dev/null 2>&1 || true
"$ADB" -s "$SERIAL" shell am start -n "$ACTIVITY"

if [[ "${DROIDVNC_SCRCPY:-auto}" != "0" ]] && command -v scrcpy >/dev/null 2>&1 && [[ -n "${DISPLAY:-}" ]]; then
  exec scrcpy -s "$SERIAL" --window-title "GrapheneOS droidVNC-NG (${SERIAL})" --stay-awake
fi
