#!/usr/bin/env bash
# Goal0 Android UI inspect pipeline — capture screenshots + UI dumps from the APK on VM.
#
# Produces a timestamped bundle an agent can pull locally and Read() as images.
#
# Usage:
#   ./scripts/goal0-android-ui-inspect.sh --mvp-proof
#     Local PR-023 MVP verification checklist + asset pipeline proof (no VM).
#     Writes docs/evidence/UI_REFRESH_MVP_PROOF.json.
#   ./scripts/goal0-android-ui-inspect.sh
#   GOAL0_VM_PORT=5576 AKALYNTH_UI_SCENARIOS=login,world,world_debug ./scripts/goal0-android-ui-inspect.sh
#   AKALYNTH_UI_SCENARIOS=azura_gather ./scripts/goal0-android-ui-inspect.sh   # codex → Azura → (34,32) gather shot
#   AKALYNTH_UI_INSTALL=1 ./scripts/goal0-android-ui-inspect.sh
#
# MVP verification checklist (PR-023, also enforced by --mvp-proof):
#   - Rookguard placements loaded (162) — built JSON + Android assets mirror
#   - 20 item icons in registry — ItemPresentationCatalog.MVP_ITEM_TYPES indexed
#   - Hotbar ItemIcon path — Hotbar.kt → ItemIcon → ItemIconResolver.item_type lookup
#   - Chronicle glyph resolver — ChronicleGlyphResolver + 9 chronicle_kind registry entries
#
# azura_gather runs the full Rookguard codex path (move/chat/tem/training/vocation/gate), walks to
# gather node tile 34,32 (azura_ley_mote_e), captures azura_gather.png (~5–10 min).
#
# Pull bundle for agent image inspection:
#   scp -r goal0-edge-01:/tmp/akalynth-ui-inspect/<run_id> /tmp/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${1:-}" == "--mvp-proof" ]]; then
  exec "${ROOT}/scripts/goal0-android-ui-inspect-mvp-proof.sh"
fi
HOST="${GOAL0_EDGE_HOST:-goal0-edge-01}"
PORT="${GOAL0_VM_PORT:-5576}"
SERIAL="${GOAL0_ADB_SERIAL:-emulator-${PORT}}"
PKG="com.akalynth.client"
ACTIVITY="${PKG}/.MainActivity"
APK_URL="${AKALYNTH_BETA_APK_URL:-https://beta.akalynth.com/download/akalynth-beta.apk}"
SCENARIOS="${AKALYNTH_UI_SCENARIOS:-login,world}"
INSTALL="${AKALYNTH_UI_INSTALL:-0}"
CONNECT_WAIT_S="${AKALYNTH_UI_CONNECT_WAIT_S:-14}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
REMOTE_ROOT="/tmp/akalynth-ui-inspect/${RUN_ID}"
REMOTE_SCRIPT="/tmp/goal0-android-ui-inspect-remote.sh"
LOCAL_PULL="${AKALYNTH_UI_PULL_DIR:-/tmp/akalynth-ui-inspect-${RUN_ID}}"

log() { printf '[ui-inspect] %s\n' "$1"; }

log "Run ${RUN_ID} on ${HOST} (${SERIAL}) scenarios=${SCENARIOS}"

scp -q "${ROOT}/scripts/goal0-android-ui-inspect-remote.sh" "${HOST}:${REMOTE_SCRIPT}"
scp -q "${ROOT}/scripts/goal0-android-ui-inspect-lib.sh" "${HOST}:/tmp/goal0-android-ui-inspect-lib.sh"
ssh -o BatchMode=yes -o ConnectTimeout=15 "${HOST}" \
  bash "${REMOTE_SCRIPT}" \
  "${SERIAL}" "${PKG}" "${ACTIVITY}" "${APK_URL}" "${REMOTE_ROOT}" \
  "${SCENARIOS}" "${INSTALL}" "${CONNECT_WAIT_S}"

log "Pulling bundle to ${LOCAL_PULL}"
rm -rf "${LOCAL_PULL}"
scp -qr "${HOST}:${REMOTE_ROOT}" "${LOCAL_PULL}"

log "Bundle local: ${LOCAL_PULL}"
log "Agent: Read PNGs in agent_read_order from manifest.json, then compare to inspect_checklist"
printf '%s\n' "${LOCAL_PULL}"