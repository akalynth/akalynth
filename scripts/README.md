# Scripts

Bootstrap, verification, and automation helpers for local dev + CI.
Unless noted, run these from the repo root.
Scripts should be idempotent and documented.

## Quick index

## Scope (v1)

### V1-binding gates
- `scripts/ci_invariant_guard.sh`
- `scripts/verify_protocol_sync.sh`
- `scripts/test-chain-discipline.sh`

### Advisory / developer-only
- `scripts/verify_mvp.sh` (smoke tests)
- `scripts/precommit-hook.sh` (advisory)
- `scripts/bootstrap_linux.sh` (dev-only)
- `scripts/format_ts.sh` (formatting)
- `scripts/refuse_windows.*` (policy guard)

### Root scripts
- `scripts/bootstrap_linux.sh`: Linux-only bootstrap for system deps (apt installs node/npm/git/build tools). Run: `sudo ./scripts/bootstrap_linux.sh`
- `scripts/ci_invariant_guard.sh`: CI guard enforcing API-first invariants (checks required verification scripts on runtime changes). Run: `./scripts/ci_invariant_guard.sh`
- `scripts/format_ts.sh`: Prettier formatter for a single TS/TSX file (used by tooling via `CLAUDE_FILE_PATH`). Run: `CLAUDE_FILE_PATH=path/to/file.ts ./scripts/format_ts.sh`
- `scripts/heat_out_of_order_smoke.ts`: Smoke test for heat receipt timestamp guard (older receipt must not overwrite newer heat). Run: `npx tsx scripts/heat_out_of_order_smoke.ts`
- `scripts/heat_pr2_out_of_order_smoke.ts`: Smoke test for PR2 heat timestamp guards + column isolation. Run: `npx tsx scripts/heat_pr2_out_of_order_smoke.ts`
- `scripts/phase_gate.ts`: PreToolUse hook that blocks high-risk/forbidden edits unless `verify:quick` passes. Invoked by hook runner (reads JSON on stdin).
- `scripts/precommit-hook.sh`: Pretool/precommit guard for OS policy + oversized staged blobs. Install as a git hook or run manually.
- `scripts/refuse_windows.js`: Exits non-zero on Windows (Node-based policy guard). Run: `node scripts/refuse_windows.js`
- `scripts/refuse_windows.sh`: Exits non-zero on Windows (shell-based policy guard). Run: `./scripts/refuse_windows.sh`
- `scripts/verify_mvp.sh`: End-to-end MVP verification (boots server, runs HTTP/WS scenarios, asserts receipts). Run: `PORT=3101 ./scripts/verify_mvp.sh`
- `scripts/verify_protocol_sync.sh`: Ensures `docs/PROTOCOL.md` matches `packages/shared/protocol.ts`. Run: `./scripts/verify_protocol_sync.sh`

### Verification harness
- `scripts/verify/README.md`: How to run the WebSocket verification harness and scenario schema.
- `scripts/verify/ws_harness.mjs`: Deterministic WS scenario runner used by `verify_mvp.sh` (JSON report to stdout).
- `scripts/verify/scenarios/*.json`: Scenario definitions used by the harness (see Scenario details below).

### Directories (currently empty)
- `scripts/bootstrap/`: Reserved for bootstrap helpers.
- `scripts/release/`: Reserved for release automation helpers.

## Scenario details
- `scripts/verify/scenarios/baseline.json`: Basic movement/chat flow; expects welcome/login/world_state/move_result.
- `scripts/verify/scenarios/death.json`: Triggers `kill_self`, then exercises death_notice and respawn moves.
- `scripts/verify/scenarios/heat.json`: Runestone spam to hit cooldown; expects `runestone_denied` with reason `cooldown`.
- `scripts/verify/scenarios/runestone.json`: Runestone cast flow; expects result plus cooldown denial.
- `scripts/verify/scenarios/sovereign.json`: Minimal login/move flow used by sovereign presence checks.
- `scripts/verify/scenarios/sovereign_echo.json`: Minimal login/move flow used by sovereign echo tests.
- `scripts/verify/scenarios/stone.json`: Movement path used to trigger stone legend displacement checks.
- `scripts/verify/scenarios/trinity.json`: Multiple runestone casts used for trinity-of-shadow validation.
- `scripts/verify/scenarios/witness.json`: Witness client waits for `tem_witness_request` and responds.
- `scripts/verify/scenarios/witness_map_mismatch.json`: Variant witness responder with a longer delay.
- `scripts/verify/scenarios/witness_quorum.json`: Witness responder used for quorum resolution timing.
- `scripts/verify/scenarios/witness_trigger.json`: Movement/runestone spam to trigger a witness request on another client.

## Notes
- Heat smoke tests delete temp data unless `SMOKE_KEEP_TMP=1` is set.
- `verify_mvp.sh` targets `apps/server/`; see `scripts/verify/README.md` for env knobs.
