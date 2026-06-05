# Akalynth Repo Audit Report — v0 Client Spine + Protocol Parity

> **Status:** Historical snapshot (non-authoritative for v1).

Date (UTC): 2026-01-11T12:24:47Z

## Phase A — Baseline Inventory

### Repo tree summary (top-level + key subdirs)

```
akalynth/
  apps/                 # app entrypoints
    debug-client/       # v0 web client (Vite)
    server/             # authoritative server
  packages/
    shared/             # protocol + shared types + maps
  tools/                # new skeleton
  data/                 # new skeleton
  docs/
  scripts/
  tests/
  ops/
  dist/
  __PROPOSAL/
```

### Source-of-truth files

- Protocol: `packages/shared/protocol.ts`
- Shared types: `packages/shared/types.ts`
- HTTP contracts + MapName: `packages/shared/http.ts`
- Maps: `packages/shared/maps/*.json` (loaded by `apps/server/src/world/state.ts` and `apps/debug-client/src/data/maps.ts`)
- Server loop + WS flow: `apps/server/src/index.ts`
- HTTP API router: `apps/server/src/api/http.ts`
- Client connection/loop: `apps/debug-client/src/hooks/useGameClient.ts`

### Build tools

- Node: v20.19.6
- npm: 10.8.2

## Phase B — Build / Typecheck Matrix

| Package | Install | Build / Typecheck | Result | Notes |
| --- | --- | --- | --- | --- |
| apps/server | `npm ci` | `npm run build` | PASS | `npm ci` reported 0 vulnerabilities |
| packages/shared | `npm ci` | `npm run typecheck` | PASS | `npm ci` reported 0 vulnerabilities |
| apps/debug-client | `npm ci` | `npm run build` | PASS | `npm ci` reported 2 moderate vulnerabilities (not build‑blocking) |

## Phase C — Protocol Parity Table (Client ↔ packages/shared/protocol.ts)

| Message | Direction | Protocol fields | Client fields used | Match? | Fix needed |
| --- | --- | --- | --- | --- | --- |
| connect | C→S | `type` | `type` | Yes | No |
| welcome | S→C | `type`, `version` | none (presence only) | Yes (version unused) | No |
| login | C→S | `type`, `guest_token` | `guest_token` | Yes | No |
| login_ack | S→C | `ok?`, `player_id`, `guest_token`, `name`, `reason?` | `ok`, `reason`, `player_id`, `guest_token`, `name` | Yes | No |
| enter_world | C→S | `type` | `type` | Yes | No |
| world_state | S→C | `map`, `player`, `nearby_players` | `map`, `player`, `nearby_players` | Yes | No |
| move_intent | C→S | `direction` | `direction` | Yes | No |
| move_result | S→C | `ok`, `x`, `y`, `reason`, `map?` | `x`, `y`, `map` | Partial (ok/reason unused) | No |
| player_moved | S→C | `player_id`, `x`, `y` | `player_id`, `x`, `y` | Yes | No |
| player_joined | S→C | `player` | `player` | Yes | No |
| player_left | S→C | `player_id` | `player_id` | Yes | No |
| chat | C→S | `message` | `message` | Yes | No |
| chat_broadcast | S→C | `player_id`, `name`, `message` | `player_id`, `name`, `message` | Yes | No |
| death_notice | S→C | `ok`, `respawn_in_ms`, `map`, `spawn`, `reason` | `respawn_in_ms`, optional `map` | Partial (spawn/reason unused) | No |
| attack_intent | C→S | `target_id` (legacy `target_player_id` accepted by parser) | `target_id` | Yes | No |
| combat_resolved | S→C | `attacker_id`, `defender_id`, `outcome`, `map`, `x`, `y` | `attacker_id`, `defender_id`, `map`, `x`, `y` | Partial (outcome unused) | No |
| combat_rejected | S→C | `reason` | `reason` | Yes | No |
| error | S→C | `code`, `message` | `code`, `message` | Yes | No |
| tem_challenge | S→C | `challenge_id`, `message`, `timeout_seconds` | `message` | Partial (id/timeout unused) | No |

Protocol sanity checks:
- `world_state` includes authoritative `map` in protocol and server messages.
- `move_result` includes `map` only on transfer in server code.
- `attack_intent` parser accepts legacy `target_player_id` but returns `target_id`.

## Phase D — v0 Loop Sanity Checklist

- Connect → login → enter_world → world_state: OK (client sends `connect`/`login`/`enter_world`, server responds with `world_state`).
- Movement: 8‑dir D‑pad, client prediction + authoritative `move_result`/`player_moved` reconciliation, server throttles; no client‑side drift logic detected beyond prediction. OK.
- Map authority: client map is read‑only; reset on `world_state.map` or `move_result.map`; entities cleared on reset; map driven by server. OK.
- Attack: target selection via explicit target or nearest alive; sends `attack_intent` with `target_id`; feedback only on `combat_resolved`/`combat_rejected`; no local damage assumptions. OK.

## Phase E — Manual Walk / Transfer / Attack Script

1) Start server (terminal 1):

```bash
cd apps/server
ALLOW_INSECURE_LOCAL=1 npm run dev
```

2) Start client (terminal 2):

```bash
cd apps/debug-client
VITE_HTTP_BASE=http://localhost:3000 VITE_WS_BASE=ws://localhost:3000 npm run dev
```

3) 5‑minute walk test:
- Move continuously across Rookguard for 5 minutes.
- Expect no drift; server corrections should keep the player in sync.

4) Force reconnect:
- Refresh the browser.
- Expect connection to return to `awaiting_world_state` → `connected`, no duplicate “me”, no ghost roster.

5) Map transfer (GateToAzura):
- Complete tutorial steps, walk onto the gate tile.
- Expect client to clear entities, await new `world_state`, then render Azura map.

6) Attack loop test:
- With another player nearby, select or auto‑target.
- Press Attack; verify `attack_intent` uses `target_id`.
- Expect server‑confirmed feedback (`combat_resolved`) or rejection toast (`combat_rejected`).

Logs to watch:
- Server console: connection errors, WS errors, uncaught exceptions.
- Browser console: `ws message parse error`, `error` toasts.

## Phase F — Stop‑Ship Issues

None found. No patches applied.

## Next steps (optional)

- Run the manual transfer/attack script with two clients and capture any drift or duplicate‑entity anomalies.
- If drift appears, log `move_result` vs `player_moved` ordering to validate reconciliation timing.
- Consider updating `docs/PROTOCOL.md` to reflect `attack_intent.target_id` (doc parity only).
