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
AKALYNTH_BOOTSTRAP=1 npm run dev   # first run only (creates canonical receipts file)
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
- [Governance Invariants](./GOVERNANCE_INVARIANTS.md) - Civil guarantees and auditability constraints
- [World Evolution](./WORLD_EVOLUTION.md) - Epochs, sunsets, and founder-absence survival rules
- [Monetization Blueprint](./MONETIZATION_BLUEPRINT.md) - Future-proof rules for non-competitive purchases
- [Monetization Constitution](./MONETIZATION_CONSTITUTION.md) - Formal, enforceable monetization policy
- [Monetization Constitution Review](./MONETIZATION_CONSTITUTION_REVIEW.md) - Rationale, enforcement notes, and loophole closures
- [Monetization Receipts](./MONETIZATION_RECEIPTS.md) - Receipt schema for auditable, reversible monetization
- [Monetization Justifications](./MONETIZATION_JUSTIFICATIONS.md) - Registry of “not power” justification IDs
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
