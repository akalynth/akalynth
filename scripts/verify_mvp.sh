#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
RECEIPTS="${RECEIPTS:-$SERVER_DIR/audit/receipts.jsonl}"

WS_URL="${WS_URL:-ws://localhost:3000}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-12}"

log() { echo -e "🧪 $*"; }
die() { echo -e "❌ $*" >&2; exit 1; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"; }

# prefer GNU timeout if present, else fallback to no-timeout mode
TIMEOUT_BIN="$(command -v timeout || true)"
run_timeout() {
  local secs="$1"; shift
  if [[ -n "$TIMEOUT_BIN" ]]; then
    "$TIMEOUT_BIN" "$secs" "$@"
  else
    "$@"
  fi
}

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    log "Stopping server (pid=$SERVER_PID)…"
    kill "$SERVER_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

log "Akalynth MVP verify (Rookguard → Azura gate) @ $WS_URL"
log "Repo: $ROOT_DIR"

need_cmd node
need_cmd npm
need_cmd bash

log "Installing server deps…"
cd "$SERVER_DIR"
npm install --silent

if ! npx --yes wscat --version >/dev/null 2>&1; then
  die "wscat not available via npx. Ensure server/devDependencies has wscat and run npm install."
fi

mkdir -p "$(dirname "$RECEIPTS")"
touch "$RECEIPTS"
BASE_LINES="$(wc -l < "$RECEIPTS" | tr -d ' ')"
log "Receipts baseline lines: $BASE_LINES"

log "Starting server (npm run dev)…"
npm run dev >/tmp/akalynth_verify_server.log 2>&1 &
SERVER_PID=$!
sleep 1

log "Waiting for server to accept WebSocket…"
READY=0
for _ in {1..12}; do
  if run_timeout 2 bash -lc "printf '{\"type\":\"connect\"}\n' | npx --yes wscat -c '$WS_URL' >/dev/null 2>&1"; then
    READY=1
    break
  fi
  sleep 0.5
done
[[ "$READY" -eq 1 ]] || die "Server not ready on $WS_URL. Check /tmp/akalynth_verify_server.log"

# HTTP control plane checks
log "Checking HTTP control plane..."
HTTP_URL="${HTTP_URL:-http://localhost:3000}"

need_cmd curl
need_cmd jq

curl -sf "$HTTP_URL/v1/health" | grep -q '"ok":true' \
  || die "HTTP /v1/health failed"

curl -sf "$HTTP_URL/v1/maps" | grep -q 'Rookguard' \
  || die "HTTP /v1/maps missing Rookguard"

curl -sf "$HTTP_URL/v1/maps/Azura" | grep -q '"name":"Azura"' \
  || die "HTTP /v1/maps/Azura failed"

WORLD_PLAYERS_JSON="$(run_timeout 5 curl -s "$HTTP_URL/v1/world/Rookguard/players" || true)"
echo "$WORLD_PLAYERS_JSON" | jq . >/dev/null 2>&1 || die "Invalid JSON from /v1/world/Rookguard/players: $WORLD_PLAYERS_JSON"
[[ "$(echo "$WORLD_PLAYERS_JSON" | jq -r 'has("players")')" == "true" ]] \
  || die "/v1/world/Rookguard/players missing players field: $WORLD_PLAYERS_JSON"

log "HTTP checks passed"

# Mint guest session via HTTP
log "Minting guest session via HTTP..."
MINT_JSON="$(run_timeout 5 curl -s -X POST "$HTTP_URL/v1/session/guest" || true)"
echo "$MINT_JSON" | jq . >/dev/null 2>&1 || die "Invalid JSON from /v1/session/guest: $MINT_JSON"

GUEST_TOKEN="$(echo "$MINT_JSON" | jq -r '.guest_token // empty')"
PLAYER_ID="$(echo "$MINT_JSON" | jq -r '.player_id // empty')"

[[ -n "$GUEST_TOKEN" ]] || die "Missing guest_token from mint response: $MINT_JSON"
[[ -n "$PLAYER_ID" ]] || die "Missing player_id from mint response: $MINT_JSON"

log "Minted session ok (player_id=$PLAYER_ID)"

log "Checking session via HTTP /v1/session/me..."
SESSION_ME_JSON="$(run_timeout 5 curl -s -H "Authorization: Bearer $GUEST_TOKEN" "$HTTP_URL/v1/session/me" || true)"
echo "$SESSION_ME_JSON" | jq . >/dev/null 2>&1 || die "Invalid JSON from /v1/session/me: $SESSION_ME_JSON"

[[ "$(echo "$SESSION_ME_JSON" | jq -r '.ok // empty')" == "true" ]] \
  || die "/v1/session/me missing ok=true: $SESSION_ME_JSON"
[[ "$(echo "$SESSION_ME_JSON" | jq -r '.player_id // empty')" == "$PLAYER_ID" ]] \
  || die "/v1/session/me player_id mismatch: $SESSION_ME_JSON"
[[ "$(echo "$SESSION_ME_JSON" | jq -r '.guest_token // empty')" == "$GUEST_TOKEN" ]] \
  || die "/v1/session/me guest_token mismatch: $SESSION_ME_JSON"
TTL_MS="$(echo "$SESSION_ME_JSON" | jq -r '.ttl_ms_remaining // -1')"
[[ "$TTL_MS" -gt 0 ]] || die "/v1/session/me ttl_ms_remaining not > 0: $SESSION_ME_JSON"

HTTP_ME_STATUS="$(run_timeout 5 curl -s -o /dev/null -w "%{http_code}" "$HTTP_URL/v1/session/me")"
[[ "$HTTP_ME_STATUS" == "401" ]] || die "/v1/session/me without auth should be 401, got $HTTP_ME_STATUS"

log "Running scripted WS flow (timeout ${TIMEOUT_SECONDS}s)…"
RESP="$(
  run_timeout "$TIMEOUT_SECONDS" node -e '
const WebSocket = require("ws");
const ws = new WebSocket(process.argv[1]);
const guestToken = process.argv[2];
const messages = [
  {"type":"connect"},
  {"type":"login","guest_token":guestToken},
  {"type":"enter_world"},
  {"type":"move_intent","direction":"east"},
  {"type":"move_intent","direction":"east"},
  {"type":"move_intent","direction":"east"},
  {"type":"chat","message":"hi"},
  {"type":"move_intent","direction":"east"},
  {"type":"move_intent","direction":"east"},
  {"type":"chat","message":"AZURA"},
  {"type":"move_intent","direction":"east"},
  {"type":"move_intent","direction":"east"},
  {"type":"move_intent","direction":"east"}
];
let idx = 0;
ws.on("open", () => {
  const send = () => {
    if (idx < messages.length) {
      ws.send(JSON.stringify(messages[idx++]));
      setTimeout(send, 200);
    } else {
      setTimeout(() => ws.close(), 1000);
    }
  };
  send();
});
ws.on("message", (data) => console.log(data.toString()));
ws.on("close", () => process.exit(0));
ws.on("error", (e) => { console.error(e.message); process.exit(1); });
' "$WS_URL" "$GUEST_TOKEN" 2>/dev/null || true
)"

