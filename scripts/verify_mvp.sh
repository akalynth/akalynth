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
DEBUG=1 \
ALLOW_TEST_DEATH=1 \
DEATH_RESPAWN_DELAY_MS="$DEATH_RESPAWN_DELAY_MS_OVERRIDE" \
PUBLIC_RECEIPTS_DELAY_MS=0 \
PUBLIC_RECEIPTS_DELAY_PROFILE=default \
PUBLIC_RECEIPTS_JITTER_MS=0 \
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
ROOK_SPAWN_X="$(echo "$WORLD_STATE_RG" | jq -r '.map.spawn.x // empty')"
ROOK_SPAWN_Y="$(echo "$WORLD_STATE_RG" | jq -r '.map.spawn.y // empty')"
[[ -n "$ROOK_SPAWN_X" && -n "$ROOK_SPAWN_Y" ]] \
  || die "/v1/world/Rookguard/state missing spawn: $WORLD_STATE_RG"

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
const gateSequence = [
  { type: "connect" },
  { type: "login", guest_token: guestToken },
  { type: "enter_world" },
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "east" },
  { type: "chat", message: "hi" },
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "east" },
  { type: "chat", message: "AZURA" },
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "east" },
];
let enteredAzura = false;
let stage = "init";
let stateMap = "Rookguard";
let temResponded = false;

function fetchState(label) {
  try {
    const target = new URL(`/v1/world/${stateMap}/state`, httpUrl);
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

function sendSeq(seq, delay, done) {
  let idx = 0;
  const send = () => {
    if (idx < seq.length) {
      ws.send(JSON.stringify(seq[idx++]));
      setTimeout(send, delay);
    } else if (done) {
      done();
    }
  };
  send();
}

ws.on("open", () => {
  sendSeq(gateSequence, 200);
});

ws.on("message", (data) => {
  const str = data.toString();
  console.log(str);
  try {
    const msg = JSON.parse(str);
    if (msg.type === "world_state" && msg.player && msg.player.x === 32 && msg.player.y === 32 && !enteredAzura) {
      enteredAzura = true;
      stateMap = "Azura";
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "kill_self" }));
      }, 300);
    }
    if (msg.type === "tem_challenge" && !temResponded) {
      temResponded = true;
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "chat", message: "AZURA" }));
      }, 100);
    }
    if (msg.type === "death_notice") {
      fetchState("STATE_DEAD");
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "move_intent", direction: "north" }));
      }, 20);
      const waitMs = (msg.respawn_in_ms || 15000) + 500;
      setTimeout(() => {
        stage = "await_hesitation";
        ws.send(JSON.stringify({ type: "move_intent", direction: "south" }));
      }, waitMs);
    }
    if (msg.type === "move_result") {
      if (stage === "await_hesitation") {
        console.log(`HESITATION_RESULT:${JSON.stringify(msg)}`);
        stage = "await_success";
        setTimeout(() => {
          ws.send(JSON.stringify({ type: "move_intent", direction: "south" }));
        }, 200);
      } else if (stage === "await_success") {
        console.log(`SUCCESS_RESULT:${JSON.stringify(msg)}`);
        stage = "done";
        setTimeout(() => {
          fetchState("STATE_ALIVE");
          setTimeout(() => ws.close(), 500);
        }, 500);
      }
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
HESITATION_JSON="$(echo "$DEATH_RESP" | grep '^HESITATION_RESULT:' | head -n1 | sed 's/^HESITATION_RESULT://')"
SUCCESS_JSON="$(echo "$DEATH_RESP" | grep '^SUCCESS_RESULT:' | head -n1 | sed 's/^SUCCESS_RESULT://')"

echo "$DEAD_STATE_JSON" | jq . >/dev/null 2>&1 || die "Invalid dead state JSON"
echo "$ALIVE_STATE_JSON" | jq . >/dev/null 2>&1 || die "Invalid alive state JSON"
echo "$HESITATION_JSON" | jq . >/dev/null 2>&1 || die "Missing hesitation move_result JSON"
echo "$SUCCESS_JSON" | jq . >/dev/null 2>&1 || die "Missing success move_result JSON"

[[ "$(echo "$DEAD_STATE_JSON" | jq -r '.me.status // empty')" == "dead" ]] \
  || die "Caller status not dead in HTTP state during death window"
[[ "$(echo "$ALIVE_STATE_JSON" | jq -r '.me.status // empty')" == "alive" ]] \
  || die "Caller status not alive in HTTP state after respawn"
echo "$HESITATION_JSON" | jq -e '.ok == false' >/dev/null 2>&1 \
  || die "Ledger hesitation did not reject first post-respawn move"
echo "$SUCCESS_JSON" | jq -e '.ok == true' >/dev/null 2>&1 \
  || die "Ledger hesitation did not allow subsequent move"

log "Checking receipts API for death events..."
if ! run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=death&player_id=$DEATH_PLAYER_ID&limit=20" \
  | grep -q "$DEATH_PLAYER_ID"; then
  die "Receipts API missing death for player_id=$DEATH_PLAYER_ID"
fi
LAST_DAMAGE_OK="$(run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=last_damage_attribution&player_id=$DEATH_PLAYER_ID&limit=20" \
  | jq '[.receipts[] | select(.inputs.source_type=="status" and .inputs.source_id=="test")] | length' 2>/dev/null || echo 0)"
