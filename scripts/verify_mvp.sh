#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
RECEIPTS="${RECEIPTS:-$SERVER_DIR/audit/receipts.jsonl}"
SCENARIOS_DIR="$ROOT_DIR/scripts/verify/scenarios"
HARNESS="$ROOT_DIR/scripts/verify/ws_harness.mjs"
PORT="${PORT:-3100}"
HTTP_URL="${HTTP_URL:-http://localhost:$PORT}"
WS_URL="${WS_URL:-ws://localhost:$PORT}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-12}"
DEATH_TIMEOUT_SECONDS="${DEATH_TIMEOUT_SECONDS:-40}"
DEATH_RESPAWN_DELAY_MS_OVERRIDE="${DEATH_RESPAWN_DELAY_MS_OVERRIDE:-300}"
log() { echo -e "🧪 $*"; }
die() { echo -e "❌ $*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"; }
TIMEOUT_BIN="$(command -v timeout || true)"
run_timeout() { local secs="$1"; shift; [[ -n "$TIMEOUT_BIN" ]] && "$TIMEOUT_BIN" "$secs" "$@" || "$@"; }
cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    log "Stopping server (pid=$SERVER_PID)…"
    if command -v pkill >/dev/null 2>&1; then pkill -P "$SERVER_PID" 2>/dev/null || true; fi
    kill "$SERVER_PID" 2>/dev/null || true
    sleep 1
    if command -v pkill >/dev/null 2>&1; then pkill -P "$SERVER_PID" 2>/dev/null || true; fi
    kill -9 "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
port_in_use() { command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; }
wait_for_health() {
  local deadline=$((SECONDS + 10))
  while (( SECONDS < deadline )); do
    curl -sf "$HTTP_URL/v1/health" >/dev/null 2>&1 && return 0
    sleep 0.3
  done
  die "Server not ready on $HTTP_URL. Check /tmp/akalynth_verify_server.log"
}
poll_json() {
  local desc="$1" url="$2" filter="$3" timeout_s="${4:-6}"
  local deadline=$((SECONDS + timeout_s))
  while (( SECONDS < deadline )); do
    local body
    body="$(curl -s "$url" || true)"
    if echo "$body" | jq -e "$filter" >/dev/null 2>&1; then
      echo "$body"
      return 0
    fi
    sleep 0.2
  done
  die "$desc"
}
wait_for_receipt() {
  local action="$1" player_id="$2" filter="$3"
  poll_json "Receipts API missing $action for player_id=$player_id" \
    "$HTTP_URL/v1/receipts?action=$action&player_id=$player_id&limit=50" \
    "$filter"
}
try_receipt() {
  local action="$1" player_id="$2" filter="$3" timeout_s="${4:-4}"
  local deadline=$((SECONDS + timeout_s))
  while (( SECONDS < deadline )); do
    local body
    body="$(curl -s "$HTTP_URL/v1/receipts?action=$action&player_id=$player_id&limit=50" || true)"
    echo "$body" | jq -e "$filter" >/dev/null 2>&1 && return 0
    sleep 0.2
  done
  return 1
}
run_ws_scenario() {
  local scenario="$1" token="$2" timeout_s="${3:-$TIMEOUT_SECONDS}"
  run_timeout "$timeout_s" node "$HARNESS" \
    --ws-url "$WS_URL" \
    --guest-token "$token" \
    --scenario "$SCENARIOS_DIR/$scenario.json" || true
}
assert_ws_ok() {
  local label="$1" json="$2"
  if ! echo "$json" | jq -e '.ok == true' >/dev/null 2>&1; then
    local failures
    failures="$(echo "$json" | jq -r '.failures[]?' 2>/dev/null || true)"
    die "$label failed: ${failures:-unknown_failure}"
  fi
}
mint_guest() {
  local json token player
  json="$(run_timeout 5 curl -s -X POST "$HTTP_URL/v1/session/guest" || true)"
  echo "$json" | jq . >/dev/null 2>&1 || die "Invalid JSON from /v1/session/guest: $json"
  token="$(echo "$json" | jq -r '.guest_token // empty')"
  player="$(echo "$json" | jq -r '.player_id // empty')"
  [[ -n "$token" ]] || die "Missing guest_token from mint response: $json"
  [[ -n "$player" ]] || die "Missing player_id from mint response: $json"
  echo "$player $token"
}
log "Akalynth MVP verify @ $WS_URL"
for cmd in node npm bash curl jq; do need_cmd "$cmd"; done
cd "$SERVER_DIR"
npm install --silent
[[ -f "$HARNESS" ]] || die "Missing harness: $HARNESS"
port_in_use && die "PORT=$PORT already in use. Set PORT to a free port and re-run."
mkdir -p "$(dirname "$RECEIPTS")"
touch "$RECEIPTS"
DEBUG=1 \
ALLOW_TEST_DEATH=1 \
DEATH_RESPAWN_DELAY_MS="$DEATH_RESPAWN_DELAY_MS_OVERRIDE" \
PUBLIC_RECEIPTS_DELAY_MS=0 \
PUBLIC_RECEIPTS_DELAY_PROFILE=default \
PUBLIC_RECEIPTS_JITTER_MS=0 \
PORT="$PORT" \
npm run dev >/tmp/akalynth_verify_server.log 2>&1 &
SERVER_PID=$!
wait_for_health
curl -sf "$HTTP_URL/v1/maps" | grep -q 'Rookguard' || die "HTTP /v1/maps missing Rookguard"
curl -sf "$HTTP_URL/v1/maps/Azura" | grep -q '"name":"Azura"' || die "HTTP /v1/maps/Azura failed"
WORLD_STATE_RG="$(poll_json "Invalid JSON from /v1/world/Rookguard/state" \
  "$HTTP_URL/v1/world/Rookguard/state" '.ok == true')"
