#!/usr/bin/env bash
# Runs on goal0-edge-01. Invoked by goal0-android-ui-inspect.sh — do not pipe on stdin.
set -euo pipefail

SERIAL="$1"
PKG="$2"
ACTIVITY="$3"
APK_URL="$4"
REMOTE_ROOT="$5"
SCENARIOS="$6"
INSTALL="$7"
CONNECT_WAIT_S="$8"

ADB=(adb -s "${SERIAL}")
MOVE_DELAY="${AKALYNTH_UI_MOVE_DELAY:-2.0}"
CODEX_MAX_STEPS_PER_LEG="${AKALYNTH_UI_CODEX_MAX_STEPS:-120}"
COMBAT_WAIT_S="${AKALYNTH_UI_COMBAT_WAIT_S:-2.2}"
GATHER_TARGET_X="${AKALYNTH_GATHER_TARGET_X:-34}"
GATHER_TARGET_Y="${AKALYNTH_GATHER_TARGET_Y:-32}"

mkdir -p "${REMOTE_ROOT}"
LOG="${REMOTE_ROOT}/inspect.log"

log_line() {
  printf '%s\n' "$1" | tee -a "${LOG}"
}

# shellcheck source=goal0-android-ui-inspect-lib.sh
source "/tmp/goal0-android-ui-inspect-lib.sh"

adb_ready() {
  "${ADB[@]}" wait-for-device
  "${ADB[@]}" shell true </dev/null
}

capture_png() {
  local name="$1"
  "${ADB[@]}" exec-out screencap -p > "${REMOTE_ROOT}/${name}.png"
  printf '%s\n' "${name}.png"
}

dump_ui_xml() {
  local name="$1"
  ui_dump "/sdcard/${name}.xml"
  if [[ -f "${REMOTE_ROOT}/.ui_dump.xml" ]]; then
    cp "${REMOTE_ROOT}/.ui_dump.xml" "${REMOTE_ROOT}/${name}.xml"
    printf '%s\n' "${name}.xml"
  fi
}