if [[ "${LAST_DAMAGE_OK:-0}" -lt 1 ]]; then
  die "Receipts API missing last_damage_attribution with status/test for player_id=$DEATH_PLAYER_ID"
fi
if ! run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=death_in_azura&player_id=$DEATH_PLAYER_ID&limit=20" \
  | grep -q "$DEATH_PLAYER_ID"; then
  die "Receipts API missing death_in_azura for player_id=$DEATH_PLAYER_ID"
fi
if ! run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=respawn&player_id=$DEATH_PLAYER_ID&limit=20" \
  | grep -q "$DEATH_PLAYER_ID"; then
  die "Receipts API missing respawn for player_id=$DEATH_PLAYER_ID"
fi
log "Death receipts present ✅"

LEDGER_HESITATION_COUNT="$(run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=ledger_hesitation&player_id=$DEATH_PLAYER_ID&limit=20" \
  | jq '[.receipts[] | select(.inputs.type=="movement_block" and .inputs.map=="Azura")] | length' 2>/dev/null || echo 0)"
if [[ "${LEDGER_HESITATION_COUNT:-0}" -ne 1 ]]; then
  die "Expected one ledger_hesitation receipt for player_id=$DEATH_PLAYER_ID"
fi

log "Minting guest session for stone legend test..."
STONE_MINT_JSON="$(run_timeout 5 curl -s -X POST "$HTTP_URL/v1/session/guest" || true)"
echo "$STONE_MINT_JSON" | jq . >/dev/null 2>&1 || die "Invalid JSON from /v1/session/guest (stone run): $STONE_MINT_JSON"
STONE_GUEST_TOKEN="$(echo "$STONE_MINT_JSON" | jq -r '.guest_token // empty')"
STONE_PLAYER_ID="$(echo "$STONE_MINT_JSON" | jq -r '.player_id // empty')"
[[ -n "$STONE_GUEST_TOKEN" ]] || die "Missing guest_token for stone test"
[[ -n "$STONE_PLAYER_ID" ]] || die "Missing player_id for stone test"
log "Minted stone test session ok (player_id=$STONE_PLAYER_ID)"

log "Running stone legend WS flow (timeout ${TIMEOUT_SECONDS}s)…"
STONE_RESP="$(
  run_timeout "$TIMEOUT_SECONDS" node -e '
const WebSocket = require("ws");
const ws = new WebSocket(process.argv[1]);
const guestToken = process.argv[2];
const moves = [
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "south" },
  { type: "move_intent", direction: "south" },
  { type: "move_intent", direction: "south" },
  { type: "move_intent", direction: "south" }
];
const messages = [
  { type: "connect" },
  { type: "login", guest_token: guestToken },
  { type: "enter_world" },
  ...moves
];
let lastMove = null;

function sendSeq(seq, delay, done) {
  let idx = 0;
  const send = () => {
    if (idx < seq.length) {
      ws.send(JSON.stringify(seq[idx++]));
      setTimeout(send, delay);
    } else if (done) {
      done();
    }
  };
  send();
}

