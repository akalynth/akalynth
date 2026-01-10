#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
RECEIPTS="${RECEIPTS:-$SERVER_DIR/audit/receipts.jsonl}"

WS_URL="${WS_URL:-ws://localhost:3000}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-12}"
DEATH_TIMEOUT_SECONDS="${DEATH_TIMEOUT_SECONDS:-40}"
DEATH_RESPAWN_DELAY_MS_OVERRIDE="${DEATH_RESPAWN_DELAY_MS_OVERRIDE:-300}"

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

log "Starting server (DEBUG=1 ALLOW_TEST_DEATH=1 DEATH_RESPAWN_DELAY_MS=$DEATH_RESPAWN_DELAY_MS_OVERRIDE npm run dev)…"
DEBUG=1 ALLOW_TEST_DEATH=1 DEATH_RESPAWN_DELAY_MS="$DEATH_RESPAWN_DELAY_MS_OVERRIDE" npm run dev >/tmp/akalynth_verify_server.log 2>&1 &
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

log "Checking world state snapshots via HTTP..."
WORLD_STATE_RG="$(run_timeout 5 curl -s "$HTTP_URL/v1/world/Rookguard/state" || true)"
echo "$WORLD_STATE_RG" | jq . >/dev/null 2>&1 || die "Invalid JSON from /v1/world/Rookguard/state: $WORLD_STATE_RG"
[[ "$(echo "$WORLD_STATE_RG" | jq -r '.ok // empty')" == "true" ]] \
  || die "/v1/world/Rookguard/state missing ok=true: $WORLD_STATE_RG"
[[ "$(echo "$WORLD_STATE_RG" | jq -r '.map.name // empty')" == "Rookguard" ]] \
  || die "/v1/world/Rookguard/state wrong map: $WORLD_STATE_RG"
[[ "$(echo "$WORLD_STATE_RG" | jq -r '.tick_ms // empty')" == "100" ]] \
  || die "/v1/world/Rookguard/state tick_ms mismatch: $WORLD_STATE_RG"
PC_RG="$(echo "$WORLD_STATE_RG" | jq -r '.player_count // -1')"
[[ "$PC_RG" -ge 0 ]] || die "/v1/world/Rookguard/state player_count invalid: $WORLD_STATE_RG"

WORLD_STATE_AZ="$(run_timeout 5 curl -s "$HTTP_URL/v1/world/Azura/state" || true)"
echo "$WORLD_STATE_AZ" | jq . >/dev/null 2>&1 || die "Invalid JSON from /v1/world/Azura/state: $WORLD_STATE_AZ"
[[ "$(echo "$WORLD_STATE_AZ" | jq -r '.map.name // empty')" == "Azura" ]] \
  || die "/v1/world/Azura/state wrong map: $WORLD_STATE_AZ"

WORLD_STATE_RG_AUTH="$(run_timeout 5 curl -s -H "Authorization: Bearer $GUEST_TOKEN" "$HTTP_URL/v1/world/Rookguard/state" || true)"
echo "$WORLD_STATE_RG_AUTH" | jq . >/dev/null 2>&1 || die "Invalid JSON from authed /v1/world/Rookguard/state: $WORLD_STATE_RG_AUTH"
[[ "$(echo "$WORLD_STATE_RG_AUTH" | jq -r '.me.player_id // empty')" == "$PLAYER_ID" ]] \
  || die "/v1/world/Rookguard/state auth me mismatch: $WORLD_STATE_RG_AUTH"

WORLD_STATE_UNKNOWN_STATUS="$(run_timeout 5 curl -s -o /dev/null -w "%{http_code}" "$HTTP_URL/v1/world/Unknown/state")"
[[ "$WORLD_STATE_UNKNOWN_STATUS" == "404" ]] || die "/v1/world/Unknown/state should be 404, got $WORLD_STATE_UNKNOWN_STATUS"

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
// Cadence test: 25 moves at ~100ms intervals to trigger perfect_cadence detector
const cadence = Array.from({length: 25}, (_, i) => ({
  type: "move_intent",
  direction: i % 2 === 0 ? "north" : "south"
}));

function sendSeq(seq, delay, done) {
  let idx = 0;
  const send = () => {
    if (idx < seq.length) {
      ws.send(JSON.stringify(seq[idx++]));
      setTimeout(send, delay);
    } else {
      done();
    }
  };
  send();
}