tap_connect() {
  ui_dump /sdcard/ui_connect_probe.xml
  local bounds
  bounds="$(grep -oE 'text="Connect"[^>]*bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' "${REMOTE_ROOT}/.ui_dump.xml" 2>/dev/null | head -1 | sed -n 's/.*bounds="\([^"]*\)".*/\1/p' || true)"
  if [[ -n "${bounds}" ]] && [[ "${bounds}" =~ \[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\] ]]; then
    local cx=$(( (BASH_REMATCH[1] + BASH_REMATCH[3]) / 2 ))
    local cy=$(( (BASH_REMATCH[2] + BASH_REMATCH[4]) / 2 ))
    log_line "tap Connect via uiautomator @ ${cx},${cy}"
    "${ADB[@]}" shell input tap "${cx}" "${cy}" </dev/null
  else
    log_line "tap Connect via fallback @ 540,1048"
    "${ADB[@]}" shell input tap 540 1048 </dev/null
  fi
}

app_meta() {
  "${ADB[@]}" shell dumpsys package "${PKG}" </dev/null 2>/dev/null | grep -E 'versionName=|versionCode=' | head -2 | tr -d '\r' | tee -a "${LOG}" || true
  "${ADB[@]}" shell dumpsys activity activities </dev/null 2>/dev/null | grep -E 'mResumedActivity' | head -1 | tr -d '\r' | tee -a "${LOG}" || true
}

log_section() { log_line "=== $1 ==="; }

adb_ready

if [[ "${INSTALL}" == "1" ]]; then
  log_section "install"
  curl -fsSL -o /tmp/akalynth-beta.apk "${APK_URL}"
  "${ADB[@]}" uninstall "${PKG}" 2>/dev/null || true
  "${ADB[@]}" install /tmp/akalynth-beta.apk
fi

log_section "preflight"
app_meta

IFS=',' read -r -a SCENARIO_ARR <<< "${SCENARIOS}"

for scenario in "${SCENARIO_ARR[@]}"; do
  case "${scenario}" in
    login)
      log_section "scenario:login"
      "${ADB[@]}" shell am force-stop "${PKG}" </dev/null || true
      sleep 1
      "${ADB[@]}" shell am start -n "${ACTIVITY}" </dev/null
      sleep 3
      capture_png login >/dev/null
      dump_ui_xml login_ui >/dev/null || true
      ;;
    world)
      log_section "scenario:world"
      "${ADB[@]}" shell am force-stop "${PKG}" </dev/null || true
      sleep 1
      "${ADB[@]}" shell am start -n "${ACTIVITY}" </dev/null
      sleep 3
      tap_connect
      sleep "${CONNECT_WAIT_S}"
      capture_png world_connected >/dev/null
      dump_ui_xml world_ui >/dev/null || true
      "${ADB[@]}" logcat -d -t 60 2>/dev/null | grep -iE 'gather_snapshot|gather_' | tail -10 > "${REMOTE_ROOT}/gather_logcat.txt" || true
      ;;
    azura_gather)
      log_section "scenario:azura_gather"
      "${ADB[@]}" shell am force-stop "${PKG}" </dev/null || true
      sleep 1
      "${ADB[@]}" shell am start -n "${ACTIVITY}" </dev/null
      sleep 3
      tap_connect
      sleep "${CONNECT_WAIT_S}"
      if run_codex_to_azura; then
        log_line "codex: onboarding complete"
      else
        log_line "codex: onboarding failed (continuing for screenshot)"
      fi
      ensure_hud_ready 2>/dev/null || cache_dpad_coords 2>/dev/null || true
      # If codex failed, give extra time for a late transfer to register before
      # checking map text — transfer can arrive 5–15 s after reaching (10,2).
      if ui_wait_text "High City" 30 2>/dev/null || ui_wait_text "Azura" 20 2>/dev/null; then
        log_line "gather: on Azura — walk to node tile ${GATHER_TARGET_X},${GATHER_TARGET_Y} (azura_ley_mote_e)"
        ensure_hud_ready 2>/dev/null || cache_dpad_coords 2>/dev/null || true
        walk_to_greedy "${GATHER_TARGET_X}" "${GATHER_TARGET_Y}" 20 \
          || log_line "gather: walk incomplete (continuing for screenshot)"
      else
        log_line "gather: skipped (not on High City / Azura after extended wait)"
      fi
      sleep 2
      dump_ui_xml azura_gather_ui >/dev/null || true
      if grep -q 'text="Gthr"' "${REMOTE_ROOT}/azura_gather_ui.xml" 2>/dev/null; then
        log_line "gather: Gthr button visible in UI dump"
      else
        log_line "gather: Gthr not found (may be out of range or snapshot pending)"
      fi
      "${ADB[@]}" logcat -d -t 120 2>/dev/null | grep -iE 'gather_snapshot|gather_' | tail -15 > "${REMOTE_ROOT}/azura_gather_logcat.txt" || true
      bring_app_foreground 2>/dev/null || true
      ensure_hud_ready 2>/dev/null || cache_dpad_coords 2>/dev/null || true
      capture_png azura_gather >/dev/null
      ;;
    world_debug)
      log_section "scenario:world_debug"
      ui_dump /sdcard/ui_dbg.xml
      bounds="$(grep -oE 'text="DBG"[^>]*bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' "${REMOTE_ROOT}/.ui_dump.xml" 2>/dev/null | head -1 | sed -n 's/.*bounds="\([^"]*\)".*/\1/p' || true)"
      if [[ -n "${bounds}" ]] && [[ "${bounds}" =~ \[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\] ]]; then
        cx=$(( (BASH_REMATCH[1] + BASH_REMATCH[3]) / 2 ))
        cy=$(( (BASH_REMATCH[2] + BASH_REMATCH[4]) / 2 ))
        "${ADB[@]}" shell input tap "${cx}" "${cy}" </dev/null
        sleep 2
        capture_png world_debug_drawer >/dev/null
      else
        log_line "DBG button not found; skipping debug drawer capture"
      fi
      ;;
    *)
      log_line "unknown scenario: ${scenario}"
      ;;
  esac
done

log_section "postflight"
app_meta

{
  printf '{\n  "run_id": "%s",\n' "$(basename "${REMOTE_ROOT}")"
  printf '  "serial": "%s",\n' "${SERIAL}"
  printf '  "package": "%s",\n' "${PKG}"
  printf '  "scenarios": "%s",\n' "${SCENARIOS}"
  printf '  "artifacts": ['
  first=1
  while IFS= read -r f; do
    [[ -z "${f}" ]] && continue
    if [[ "${first}" -eq 1 ]]; then first=0; else printf ','; fi
    printf '"%s"' "${f}"
  done < <(find "${REMOTE_ROOT}" -maxdepth 1 -type f -printf '%f\n' | sort)
  printf '],\n  "agent_read_order": ['
  first=1
  while IFS= read -r f; do
    [[ -z "${f}" ]] && continue
    if [[ "${first}" -eq 1 ]]; then first=0; else printf ','; fi
    printf '"%s"' "${f}"
  done < <(find "${REMOTE_ROOT}" -maxdepth 1 -type f -name '*.png' -printf '%f\n' | sort)
  printf '],\n  "inspect_checklist": [\n'
  printf '    "top_bar: map chip centered, no overlap with Issue/DBG/TILES",\n'
  printf '    "dpad: dark scrim behind frame, readable over playfield",\n'
  printf '    "action_dock: textured rings (Chat/Chronicle/ATK), vocation chips use action ring",\n'
  printf '    "gather: Gthr/Deliv visible when adjacent to node/station (Azura chill zone)",\n'
  printf '    "textures: nine-slice panels/buttons/dock — no full-screen overlay bleed",\n'
  printf '    "azura_gather: High City map, pos (34,32) on azura_ley_mote_e, Gather section shows Gthr"\n'
  printf '  ]\n}\n'
} > "${REMOTE_ROOT}/manifest.json"
log_line "manifest written"
log_line "bundle=${REMOTE_ROOT}"
cat "${REMOTE_ROOT}/manifest.json" | tee -a "${LOG}"