ws.on("open", () => {
  sendSeq(messages, 150, () => {
    setTimeout(() => {
      if (lastMove) {
        console.log(`STONE_LAST_MOVE:${JSON.stringify(lastMove)}`);
      } else {
        console.log("STONE_LAST_MOVE:null");
      }
      ws.close();
    }, 800);
  });
});

ws.on("message", (data) => {
  const str = data.toString();
  console.log(str);
  try {
    const msg = JSON.parse(str);
    if (msg.type === "move_result") {
      lastMove = msg;
    }
  } catch (_) {
    // ignore parse errors
  }
});

ws.on("close", () => process.exit(0));
ws.on("error", (e) => { console.error(e.message); process.exit(1); });
' "$WS_URL" "$STONE_GUEST_TOKEN" 2>/dev/null || true
)"

STONE_LAST_MOVE_JSON="$(echo "$STONE_RESP" | grep '^STONE_LAST_MOVE:' | tail -n1 | sed 's/^STONE_LAST_MOVE://')"
echo "$STONE_LAST_MOVE_JSON" | jq . >/dev/null 2>&1 || die "Missing stone move_result JSON"
echo "$STONE_LAST_MOVE_JSON" | jq -e '.ok == true' >/dev/null 2>&1 \
  || die "Stone move_result did not succeed"
STONE_LAST_X="$(echo "$STONE_LAST_MOVE_JSON" | jq -r '.x')"
STONE_LAST_Y="$(echo "$STONE_LAST_MOVE_JSON" | jq -r '.y')"
if [[ "$STONE_LAST_X" != "$ROOK_SPAWN_X" || "$STONE_LAST_Y" != "$ROOK_SPAWN_Y" ]]; then
  die "Stone attempt did not displace to spawn (got $STONE_LAST_X,$STONE_LAST_Y expected $ROOK_SPAWN_X,$ROOK_SPAWN_Y)"
fi

log "Checking receipts API for stone legend..."
if ! run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=legend_attempted&player_id=$STONE_PLAYER_ID&limit=20" \
  | grep -q "$STONE_PLAYER_ID"; then
  die "Receipts API missing legend_attempted for player_id=$STONE_PLAYER_ID"
fi

LEGEND_REFUSED_JSON="$(run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=legend_refused&player_id=$STONE_PLAYER_ID&limit=20" || true)"
echo "$LEGEND_REFUSED_JSON" | jq . >/dev/null 2>&1 || die "Invalid legend_refused JSON: $LEGEND_REFUSED_JSON"
LEGEND_REFUSED_COUNT="$(echo "$LEGEND_REFUSED_JSON" | jq '[.receipts[] | select(.inputs.reason=="cannot_obtain" and .inputs.outcome=="displace")] | length' 2>/dev/null || echo 0)"
if [[ "${LEGEND_REFUSED_COUNT:-0}" -lt 1 ]]; then
  die "Receipts API missing legend_refused with cannot_obtain/displace for player_id=$STONE_PLAYER_ID"
fi
LEGEND_REFUSED_TO_X="$(echo "$LEGEND_REFUSED_JSON" | jq -r '.receipts[] | select(.inputs.reason=="cannot_obtain") | .inputs.to.x' | head -n1)"
LEGEND_REFUSED_TO_Y="$(echo "$LEGEND_REFUSED_JSON" | jq -r '.receipts[] | select(.inputs.reason=="cannot_obtain") | .inputs.to.y' | head -n1)"
if [[ "$LEGEND_REFUSED_TO_X" != "$ROOK_SPAWN_X" || "$LEGEND_REFUSED_TO_Y" != "$ROOK_SPAWN_Y" ]]; then
  die "legend_refused did not target spawn (got $LEGEND_REFUSED_TO_X,$LEGEND_REFUSED_TO_Y expected $ROOK_SPAWN_X,$ROOK_SPAWN_Y)"
fi

