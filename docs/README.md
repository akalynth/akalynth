# Akalynth

A Tibia-world-feel MMO with authoritative server architecture.

> **Platform Policy**: This repo targets Linux and Android only. Windows is intentionally unsupported.

## Current Stage

Akalynth v0.1 is a **pre-alpha, proof-native MMO vertical slice**.

It is not a production MMO, not content-alpha, and not a public launch candidate. The canonical current-stage boundary is maintained in [Current Stage](./CURRENT_STAGE.md).

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

## Showcase Preflight

From the repository root:

```bash
npm run verify:showcase
```

This checks protocol sync, server build, MVP verification, and debug-client build. It does not start the server or client and does not prove production readiness.

## Project Structure

```
akalynth/
  apps/server/        # Authoritative MMO server (TypeScript)
  apps/debug-client/  # Debug web client (Vite)
  apps/android/       # Android client foundation
  packages/shared/    # Shared schemas/types
  docs/               # Specifications and stage boundaries
  scripts/            # Bootstrap, verification, and dev scripts (Linux)
  tools/              # Tooling and validators
  infra/              # Deploy notes, CI/CD, infrastructure
  data/               # Map/data sources
```

## Documentation

Showcase / driver packet:

- [Current Stage](./CURRENT_STAGE.md) - canonical claim boundary for the repo now
- [Technical Driver Brief](./DRIVER_BRIEF.md) - why the base is useful and how to evaluate it
- [Showcase Runbook](./SHOWCASE_RUNBOOK.md) - bounded local demonstration path
- [Proof Run Template](./PROOF_RUN_TEMPLATE.md) - template for recording a run without overclaiming
- [Known Gaps](./KNOWN_GAPS.md) - release blockers, engineering risks, and presentation rules
- [30-Day Driver Plan](./DRIVER_30_DAY_PLAN.md) - bounded next execution path

Design / production notes:

- [Classic 32 Art And Mobile UI Direction](./CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md) - old-school 32x32 art direction, OpenAI asset pipeline, and mobile HUD rules

Core docs:

- [V1 Scope Fence](./V1_SCOPE.md) - what v1 includes and explicitly defers
- [Architecture](./ARCHITECTURE.md) - server loop, world state, anti-cheat pipeline
- [Protocol](./PROTOCOL.md) - message types and examples
- [Anti-Cheat](./ANTICHEAT.md) - detection signals, Tem challenge, enforcement
- [Governance Invariants](./GOVERNANCE_INVARIANTS.md) - civil guarantees and auditability constraints
- [World Evolution](./WORLD_EVOLUTION.md) - epochs, sunsets, and founder-absence survival rules
- [Monetization Blueprint](./MONETIZATION_BLUEPRINT.md) - future-proof rules for non-competitive purchases
- [Monetization Constitution](./MONETIZATION_CONSTITUTION.md) - formal, enforceable monetization policy
- [Monetization Constitution Review](./MONETIZATION_CONSTITUTION_REVIEW.md) - rationale, enforcement notes, and loophole closures
- [Monetization Receipts](./MONETIZATION_RECEIPTS.md) - receipt schema for auditable, reversible monetization
- [Monetization Justifications](./MONETIZATION_JUSTIFICATIONS.md) - registry of “not power” justification IDs
- [World: Azura](./WORLD_AZURA.md) - city layout, spawn zone, landmarks
- [Copilot Delegation](./COPILOT_DELEGATION.md) - custom agents, domain specialists, constraint enforcement

## V1 Claim Boundary

The original MVP was:

- Guest login (no registration required)
- Authoritative grid movement
- Chat
- Audit receipts (JSONL)
- Tem anti-bot challenge

The repository now contains additional implemented systems, including combat, death, item handling, protected slots, chronicle evidence, treasury, work contracts, NPC recognition, Android client code, and a load-test harness.

These systems are not automatically release-claimed. A system is release-claimed only when it is:

1. listed in [Current Stage](./CURRENT_STAGE.md),
2. covered by a named verifier or smoke test,
3. included in a passing CI/local proof run,
4. and documented in the release or proof-run artifact.

## Explicitly Not Claimed

- Production deployment readiness
- Commercial MMO readiness
- Content-alpha gameplay depth
- Public launch readiness
- Android release readiness
- Long-lived persistent-world guarantees
