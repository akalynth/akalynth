# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Akalynth is a Tibia-style MMO with a **server-authoritative** architecture and **anti-bot-first** enforcement (Tem). The server is the single source of truth; clients send intent only.

**Platform policy**: Linux server + Android client only. Windows is intentionally unsupported.

## Commands

```bash
# Bootstrap (installs Node.js, npm, build-essential on Debian/Linux)
sudo ./scripts/bootstrap_linux.sh

# Server development
cd apps/server && npm install
npm run dev          # tsx watch mode
npm run build        # tsc compile
npm start            # run compiled dist/index.js

# Manual WebSocket test
wscat -c ws://localhost:3000

# Full MVP verification (runs all scenarios)
./scripts/verify_mvp.sh
```

## Architecture

### Server Loop (100ms tick)
1. Receive pending intents from clients
2. Validate each intent (anti-cheat checks)
3. Apply valid intents to world state
4. Broadcast state changes to affected clients
5. Emit audit receipts (JSONL)

### Key Components

| Path | Purpose |
|------|---------|
| `apps/server/src/index.ts` | WebSocket server, message routing, session state |
| `apps/server/src/world/state.ts` | Active map definitions, per-map player sets |
| `apps/server/src/world/movement.ts` | Movement validation (walkable tile, speed limit, direction) |
| `apps/server/src/anticheat/detector.ts` | Pattern analysis, flags suspicious behavior |
| `apps/server/src/anticheat/tem.ts` | Issues Tem challenges to flagged players |
| `apps/server/src/world/heat.ts` | Server-side heat score per player, deterministic decay |
| `apps/server/src/world/witness.ts` | Social witness mechanism for heat penalties |
| `apps/server/src/audit/logger.ts` | JSONL receipt writer (every action audited) |
| `apps/server/src/audit/public_receipts.ts` | Delayed/redacted public feed (`/v1/receipts/public`) |
| `apps/server/src/persist/` | SQLite persistence layer (receipt-driven materialization) |

### Shared Code (`packages/shared/`)
- `protocol.ts` - All WebSocket message types (client→server and server→client)
- `types.ts` - Domain types (Player, MapData, TileCode, Signal, etc.)
- `http.ts` - HTTP API types (MapName, etc.)

### Data Flow
```
Client                          Server
  │                               │
  ├──── move_intent ─────────────►│
  │     {direction: "north"}      │
  │                               ├── validate tile
  │                               ├── check speed
  │                               ├── anti-cheat scan
  │                               ├── update world state
  │                               ├── emit audit log
  │◄──── move_result ─────────────┤
  │     {x: 10, y: 11, ok: true}  │
```

## Source-of-Truth Files
- Protocol: `docs/PROTOCOL.md` + `packages/shared/protocol.ts`
- Architecture: `docs/ARCHITECTURE.md`
- Anti-cheat: `docs/ANTICHEAT.md`
- Worlds: `docs/WORLD_ROOKGUARD.md`, `docs/WORLD_AZURA.md`

## MVP Scope (locked)
- Authoritative grid movement
- Chat
- Tem anti-bot challenge
- JSONL audit receipts
- Two zones: Rookguard (32x32 training) → Azura (64x64 city)

Not in MVP: combat, inventory, housing logic (placeholders only), NPC AI.

## Engineering Rules
- Server is authoritative. Client sends intent only (never coordinates/truth claims).
- One main server tick loop (simple, explicit, auditable).
- Every player action emits a JSONL receipt (audit trail).
- Keep dependencies minimal. Avoid new frameworks unless required.
- No Colyseus until post-MVP review.

## Environment Variables

Key flags for development/testing:

| Variable | Purpose |
|----------|---------|
| `DEBUG=1` | Enable debug features (runestone, public_raw endpoint, etc.) |
| `ALLOW_TEST_DEATH=1` | Enable `kill_self` command |
| `REQUIRE_TLS=1` | Reject plaintext (default on) |
| `ALLOW_INSECURE_LOCAL=1` | Permit plaintext from loopback |
| `TRUST_PROXY=1` | Honor `x-forwarded-proto` from proxy |
| `SOVEREIGN_ENABLED=1` | Enable Sovereign identity system |
| `CAPS_ENABLED=1` | Enable capability system |
| `PUBLIC_RECEIPTS_DELAY_MS=0` | Disable delay for deterministic tests |

## Commit Discipline (Atomic)
- One responsibility per commit
- Use messages: `<area>: <what>`
  - `docs: add rookguard world spec`
  - `shared: add tutorial tile codes`
  - `server: add tutorial gating receipts`

## Verification Checklist (must pass for each PR)
1. `sudo ./scripts/bootstrap_linux.sh`
2. `cd apps/server && npm install && npm run dev`
3. `wscat -c ws://localhost:3000`
4. login → enter_world → move_intent works
5. JSONL receipts written
6. Tem challenge triggers on suspicious movement