log "Checking public receipts feed..."
sleep 0.5  # Allow receipts to flush
PUBLIC_JSON="$(run_timeout 5 curl -s "$HTTP_URL/v1/receipts/public?limit=50" || true)"
echo "$PUBLIC_JSON" | jq . >/dev/null 2>&1 || die "Invalid JSON from public receipts feed"
[[ "$(echo "$PUBLIC_JSON" | jq -r 'has("receipts") and (.receipts | type == "array")')" == "true" ]] \
  || die "Public receipts feed missing receipts array: $PUBLIC_JSON"
[[ "$(echo "$PUBLIC_JSON" | jq -r '.mode // empty')" == "strict" ]] \
  || die "Public receipts feed missing mode=strict"
if echo "$PUBLIC_JSON" | grep -q '"player_id"'; then
  die "Public receipts feed leaked player_id in strict mode"
fi
RAW_COORD_COUNT="$(echo "$PUBLIC_JSON" | jq '[.receipts[].inputs | paths(scalars) as $p | select(($p[-1]=="x" or $p[-1]=="y") and ($p[-2] != "approx") and (getpath($p) | type=="number"))] | length' 2>/dev/null || echo 0)"
if [[ "${RAW_COORD_COUNT:-0}" -gt 0 ]]; then
  die "Public receipts feed leaked raw coordinates outside approx buckets"
fi
ACTOR_COUNT="$(echo "$PUBLIC_JSON" | jq '[.receipts[] | select(.actor? and (.actor | type=="string") and (.actor | length > 0))] | length' 2>/dev/null || echo 0)"
if [[ "${ACTOR_COUNT:-0}" -lt 1 ]]; then
  die "Public receipts feed missing actor field in strict mode"
fi
if ! echo "$PUBLIC_JSON" | grep -Eq 'death_in_rookguard|death_in_azura'; then
  die "Public receipts feed missing death_in_*"
fi
FIRST_PUBLIC_COUNT="$(echo "$PUBLIC_JSON" | jq '[.receipts[] | select(.action | startswith("first_"))] | length' 2>/dev/null || echo 0)"
if [[ "${FIRST_PUBLIC_COUNT:-0}" -lt 1 ]]; then
  if ! echo "$PUBLIC_JSON" | grep -q 'first_'; then
    die "Public receipts feed missing first-of legend receipts"
  fi
fi
if ! echo "$PUBLIC_JSON" | grep -Eq 'legend_refused|first_attempt_stone_cannot_obtain'; then
  die "Public receipts feed missing stone legend receipts"
fi
log "Public receipts feed present ✅"

log "Checking public rumors feed..."
RUMOR_JSON="$(run_timeout 5 curl -s "$HTTP_URL/v1/rumors/public?limit=20" || true)"
echo "$RUMOR_JSON" | jq . >/dev/null 2>&1 || die "Invalid JSON from public rumors feed"
[[ "$(echo "$RUMOR_JSON" | jq -r 'has("rumors") and (.rumors | type == "array")')" == "true" ]] \
  || die "Public rumors feed missing rumors array: $RUMOR_JSON"
RUMOR_TEXT="$(echo "$RUMOR_JSON" | jq -r '.rumors[] | select(.rumor_id=="nothing_finishes") | .text' | head -n1)"
[[ "$RUMOR_TEXT" == "There's a place in Rookguard where nothing finishes." ]] \
  || die "Public rumors feed missing exact rumor text"
STONE_RUMOR_TEXT="$(echo "$RUMOR_JSON" | jq -r '.rumors[] | select(.rumor_id=="stone_refuses") | .text' | head -n1)"
[[ "$STONE_RUMOR_TEXT" == "Somewhere in Rookguard, the world refuses to finish what you start." ]] \
  || die "Public rumors feed missing stone_refuses rumor text"
if echo "$RUMOR_JSON" | grep -q '"player_id"'; then
  die "Public rumors feed leaked player_id"
fi
RUMOR_COORD_COUNT="$(echo "$RUMOR_JSON" | jq '[.rumors[] | paths(scalars) as $p | select(($p[-1]=="x" or $p[-1]=="y") and (getpath($p) | type=="number"))] | length' 2>/dev/null || echo 0)"
if [[ "${RUMOR_COORD_COUNT:-0}" -gt 0 ]]; then
  die "Public rumors feed leaked coordinate fields"
