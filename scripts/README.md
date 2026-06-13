# Scripts

Bootstrap, verification, and automation helpers for local dev + CI.
Unless noted, run these from the repo root.
Scripts should be idempotent and documented.

## Quick index

- Bootstrap: `bootstrap_linux.sh`
- V1-binding gates: `ci_invariant_guard.sh`, `verify_protocol_sync.sh`, `test-chain-discipline.sh`
- MVP / smoke: `verify_mvp.sh`, `showcase_local.sh`, `studio-smoke.mjs`
- Account-character parity: root `npm run verify:account-character`
- Docker runtime: `verify-docker-runtime.sh`, `smoke-docker-runtime.sh`, `render-docker-runtime.sh`
- Edge ops: `add-plane-c-android-peer.sh`, `verify-plane-c-ollama.sh`, `open-graphene-termux.sh`, `open-graphene-droidvnc.sh`, `deploy-temp-android-novnc-lane.sh`, `deploy-temp-rustdesk-server.sh`
- Policy guards / hooks: `phase_gate.ts`, `precommit-hook.sh`, `refuse_windows.{js,sh}`, `warn_protocol_change.sh`, `require-chronicle.js`
- Formatting: `format_ts.sh`
- Verification harness: `verify/` (see `verify/README.md`)

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
- `scripts/add-plane-c-android-peer.sh`: Dry-run or apply the GrapheneOS
  Android Plane C WireGuard peer on `edge02`/`wg-edge-03`. Run:
  `PEER_PUBLIC_KEY='<android-public-key>' scripts/add-plane-c-android-peer.sh`
  for validation, then add `APPLY=1` once the Android public key and SSH access
  are confirmed. Android private keys must remain on the phone.
- `scripts/verify-plane-c-ollama.sh`: Verify the private-only Ollama path
  `Android -> WireGuard Plane C -> 10.46.0.1:11434`. Run:
  `SSH_TARGET='<edge02-ssh-target>' scripts/verify-plane-c-ollama.sh`, adding
  `PEER_PUBLIC_KEY='<android-public-key>'` to require the Android peer and
  `ANDROID_SERIAL='<adb-serial>'` to test Android-side TCP reachability.
- `scripts/open-graphene-termux.sh`: Open Termux on the active GrapheneOS
  emulator clone, defaulting to `emulator-5576`, and mirror it with `scrcpy`
  when `scrcpy` and a graphical display are available. Run:
  `ANDROID_SERIAL=emulator-5576 scripts/open-graphene-termux.sh`.
- `scripts/open-graphene-droidvnc.sh`: Open droidVNC-NG on the active
  GrapheneOS emulator clone, defaulting to `emulator-5576`, and mirror it with
  `scrcpy` when `scrcpy` and a graphical display are available. Run:
  `ANDROID_SERIAL=emulator-5576 scripts/open-graphene-droidvnc.sh`.
- `scripts/deploy-temp-android-novnc-lane.sh`: Create a temporary public
  HTTPS/noVNC lane on `edge02` to Android droidVNC-NG over Plane C. It refuses
  raw public VNC, requires a dedicated `PUBLIC_HOSTNAME`, generates a random
  URL path plus Caddy basic-auth password, and installs a systemd timer that
  tears the lane down after `DURATION=4h` by default. Run from `goal0-edge-01`:
  `PUBLIC_HOSTNAME='<temporary-dns-name>' SSH_TARGET=edge02 scripts/deploy-temp-android-novnc-lane.sh`.
- `scripts/deploy-temp-rustdesk-server.sh`: Create a temporary public RustDesk
  OSS server on `edge02` with `hbbs` and `hbbr`, using TCP `21115-21119` and
  UDP `21116`. It downloads verified RustDesk server binaries, writes systemd
  services, outputs the RustDesk client ID server / relay / key values, and
  installs a cleanup timer that removes the services and generated server key
  after `DURATION=4h` by default. Run from `goal0-edge-01`:
  `PUBLIC_ADDR='89.213.118.222' SSH_TARGET=edge02 scripts/deploy-temp-rustdesk-server.sh`.
