#!/usr/bin/env bash
# Boot a dedicated GrapheneOS golden clone on goal0-edge-01 for Akalynth APK testing.
set -euo pipefail

HOST="${GOAL0_EDGE_HOST:-goal0-edge-01}"
NAME="${GOAL0_VM_NAME:-akalynth-bugtest-$(date -u +%Y%m%d)}"
PORT="${GOAL0_VM_PORT:-5576}"
APK_URL="${AKALYNTH_BETA_APK_URL:-https://beta.akalynth.com/download/akalynth-beta.apk}"
CLONE_SCRIPT="/opt/goal0/android-golden/run-grapheneos-golden-clone.sh"
GOLDEN_LOCK="/opt/goal0/android-golden/grapheneos/stage-emu64x-20260613T133841Z/images/multiinstance.lock"
RUN_ROOT="/home/g0admin/goal0-grapheneos-running/${NAME}"

log() { printf '[goal0-vm] %s\n' "$1"; }

ssh -o BatchMode=yes -o ConnectTimeout=12 "${HOST}" bash -s -- "${NAME}" "${PORT}" "${RUN_ROOT}" "${CLONE_SCRIPT}" "${GOLDEN_LOCK}" "${APK_URL}" <<'REMOTE'
set -euo pipefail
NAME="$1"
PORT="$2"
RUN_ROOT="$3"
CLONE_SCRIPT="$4"
GOLDEN_LOCK="$5"
APK_URL="$6"

if pgrep -af -- "-datadir ${RUN_ROOT}/datadir" >/dev/null 2>&1; then
  echo "VM already running: ${RUN_ROOT}"
else
  pgrep -a qemu >/dev/null && adb emu kill 2>/dev/null || true
  sleep 2
  rm -f "${GOLDEN_LOCK}"
  rm -rf "${RUN_ROOT}"
  sudo -u g0admin bash -lc "${CLONE_SCRIPT} --name ${NAME} --port ${PORT} --wait"
fi

SERIAL="emulator-${PORT}"
adb -s "${SERIAL}" wait-for-device
curl -fsSL -o /tmp/akalynth-beta.apk "${APK_URL}"
adb -s "${SERIAL}" install -r /tmp/akalynth-beta.apk
adb -s "${SERIAL}" shell am start -n com.akalynth.client/.MainActivity
printf 'serial=%s\n' "${SERIAL}"
printf 'run_dir=%s\n' "${RUN_ROOT}"
REMOTE

log "Ready on ${HOST}: adb -s emulator-${PORT} shell"