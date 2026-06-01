# Architecture

How the Akalynth server stays authoritative over an untrusted client: the tick loop, transport posture, anti-cheat and enforcement systems, the receipt/audit chain, and the networking choices behind the MVP.

## Core Principle

**Server authoritative simulation.**

The client is never trusted. It sends *intent*, and the server decides truth.

## Encrypted-by-Default Transport

- `REQUIRE_TLS=1` is the default posture: plaintext HTTP and WS upgrades are rejected.
- `TRUST_PROXY=0` (default) ignores all `x-forwarded-*` headers. Remote clients cannot bypass TLS requirements by spoofing `x-forwarded-proto: https`.
- Behind a proxy, set `TRUST_PROXY=1` and ensure the proxy sets `x-forwarded-proto: https` for secure traffic.
- By default, trusted proxy hops are loopback-only (`TRUST_PROXY_LOOPBACK_ONLY=1`); widen only if you understand the risk.
- Optional: `TRUST_PROXY_ALLOWLIST` (comma-separated IPs/CIDRs) can be used instead of loopback-only mode for custom proxy configurations.
- When `TRUST_PROXY=1`, only requests arriving from a trusted proxy hop (loopback by default, or allowlist) can use `x-forwarded-proto` to attest HTTPS. The server validates the proxy's remote address before honoring forwarded headers.
- Dev escape hatch: `ALLOW_INSECURE_LOCAL=1` permits plaintext only from loopback clients (when `TRUST_PROXY=0` or when proxy is not trusted).
- Recommended deployment: bind the server to loopback and terminate TLS at a reverse proxy. Set `TRUST_PROXY=1` with `TRUST_PROXY_LOOPBACK_ONLY=1` (default).

## Server Loop

```text
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

### WebSocket Server (`apps/server/src/index.ts`)

- Accepts client connections
- Routes messages to handlers
- Maintains session state per connection

### World State (`apps/server/src/world/state.ts`)

- Loads the active map definitions (`packages/shared/maps/rookguard.json`, `packages/shared/maps/azura.json`)
- Keeps per-map player sets so broadcasts stay local to each zone
- Serialises public player info with `toPublicPlayer`

### Movement Validator (`apps/server/src/world/movement.ts`)

- Validates move intents
- Checks: walkable tile, within speed limit, valid direction
- Rejects impossible moves

### Anti-Cheat Pipeline (`apps/server/src/anticheat/`)

```text
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
- Heat is receipt-backed and durable across restart: `heat_changed` / `heat_tem_escalation` / `heat_penalty_applied` receipts materialize into the `player_heat` SQLite projection, the live score is hydrated on (re)connect, and the projection is rebuilt from the receipt chain on replay if the DB is lost. The active penalty window and Tem cooldown survive restart (and correctly expire by wall-clock). Proven by `verify:anticheat-persistence` in CI.

### Witness Check v0 (Tem Social Witness)

- Server-driven witness mechanism triggered when a heat penalty applies (emits `ledger_marked` with `mark="watched"`).
- Nearby players (within `WITNESS_RADIUS_TILES`, default 8 tiles Manhattan distance) are selected as witnesses (default 2, clamp 1-3).
- Witnesses receive a non-accusatory prompt via WebSocket (`tem_witness_request`): "The Ledger stirs. Confirm what you saw."
- Witness responses (`tem_witness_response` with `response: "confirm" | "deny" | "uncertain"`) are recorded as private receipts (`witness_response` action).
- Privacy: witness request messages contain only redacted `target_actor` (using same mode as public receipts: `anon` or `daily_hash`); **never** raw `player_id`. No coordinates exposed.
- Anti-abuse: request TTL (`WITNESS_TTL_MS`, default 12s) ensures timely responses; cooldowns (`WITNESS_COOLDOWN_MS`, default 60s) prevent spam per-target and per-witness.
- Receipts: `witness_requested` and `witness_response` are **private only**; not allowed into `/v1/receipts/public` nor `/v1/rumors/public`.
- Pending requests and cooldowns are intentionally in-memory only. Given the 12s request TTL and 60s cooldowns, restart-reset is acceptable: a restart outlives any in-flight request, and the quorum *outcome* (the durable consequence) is receipt-backed via `witness_quorum_resolved`. The enforcement consequence that must persist — heat/penalty — does, independently (see Heat above).
- Enabled by default in DEBUG mode; set `WITNESS_ENABLED=1` explicitly for production use.

#### Witness Quorum v0

- Aggregates witness responses per request and emits exactly one `witness_quorum_resolved` receipt.
- Resolution triggers:
  - **Eager**: when all expected witnesses have responded
  - **TTL**: when request expires (default 12s)
- Outcome rules (deterministic, order-independent):
  - `confirmed`: all witnesses responded "confirm"
  - `denied`: all witnesses responded "deny"
  - `contested`: mix of "confirm" and "deny" responses
  - `insufficient`: partial responses, all "uncertain", or mixed with "uncertain" without confirm+deny conflict
- Receipt schema: `{request_id, kind, target_actor, map, outcome, response_count, expected_count, confirm_count, deny_count, uncertain_count, triggered_by, ttl_ms}`
- No automatic escalation in v0; the quorum outcome is recorded for audit purposes only.
- Quorum receipts are **private only**; not added to `PUBLIC_RECEIPTS_ALLOW`.

### Sovereign Presence v0

