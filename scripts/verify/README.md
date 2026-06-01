# Verification Harness

## Purpose

`scripts/verify/ws_harness.mjs` drives deterministic WebSocket scenarios for MVP verification.
The scenarios live in `scripts/verify/scenarios` and are consumed by `scripts/verify_mvp.sh`.
`verify_mvp.sh` targets the server at `apps/server/`.

## Run verify

```bash
PORT=3101 ./scripts/verify_mvp.sh
```

## Run a single scenario manually

```bash
PORT=3101 npm --prefix apps/server run dev
```

In a second shell:

```bash
TOKEN=$(curl -s -X POST http://localhost:3101/v1/session/guest | jq -r '.guest_token')
node scripts/verify/ws_harness.mjs \
  --ws-url ws://localhost:3101 \
  --guest-token "$TOKEN" \
  --scenario scripts/verify/scenarios/stone.json
```

Optional timeout override:

```bash
node scripts/verify/ws_harness.mjs --ws-url ws://localhost:3101 --guest-token "$TOKEN" \
  --scenario scripts/verify/scenarios/stone.json --timeout-ms 6000
```

Flags:

- `--ws-url <ws>` (required): server WebSocket URL.
- `--guest-token <token>` (required): guest session token.
- `--scenario <file>` (required): scenario JSON path.
- `--timeout-ms <ms>` (optional): overrides the scenario `duration_ms` bound.
- `--ready-file <path>` (optional): writes a `{ ready: true, scenario, at_ms }`
  marker once bootstrap completes (used to synchronize multi-client runs).

## Scenario schema (summary)

```json
{
  "name": "runestone",
  "bootstrap": true,
  "bootstrap_delay_ms": 150,
  "auto_tem": true,
  "duration_ms": 3000,
  "events": [
    { "send": { "type": "move_intent", "direction": "east" }, "delay_ms": 150 },
    { "repeat": 10, "pattern": [ { "type": "move_intent", "direction": "north" } ], "delay_ms": 105 }
  ],
  "hooks": [
    {
      "when": { "type": "death_notice" },
      "send": { "type": "move_intent", "direction": "south" },
      "after_ms": { "field": "respawn_in_ms", "add": 500 }
    }
  ],
  "expect": [
    { "type": "runestone_result" },
    { "type": "runestone_denied", "fields": { "reason": "cooldown" } }
  ]
}
```

- `bootstrap`: auto-send `connect`, `login`, `enter_world` unless `false`.
- `bootstrap_delay_ms`: delay between bootstrap messages.
- `auto_tem`: auto-answer Tem challenges with `AZURA`.
- `events`: ordered sends; `delay_ms` waits after each send.
- `hooks`: optional conditional sends when a received message partially matches `when`.
- `expect`: required message types with optional field equality checks.

## Harness output

The harness writes a JSON report to stdout:

```json
{
  "ok": true,
  "scenario": "stone",
  "messages": [],
  "events": [],
  "failures": []
}
```

- `ok`: `true` when there are no failures.
- `scenario`: the scenario `name` (or the scenario file basename if unnamed).
- `messages`: all inbound WS messages.
- `events`: sent messages with timestamps.
- `failures`: missing expectations or runtime errors.

The process exits `0` when `ok` is `true` and `2` otherwise.

## Determinism knobs

`verify_mvp.sh` pins public feed delays to zero and uses explicit ports:

- `PORT` and `TRINITY_PORT` (default `PORT+1`)
- `TIMEOUT_SECONDS`, `DEATH_RESPAWN_DELAY_MS_OVERRIDE`
- `PUBLIC_RECEIPTS_DELAY_MS=0`, `PUBLIC_RECEIPTS_DELAY_PROFILE=default`, `PUBLIC_RECEIPTS_JITTER_MS=0`
- `RUNESTONE_TEST_FORCE_FACE=shadow` for trinity
