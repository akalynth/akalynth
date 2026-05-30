# Akalynth (Linux + Android only)

## Structure Note

Legacy folders (if any remain) are deprecated; use `apps/` + `packages/` for new work.

A Tibia-world-feel MMO with a **server-authoritative** architecture and **anti-bot-first** enforcement (Tem).

**Platform policy**: Linux server + Android client only. **Windows is intentionally unsupported.**

## Current Stage

Akalynth v0.1 is a **pre-alpha, proof-native MMO vertical slice**.

It is not a production MMO, not content-alpha, and not a public launch candidate. For the canonical claim boundary, start with:

- `docs/CURRENT_STAGE.md`
- `docs/DRIVER_BRIEF.md`
- `docs/SHOWCASE_RUNBOOK.md`
- `docs/KNOWN_GAPS.md`
- `docs/DRIVER_30_DAY_PLAN.md`

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
- Terminal A: `cd apps/server && ALLOW_INSECURE_LOCAL=1 npm run dev`
- Terminal B: `cd apps/debug-client && npm install && npm run dev`
- Health: `curl -s http://127.0.0.1:3000/v1/health`
- Client: http://127.0.0.1:5173/

3) Protocol edits: `./scripts/verify_protocol_sync.sh`

4) Runtime/API edits: `./scripts/verify_mvp.sh`

5) Focused persistence/receipt checks (from apps/server):
- `npm run verify:receipt-hygiene`
- `npx tsx ../../scripts/heat_out_of_order_smoke.ts`
- `npx tsx ../../scripts/heat_pr2_out_of_order_smoke.ts`

## Showcase Preflight

For a bounded local preflight before showing the repo to a potential technical driver:

```bash
npm run verify:showcase
```

This script checks protocol sync, server build, MVP verification, and debug-client build. It does not start the server or client and does not prove production readiness.

## ⚠️ Verification Spine (Mandatory)

**All contributions must pass the Verification Spine before merge.**

```bash
cd apps/server
npm run verify
```

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
- `docs/DRIVER_BRIEF.md`
- `docs/SHOWCASE_RUNBOOK.md`
- `docs/PROOF_RUN_TEMPLATE.md`
- `docs/KNOWN_GAPS.md`
- `docs/DRIVER_30_DAY_PLAN.md`

Core docs:

- `docs/V1_SCOPE.md`
- `docs/ARCHITECTURE.md`
- `docs/PROTOCOL.md`
- `docs/ANTICHEAT.md`
- `docs/WORLD_AZURA.md`
