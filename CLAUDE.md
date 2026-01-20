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

# Debug client (React/Vite)
cd apps/debug-client && npm install && npm run dev

# Verification commands (run from apps/server/)
npm run verify              # Full guarantee verification
npm run verify:verbose      # Verbose output
npm run verify:quick        # Skip build step
npm run verify:heat         # Heat system verification
npm run verify:protected    # Protected slots verification
npm run verify:chronicle    # Chronicle verification
npm run verify:chronicle-chain  # Chronicle chain verification

# Manual WebSocket test
wscat -c ws://localhost:3000

# Full MVP verification (runs all scenarios)
./scripts/verify_mvp.sh

# Protocol sync check
./scripts/verify_protocol_sync.sh
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
- `maps/` - Map definitions (rookguard.json, azura.json)

### Apps
- `apps/server/` - Authoritative MMO server (TypeScript, WebSocket)
- `apps/debug-client/` - Debug web client (React/Vite)
- `apps/android/` - Android client (placeholder)

### Rulebook (`rulebook/`)
- DSL-based game rules and invariants
- `compiled/` - Compiled rulebook output
- `invariants/` - Game invariant definitions

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
- Copilot Delegation: `docs/COPILOT_DELEGATION.md` (custom agents, constraint enforcement)

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

## Custom Agents (Delegation)

This project uses **custom agents** (domain specialists) for architecture-critical work. See `docs/COPILOT_DELEGATION.md` for full details.

### Available Agents

- **chronicle-evidence-engineer** (`.claude/agents/chronicle-evidence-engineer.md`)
  - Use for: Phase 4.4 forensic evidence features
  - Enforces: Receipt-first design, Civil Guarantees, deterministic evidence
  - Example: "Show players why item dropped on death"

- **receipt-engineer** (`.claude/agents/receipt-engineer.md`)
  - Use for: Receipt-first persistence, chain integrity, replay determinism
  - Enforces: Canonical receipts, no state mutation without receipt emission, chain verification
  - Example: "Add new receipt type for player trade"

- **anticheat-engineer** (`.claude/agents/anticheat-engineer.md`)
  - Use for: Heat signals, Tem challenges, enforcement ladder
  - Enforces: Deterministic heat computation, evidence-based enforcement, receipt-backed signals
  - Example: "Add new anti-cheat detection for speed hacking"

- **combat-engineer** (`.claude/agents/combat-engineer.md`)
  - Use for: Death penalties, drops, combat resolution
  - Enforces: Deterministic outcomes, reproducible combat, receipt-driven drops
  - Example: "Implement PvP death penalty scaling"

### When to Delegate

✅ **Use custom agents for:**
- Protocol changes (WebSocket messages)
- Anti-cheat patterns (heat, Tem, detection)
- Receipt schema additions
- Evidence/audit features
- Domain-specific refactoring

❌ **Don't delegate for:**
- Simple fixes (typos, formatting)
- Documentation updates
- Build/tooling configuration

### Quick Commands

Available via `.claude/commands/`:
- `@anticheat` - Review anticheat logic
- `@atomic` - Check commit discipline
- `@bootstrap` - Environment setup
- `@protocol` - Validate protocol changes
- `@verify` - Run MVP verification
- `@receipt-verify` - Verify receipt chain integrity
- `@drop-check` - Validate drop policy determinism
- `@treasury-check` - Verify gold/item consistency
- `@identity-check` - Verify caps/roles/segregation

**Rule:** Delegate to custom agents early. Trust their constraints. They enforce architectural integrity you might miss.

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
| `AKALYNTH_PROTOCOL_ACK=YES` | Acknowledge protocol.ts edit (bypass warning hook) |
| `AKALYNTH_RECEIPT_CHAIN_PATH` | Primary: absolute path to receipts.jsonl |
| `AKALYNTH_RECEIPTS_PATH` | Legacy fallback (deprecated) |
| `AKALYNTH_DB_PATH` | Absolute path to SQLite database |
| `CHRONICLE_KEY_PATH` | Signing key path (required in production) |

## Protocol Change Warning

Editing `protocol.ts` triggers a warning hook that blocks changes unless explicitly acknowledged. This prevents accidental breaking changes to the API surface.

To bypass the warning when intentional:
```bash
AKALYNTH_PROTOCOL_ACK=YES
```

The hook (`scripts/warn_protocol_change.sh`) exits with code 1 to block edits unless acknowledged.

## Production Key Discipline

In production mode (`NODE_ENV=production` or `AKALYNTH_ENV=production`):

1. **`CHRONICLE_KEY_PATH` is required** - Server fails to start without it
2. **Key file permissions must be 0600 or stricter** - No group/world readable
3. **Hard fail early** - Server exits with code 2 on key errors

Dev mode allows missing key only if no signing is required. Key loading is consolidated in `packages/coordination-kernel/src/receipt/key.ts`.

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

## Claude Code Slash Commands
Available via `.claude/commands/`:
- `/verify` - Run MVP verification checklist
- `/atomic` - Enforce atomic commit discipline
- `/protocol` - Check protocol.ts matches PROTOCOL.md
- `/bootstrap` - Run Linux bootstrap script
- `/anticheat` - Add new anti-cheat signal
- `/receipt-verify` - Verify receipt chain integrity
- `/drop-check` - Validate drop policy determinism
- `/treasury-check` - Verify gold/item consistency
- `/identity-check` - Verify caps/roles/segregation

## CI Pipeline
GitHub Actions (`.github/workflows/ci.yml`) runs:
1. API-first invariant guard
2. Protocol docs sync verification
3. TypeScript build
4. MVP verification suite
