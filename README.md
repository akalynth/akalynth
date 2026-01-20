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
- `npm run smoke:replay:out-of-order`
- `npx tsx ../../scripts/heat_out_of_order_smoke.ts`
- `npx tsx ../../scripts/heat_pr2_out_of_order_smoke.ts`

Note: Some scripts/docs historically refer to `server/` at repo root. The source of truth is `apps/server/`. If you see path errors, update the command or add a temporary `server -> apps/server` symlink.

## Docs (single source of truth)

Start here: `docs/README.md`

- `docs/ARCHITECTURE.md`
- `docs/PROTOCOL.md`
- `docs/ANTICHEAT.md`
- `docs/WORLD_AZURA.md`
