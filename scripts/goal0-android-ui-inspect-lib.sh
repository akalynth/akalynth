# shellcheck shell=bash
# UI automation helpers for goal0-android-ui-inspect-remote.sh (source, do not execute).

ui_dump() {
  local path="${1:-/sdcard/akalynth_ui_dump.xml}"
  "${ADB[@]}" shell uiautomator dump "${path}" </dev/null >/dev/null 2>&1 || true
  "${ADB[@]}" pull "${path}" "${REMOTE_ROOT}/.ui_dump.xml" >/dev/null 2>&1 || true
}

ui_tap_node() {
  local attr="$1"
  local value="$2"
  ui_dump /sdcard/akalynth_ui_tap.xml
  local coords
  coords="$(UI_DUMP="${REMOTE_ROOT}/.ui_dump.xml" python3 - "${attr}" "${value}" <<'PY'
import os, re, sys
attr, val = sys.argv[1], sys.argv[2]
xml = open(os.environ["UI_DUMP"], encoding="utf-8", errors="ignore").read()
pat = rf'<node[^>]*{re.escape(attr)}="{re.escape(val)}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
m = re.search(pat, xml)
if not m:
    raise SystemExit(1)
x1, y1, x2, y2 = map(int, m.groups())
print((x1 + x2) // 2, (y1 + y2) // 2)
PY
)" || return 1
  local cx cy
  read -r cx cy <<<"${coords}"
  log_line "ui tap ${attr}=${value} @ ${cx},${cy}"
  "${ADB[@]}" shell input tap "${cx}" "${cy}" </dev/null
}

ui_tap_text() { ui_tap_node text "$1"; }
ui_tap_content_desc() { ui_tap_node content-desc "$1"; }

ui_read_pos() {
  ui_dump /sdcard/akalynth_ui_pos.xml
  local pos
  pos="$(UI_DUMP="${REMOTE_ROOT}/.ui_dump.xml" python3 - <<'PY'
import os, re
xml = open(os.environ["UI_DUMP"], encoding="utf-8", errors="ignore").read()
m = re.search(r'text="Pos: (\d+), (\d+)"', xml)
if not m:
    raise SystemExit(1)
print(m.group(1), m.group(2))
PY
)" || return 1
  read -r POS_X POS_Y <<<"${pos}"
}

ui_wait_pos() {
  local timeout="${1:-30}"
  local i
  for ((i = 0; i < timeout; i++)); do
    if ui_read_pos 2>/dev/null; then
      log_line "hud pos ${POS_X},${POS_Y}"
      return 0
    fi
    sleep 1
  done
  return 1
}

ui_wait_text() {
  local text="$1"
  local timeout="${2:-45}"
  local i
  for ((i = 0; i < timeout; i++)); do
    ui_dump /sdcard/akalynth_ui_wait.xml
    if grep -q "text=\"${text}\"" "${REMOTE_ROOT}/.ui_dump.xml" 2>/dev/null; then
      log_line "ui saw text: ${text}"
      return 0
    fi
    sleep 1
  done
  return 1
}

cache_dpad_fallback() {
  DPAD_NORTH_X=273
  DPAD_NORTH_Y=1365
  DPAD_SOUTH_X=273
  DPAD_SOUTH_Y=1725
  DPAD_EAST_X=429
  DPAD_EAST_Y=1545
  DPAD_WEST_X=117
  DPAD_WEST_Y=1545
  log_line "dpad coords fallback: E=${DPAD_EAST_X},${DPAD_EAST_Y}"
}