ROOK_SPAWN_X="$(echo "$WORLD_STATE_RG" | jq -r '.map.spawn.x // empty')"
ROOK_SPAWN_Y="$(echo "$WORLD_STATE_RG" | jq -r '.map.spawn.y // empty')"
[[ -n "$ROOK_SPAWN_X" && -n "$ROOK_SPAWN_Y" ]] || die "/v1/world/Rookguard/state missing spawn"
poll_json "Invalid JSON from /v1/world/Azura/state" \
  "$HTTP_URL/v1/world/Azura/state" '.ok == true' >/dev/null
log "Baseline WS flow..."
read -r PLAYER_ID GUEST_TOKEN <<<"$(mint_guest)"
BASELINE_JSON="$(run_ws_scenario baseline "$GUEST_TOKEN")"
assert_ws_ok "baseline" "$BASELINE_JSON"
wait_for_receipt "session_guest_minted" "$PLAYER_ID" '(.receipts | length) > 0' >/dev/null
if ! try_receipt "tem_challenge_issued" "$PLAYER_ID" \
  '[.receipts[] | select(.inputs.trigger=="perfect_cadence")] | length > 0'; then
  log "WARN: perfect_cadence not observed (timing variance)"
fi
log "Death flow..."
read -r DEATH_PLAYER_ID DEATH_GUEST_TOKEN <<<"$(mint_guest)"
DEATH_JSON="$(run_ws_scenario death "$DEATH_GUEST_TOKEN" "$DEATH_TIMEOUT_SECONDS")"
assert_ws_ok "death" "$DEATH_JSON"
echo "$DEATH_JSON" | jq -e '.messages[] | select(.type=="death_notice")' >/dev/null || die "No death_notice received"
MOVE_REJECTS="$(echo "$DEATH_JSON" | jq '[.messages[] | select(.type=="move_result" and .ok==false)] | length')"
MOVE_OKS="$(echo "$DEATH_JSON" | jq '[.messages[] | select(.type=="move_result" and .ok==true)] | length')"
[[ "$MOVE_REJECTS" -gt 0 ]] || die "No move_result rejection observed"
[[ "$MOVE_OKS" -gt 0 ]] || die "No move_result success observed"
for action in death death_in_azura respawn; do
  wait_for_receipt "$action" "$DEATH_PLAYER_ID" '(.receipts | length) > 0' >/dev/null
