# Architecture

## Core Principle

**Server authoritative simulation.**

The client is never trusted. It sends *intent*, and the server decides truth.

## Server Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    GAME TICK (100ms)                        │
├─────────────────────────────────────────────────────────────┤
│  1. Receive all pending intents from clients                │
│  2. Validate each intent (anti-cheat checks)                │
│  3. Apply valid intents to world state                      │
│  4. Broadcast state changes to affected clients             │
│  5. Emit audit receipts (JSONL)                             │
└─────────────────────────────────────────────────────────────┘
```

## Components

### WebSocket Server (`server/src/index.ts`)

- Accepts client connections
- Routes messages to handlers
- Maintains session state per connection

### World State (`server/src/world/state.ts`)

- Loads the active map definitions (`shared/maps/rookguard.json`, `shared/maps/azura.json`)
- Keeps per-map player sets so broadcasts stay local to each zone
- Serialises public player info with `toPublicPlayer`

### Movement Validator (`server/src/world/movement.ts`)

- Validates move intents
- Checks: walkable tile, within speed limit, valid direction
- Rejects impossible moves

### Anti-Cheat Pipeline (`server/src/anticheat/`)

```
Intent → Detector → Decision → Enforcement → Audit
```

- `detector.ts` - Analyzes patterns, flags suspicious behavior
- `tem.ts` - Issues Tem challenges to flagged players
- All decisions logged to JSONL

### Heat (Behavior Enforcement v0)

- Server-side heat score per player; deterministic decay over time (configurable via env).
- Signals include perfect cadence, chat spam, runestone cooldown spam, and repeated legend probing.
- Thresholds: Tem challenge at 30, movement throttle at 60 (default values).
- Heat receipts (`heat_changed`, `heat_tem_escalation`, `heat_penalty_applied`) are private only and never public.
- When a penalty is applied, the Ledger marks the actor (`ledger_marked`, mark=`watched`) as a private historical signal (no UI, no public feed).
- In-memory state only; process restart resets heat.

### Audit Logger (`server/src/audit/logger.ts`)

- Writes JSONL receipts for every action
- Fields: timestamp, player_id, action, inputs, result, hash
- Used for appeals and analysis

### Public Receipts Feed (`/v1/receipts/public`)

- Always delayed and redacted to preserve controlled asymmetry; canonical truth remains in `/v1/receipts`
- Response shape is stable (`mode: "strict"` with redacted `PublicReceipt[]`)
- Coordinates are bucketed (default `PUBLIC_RECEIPTS_BUCKET_SIZE=8`) and actors are anonymized (`PUBLIC_RECEIPTS_ACTOR_MODE=anon|daily_hash`)
- Daily hashes use `PUBLIC_RECEIPTS_HASH_SALT` (defaults to `akalynth-public-receipts`)
- Visibility is action-specific with deterministic jitter derived from `evidence_hash` + `PUBLIC_RECEIPTS_JITTER_SALT`
- Delay profile defaults to `default` (uses `PUBLIC_RECEIPTS_DELAY_MS`); `tibia` profile defines per-action baselines
- For deterministic testing: `PUBLIC_RECEIPTS_DELAY_PROFILE=default`, `PUBLIC_RECEIPTS_DELAY_MS=0`, `PUBLIC_RECEIPTS_JITTER_MS=0`
- Debug-only raw feed exists at `/v1/receipts/public_raw` (requires `DEBUG=1`, otherwise 403)

### Legend Objects (Stone That Cannot Be Obtained)

- A hidden landmark in Rookguard triggers `legend_sighted`, `legend_attempted`, and `legend_refused` receipts.
- The server displaces the player back to spawn; no item is granted and no UI message is sent.
- The first attempt emits `first_attempt_stone_cannot_obtain` and seeds the follow-up rumor.
- Public feeds expose only redacted, delayed `legend_refused` / first-of receipts; private receipts remain canonical.

### Runestone Ritual System (`server/src/world/runestone.ts`)

A social gambling/ritual artifact inspired by Tibia's dice system, but with Akalynth's twist: the Ledger is authoritative; Tem gating is planned (DEBUG-only today).

**Core mechanics:**
- Runestone tables are world landmarks (not inventory items yet)
- Player must be within 1 tile of table to cast
- Server rolls outcome using `crypto.randomInt` (6 faces: fire, water, earth, air, light, shadow)
- Results broadcast to players within 8 tiles
- 2-second cooldown between casts per player

**Protocol:**
- Client sends `runestone_cast` with `table_id` and optional `guess`
- Server responds with `runestone_result` (broadcast) or `runestone_denied` (to caster only)
- Denial reasons: `cooldown`, `not_near_table`, `not_authorized`, `rate_limited`

**Receipts:**
- `runestone_cast` - Player attempted cast (inputs: table_id, map, position, guess)
- `runestone_result` - Server rolled outcome (inputs: table_id, map, position, face)
- `runestone_denied` - Cast rejected (inputs: table_id, reason)
- `trinity_of_shadow` - Legend: 3 consecutive shadow rolls by same player (once per player per process)

**Access control:**
- Currently DEBUG-gated (`DEBUG=1` required)
- Future: Tem grants/revokes capability tokens

**Public myth surface:**
- Only `trinity_of_shadow` appears in `/v1/receipts/public` (redacted, delayed)
- Regular casts remain private; myth is public

**Testing:**
- Set `RUNESTONE_TEST_FORCE_FACE=shadow` (requires `DEBUG=1`) to force specific outcome

### Verification Harness (`scripts/verify`)

- `scripts/verify/ws_harness.mjs` drives deterministic WS scenarios for MVP verification.
- `scripts/verify/scenarios/*.json` define the message sequences and expectations used by `scripts/verify_mvp.sh`.

## Data Flow

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
  │                               │
```

## Why This Architecture?

1. **Cheats can't teleport** - Server validates every move
2. **Cheats can't speed hack** - Server enforces tick rate
3. **Cheats can't see hidden data** - Server only sends what's visible
4. **All actions are auditable** - JSONL receipts for everything

## Networking Choice (MVP)

- **Lock**: custom WebSocket server (current `server/src/index.ts`)
- Reason: we need explicit control over `intent queue → tick → validate → apply → audit receipts`
- Simplicity: single 32×32 + 64×64 worlds do not need matchmaking, rooms, or delta-sync frameworks

### Post-MVP Review (When to revisit Colyseus)

Reconsider Colyseus (or similar) only when:
- Multiple rooms/shards or replayable instances are required
- We carry >1 city per process with >100 CCUs and need built-in state-diff/matchmaking
- Engineering time shifts from gameplay/anti-cheat to maintaining sync plumbing

Until then, the bespoke WebSocket loop remains the single source of truth for movement, chat, Tem enforcement, and tutorial gating.

### Death & Respawn (MVP)

- Server-authoritative, receipt-driven: `death`, `death_penalty_applied`, `respawn` are emitted with map/position and timing.
- Penalty is time + position only. Respawn delay defaults to 15s and is overrideable via `DEATH_RESPAWN_DELAY_MS` (tests set ~300ms).
- Dead players cannot move; Tem/anti-cheat state is **not** cleared by death.
- Status surfaces via control plane: `/v1/world/:map/state` includes caller `status` + `dead_until_ms` + TTL; WS `world_state` carries status.
- Crash/restart: player state is in-memory; reconnects within the same process honor `dead_until_ms` (timer re-armed). Process restarts reset world/session state today.
- Debug death trigger is gated by `DEBUG=1` + `ALLOW_TEST_DEATH=1` and should not be exposed in production configs.