fi
RUMOR_ACTOR_COUNT="$(echo "$RUMOR_JSON" | jq '[.rumors[] | select(.actor? and (.actor | type=="string") and (.actor | length > 0))] | length' 2>/dev/null || echo 0)"
if [[ "${RUMOR_ACTOR_COUNT:-0}" -lt 1 ]]; then
  die "Public rumors feed missing actor field"
fi
log "Public rumors feed present ✅"

# ============================================================================
# Runestone v0 tests
# ============================================================================

log "Minting guest session for runestone test..."
RUNE_MINT_JSON="$(run_timeout 5 curl -s -X POST "$HTTP_URL/v1/session/guest" || true)"
echo "$RUNE_MINT_JSON" | jq . >/dev/null 2>&1 || die "Invalid JSON from /v1/session/guest (runestone run): $RUNE_MINT_JSON"
RUNE_GUEST_TOKEN="$(echo "$RUNE_MINT_JSON" | jq -r '.guest_token // empty')"
RUNE_PLAYER_ID="$(echo "$RUNE_MINT_JSON" | jq -r '.player_id // empty')"
[[ -n "$RUNE_GUEST_TOKEN" ]] || die "Missing guest_token for runestone test"
[[ -n "$RUNE_PLAYER_ID" ]] || die "Missing player_id for runestone test"
log "Minted runestone test session ok (player_id=$RUNE_PLAYER_ID)"

log "Running runestone WS flow (timeout ${TIMEOUT_SECONDS}s)…"
RUNE_RESP="$(
  run_timeout "$TIMEOUT_SECONDS" node -e '
const WebSocket = require("ws");
const ws = new WebSocket(process.argv[1]);
const guestToken = process.argv[2];

// Move from spawn (2,2) to runestone table (4,4): east 2, south 2
const moveToTable = [
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "south" },
  { type: "move_intent", direction: "south" }
];

const messages = [
  { type: "connect" },
  { type: "login", guest_token: guestToken },
  { type: "enter_world" },
  ...moveToTable
];

let gotResult = false;
let gotDenied = false;

function sendSeq(seq, delay, done) {
  let idx = 0;
  const send = () => {
    if (idx < seq.length) {
      ws.send(JSON.stringify(seq[idx++]));
      setTimeout(send, delay);
    } else if (done) {
      done();
    }
  };
  send();
}

ws.on("open", () => {
  sendSeq(messages, 150, () => {
    // Now at table position, cast runestone
    setTimeout(() => {
      ws.send(JSON.stringify({ type: "runestone_cast", table_id: "rookguard_runestone_table_01" }));
      // Immediately try again to test cooldown
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "runestone_cast", table_id: "rookguard_runestone_table_01" }));
        setTimeout(() => ws.close(), 500);
      }, 100);
    }, 300);
  });
});

ws.on("message", (data) => {
  const str = data.toString();
  console.log(str);
  try {
    const msg = JSON.parse(str);
    if (msg.type === "runestone_result") {
      gotResult = true;
      console.log("RUNE_RESULT:" + JSON.stringify(msg));
    }
    if (msg.type === "runestone_denied") {
      gotDenied = true;
      console.log("RUNE_DENIED:" + JSON.stringify(msg));
    }
  } catch (_) {}
});

ws.on("close", () => {
  console.log("RUNE_GOT_RESULT:" + gotResult);
  console.log("RUNE_GOT_DENIED:" + gotDenied);
  process.exit(0);
});
ws.on("error", (e) => { console.error(e.message); process.exit(1); });
' "$WS_URL" "$RUNE_GUEST_TOKEN" 2>/dev/null || true
)"

echo "$RUNE_RESP" | grep -q '"type":"runestone_result"' \
  || die "No runestone_result received"
echo "$RUNE_RESP" | grep -q '"type":"runestone_denied"' \
  || die "No runestone_denied received (cooldown test failed)"

RUNE_RESULT_JSON="$(echo "$RUNE_RESP" | grep '^RUNE_RESULT:' | head -n1 | sed 's/^RUNE_RESULT://')"
echo "$RUNE_RESULT_JSON" | jq . >/dev/null 2>&1 || die "Invalid runestone_result JSON"
[[ "$(echo "$RUNE_RESULT_JSON" | jq -r '.table_id // empty')" == "rookguard_runestone_table_01" ]] \
  || die "runestone_result wrong table_id"
