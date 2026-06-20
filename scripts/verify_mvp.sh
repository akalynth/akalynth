#!/usr/bin/env bash
# MVP verification = smoke tests + basic invariants
# This script does NOT certify constitutional compliance.
set -euo pipefail
set -o monitor
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/apps/server"
LOG_DIR="${TMPDIR:-/tmp}/akalynth-verify"
RECEIPTS_ENV_SET=0
if [[ -n "${AKALYNTH_RECEIPT_CHAIN_PATH:-}" || -n "${AKALYNTH_RECEIPTS_PATH:-}" || -n "${RECEIPTS:-}" ]]; then
  RECEIPTS_ENV_SET=1
fi
RECEIPTS="${AKALYNTH_RECEIPT_CHAIN_PATH:-${RECEIPTS:-$SERVER_DIR/audit/receipts.jsonl}}"
SCENARIOS_DIR="$ROOT_DIR/scripts/verify/scenarios"
HARNESS="$ROOT_DIR/scripts/verify/ws_harness.mjs"
PORT="${PORT:-3100}"
HTTP_URL="${HTTP_URL:-http://127.0.0.1:$PORT}"
WS_URL="${WS_URL:-ws://127.0.0.1:$PORT}"
# Generic TIMEOUT_SECONDS is often set by CI runners; do not inherit it.
AKALYNTH_WS_TIMEOUT_SECONDS="${AKALYNTH_WS_TIMEOUT_SECONDS:-20}"
DEATH_TIMEOUT_SECONDS="${DEATH_TIMEOUT_SECONDS:-40}"
DEATH_RESPAWN_DELAY_MS_OVERRIDE="${DEATH_RESPAWN_DELAY_MS_OVERRIDE:-300}"
log() { echo -e "🧪 $*"; }
die() { echo -e "❌ $*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"; }
TIMEOUT_BIN="$(command -v timeout || true)"
run_timeout() {
  local secs="$1"
  shift
  if [[ -n "$TIMEOUT_BIN" ]]; then
    "$TIMEOUT_BIN" "$secs" "$@"
  else
    "$@"
  fi
}

RUN_DIR=""
RUN_DIR_TEMP=0
if [[ -z "${AKALYNTH_DB_PATH:-}" || -z "${AKALYNTH_REPLAY_MARKER_PATH:-}" || "$RECEIPTS_ENV_SET" == "0" ]]; then
  RUN_DIR="$(mktemp -d)"
  RUN_DIR_TEMP=1
fi

if [[ -n "$RUN_DIR" ]]; then
  if [[ "$RECEIPTS_ENV_SET" == "0" ]]; then
    RECEIPTS="$RUN_DIR/audit/receipts.jsonl"
  fi
  AKALYNTH_DB_PATH="${AKALYNTH_DB_PATH:-$RUN_DIR/data/akalynth.db}"
  AKALYNTH_REPLAY_MARKER_PATH="${AKALYNTH_REPLAY_MARKER_PATH:-$RUN_DIR/data/replay_marker.json}"
fi

export AKALYNTH_RECEIPT_CHAIN_PATH="$RECEIPTS"
if [[ -n "${AKALYNTH_DB_PATH:-}" ]]; then
  export AKALYNTH_DB_PATH
fi
if [[ -n "${AKALYNTH_REPLAY_MARKER_PATH:-}" ]]; then
  export AKALYNTH_REPLAY_MARKER_PATH
fi
if [[ -z "${CHRONICLE_KEY_PATH:-}" && -f "$ROOT_DIR/.secrets/chronicle.key" ]]; then
  export CHRONICLE_KEY_PATH="$ROOT_DIR/.secrets/chronicle.key"
fi

WITNESS_BG_PID=""
cleanup_bg() {
  if [[ -n "${WITNESS_BG_PID:-}" ]] && kill -0 "$WITNESS_BG_PID" 2>/dev/null; then
    kill "$WITNESS_BG_PID" 2>/dev/null || true
  fi
}