cache_dpad_coords() {
  local attempt
  for attempt in 1 2 3 4 5; do
    bring_app_foreground 2>/dev/null || true
    ui_dump /sdcard/akalynth_dpad.xml
    local coords
    coords="$(UI_DUMP="${REMOTE_ROOT}/.ui_dump.xml" python3 - <<'PY'
import os, re
xml = open(os.environ["UI_DUMP"], encoding="utf-8", errors="ignore").read()
for desc in ("NORTH", "SOUTH", "EAST", "WEST"):
    m = re.search(
        rf'content-desc="{desc}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
        xml,
    )
    if not m:
        raise SystemExit(f"missing {desc}")
    x1, y1, x2, y2 = map(int, m.groups())
    print(f"{desc} {(x1+x2)//2} {(y1+y2)//2}")
PY
)" && {
      local key x y
      while read -r key x y; do
        [[ -z "${key}" ]] && continue
        printf -v "DPAD_${key}_X" '%s' "${x}"
        printf -v "DPAD_${key}_Y" '%s' "${y}"
      done <<< "${coords}"
      log_line "dpad coords cached: E=${DPAD_EAST_X},${DPAD_EAST_Y}"
      return 0
    }
    log_line "dpad cache attempt ${attempt} failed"
    sleep 2
  done
  cache_dpad_fallback
  return 0
}

app_is_foreground() {
  "${ADB[@]}" shell dumpsys activity activities </dev/null 2>/dev/null \
    | grep -q "${PKG}/.MainActivity"
}

bring_app_foreground() {
  if app_is_foreground; then
    return 0
  fi
  log_line "ui: bringing app to foreground"
  "${ADB[@]}" shell am start -n "${ACTIVITY}" </dev/null
  sleep 2
}

dpad_press_at() {
  local x="$1"
  local y="$2"
  local hold_ms="${3:-95}"
  # Compose DPad repeats while held (MOVE_REPEAT_MS=130). Stay under one tick.
  "${ADB[@]}" shell input swipe "${x}" "${y}" "${x}" "${y}" "${hold_ms}" </dev/null
}

dpad_move() {
  local dir="$1"
  local x_var="DPAD_${dir}_X"
  local y_var="DPAD_${dir}_Y"
  local x="${!x_var:-}"
  local y="${!y_var:-}"
  if [[ -z "${x}" || -z "${y}" ]]; then
    ui_tap_content_desc "${dir}" || return 1
  else
    dpad_press_at "${x}" "${y}"
  fi
  sleep "${MOVE_DELAY}"
}

expected_pos_after_move() {
  local dir="$1"
  local from_x="$2"
  local from_y="$3"
  case "${dir}" in
    EAST) echo $((from_x + 1)) "${from_y}" ;;
    WEST) echo $((from_x - 1)) "${from_y}" ;;
    SOUTH) echo "${from_x}" $((from_y + 1)) ;;
    NORTH) echo "${from_x}" $((from_y - 1)) ;;
    *) return 1 ;;
  esac
}

pos_moved_one_tile() {
  local dir="$1"
  local from_x="$2"
  local from_y="$3"
  case "${dir}" in
    EAST) [[ "${POS_X}" -eq $((from_x + 1)) && "${POS_Y}" -eq "${from_y}" ]] ;;
    WEST) [[ "${POS_X}" -eq $((from_x - 1)) && "${POS_Y}" -eq "${from_y}" ]] ;;
    SOUTH) [[ "${POS_X}" -eq "${from_x}" && "${POS_Y}" -eq $((from_y + 1)) ]] ;;
    NORTH) [[ "${POS_X}" -eq "${from_x}" && "${POS_Y}" -eq $((from_y - 1)) ]] ;;
    *) return 1 ;;
  esac
}

