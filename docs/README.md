# Akalynth

A Tibia-world-feel MMO with authoritative server architecture.

> **Platform Policy**: This repo targets Linux and Android only. Windows is intentionally unsupported.

## Quick Start

### 1. Bootstrap (Debian/Ubuntu)

```bash
sudo ./scripts/bootstrap_linux.sh
```

This installs: `ca-certificates curl git build-essential nodejs npm`

### 2. Run the Server

```bash
cd apps/server
npm install
npm run dev
```

Server starts on `ws://localhost:3000`

### 3. Test Connection

```bash
# Install wscat if needed
npm install -g wscat

# Connect
wscat -c ws://localhost:3000
```

Send a test message:
```json
{"type":"connect"}
```

## Project Structure

```
akalynth/
  apps/server/     # Authoritative MMO server (TypeScript)
  apps/debug-client/  # Debug web client (Vite)
  packages/shared/ # Shared schemas/types
  docs/            # Specifications
  scripts/         # Bootstrap & dev scripts (Linux)
  ops/             # Deploy notes, systemd units
```

## Documentation

- [Architecture](./ARCHITECTURE.md) - Server loop, world state, anti-cheat pipeline
- [Protocol](./PROTOCOL.md) - Message types and examples
- [Anti-Cheat](./ANTICHEAT.md) - Detection signals, Tem challenge, enforcement
- [World: Azura](./WORLD_AZURA.md) - City layout, spawn zone, landmarks
- [Copilot Delegation](./COPILOT_DELEGATION.md) - Custom agents, domain specialists, constraint enforcement

## MVP Features

- Guest login (no registration required)
- Authoritative grid movement
- Chat
- Audit receipts (JSONL)
- Tem anti-bot challenge

## Not in MVP

- Combat
- Inventory
- Housing logic (plots are marked but not functional)
