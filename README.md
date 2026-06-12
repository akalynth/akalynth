# Akalynth (Linux + Android only)

## Structure Note

Legacy folders (if any remain) are deprecated; use `apps/` + `packages/` for new work.

A classic-feel MMO with a **server-authoritative** architecture and **anti-bot-first** enforcement (Tem).

**Platform policy**: Linux server + Android client only. **Windows is intentionally unsupported.**

## Current Stage

Akalynth v0.1 is a **pre-alpha, proof-native MMO vertical slice**.

It is not a production MMO, not content-alpha, and not a public launch candidate. For the canonical claim boundary, start with:

- `docs/CURRENT_STAGE.md`
- `docs/SHOWCASE_RUNBOOK.md`
- `docs/KNOWN_GAPS.md`

## Quickstart (Server)

```bash
sudo ./scripts/bootstrap_linux.sh
cd apps/server
npm install
npm run dev
```

Test with:

```bash
wscat -c ws://localhost:3000
```

## Docker Runtime

The production-shaped server container lives under `infra/docker/`.

```bash
npm run verify:docker-runtime
npm run render:docker-runtime
npm run smoke:docker-runtime
```

The smoke command builds `akalynth/server:local`, boots a disposable container
with a temporary chronicle key and runtime volume, checks internal health, and
cleans up after itself. The render command writes reviewable host runtime files
to `.tmp/akalynth-docker-runtime` by default. For host-managed Docker Compose
and systemd notes, see `infra/README.md`.

## Typical Dev Flow (Linux + Android)

1) Fresh setup
```bash
sudo ./scripts/bootstrap_linux.sh
cd apps/server
npm install
```

2) Run local dev
- Terminal A: `npm run dev:server:fresh` (from repo root)
- Terminal B: `cd apps/debug-client && npm install && npm run dev`
- Health: `curl -s http://127.0.0.1:3000/v1/health`
- Client: http://127.0.0.1:5173/

`dev:server:fresh` runs `dev:bootstrap` (generates a local-only chronicle signing
key at `apps/server/chronicle.key` if absent — see step below), then starts the
server with `AKALYNTH_BOOTSTRAP=1` (creates the genesis receipt chain on first
run), `CHRONICLE_KEY_PATH=chronicle.key` (enables character creation/identity),
and `ALLOW_INSECURE_LOCAL=1` (accepts loopback over plain HTTP/WS). Without the
signing key the server exits with `Signing key not found`.

The dev key is a random 32-byte seed, gitignored, and **local-only** — never
reuse it for a deployment. Production keys are minted out-of-band; see
`docs/NEW_BOX_PROVISIONING.md`. Use `dev:server:fresh` for everyday local
development — it is idempotent (the key generates once, `AKALYNTH_BOOTSTRAP=1`
only matters before the chain exists). Plain `npm run dev:server` starts the
bare server **without** the dev key/identity/loopback env, for when you set
those yourself.

3) Protocol edits: `./scripts/verify_protocol_sync.sh`

4) Runtime/API edits: `./scripts/verify_mvp.sh`

5) Account-character/API parity edits:
- `npm run verify:account-character` (server `/v1/characters`, protocol docs,
  debug-client guard, and Android account-character tests)

6) Focused persistence/receipt/anti-cheat checks (from apps/server):
- `npm run verify:receipt-hygiene`
- `npm run verify:heat`
- `npm run verify:anticheat-persistence`

## Showcase Preflight

For a bounded local preflight before showing the repo to a potential technical driver:

```bash
npm run verify:showcase
```

This script checks protocol sync, server build, MVP verification, and debug-client build. It does not start the server or client and does not prove production readiness.

## ⚠️ Verification Spine (Mandatory)

**All contributions must pass the Verification Spine before merge.**

Run the spine from the repository root:

```bash
npm run verify
```

This builds the verification packages and runs `packages/verification-spine/bin/akalynth-verify.js`.
Profile variants are also available: `npm run verify:quick`, `npm run verify:full`, and `npm run verify:audit`.

> Note: `npm run verify` inside `apps/server` is a different, server-scoped check
> (`tsx tools/verify-guarantees.ts`), not the full spine.

The Verification Spine is **not optional tooling** — it is **civilizational law enforcement**.

### What It Verifies

- Civil Guarantees (G1-G15) - Constitutional law
- Receipt chain integrity - Audit trail
- Protocol sync - API surface
- Chronicle chain - Hash chain validity
- Treasury integrity - Gold/item accounting
- Heat system - Anti-cheat determinism
- Protected slots - Item drop policy
- ...and 11 more domain checks

### Non-Negotiable Invariants

❌ **Forbidden:**
- No deploy path bypasses `npm run verify`
- No CI green state without spine success
- No manual verification bypass

✅ **Required:**
- All future verifiers register with spine
- Failure is loud, blocking, and unskippable
- Every release includes verification metadata

**Full specification:** `docs/VERIFICATION_SPINE_API.md`

**Leverage score:** 9/9 (Critical infrastructure)

---

## Audit / CI Chronicle Verification

CI runs `verify:receipt-hygiene` with chronicle enabled and a fixture log path. See `.github/workflows/ci.yml` (step: "Receipt + chronicle hygiene (audit)") for the exact `ENABLE_CHRONICLE` and `CHRONICLE_LOG_PATH` wiring.

## Docs (single source of truth)

Start here: `docs/README.md`

Showcase / driver packet:

- `docs/CURRENT_STAGE.md`
- `docs/SHOWCASE_RUNBOOK.md`
- `docs/PROOF_RUN_TEMPLATE.md`
- `docs/KNOWN_GAPS.md`

Core docs:

- `docs/V1_SCOPE.md`
- `docs/ARCHITECTURE.md`
- `docs/PROTOCOL.md`
- `docs/ANTICHEAT.md`
- `docs/WORLD_HIGH_CITY.md`
