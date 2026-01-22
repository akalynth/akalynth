# Akalynth (Linux + Android only)

## Structure Note

Legacy folders (if any remain) are deprecated; use `apps/` + `packages/` for new work.

A Tibia-world-feel MMO with a **server-authoritative** architecture and **anti-bot-first** enforcement (Tem).

**Platform policy**: Linux server + Android client only. **Windows is intentionally unsupported.**

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

- `docs/V1_SCOPE.md`
- `docs/ARCHITECTURE.md`
- `docs/PROTOCOL.md`
- `docs/ANTICHEAT.md`
- `docs/WORLD_AZURA.md`
