# Server App (`akalynth-server`)

Authoritative game server for Akalynth. Serves HTTP and WebSocket on the same
port and is the single source of truth for world state, anti-cheat, receipts,
and the chronicle.

## Run

```bash
cd apps/server
npm install
npm run dev          # tsx watch src/index.ts
```

By default the server listens on `0.0.0.0:3000`:

- WebSocket: `ws://localhost:3000`
- Health:    `curl -s http://127.0.0.1:3000/v1/health`

Common environment variables (see `src/index.ts` for the full set):

- `PORT` (default `3000`), `HOST` (default `0.0.0.0`)
- `ALLOW_INSECURE_LOCAL=1` - allow insecure local dev connections
- `AKALYNTH_BOOTSTRAP=1` - first-run bootstrap (creates canonical receipts file)
- `ENABLE_CHRONICLE` / `CHRONICLE_LOG_PATH` / `CHRONICLE_STRICT` - chronicle wiring
- `REQUIRE_TLS`, `CAPS_ENABLED`, and `IP_*` rate-limit toggles

## Scripts

```bash
npm run build        # tsc
npm run start        # node ../../dist/server/apps/server/src/index.js
npm run verify       # tsx tools/verify-guarantees.ts (server-scoped guarantees)
npm run verify:heat
npm run verify:anticheat-persistence
npm run verify:receipt-hygiene
```

There are many additional domain verifiers under `tools/` (chronicle, treasury,
identity, monetization, rate-limits, etc.); see the `scripts` block in
`package.json`. The full repo-wide Verification Spine is run from the repository
root with `npm run verify`.

## Layout

```
server/
  src/
    index.ts        # entrypoint (HTTP + WS server)
    api/            # HTTP/WS protocol handlers
    world/          # authoritative world state
    anticheat/      # anti-cheat / Tem pipeline
    audit/          # receipts
    evidence/       # evidence projections
    witness/        # chronicle adapter (calls the Rust chronicle crate)
    persist/        # persistence
    moderation/  metrics/  rulebook/  skills/
  tools/            # verifiers and generators (tsx)
  fixtures/         # golden fixtures for evidence/CI (see fixtures/README.md)
  docs/             # server-scoped specs (CIVIL_GUARANTEES, EVIDENCE_UI_SPEC, ...)
```

## Related docs

- [Civil Guarantees](./docs/CIVIL_GUARANTEES.md)
- [Evidence UI Spec](./docs/EVIDENCE_UI_SPEC.md)
- [Phase 6: Witness Interface](./docs/PHASE6_WITNESS_INTERFACE.md)
- [Phase 7: Moderation](./docs/PHASE7_MODERATION.md)
- Repo docs index: [`../../docs/README.md`](../../docs/README.md)