- `scripts/ci_invariant_guard.sh`: CI guard enforcing API-first invariants (checks required verification scripts on runtime changes). Run: `./scripts/ci_invariant_guard.sh`
- `scripts/format_ts.sh`: Prettier formatter for a single TS/TSX file (used by tooling via `CLAUDE_FILE_PATH`). Run: `CLAUDE_FILE_PATH=path/to/file.ts ./scripts/format_ts.sh`
- `scripts/phase_gate.ts`: PreToolUse hook that blocks high-risk/forbidden edits unless `verify:quick` passes. Invoked by hook runner (reads JSON on stdin).
- `scripts/precommit-hook.sh`: Pretool/precommit guard for OS policy + oversized staged blobs. Install as a git hook or run manually.
- `scripts/refuse_windows.js`: Exits non-zero on Windows (Node-based policy guard). Run: `node scripts/refuse_windows.js`
- `scripts/refuse_windows.sh`: Exits non-zero on Windows (shell-based policy guard). Run: `./scripts/refuse_windows.sh`
- `scripts/require-chronicle.js`: Guard that asserts a chronicle/receipt prerequisite before a gated action.
- `scripts/warn_protocol_change.sh`: Advisory warning when protocol-relevant files change.
- `scripts/test-chain-discipline.sh`: V1-binding gate for receipt chain discipline. Run: `./scripts/test-chain-discipline.sh`
- `scripts/showcase_local.sh`: Local showcase runner (backs `npm run verify:showcase`).
- `scripts/studio-smoke.mjs`: Studio smoke test (backs `npm run studio-smoke`). Run: `node scripts/studio-smoke.mjs`
- `scripts/verify_mvp.sh`: End-to-end MVP verification (boots server, runs HTTP/WS scenarios, asserts receipts). Run: `PORT=3101 ./scripts/verify_mvp.sh`
- `scripts/verify_protocol_sync.sh`: Ensures `docs/PROTOCOL.md` matches `packages/shared/protocol.ts`. Run: `./scripts/verify_protocol_sync.sh`
- Root `npm run verify:account-character`: focused account-character parity
  gate. Runs protocol sync, server account-character tests, server create/select play-token handoff and login projection proof, shared account-character HTTP type proof, server wallet/shop/work/property gameplay route proof, debug-client guard, debug-client gameplay wire-authority proof, Android account-character unit tests, Android account-character token login handoff proof, Android gameplay wire-authority protocol proof, and Android character UI compile.
- Site `./scripts/verify-account-character-site.sh` in `akalynth-site`: focused
  public account portal and Public/Builder/Operator/Agent Codex surface gate.
  Wraps `scripts/verify-site-e2d-character-gameplay.mjs`, which includes
  executable site E2D character and gameplay action proof for account-scoped
  create/select/shop/work/property requests plus explicit no-session/no-CSRF
  inline helper proof.

### Docker runtime scripts
- `scripts/verify-docker-runtime.sh`: Backs `npm run verify:docker-runtime` (see `infra/README.md`).
- `scripts/smoke-beta-apk.sh`: Downloads the public beta APK, verifies the
  `.sha256` sidecar, and optionally installs through `adb` when a device is
  connected.
- `scripts/smoke-docker-runtime.sh`: Backs `npm run smoke:docker-runtime`.
- `scripts/render-docker-runtime.sh`: Backs `npm run render:docker-runtime` (renders host Docker files into `.tmp/akalynth-docker-runtime` by default).

### Verification harness
- `scripts/verify/README.md`: How to run the WebSocket verification harness and scenario schema.
- `scripts/verify/ws_harness.mjs`: Deterministic WS scenario runner used by `verify_mvp.sh` (JSON report to stdout).
- `scripts/verify/scenarios/*.json`: Scenario definitions used by the harness (see Scenario details below).

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
- `verify_mvp.sh` targets `apps/server/`; see `scripts/verify/README.md` for env knobs.
