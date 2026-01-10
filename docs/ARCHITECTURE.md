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

- Holds all player positions
- Holds map data (loaded from `shared/maps/azura.json`)
- Single source of truth

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