cleanup() {
  cleanup_bg
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    log "Stopping server (pid=$SERVER_PID)…"
    if command -v pkill >/dev/null 2>&1; then pkill -P "$SERVER_PID" 2>/dev/null || true; fi
    kill "$SERVER_PID" 2>/dev/null || true
    sleep 1
    if command -v pkill >/dev/null 2>&1; then pkill -P "$SERVER_PID" 2>/dev/null || true; fi
    kill -9 "$SERVER_PID" 2>/dev/null || true
  fi
}
cleanup_all() {
  cleanup
  if [[ "$RUN_DIR_TEMP" == "1" && -n "$RUN_DIR" && -d "$RUN_DIR" ]]; then
    rm -rf "$RUN_DIR" 2>/dev/null || true
  fi
}
trap cleanup_all EXIT
port_in_use() { command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; }
port_in_use_port() { local p="$1"; command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; }
kill_port() {
  local p="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti:"$p" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
      sleep 1
    fi
  fi
}
pick_free_port() {
  local p="$1"
  local tries=0
  while port_in_use_port "$p" && (( tries < 50 )); do
    p=$((p + 1))
    tries=$((tries + 1))
  done
  echo "$p"
}
wait_for_health() {
  local deadline=$((SECONDS + 10))
  while (( SECONDS < deadline )); do
    curl -sf "$HTTP_URL/v1/health" >/dev/null 2>&1 && return 0
    sleep 0.3
  done
  die "Server not ready on $HTTP_URL. Check $LOG_DIR/akalynth_verify_server.log"
}
wait_for_http_code() {
  local url="$1" want="$2" timeout_s="${3:-12}"
  local deadline=$((SECONDS + timeout_s))
  while (( SECONDS < deadline )); do
    local code
    code="$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)"
    [[ "$code" == "$want" ]] && return 0
    sleep 0.3
  done
  die "Server not ready for $url (wanted HTTP $want)"
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
  local scenario="$1" token="$2" timeout_s="${3:-$AKALYNTH_WS_TIMEOUT_SECONDS}"
  run_timeout "$timeout_s" node "$HARNESS" \
    --ws-url "$WS_URL" \
    --guest-token "$token" \
    --scenario "$SCENARIOS_DIR/$scenario.json" || true
}
run_ws_scenario_bg() {
  local scenario="$1" token="$2" outfile="$3" timeout_s="${4:-$AKALYNTH_WS_TIMEOUT_SECONDS}"
  local ready_file="${5:-}"
  rm -f "$outfile" "${outfile}.code"
  if [[ -n "$ready_file" ]]; then
    rm -f "$ready_file"
  fi
  (
    set +e
    local cmd=(
      node "$HARNESS"
      --ws-url "$WS_URL" \
      --guest-token "$token" \
      --scenario "$SCENARIOS_DIR/$scenario.json"
    )
    if [[ -n "$ready_file" ]]; then
      cmd+=(--ready-file "$ready_file")
    fi
    run_timeout "$timeout_s" "${cmd[@]}" >"$outfile" 2>&1
    echo $? >"${outfile}.code"
  ) &
  WITNESS_BG_PID=$!
}
wait_for_file() {
  local desc="$1" file="$2" timeout_s="${3:-10}"
  local deadline=$((SECONDS + timeout_s))
  while (( SECONDS < deadline )); do
    [[ -s "$file" ]] && return 0
    sleep 0.2
  done
  die "$desc"
}
wait_ws_bg_ok() {
  local label="$1" outfile="$2" timeout_s="${3:-$AKALYNTH_WS_TIMEOUT_SECONDS}"
  local deadline=$((SECONDS + timeout_s))
  while (( SECONDS < deadline )); do
    if [[ -f "${outfile}.code" ]]; then
      local code
      code="$(cat "${outfile}.code" 2>/dev/null || echo 1)"
      if [[ "$code" != "0" ]]; then
        die "$label harness exited non-zero (code=$code). Output:\n$(cat "$outfile" 2>/dev/null || true)"
      fi
      local json
      json="$(cat "$outfile" 2>/dev/null || true)"
      echo "$json" | jq -e '.ok == true' >/dev/null 2>&1 || die "$label harness not ok. Output:\n$json"
      return 0
    fi
    sleep 0.2
  done
  die "$label harness timed out. Output so far:\n$(cat "$outfile" 2>/dev/null || true)"
}
assert_ws_ok() {
  local label="$1" json="$2"
  if ! echo "$json" | jq -e '.ok == true' >/dev/null 2>&1; then
    local failures
    failures="$(echo "$json" | jq -r '.failures[]?' 2>/dev/null || true)"
    if [[ -z "$failures" ]]; then
      local preview
      preview="$(printf '%s' "$json" | tr '\n' ' ' | head -c 240)"
      die "$label failed: unknown_failure (json_len=${#json}; preview=${preview:-<empty>})"
    fi
    die "$label failed: $failures"
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

if [[ -z "${CHRONICLE_KEY_PATH:-}" ]]; then
  if [[ -z "$RUN_DIR" ]]; then
    RUN_DIR="$(mktemp -d)"
    RUN_DIR_TEMP=1
  fi
  CHRONICLE_KEY_PATH="$RUN_DIR/secrets/chronicle.key"
  mkdir -p "$(dirname "$CHRONICLE_KEY_PATH")"
  node --input-type=module -e "
    import crypto from 'node:crypto';
    import fs from 'node:fs';
    const keyPath = process.argv[1];
    const seed = crypto.createHash('sha256').update('akalynth-mvp-verify-temp-key-v1').digest();
    fs.writeFileSync(keyPath, seed.subarray(0, 32));
    fs.chmodSync(keyPath, 0o600);
  " "$CHRONICLE_KEY_PATH"
  export CHRONICLE_KEY_PATH
fi

cd "$ROOT_DIR"
npm install --silent
npm --silent run build:packages
cd "$SERVER_DIR"
npm install --silent
log "Building server..."
npm --silent run build
[[ -f "$HARNESS" ]] || die "Missing harness: $HARNESS"
mkdir -p "$LOG_DIR"

# Clean up any lingering processes on test ports
log "Cleaning up test ports..."
kill_port "$PORT"
kill_port "$((PORT + 1))"
kill_port "$((PORT + 50))"
kill_port "$((PORT + 51))"

# Ensure rulebook compiled artifacts exist for built server
if [[ ! -f "$ROOT_DIR/rulebook/compiled/RULEBOOK_ROOT.txt" ]]; then
  log "Generating rulebook (missing compiled artifacts)..."
  (cd "$SERVER_DIR" && npm run rulebook:genesis) >"$LOG_DIR/akalynth_verify_rulebook.log" 2>&1 \
    || die "rulebook:genesis failed. See $LOG_DIR/akalynth_verify_rulebook.log"
fi

port_in_use && die "PORT=$PORT already in use. Set PORT to a free port and re-run."
mkdir -p "$(dirname "$RECEIPTS")"
if [[ -n "${AKALYNTH_DB_PATH:-}" ]]; then
  mkdir -p "$(dirname "$AKALYNTH_DB_PATH")"
fi
if [[ -n "${AKALYNTH_REPLAY_MARKER_PATH:-}" ]]; then
  mkdir -p "$(dirname "$AKALYNTH_REPLAY_MARKER_PATH")"
fi
touch "$RECEIPTS"

ORIG_PORT="$PORT"
ORIG_HTTP_URL="$HTTP_URL"
ORIG_WS_URL="$WS_URL"
TLS_SPOOF_PORT="${TLS_SPOOF_PORT:-$((ORIG_PORT + 50))}"
TLS_TRUST_PORT="${TLS_TRUST_PORT:-$((ORIG_PORT + 51))}"
TLS_SPOOF_PORT="$(pick_free_port "$TLS_SPOOF_PORT")"
TLS_TRUST_PORT="$(pick_free_port "$TLS_TRUST_PORT")"

log "TLS spoofing test (TRUST_PROXY=0 blocks x-forwarded-proto spoof)…"
cleanup
sleep 1
PORT="$TLS_SPOOF_PORT"; HTTP_URL="http://127.0.0.1:$PORT"; WS_URL="ws://127.0.0.1:$PORT"
DEBUG=1 \
REQUIRE_TLS=1 \
TRUST_PROXY=0 \
ALLOW_INSECURE_LOCAL=0 \
AKALYNTH_LIFECYCLE_VERIFY=0 \
PORT="$PORT" \
npm run start >"$LOG_DIR/akalynth_verify_server_tls_spoof.log" 2>&1 &
SERVER_PID=$!
wait_for_http_code "$HTTP_URL/v1/health" "403" 20
SPOOF_HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" -H "x-forwarded-proto: https" "$HTTP_URL/v1/maps")"
[[ "$SPOOF_HTTP_CODE" == "403" ]] || die "Spoofed x-forwarded-proto:https bypassed TLS gate (got $SPOOF_HTTP_CODE)"
if HTTP_URL="$HTTP_URL" node <<'NODE'
const http = require('http');
const url = new URL(process.env.HTTP_URL);
const options = {
  host: url.hostname,
  port: url.port,
  path: '/',
  headers: {
    Connection: 'Upgrade',
    Upgrade: 'websocket',
    'Sec-WebSocket-Version': '13',
    'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
    'x-forwarded-proto': 'https',
  },
};
const req = http.request(options);
const timer = setTimeout(() => process.exit(1), 800);
req.on('upgrade', () => {
  clearTimeout(timer);
  process.exit(1);
});
req.on('response', (res) => {
  clearTimeout(timer);
  process.exit(res.statusCode === 403 ? 0 : 1);
});
req.on('error', () => {
  clearTimeout(timer);
  process.exit(1);
});
req.end();
NODE
then
  :
else
  die "Spoofed WS upgrade with x-forwarded-proto:https bypassed TLS gate"
fi

log "TLS trusted proxy test (TRUST_PROXY=1 honors forwarded headers from loopback proxy)…"
cleanup
sleep 1
PORT="$TLS_TRUST_PORT"; HTTP_URL="http://127.0.0.1:$PORT"; WS_URL="ws://127.0.0.1:$PORT"
DEBUG=1 \
REQUIRE_TLS=1 \
TRUST_PROXY=1 \
TRUST_PROXY_LOOPBACK_ONLY=1 \
ALLOW_INSECURE_LOCAL=0 \
AKALYNTH_LIFECYCLE_VERIFY=0 \
PORT="$PORT" \
npm run start >"$LOG_DIR/akalynth_verify_server_tls_trust.log" 2>&1 &
SERVER_PID=$!
wait_for_http_code "$HTTP_URL/v1/health" "403" 20
NOHDR_CODE="$(curl -s -o /dev/null -w "%{http_code}" "$HTTP_URL/v1/maps")"
[[ "$NOHDR_CODE" == "403" ]] || die "TRUST_PROXY=1 should require x-forwarded-proto:https (got $NOHDR_CODE)"
OK_CODE="$(curl -s -o /dev/null -w "%{http_code}" -H "x-forwarded-proto: https" "$HTTP_URL/v1/maps")"
[[ "$OK_CODE" == "200" ]] || die "Trusted proxy x-forwarded-proto:https did not allow request (got $OK_CODE)"
BAD_CODE="$(curl -s -o /dev/null -w "%{http_code}" -H "x-forwarded-proto: http" "$HTTP_URL/v1/maps")"
[[ "$BAD_CODE" == "403" ]] || die "Trusted proxy x-forwarded-proto:http was not rejected (got $BAD_CODE)"
if HTTP_URL="$HTTP_URL" node <<'NODE'
const http = require('http');
const url = new URL(process.env.HTTP_URL);
const options = {
  host: url.hostname,
  port: url.port,
  path: '/',
  headers: {
    Connection: 'Upgrade',
    Upgrade: 'websocket',
    'Sec-WebSocket-Version': '13',
    'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
    'x-forwarded-proto': 'https',
  },
};
const req = http.request(options);
const timer = setTimeout(() => process.exit(1), 800);
req.on('upgrade', () => {
  clearTimeout(timer);
  process.exit(0);
});
req.on('response', () => {
  clearTimeout(timer);
  process.exit(1);
});
req.on('error', () => {
  clearTimeout(timer);
  process.exit(1);
});
req.end();
NODE
then
  :
else
  die "Trusted proxy WS upgrade with x-forwarded-proto:https did not upgrade"
fi

cleanup
sleep 1
PORT="$ORIG_PORT"; HTTP_URL="$ORIG_HTTP_URL"; WS_URL="$ORIG_WS_URL"

DEBUG=1 \
ALLOW_TEST_DEATH=1 \
REQUIRE_TLS=1 \
ALLOW_INSECURE_LOCAL=1 \
TRUST_PROXY=0 \
AKALYNTH_LIFECYCLE_VERIFY=0 \
DEATH_RESPAWN_DELAY_MS="$DEATH_RESPAWN_DELAY_MS_OVERRIDE" \
PUBLIC_RECEIPTS_DELAY_MS=0 \
PUBLIC_RECEIPTS_DELAY_PROFILE=default \
PUBLIC_RECEIPTS_JITTER_MS=0 \
HEAT_PENALTY_THRESHOLD=30 \
WITNESS_COUNT=1 \
SOVEREIGN_ENABLED=1 \
SOVEREIGN_FORCE_NEXT_GUEST=1 \
SOVEREIGN_ALLOW_NAME_MATCH=1 \
CAPS_ENABLED=1 \
CAPS_DEBUG_GRANT_SOVEREIGN=1 \
PORT="$PORT" \
npm run start >"$LOG_DIR/akalynth_verify_server.log" 2>&1 &
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
BASELINE_JSON="$(run_ws_scenario baseline "$GUEST_TOKEN" "$AKALYNTH_WS_TIMEOUT_SECONDS")"
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
wait_for_receipt "death" "$DEATH_PLAYER_ID" '(.receipts | length) > 0' >/dev/null
DEATH_IN_AZURA=0
if try_receipt "death_in_azura" "$DEATH_PLAYER_ID" '(.receipts | length) > 0' 4; then
  DEATH_IN_AZURA=1
else
  wait_for_receipt "death_in_rookguard" "$DEATH_PLAYER_ID" '(.receipts | length) > 0' >/dev/null
fi
wait_for_receipt "respawn" "$DEATH_PLAYER_ID" '(.receipts | length) > 0' >/dev/null
if [[ "$DEATH_IN_AZURA" == "1" ]]; then
  wait_for_receipt "ledger_hesitation" "$DEATH_PLAYER_ID" '[.receipts[] | select(.inputs.type=="movement_block")] | length == 1' >/dev/null
fi
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
ACTOR_COUNT="$(echo "$PUBLIC_JSON" | jq '[.receipts[] | select(.actor_id? and (.actor_id | length > 0))] | length')"
[[ "$ACTOR_COUNT" -gt 0 ]] || die "Public receipts feed missing actor_id"
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
log "Heat flow..."
read -r HEAT_PLAYER_ID HEAT_GUEST_TOKEN <<<"$(mint_guest)"
HEAT_JSON="$(run_ws_scenario heat "$HEAT_GUEST_TOKEN")"
assert_ws_ok "heat" "$HEAT_JSON"
wait_for_receipt "heat_changed" "$HEAT_PLAYER_ID" '(.receipts | length) > 0' >/dev/null
if ! try_receipt "heat_tem_escalation" "$HEAT_PLAYER_ID" '(.receipts | length) > 0' 6; then
  try_receipt "tem_challenge_issued" "$HEAT_PLAYER_ID" \
    '[.receipts[] | select(.inputs.trigger=="heat")] | length > 0' 6 || die "Heat escalation receipt missing"
fi

# Witness flow requires separate server without SOVEREIGN_FORCE_NEXT_GUEST
# (because we need multiple concurrent non-sovereign guests for witness selection)
log "Witness flow (separate server without SOVEREIGN_FORCE_NEXT_GUEST)..."
cleanup
sleep 1
WITNESS_PORT="${WITNESS_PORT:-$((PORT + 2))}"
WITNESS_PORT="$(pick_free_port "$WITNESS_PORT")"
PORT="$WITNESS_PORT"; HTTP_URL="http://127.0.0.1:$PORT"; WS_URL="ws://127.0.0.1:$PORT"
DEBUG=1 \
ALLOW_TEST_DEATH=1 \
REQUIRE_TLS=1 \
ALLOW_INSECURE_LOCAL=1 \
TRUST_PROXY=0 \
AKALYNTH_LIFECYCLE_VERIFY=0 \
HEAT_PENALTY_THRESHOLD=30 \
WITNESS_COUNT=1 \
PORT="$PORT" \
npm run start >"$LOG_DIR/akalynth_verify_server_witness.log" 2>&1 &
SERVER_PID=$!
wait_for_health

# 1) Connect witness client first and let it sit waiting for request
read -r WITNESS_PLAYER_ID WITNESS_TOKEN <<<"$(mint_guest)"
WITNESS_OUT="$LOG_DIR/akalynth_witness_harness.json"
WITNESS_READY="$LOG_DIR/akalynth_witness_ready.json"
run_ws_scenario_bg "witness" "$WITNESS_TOKEN" "$WITNESS_OUT" 25 "$WITNESS_READY"
wait_for_file "Witness harness did not enter world" "$WITNESS_READY" 10

# 2) Trigger a heat penalty on a separate target (this should emit ledger_marked → witness_requested)
read -r TARGET_PLAYER_ID TARGET_TOKEN <<<"$(mint_guest)"
TARGET_JSON="$(run_ws_scenario witness_trigger "$TARGET_TOKEN" 15)"
assert_ws_ok "witness_target" "$TARGET_JSON"
wait_for_receipt "witness_requested" "$TARGET_PLAYER_ID" '[.receipts[] | select(.inputs.kind=="heat_penalty")] | length > 0' >/dev/null

# 3) Witness harness must complete (received request + sent response)
wait_ws_bg_ok "witness" "$WITNESS_OUT" 25

# 4) Assert receipts exist (private only)
wait_for_receipt "witness_response" "$WITNESS_PLAYER_ID" '[.receipts[] | select(.inputs.request_id and .inputs.response)] | length > 0' >/dev/null

# 5) Ensure no player_id leaks in witness WS output
if grep -q '"player_id"' "$WITNESS_OUT" 2>/dev/null; then
  # Check if the player_id is in tem_witness_request (should not be)
  if cat "$WITNESS_OUT" 2>/dev/null | jq -e '.messages[] | select(.type=="tem_witness_request") | has("player_id")' >/dev/null 2>&1; then
    die "Witness WS output leaked player_id in tem_witness_request"
  fi
fi

# 6) Quorum resolution check: verify the receipt exists
log "Witness quorum resolved check (TTL-based)..."
QUORUM_RECEIPT="$(wait_for_receipt "witness_quorum_resolved" "$TARGET_PLAYER_ID" '[.receipts[] | select(.inputs.outcome)] | length > 0' 15)"
QUORUM_OUTCOME="$(echo "$QUORUM_RECEIPT" | jq -r '.receipts[] | select(.inputs.outcome) | .inputs.outcome' | head -n1)"
[[ -n "$QUORUM_OUTCOME" ]] || die "Witness quorum outcome missing"
QUORUM_TRIGGERED_BY="$(echo "$QUORUM_RECEIPT" | jq -r '.receipts[] | select(.inputs.triggered_by) | .inputs.triggered_by' | head -n1)"
log "Quorum resolved: outcome=$QUORUM_OUTCOME triggered_by=$QUORUM_TRIGGERED_BY"

# Restart main server for sovereign/echo tests
cleanup
sleep 1
PORT="$ORIG_PORT"; HTTP_URL="$ORIG_HTTP_URL"; WS_URL="$ORIG_WS_URL"
DEBUG=1 \
ALLOW_TEST_DEATH=1 \
REQUIRE_TLS=1 \
ALLOW_INSECURE_LOCAL=1 \
TRUST_PROXY=0 \
AKALYNTH_LIFECYCLE_VERIFY=0 \
DEATH_RESPAWN_DELAY_MS="$DEATH_RESPAWN_DELAY_MS_OVERRIDE" \
PUBLIC_RECEIPTS_DELAY_MS=0 \
PUBLIC_RECEIPTS_DELAY_PROFILE=default \
PUBLIC_RECEIPTS_JITTER_MS=0 \
HEAT_PENALTY_THRESHOLD=30 \
WITNESS_COUNT=1 \
SOVEREIGN_ENABLED=1 \
SOVEREIGN_FORCE_NEXT_GUEST=1 \
SOVEREIGN_ALLOW_NAME_MATCH=1 \
CAPS_ENABLED=1 \
CAPS_DEBUG_GRANT_SOVEREIGN=1 \
PORT="$PORT" \
npm run start >"$LOG_DIR/akalynth_verify_server.log" 2>&1 &
SERVER_PID=$!
wait_for_health
log "Sovereign presence flow..."
read -r SOV_PLAYER_ID SOV_TOKEN <<<"$(mint_guest)"
SOV_JSON="$(run_ws_scenario sovereign "$SOV_TOKEN")"
assert_ws_ok "sovereign" "$SOV_JSON"
wait_for_receipt "sovereign_declared" "$SOV_PLAYER_ID" '(.receipts | length) > 0' >/dev/null
wait_for_receipt "sovereign_marked" "$SOV_PLAYER_ID" '(.receipts | length) > 0' >/dev/null
wait_for_receipt "sovereign_presence" "$SOV_PLAYER_ID" '(.receipts | length) > 0' >/dev/null
PUBLIC_SOV_JSON="$(poll_json "Public receipts feed invalid" "$HTTP_URL/v1/receipts/public?limit=50" 'has("receipts")')"
echo "$PUBLIC_SOV_JSON" | grep -q 'sovereign_' && die "Public receipts feed leaked sovereign action"
log "Capability binding assertions..."
wait_for_receipt "capability_granted" "$SOV_PLAYER_ID" '(.receipts | length) > 0' >/dev/null
wait_for_receipt "capability_granted" "$SOV_PLAYER_ID" \
  '[.receipts[] | select(.inputs.cap=="house:buy")] | length > 0' >/dev/null
wait_for_receipt "capability_granted" "$SOV_PLAYER_ID" \
  '[.receipts[] | select(.inputs.cap=="echo:spawn")] | length > 0' >/dev/null
# Assert public feed does NOT contain capability_* actions
echo "$PUBLIC_SOV_JSON" | grep -q 'capability_granted' && die "Public receipts feed leaked capability_granted"
echo "$PUBLIC_SOV_JSON" | grep -q 'capability_revoked' && die "Public receipts feed leaked capability_revoked"
echo "$PUBLIC_SOV_JSON" | grep -q 'capability_gated' && die "Public receipts feed leaked capability_gated"
log "Sovereign Echo spawn/despawn flow..."
# Previous sovereign session already disconnected, check spawn receipt exists with synthetic echo_id
SPAWN_RECEIPT="$(wait_for_receipt "sovereign_echo_spawned" "$SOV_PLAYER_ID" \
  '[.receipts[] | select(.inputs.echo_id | startswith("echo:"))] | length > 0')"
# Verify spawn receipt has all required fields
echo "$SPAWN_RECEIPT" | jq -e '.receipts[0].inputs | has("echo_id") and has("map") and has("x") and has("y") and has("cause")' >/dev/null \
  || die "Echo spawn receipt missing required fields"
echo "$SPAWN_RECEIPT" | jq -e '.receipts[0].inputs.cause == "disconnect"' >/dev/null \
  || die "Echo spawn cause should be 'disconnect'"

# New Sovereign session triggers despawn (SOVEREIGN_FORCE_NEXT_GUEST still on)
# Note: With SOVEREIGN_FORCE_NEXT_GUEST=1, every guest is sovereign, so despawn triggers on login
read -r SOV2_PLAYER_ID SOV2_TOKEN <<<"$(mint_guest)"
SOV2_JSON="$(run_ws_scenario sovereign_echo "$SOV2_TOKEN")"
assert_ws_ok "sovereign_reconnect" "$SOV2_JSON"

# Check despawn receipt with synthetic echo_id and cause='replaced' (uses original owner_player_id)
DESPAWN_RECEIPT="$(wait_for_receipt "sovereign_echo_despawned" "$SOV_PLAYER_ID" \
  '[.receipts[] | select(.inputs.cause=="replaced" and (.inputs.echo_id | startswith("echo:")))] | length > 0')"
# Verify despawn receipt has all required fields
echo "$DESPAWN_RECEIPT" | jq -e '.receipts[0].inputs | has("echo_id") and has("map") and has("x") and has("y") and has("cause")' >/dev/null \
  || die "Echo despawn receipt missing required fields"

# Fetch fresh public receipts and assert no echo leaks
PUBLIC_ECHO_JSON="$(poll_json "Public receipts feed invalid" "$HTTP_URL/v1/receipts/public?limit=100" 'has("receipts")')"
echo "$PUBLIC_ECHO_JSON" | grep -q 'sovereign_echo_spawned' && die "Public receipts leaked echo_spawned"
echo "$PUBLIC_ECHO_JSON" | grep -q 'sovereign_echo_despawned' && die "Public receipts leaked echo_despawned"
log "Trinity of Shadow flow (forced face)..."
cleanup
sleep 1
TRINITY_PORT="${TRINITY_PORT:-$((PORT + 1))}"
PORT="$TRINITY_PORT"; HTTP_URL="http://127.0.0.1:$PORT"; WS_URL="ws://127.0.0.1:$PORT"
port_in_use && die "PORT=$PORT already in use for trinity server."
DEBUG=1 \
ALLOW_TEST_DEATH=1 \
REQUIRE_TLS=1 \
ALLOW_INSECURE_LOCAL=1 \
TRUST_PROXY=0 \
AKALYNTH_LIFECYCLE_VERIFY=0 \
DEATH_RESPAWN_DELAY_MS="$DEATH_RESPAWN_DELAY_MS_OVERRIDE" \
PUBLIC_RECEIPTS_DELAY_MS=0 \
PUBLIC_RECEIPTS_DELAY_PROFILE=default \
PUBLIC_RECEIPTS_JITTER_MS=0 \
RUNESTONE_TEST_FORCE_FACE=shadow \
PORT="$PORT" \
npm run start >"$LOG_DIR/akalynth_verify_server_trinity.log" 2>&1 &
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
log "Monetization receipt verification..."
AKALYNTH_RECEIPTS_PATH="$RECEIPTS" npm run verify:monetization >/dev/null
log "Doctrine verification..."
npm run verify:doctrine >/dev/null
log "✅ VERIFY PASS"
log "Last receipts:"
tail -10 "$RECEIPTS" || true
