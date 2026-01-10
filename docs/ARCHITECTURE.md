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

### Audit Logger (`server/src/audit/logger.ts`)

- Writes JSONL receipts for every action
- Fields: timestamp, player_id, action, inputs, result, hash
- Used for appeals and analysis

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