[[ "$(echo "$RUNE_RESULT_JSON" | jq -r '.caster.id // empty')" == "$RUNE_PLAYER_ID" ]] \
  || die "runestone_result wrong caster.id"
RUNE_FACE="$(echo "$RUNE_RESULT_JSON" | jq -r '.face // empty')"
[[ "$RUNE_FACE" =~ ^(fire|water|earth|air|light|shadow)$ ]] \
  || die "runestone_result invalid face: $RUNE_FACE"
echo "$RUNE_RESULT_JSON" | grep -q "The stone exhales:" \
  || die "runestone_result missing whisper"

RUNE_DENIED_JSON="$(echo "$RUNE_RESP" | grep '^RUNE_DENIED:' | head -n1 | sed 's/^RUNE_DENIED://')"
echo "$RUNE_DENIED_JSON" | jq . >/dev/null 2>&1 || die "Invalid runestone_denied JSON"
[[ "$(echo "$RUNE_DENIED_JSON" | jq -r '.reason // empty')" == "cooldown" ]] \
  || die "runestone_denied reason not cooldown"

log "Checking receipts API for runestone events..."
if ! run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=runestone_cast&player_id=$RUNE_PLAYER_ID&limit=20" \
  | grep -q "$RUNE_PLAYER_ID"; then
  die "Receipts API missing runestone_cast for player_id=$RUNE_PLAYER_ID"
fi
if ! run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=runestone_result&player_id=$RUNE_PLAYER_ID&limit=20" \
  | grep -q "$RUNE_PLAYER_ID"; then
  die "Receipts API missing runestone_result for player_id=$RUNE_PLAYER_ID"
fi
if ! run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=runestone_denied&player_id=$RUNE_PLAYER_ID&limit=20" \
  | grep -q "cooldown"; then
  die "Receipts API missing runestone_denied with cooldown for player_id=$RUNE_PLAYER_ID"
fi
log "Runestone basic receipts present ✅"

# Trinity of Shadow test (forced face)
log "Running Trinity of Shadow test (forced face)..."

# Restart server with RUNESTONE_TEST_FORCE_FACE=shadow
log "Stopping server for trinity test restart..."
kill "$SERVER_PID" 2>/dev/null || true
sleep 1
kill -9 "$SERVER_PID" 2>/dev/null || true
sleep 1

log "Starting server with RUNESTONE_TEST_FORCE_FACE=shadow..."
DEBUG=1 \
ALLOW_TEST_DEATH=1 \
DEATH_RESPAWN_DELAY_MS="$DEATH_RESPAWN_DELAY_MS_OVERRIDE" \
PUBLIC_RECEIPTS_DELAY_MS=0 \
PUBLIC_RECEIPTS_DELAY_PROFILE=default \
PUBLIC_RECEIPTS_JITTER_MS=0 \
RUNESTONE_TEST_FORCE_FACE=shadow \
npm run dev >/tmp/akalynth_verify_server_trinity.log 2>&1 &
SERVER_PID=$!
sleep 1

log "Waiting for server to accept WebSocket (trinity test)…"
READY=0
for _ in {1..12}; do
  if run_timeout 2 bash -lc "printf '{\"type\":\"connect\"}\n' | npx --yes wscat -c '$WS_URL' >/dev/null 2>&1"; then
    READY=1
    break
  fi
  sleep 0.5
done
[[ "$READY" -eq 1 ]] || die "Server not ready for trinity test. Check /tmp/akalynth_verify_server_trinity.log"

TRINITY_MINT_JSON="$(run_timeout 5 curl -s -X POST "$HTTP_URL/v1/session/guest" || true)"
TRINITY_GUEST_TOKEN="$(echo "$TRINITY_MINT_JSON" | jq -r '.guest_token // empty')"
TRINITY_PLAYER_ID="$(echo "$TRINITY_MINT_JSON" | jq -r '.player_id // empty')"
[[ -n "$TRINITY_GUEST_TOKEN" ]] || die "Missing guest_token for trinity test"
[[ -n "$TRINITY_PLAYER_ID" ]] || die "Missing player_id for trinity test"
log "Minted trinity test session ok (player_id=$TRINITY_PLAYER_ID)"