dpad_move_verified() {
  local dir="$1"
  ui_read_pos || return 1
  local from_x="${POS_X}" from_y="${POS_Y}"
  local exp_x exp_y
  read -r exp_x exp_y <<< "$(expected_pos_after_move "${dir}" "${from_x}" "${from_y}")"
  local try wait_i
  for try in 1 2 3; do
    dpad_move "${dir}" || return 1
    sleep 2.5
    if ui_read_pos 2>/dev/null; then
      if [[ "${POS_X}" -eq "${exp_x}" && "${POS_Y}" -eq "${exp_y}" ]]; then
        return 0
      fi
      if pos_moved_one_tile "${dir}" "${from_x}" "${from_y}"; then
        return 0
      fi
    fi
    if ui_read_pos 2>/dev/null && [[ "${POS_X}" -eq "${from_x}" && "${POS_Y}" -eq "${from_y}" ]]; then
      log_line "move ${dir} verify retry ${try}: still at ${from_x},${from_y}"
      sleep 1.5
      continue
    fi
    ui_read_pos 2>/dev/null && log_line "move ${dir} verify: advanced to ${POS_X},${POS_Y} (wanted ${exp_x},${exp_y})"
    return 0
  done
  return 1
}

wait_pos_at() {
  local want_x="$1"
  local want_y="$2"
  local timeout="${3:-25}"
  local i
  for ((i = 0; i < timeout; i++)); do
    if ui_read_pos 2>/dev/null && [[ "${POS_X}" -eq "${want_x}" && "${POS_Y}" -eq "${want_y}" ]]; then
      log_line "pos milestone ${want_x},${want_y}"
      return 0
    fi
    sleep 1
  done
  ui_read_pos 2>/dev/null && log_line "pos milestone miss ${want_x},${want_y} (at ${POS_X},${POS_Y})" || true
  return 1
}

# BFS paths from packages/shared/maps/rookguard.json (matches verify-rookguard-codex-path).
CODEX_PATH_TUTORIAL_MOVE="EAST"
CODEX_PATH_TEM_RUNE="EAST,EAST,EAST,EAST"
CODEX_PATH_TRAINING="EAST,EAST,EAST,EAST,EAST,EAST,EAST,EAST,SOUTH,SOUTH,SOUTH,SOUTH,SOUTH,SOUTH,SOUTH,SOUTH,SOUTH,SOUTH,SOUTH,SOUTH"
CODEX_PATH_GUILD_HALL="NORTH,NORTH,NORTH,NORTH,NORTH,NORTH,NORTH,NORTH,NORTH,NORTH"
CODEX_PATH_GATE="WEST,WEST,WEST,WEST,WEST,NORTH,NORTH"

walk_path_dirs() {
  local leg_name="$1"
  local dirs_csv="$2"
  local -a dirs
  IFS=',' read -r -a dirs <<< "${dirs_csv}"
  log_line "walk ${leg_name}: ${#dirs[@]} steps"
  local dir step=0
  for dir in "${dirs[@]}"; do
    [[ -z "${dir}" ]] && continue
    dpad_move_verified "${dir}" || return 1
    step=$((step + 1))
  done
  sleep 1
  ui_read_pos 2>/dev/null && log_line "walk ${leg_name} end pos ${POS_X},${POS_Y} (${step} steps)" || true
}

walk_to_greedy() {
  local target_x="$1"
  local target_y="$2"
  local max_steps="${3:-${CODEX_MAX_STEPS_PER_LEG}}"
  local step=0
  while (( step < max_steps )); do
    ui_read_pos || return 1
    if [[ "${POS_X}" -eq "${target_x}" && "${POS_Y}" -eq "${target_y}" ]]; then
      log_line "walk reached ${target_x},${target_y} in ${step} steps"
      return 0
    fi
    local dir=""
    if (( POS_X < target_x )); then dir="EAST"
    elif (( POS_X > target_x )); then dir="WEST"
    elif (( POS_Y < target_y )); then dir="SOUTH"
    else dir="NORTH"
    fi
    dpad_move_verified "${dir}" || return 1
    step=$((step + 1))
  done
  ui_read_pos 2>/dev/null || true
  log_line "walk timeout toward ${target_x},${target_y} (last ${POS_X:-?},${POS_Y:-?})"
  return 1
}

