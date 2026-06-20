---
name: game-server-steward
description: Use when modifying the Akalynth game server runtime — game loop, zone lifecycle, entity and player state machine, server-side command dispatch, world tick, or zone event handling.
version: 0.1.1
---

# Game Server Steward

The game server runtime is the authority surface for all gameplay. Changes here affect receipts, anti-cheat coverage, protocol contracts, and player identity simultaneously.

## Scope

- `apps/server/src/` — server entry point, HTTP and WS handlers
- `apps/server/src/world/` — game loop, world tick, zone lifecycle, spawn management, zone event handling
- `apps/server/src/skills/` (`handlers.ts`, `index.ts`) — server-side command/skill dispatch and validation
- `apps/server/src/character/` and `apps/server/src/account/` — player/entity state machine, session, inventory
- `apps/server/src/anticheat/` — enforcement boundary (heat, challenges) reached from command dispatch
- `apps/server/src/persist/` — SQLite materializers, derived state writes
- Other runtime surfaces: `api/`, `audit/`, `evidence/`, `metrics/`, `moderation/`, `rulebook/`, `witness/`

## Cross-cuts

- **`protocol-guardian`** — any new or changed server command requires a shared-type update first.
- **`anti-cheat-steward`** — command dispatch is the anti-cheat enforcement boundary; state machine changes may alter heat accumulation.
- **`receipt-chain-steward`** — every gameplay consequence must emit a receipt before derived state changes.
- **`coordination-kernel-steward`** — player identity in the state machine routes through the coordination kernel; do not reimplement token validation in the game loop.

## Rules

- Server authority is absolute. Clients send intent only — never accept client-reported position, health, or inventory as truth.
- Any new gameplay consequence (death, item change, zone transition, reward) needs a receipt emitted before the SQLite materializer runs.
- State machine changes require an explicit before/after state description. Do not leave implicit transitions.
- Game loop changes must not silently alter the witness proof generation or receipt emission cadence.
- Do not add mutable server state that has no receipt coverage and no replay path.
- Zone lifecycle events (spawn, despawn, zone-enter, zone-exit) are server-authoritative — do not gate them on client acknowledgment.
- Tick changes that affect timing must include a note on anti-cheat heat impact.

## Verification

- Build: `npm -w apps/server run build`
- Full smoke: `./scripts/verify_mvp.sh`
- Lifecycle: `npm run verify:lifecycle`
- Receipt hygiene after state machine changes: `npm run verify:receipt-hygiene`
- For zone/spawn changes: run a focused server test that exercises the affected zone, then confirm receipt count.

## Output must include

- Files changed.
- State machine transitions affected.
- Receipt schema impact (new event types, changed fields).
- Anti-cheat surface change, if any.
- Protocol change required, if any (route through `protocol-guardian` first).
- Verification commands and outputs.