done
wait_for_receipt "ledger_hesitation" "$DEATH_PLAYER_ID" '[.receipts[] | select(.inputs.type=="movement_block")] | length == 1' >/dev/null
log "Stone legend flow..."
read -r STONE_PLAYER_ID STONE_GUEST_TOKEN <<<"$(mint_guest)"
STONE_JSON="$(run_ws_scenario stone "$STONE_GUEST_TOKEN")"
assert_ws_ok "stone" "$STONE_JSON"
STONE_LAST_MOVE="$(echo "$STONE_JSON" | jq -r '.messages | map(select(.type=="move_result")) | last | @json')"
[[ -n "$STONE_LAST_MOVE" && "$STONE_LAST_MOVE" != "null" ]] || die "Missing move_result in stone flow"
STONE_LAST_X="$(echo "$STONE_LAST_MOVE" | jq -r '.x')"
STONE_LAST_Y="$(echo "$STONE_LAST_MOVE" | jq -r '.y')"
[[ "$STONE_LAST_X" == "$ROOK_SPAWN_X" && "$STONE_LAST_Y" == "$ROOK_SPAWN_Y" ]] || die "Stone attempt did not displace to spawn"
wait_for_receipt "legend_attempted" "$STONE_PLAYER_ID" '(.receipts | length) > 0' >/dev/null
LEGEND_REFUSED_JSON="$(wait_for_receipt "legend_refused" "$STONE_PLAYER_ID" '[.receipts[] | select(.inputs.reason=="cannot_obtain" and .inputs.outcome=="displace")] | length > 0')"
REFUSED_TO_X="$(echo "$LEGEND_REFUSED_JSON" | jq -r '.receipts[] | select(.inputs.reason=="cannot_obtain") | .inputs.to.x' | head -n1)"
REFUSED_TO_Y="$(echo "$LEGEND_REFUSED_JSON" | jq -r '.receipts[] | select(.inputs.reason=="cannot_obtain") | .inputs.to.y' | head -n1)"
[[ "$REFUSED_TO_X" == "$ROOK_SPAWN_X" && "$REFUSED_TO_Y" == "$ROOK_SPAWN_Y" ]] || die "legend_refused did not target spawn"
log "Public receipts feed..."
PUBLIC_JSON="$(poll_json "Public receipts feed invalid" "$HTTP_URL/v1/receipts/public?limit=50" 'has("receipts") and (.receipts | type=="array")')"
[[ "$(echo "$PUBLIC_JSON" | jq -r '.mode // empty')" == "strict" ]] || die "Public receipts feed missing mode=strict"
echo "$PUBLIC_JSON" | grep -q '"player_id"' && die "Public receipts feed leaked player_id"
RAW_COORD_COUNT="$(echo "$PUBLIC_JSON" | jq '[.receipts[].inputs | paths(scalars) as $p | select(($p[-1]=="x" or $p[-1]=="y") and ($p[-2] != "approx") and (getpath($p) | type=="number"))] | length' 2>/dev/null || echo 0)"
[[ "${RAW_COORD_COUNT:-0}" -eq 0 ]] || die "Public receipts feed leaked raw coordinates"
ACTOR_COUNT="$(echo "$PUBLIC_JSON" | jq '[.receipts[] | select(.actor? and (.actor | length > 0))] | length')"
[[ "$ACTOR_COUNT" -gt 0 ]] || die "Public receipts feed missing actor"
echo "$PUBLIC_JSON" | grep -Eq 'death_in_rookguard|death_in_azura' || die "Public receipts feed missing death_in_*"
echo "$PUBLIC_JSON" | grep -Eq 'legend_refused|first_attempt_stone_cannot_obtain' || die "Public receipts feed missing stone legend receipts"
RUMOR_JSON="$(poll_json "Public rumors feed invalid" "$HTTP_URL/v1/rumors/public?limit=20" 'has("rumors") and (.rumors | type=="array")')"
RUMOR_TEXT="$(echo "$RUMOR_JSON" | jq -r '.rumors[] | select(.rumor_id=="nothing_finishes") | .text' | head -n1)"
[[ "$RUMOR_TEXT" == "There's a place in Rookguard where nothing finishes." ]] || die "Public rumors feed missing exact rumor text"
STONE_RUMOR_TEXT="$(echo "$RUMOR_JSON" | jq -r '.rumors[] | select(.rumor_id=="stone_refuses") | .text' | head -n1)"
[[ "$STONE_RUMOR_TEXT" == "Somewhere in Rookguard, the world refuses to finish what you start." ]] || die "Public rumors feed missing stone_refuses rumor text"
echo "$RUMOR_JSON" | grep -q '"player_id"' && die "Public rumors feed leaked player_id"
RUMOR_COORD_COUNT="$(echo "$RUMOR_JSON" | jq '[.rumors[] | paths(scalars) as $p | select(($p[-1]==\"x\" or $p[-1]==\"y\") and (getpath($p) | type==\"number\"))] | length' 2>/dev/null || echo 0)"
[[ "${RUMOR_COORD_COUNT:-0}" -eq 0 ]] || die "Public rumors feed leaked coordinates"
RUMOR_ACTOR_COUNT="$(echo "$RUMOR_JSON" | jq '[.rumors[] | select(.actor? and (.actor | length > 0))] | length')"
[[ "$RUMOR_ACTOR_COUNT" -gt 0 ]] || die "Public rumors feed missing actor"
log "Runestone flow..."
read -r RUNE_PLAYER_ID RUNE_GUEST_TOKEN <<<"$(mint_guest)"
RUNE_JSON="$(run_ws_scenario runestone "$RUNE_GUEST_TOKEN")"
assert_ws_ok "runestone" "$RUNE_JSON"
for action in runestone_cast runestone_result; do
  wait_for_receipt "$action" "$RUNE_PLAYER_ID" '(.receipts | length) > 0' >/dev/null