chat_is_open() {
  ui_dump /sdcard/akalynth_chat_probe.xml
  grep -q 'content-desc="Close"' "${REMOTE_ROOT}/.ui_dump.xml" 2>/dev/null \
    || grep -q 'text="Send"' "${REMOTE_ROOT}/.ui_dump.xml" 2>/dev/null
}

close_chat() {
  if ! chat_is_open; then
    cache_dpad_coords 2>/dev/null || true
    return 0
  fi
  ui_tap_content_desc "Close" 2>/dev/null || ui_tap_content_desc "Chat" 2>/dev/null || true
  sleep 1
  cache_dpad_coords 2>/dev/null || true
}

dismiss_tem_challenge() {
  if ui_wait_text "Quick human check" 8 2>/dev/null; then
    log_line "codex: Tem challenge visible"
    ui_tap_text "I'm here — confirm" || ui_tap_text "AKALYNTH" || true
    sleep 2
    return 0
  fi
  if ui_wait_text "I'm here — confirm" 5 2>/dev/null; then
    ui_tap_text "I'm here — confirm" || true
    sleep 2
    return 0
  fi
  return 1
}

ensure_hud_ready() {
  bring_app_foreground
  close_chat
  cache_dpad_coords
}

send_chat() {
  local message="$1"
  ui_tap_content_desc "Chat" || ui_tap_text "Chat" || return 1
  sleep 1
  local escaped="${message// /%s}"
  "${ADB[@]}" shell input text "${escaped}" </dev/null
  sleep 0.5
  ui_tap_content_desc "Send" || return 1
  sleep 1.5
  ui_tap_content_desc "Close" 2>/dev/null || true
  sleep 1
  cache_dpad_coords 2>/dev/null || true
  log_line "chat sent: ${message}"
}

run_codex_to_azura() {
  log_line "codex: waiting for HUD position"
  ui_wait_pos 30
  ensure_hud_ready

  log_line "codex: tutorial move tile (3,2)"
  walk_path_dirs "tutorial_move" "${CODEX_PATH_TUTORIAL_MOVE}" || return 1
  wait_pos_at 3 2 15 || return 1

  log_line "codex: chat step"
  send_chat "gather inspect ui" || return 1
  ensure_hud_ready

  log_line "codex: tem rune (7,2)"
  walk_path_dirs "tem_rune" "${CODEX_PATH_TEM_RUNE}" || return 1
  wait_pos_at 7 2 15 || return 1
  dismiss_tem_challenge || true

  log_line "codex: training slime"
  walk_path_dirs "training" "${CODEX_PATH_TRAINING}" || return 1
  local atk_try
  for atk_try in 1 2 3 4 5 6; do
    bring_app_foreground
    if ui_tap_text "ATK" 2>/dev/null; then
      log_line "codex: ATK tap ${atk_try}"
      sleep "${COMBAT_WAIT_S}"
    else
      sleep 1
    fi
  done
  sleep 2
  ensure_hud_ready

  log_line "codex: guild hall + vocation"
  walk_path_dirs "guild_hall" "${CODEX_PATH_GUILD_HALL}" || return 1
  sleep 1
  ui_tap_text "Hex" || ui_tap_text "Cnt" || ui_tap_text "Wdn" || ui_tap_text "Rvr" || true
  sleep 3
  ensure_hud_ready

  log_line "codex: gate to Azura (10,2)"
  walk_path_dirs "gate" "${CODEX_PATH_GATE}" || return 1
  walk_to_greedy 10 2 6 || true
  ui_read_pos 2>/dev/null && log_line "codex: gate tile ${POS_X},${POS_Y}"
  sleep 4
  ui_wait_text "High City" 90 || ui_wait_text "Azura" 30 || return 1
  if wait_pos_at 32 32 20; then
    log_line "codex: azura arrival pos 32,32"
    return 0
  fi
  ui_read_pos 2>/dev/null && log_line "codex: azura arrival pos ${POS_X},${POS_Y}"
  return 1
}