- Reserved "Sovereign" identity is a cosmetic continuity anchor: visible title/badge/mark, **no gameplay privileges**.
- Sovereign is still subject to Tem/Heat/Witness and normal movement/death rules.
- Default safety: Sovereign logic only activates when `SOVEREIGN_ENABLED=1`.
- Name matching is **disabled by default** outside DEBUG; enable explicitly with `SOVEREIGN_ALLOW_NAME_MATCH=1`.
- Debug test hook: `SOVEREIGN_FORCE_NEXT_GUEST=1` forces the next guest session name to the configured Sovereign name (DEBUG-only).
- Receipts are **private-only** (not in public feeds):
  - `sovereign_declared` - emitted on login when player name matches Sovereign
  - `sovereign_marked` - emitted when player enters world with cosmetic marking applied
  - `sovereign_presence` - emitted on enter_world (result=`entered`) and disconnect (result=`left`)
- Single-session uniqueness: only one Sovereign session at a time; duplicate attempts receive `login_ack` with `ok=false, reason=sovereign_already_active`.
- MVP: in-memory state only; process restart resets active Sovereign session.

### Capabilities v0 (Badges → Caps)

- **Principle**: Badges are cosmetic labels; capabilities are enforcement gates.
- **Server-only authority**: Client never asserts caps; server derives and enforces.
- **Default posture**: No privileges granted unless explicitly configured.
- **Env flags**:
  - `CAPS_ENABLED=1`: Enable capability system (default: false in prod)
  - `CAPS_DEBUG_GRANT_SOVEREIGN=1`: Sovereign badge derives `house:buy`, `echo:spawn` (DEBUG-only)
- **Capability IDs** (v0):
  - `house:buy` - Can purchase house plots
  - `echo:spawn` - Can spawn Echo NPC on disconnect
  - `map:access:<MapName>` - Future: map-specific access gates
- **Receipts** (private-only, never in PUBLIC_RECEIPTS_ALLOW):
  - `capability_granted` - Cap added (inputs: cap, source, badge?)
  - `capability_revoked` - Cap removed (inputs: cap, source)
  - `capability_gated` - Action blocked by missing cap (inputs: cap, action, reason)
- **MVP**: In-memory state only; process restart resets caps.

### Sovereign Echo v1

- **Static anchor**: When Sovereign disconnects with `echo:spawn` cap, a static Echo spawns at their last position.
- **Synthetic ID**: Echo uses `echo:<owner_player_id>` to avoid collision with real player IDs.
- **Visible marker**: Echo appears in `world_state.nearby_players` for all players on that map.
- **No privileges**: Echo cannot move, chat, or perform any actions. Pure cosmetic presence.
- **Cap-gated**: Requires `echo:spawn` capability (derived from sovereign badge when `CAPS_DEBUG_GRANT_SOVEREIGN=1`).
- **Despawn triggers**:
  - New Sovereign session is accepted (regardless of player_id)
  - Server process restart
- **Receipts** (private-only, use owner_player_id for audit linkage):
  - `sovereign_echo_spawned` - inputs: echo_id, map, x, y, cause='disconnect'
  - `sovereign_echo_despawned` - inputs: echo_id, map, x, y, cause='replaced'|'restart'
- **MVP**: In-memory state only; process restart clears Echo.

### Audit Logger (`apps/server/src/audit/logger.ts`)

- Writes JSONL receipts for every action
- Fields: sequence, timestamp, prev_hash, event_hash, signature, actor_id, action, inputs, result, inputs_hash, outputs_hash
- Used for appeals and analysis

### Public Receipts Feed (`/v1/receipts/public`)

- Always delayed and redacted to preserve controlled asymmetry; canonical truth remains in `/v1/receipts`
- Response shape is stable (`mode: "strict"` with redacted `PublicReceipt[]`)
- Coordinates are bucketed (default `PUBLIC_RECEIPTS_BUCKET_SIZE=8`) and actors are anonymized (`PUBLIC_RECEIPTS_ACTOR_MODE=anon|daily_hash`)
- Daily hashes use `PUBLIC_RECEIPTS_HASH_SALT` (defaults to `akalynth-public-receipts`)
- Visibility is action-specific with deterministic jitter derived from `event_hash` + `PUBLIC_RECEIPTS_JITTER_SALT`
- Delay profile defaults to `default` (uses `PUBLIC_RECEIPTS_DELAY_MS`); `tibia` profile defines per-action baselines
- For deterministic testing: `PUBLIC_RECEIPTS_DELAY_PROFILE=default`, `PUBLIC_RECEIPTS_DELAY_MS=0`, `PUBLIC_RECEIPTS_JITTER_MS=0`
- Debug-only raw feed exists at `/v1/receipts/public_raw` (requires `DEBUG=1`, otherwise 403)

### Legend Objects (Stone That Cannot Be Obtained)

- A hidden landmark in Rookguard triggers `legend_sighted`, `legend_attempted`, and `legend_refused` receipts.
- The server displaces the player back to spawn; no item is granted and no UI message is sent.
- The first attempt emits `first_attempt_stone_cannot_obtain` and seeds the follow-up rumor.
- Public feeds expose only redacted, delayed `legend_refused` / first-of receipts; private receipts remain canonical.

### Runestone Ritual System (`apps/server/src/world/runestone.ts`)

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

```text
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

- **Lock**: custom WebSocket server (current `apps/server/src/index.ts`)
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
