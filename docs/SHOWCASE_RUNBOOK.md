# Akalynth Showcase Runbook

> **Purpose:** Step-by-step instructions to run a local pre-alpha proof showcase from a fresh clone, and the exact claim you may make afterward.

## Scope

This runbook demonstrates a local pre-alpha proof run.

It does not prove production readiness, content-alpha readiness, Android release readiness, or public launch readiness.

## Required Environment

- Linux
- Node.js 20+
- npm
- Git

Windows is intentionally unsupported for this repository.

## Step 1: Bootstrap

Run from the repository root. `bootstrap_linux.sh` installs system dependencies (it is dev-only and refuses to run in CI):

```bash
sudo ./scripts/bootstrap_linux.sh
```

Then install all workspace dependencies. The repo provides a convenience script that installs the root, server, and debug-client packages in order:

```bash
npm run install:all
```

Equivalent manual steps (run as a single shell session so the `cd`s chain):

```bash
npm install
cd apps/server && npm install && cd ../debug-client && npm install && cd ../..
```

## Step 2: Run Preflight Verification

From the repository root:

```bash
./scripts/verify_protocol_sync.sh
./scripts/verify_mvp.sh
cd apps/server && npm run verify:agent-economy-simulation && cd ../..
```

## Step 3: Start Server

Terminal A:

```bash
cd apps/server
ALLOW_INSECURE_LOCAL=1 npm run dev
```

### Optional: Chill-Zone Gather (Step 2 client loop)

Enable the server gather lane, then enter **Azura** in the debug client. Nodes render on the
map (green **M** = Ley Mote, blue **C** = Curation Stand); the side panel sends intents only.

```bash
cd apps/server
CHILL_ZONE_GATHER_ENABLED=1 ALLOW_INSECURE_LOCAL=1 npm run dev
```

Server proof for the full loop (no UI): `cd apps/server && CHILL_ZONE_GATHER_ENABLED=1 npm run test:gather-loop`

Expected local endpoint:

```text
ws://localhost:3000
```

Optional health check from another terminal:

```bash
curl -s http://127.0.0.1:3000/v1/health
```

## Step 4: Start Debug Client

Terminal B:

```bash
cd apps/debug-client
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Step 5: Expected Observations

A successful local showcase should demonstrate:

- guest login succeeds,
- player enters Rookguard,
- movement snaps to server truth,
- chat works,
- server emits receipts,
- health endpoint responds,
- debug client remains connected during basic movement/chat.

With `CHILL_ZONE_GATHER_ENABLED=1` and Azura selected, a successful gather showcase also shows:

- gather nodes and curation stand markers on the map,
- gather/deliver buttons in the Chill-Zone Gather panel (disabled until in range),
- server-driven progress bar during an active gather,
- a `delivery.recorded` receipt after deliver (check chronicle or server logs).

## Step 6: Evidence To Capture

Capture these artifacts before claiming a successful showcase:

- commit SHA,
- command transcript,
- server logs,
- verifier outputs,
- receipt file path (default when the server is run from `apps/server/`: `apps/server/audit/receipts.jsonl`; SQLite projection at `apps/server/data/akalynth.db`),
- debug-client build result,
- any failed command output.

## Step 7: Optional Preflight Script

The repository includes a non-launching preflight helper:

```bash
npm run verify:showcase
```

This checks the documented build/verification path. It does not start the server or client, and it does not replace a human-observed demo.
It also runs the agent economy simulator verifier documented in
`docs/AKALYNTH_AGENT_ECONOMY_SIM_PROOF_V1.md`.

## Known Gaps During Showcase

- Not production.
- Not content alpha.
- Some runtime state is in-memory.
- Android release is not claimed.
- Load testing is local/staging only.
- Some implemented systems are not release-claimed unless covered by named verifiers and run artifacts.

## Show Boundary

The correct claim after a successful run is:

> A local pre-alpha proof-native MMO vertical slice was run at the named commit, using the documented runbook and captured evidence.

Do not claim:

- production readiness,
- public launch readiness,
- durable persistent-world guarantees,
- complete anti-cheat coverage,
- complete cryptographic receipt verification,
- Android release readiness.
