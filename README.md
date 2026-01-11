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

## Docs (single source of truth)

Start here: `docs/README.md`

- `docs/ARCHITECTURE.md`
- `docs/PROTOCOL.md`
- `docs/ANTICHEAT.md`
- `docs/WORLD_AZURA.md`