done
wait_for_receipt "runestone_denied" "$RUNE_PLAYER_ID" '[.receipts[] | select(.inputs.reason=="cooldown")] | length > 0' >/dev/null
log "Trinity of Shadow flow (forced face)..."
cleanup
sleep 1
TRINITY_PORT="${TRINITY_PORT:-$((PORT + 1))}"
PORT="$TRINITY_PORT"; HTTP_URL="http://localhost:$PORT"; WS_URL="ws://localhost:$PORT"
port_in_use && die "PORT=$PORT already in use for trinity server."
DEBUG=1 \
ALLOW_TEST_DEATH=1 \
DEATH_RESPAWN_DELAY_MS="$DEATH_RESPAWN_DELAY_MS_OVERRIDE" \
PUBLIC_RECEIPTS_DELAY_MS=0 \
PUBLIC_RECEIPTS_DELAY_PROFILE=default \
PUBLIC_RECEIPTS_JITTER_MS=0 \
RUNESTONE_TEST_FORCE_FACE=shadow \
PORT="$PORT" \
npm run dev >/tmp/akalynth_verify_server_trinity.log 2>&1 &
SERVER_PID=$!
wait_for_health
read -r TRINITY_PLAYER_ID TRINITY_GUEST_TOKEN <<<"$(mint_guest)"
TRINITY_JSON="$(run_ws_scenario trinity "$TRINITY_GUEST_TOKEN" 25)"
assert_ws_ok "trinity" "$TRINITY_JSON"
TRINITY_SHADOW_COUNT="$(echo "$TRINITY_JSON" | jq '[.messages[] | select(.type=="runestone_result" and .face=="shadow")] | length')"
[[ "$TRINITY_SHADOW_COUNT" -ge 3 ]] || die "Trinity test did not get 3 shadow results"
wait_for_receipt "trinity_of_shadow" "$TRINITY_PLAYER_ID" '(.receipts | length) > 0' >/dev/null
PUBLIC_TRINITY_JSON="$(poll_json "Public receipts invalid (trinity check)" "$HTTP_URL/v1/receipts/public?limit=50" 'has("receipts")')"
echo "$PUBLIC_TRINITY_JSON" | grep -q 'trinity_of_shadow' || die "Public receipts feed missing trinity_of_shadow"
echo "$PUBLIC_TRINITY_JSON" | grep 'trinity_of_shadow' | grep -q '"player_id"' && die "Public receipts leaked player_id for trinity_of_shadow"
log "✅ VERIFY PASS"
log "Last receipts:"
tail -10 "$RECEIPTS" || true