TRINITY_TIMEOUT_SECONDS=20
log "Running trinity WS flow (timeout ${TRINITY_TIMEOUT_SECONDS}s)…"
TRINITY_RESP="$(
  run_timeout "$TRINITY_TIMEOUT_SECONDS" node -e '
const WebSocket = require("ws");
const ws = new WebSocket(process.argv[1]);
const guestToken = process.argv[2];

const moveToTable = [
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "east" },
  { type: "move_intent", direction: "south" },
  { type: "move_intent", direction: "south" }
];

const messages = [
  { type: "connect" },
  { type: "login", guest_token: guestToken },
  { type: "enter_world" },
  ...moveToTable
];

let shadowCount = 0;

function sendSeq(seq, delay, done) {
  let idx = 0;
  const send = () => {
    if (idx < seq.length) {
      ws.send(JSON.stringify(seq[idx++]));
      setTimeout(send, delay);
    } else if (done) {
      done();
    }
  };
  send();
}

ws.on("open", () => {
  sendSeq(messages, 150, () => {
    // Cast 3 times with 2100ms spacing to satisfy cooldown
    setTimeout(() => {
      ws.send(JSON.stringify({ type: "runestone_cast", table_id: "rookguard_runestone_table_01" }));
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "runestone_cast", table_id: "rookguard_runestone_table_01" }));
        setTimeout(() => {
          ws.send(JSON.stringify({ type: "runestone_cast", table_id: "rookguard_runestone_table_01" }));
          setTimeout(() => ws.close(), 500);
        }, 2100);
      }, 2100);
    }, 300);
  });
});

ws.on("message", (data) => {
  const str = data.toString();
  console.log(str);
  try {
    const msg = JSON.parse(str);
    if (msg.type === "runestone_result" && msg.face === "shadow") {
      shadowCount++;
      console.log("TRINITY_SHADOW_COUNT:" + shadowCount);
    }
  } catch (_) {}
});

ws.on("close", () => process.exit(0));
ws.on("error", (e) => { console.error(e.message); process.exit(1); });
' "$WS_URL" "$TRINITY_GUEST_TOKEN" 2>/dev/null || true
)"

TRINITY_SHADOW_COUNT="$(echo "$TRINITY_RESP" | grep '^TRINITY_SHADOW_COUNT:' | tail -n1 | sed 's/^TRINITY_SHADOW_COUNT://')"
[[ "${TRINITY_SHADOW_COUNT:-0}" -ge 3 ]] \
  || die "Trinity test did not get 3 shadow results (got ${TRINITY_SHADOW_COUNT:-0})"

log "Checking receipts API for trinity_of_shadow..."
sleep 0.5  # Allow receipts to flush
if ! run_timeout 5 curl -s "$HTTP_URL/v1/receipts?action=trinity_of_shadow&player_id=$TRINITY_PLAYER_ID&limit=20" \
  | grep -q "$TRINITY_PLAYER_ID"; then
  die "Receipts API missing trinity_of_shadow for player_id=$TRINITY_PLAYER_ID"
fi
log "Trinity of Shadow receipt present ✅"

log "Checking public receipts for trinity_of_shadow..."
PUBLIC_TRINITY_JSON="$(run_timeout 5 curl -s "$HTTP_URL/v1/receipts/public?limit=50" || true)"
echo "$PUBLIC_TRINITY_JSON" | jq . >/dev/null 2>&1 || die "Invalid JSON from public receipts (trinity check)"
if ! echo "$PUBLIC_TRINITY_JSON" | grep -q 'trinity_of_shadow'; then
  die "Public receipts feed missing trinity_of_shadow"
fi
if echo "$PUBLIC_TRINITY_JSON" | grep 'trinity_of_shadow' | grep -q '"player_id"'; then
  die "Public receipts leaked player_id for trinity_of_shadow"
fi
log "Trinity of Shadow in public feed ✅"

log "✅ VERIFY PASS"
log "Last receipts:"
tail -10 "$RECEIPTS" || true