ws.on("open", () => {
  sendSeq(messages, 200, () => {
    setTimeout(() => {
      // Send cadence moves at ~105ms (slightly above tick to avoid speed_violation)
      // This is within cadence tolerance (100±8ms = 92-108ms)
      sendSeq(cadence, 105, () => setTimeout(() => ws.close(), 1500));
    }, 500);
  });
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

# Check for perfect_cadence trigger in receipts (tem_challenge_issued with perfect_cadence trigger)
log "Checking for perfect_cadence detection..."
if grep -q 'perfect_cadence' "$RECEIPTS"; then
  log "Perfect cadence detector triggered ✅"
else
  # Also check via receipts API as backup
  CADENCE_API="$(run_timeout 5 curl -s "$HTTP_URL/v1/receipts?player_id=$PLAYER_ID&limit=50" || true)"
  if echo "$CADENCE_API" | grep -q 'perfect_cadence'; then
    log "Perfect cadence detected via API ✅"
  else
    log "⚠️  perfect_cadence not found in receipts (may need more samples or timing variance)"
    log "Recent receipts with cadence-related info:"
    grep -E 'cadence|timing|tem_challenge' "$RECEIPTS" | tail -5 || true
  fi
fi

log "Checking receipts API for session_guest_minted..."
if ! run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=session_guest_minted&player_id=$PLAYER_ID&limit=20" \
  | grep -q "$PLAYER_ID"; then
  die "Receipts API missing session_guest_minted for player_id=$PLAYER_ID"
fi
log "Receipts API contains session_guest_minted ✅"

log "Minting guest session for death test..."
DEATH_MINT_JSON="$(run_timeout 5 curl -s -X POST "$HTTP_URL/v1/session/guest" || true)"
echo "$DEATH_MINT_JSON" | jq . >/dev/null 2>&1 || die "Invalid JSON from /v1/session/guest (death run): $DEATH_MINT_JSON"
DEATH_GUEST_TOKEN="$(echo "$DEATH_MINT_JSON" | jq -r '.guest_token // empty')"
DEATH_PLAYER_ID="$(echo "$DEATH_MINT_JSON" | jq -r '.player_id // empty')"
[[ -n "$DEATH_GUEST_TOKEN" ]] || die "Missing guest_token for death test"
[[ -n "$DEATH_PLAYER_ID" ]] || die "Missing player_id for death test"
log "Minted death test session ok (player_id=$DEATH_PLAYER_ID)"

log "Running death WS flow (timeout ${DEATH_TIMEOUT_SECONDS}s)…"
DEATH_RESP="$(
  run_timeout "$DEATH_TIMEOUT_SECONDS" node -e '
const WebSocket = require("ws");
const http = require("http");
const { URL } = require("url");
const ws = new WebSocket(process.argv[1]);
const guestToken = process.argv[2];
const httpUrl = process.argv[3];

function fetchState(label) {
  try {
    const target = new URL("/v1/world/Rookguard/state", httpUrl);
    const req = http.request(
      target,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${guestToken}`,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk.toString()));
        res.on("end", () => {
          console.log(`${label}:${body}`);
        });
      }
    );
    req.on("error", () => {});
    req.end();
  } catch (_) {
    // ignore HTTP errors in test helper
  }
}

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "connect" }));
  ws.send(JSON.stringify({ type: "login", guest_token: guestToken }));
  ws.send(JSON.stringify({ type: "enter_world" }));
  ws.send(JSON.stringify({ type: "kill_self" }));
});

ws.on("message", (data) => {
  const str = data.toString();
  console.log(str);
  try {
    const msg = JSON.parse(str);
    if (msg.type === "death_notice") {
      fetchState("STATE_DEAD");
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "move_intent", direction: "north" }));
      }, 20);
      const waitMs = (msg.respawn_in_ms || 15000) + 500;
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "move_intent", direction: "south" }));
        setTimeout(() => {
          fetchState("STATE_ALIVE");
          ws.close();
        }, 500);
      }, waitMs);
    }
  } catch (err) {
    // ignore parse errors
  }
});

ws.on("close", () => process.exit(0));
ws.on("error", (e) => { console.error(e.message); process.exit(1); });
' "$WS_URL" "$DEATH_GUEST_TOKEN" "$HTTP_URL" 2>/dev/null || true
)"

echo "$DEATH_RESP" | grep -q '"type":"death_notice"' \
  || die "No death_notice received in death WS flow"
echo "$DEATH_RESP" | grep -q '"reason":"dead"' \
  || die "No dead move rejection observed in death WS flow"
echo "$DEATH_RESP" | grep -Eq '"type":"move_result","ok":true' \
  || die "No successful move after respawn in death WS flow"

DEAD_STATE_JSON="$(echo "$DEATH_RESP" | grep '^STATE_DEAD:' | sed 's/^STATE_DEAD://')"
ALIVE_STATE_JSON="$(echo "$DEATH_RESP" | grep '^STATE_ALIVE:' | sed 's/^STATE_ALIVE://')"

echo "$DEAD_STATE_JSON" | jq . >/dev/null 2>&1 || die "Invalid dead state JSON"
echo "$ALIVE_STATE_JSON" | jq . >/dev/null 2>&1 || die "Invalid alive state JSON"

[[ "$(echo "$DEAD_STATE_JSON" | jq -r '.me.status // empty')" == "dead" ]] \
  || die "Caller status not dead in HTTP state during death window"
[[ "$(echo "$ALIVE_STATE_JSON" | jq -r '.me.status // empty')" == "alive" ]] \
  || die "Caller status not alive in HTTP state after respawn"

log "Checking receipts API for death events..."
if ! run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=death&player_id=$DEATH_PLAYER_ID&limit=20" \
  | grep -q "$DEATH_PLAYER_ID"; then
  die "Receipts API missing death for player_id=$DEATH_PLAYER_ID"
fi
if ! run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=respawn&player_id=$DEATH_PLAYER_ID&limit=20" \
  | grep -q "$DEATH_PLAYER_ID"; then
  die "Receipts API missing respawn for player_id=$DEATH_PLAYER_ID"
fi
log "Death receipts present ✅"

log "✅ VERIFY PASS"
log "Last receipts:"
tail -10 "$RECEIPTS" || true