echo "$RESP" | grep -q '"type":"welcome"'      || die "No welcome received"
echo "$RESP" | grep -q '"type":"login_ack"'    || die "No login_ack received"
echo "$RESP" | grep -q '"type":"world_state"'  || die "No world_state received"
echo "$RESP" | grep -q '"type":"move_result"'  || die "No move_result received"

TEM_MSG=0
if echo "$RESP" | grep -q '"type":"tem_challenge"'; then
  TEM_MSG=1
fi

NEW_LINES="$(wc -l < "$RECEIPTS" | tr -d ' ')"
DELTA=$((NEW_LINES - BASE_LINES))
log "Receipts now: $NEW_LINES (delta +$DELTA)"
[[ "$DELTA" -gt 0 ]] || die "No new receipts written to $RECEIPTS"

grep -q '"action"' "$RECEIPTS" || die "Receipts file exists but doesn't look like receipts (no action fields found)"

if [[ "$TEM_MSG" -eq 0 ]]; then
  if ! grep -q 'tem_challenge' "$RECEIPTS"; then
    die "Tem challenge not observed in messages or receipts"
  fi
fi

if ! grep -Eq 'tutorial_step_complete|gate_unlock|tutorial_completed' "$RECEIPTS"; then
  log "⚠️  Tutorial/gate receipts not matched by pattern (naming may differ). Showing last 20 receipts:"
  tail -20 "$RECEIPTS" || true
else
  log "Tutorial/gate receipts present ✅"
fi

log "Checking receipts API for session_guest_minted..."
if ! run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=session_guest_minted&limit=20" \
  | grep -q "$PLAYER_ID"; then
  die "Receipts API missing session_guest_minted for player_id=$PLAYER_ID"
fi
log "Receipts API contains session_guest_minted ✅"

log "✅ VERIFY PASS"
log "Last receipts:"
tail -10 "$RECEIPTS" || true
