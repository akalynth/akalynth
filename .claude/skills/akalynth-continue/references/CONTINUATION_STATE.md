# Akalynth continuation state

Last updated: **2026-06-20** (post PR #331 merge + beta v9 publish).

Read this before implementing. For skill routing see `AGENTS.md` and `.codex/CODEX_MAP.md`.

---

## Git / release line

| Item | Value |
|------|--------|
| Repo | `https://github.com/akalynth/akalynth` |
| Branch | `main` |
| Head (approx) | `8ee2d90` — manifest pin after `e23f32d` squash merge |
| Merged PR | [#331](https://github.com/akalynth/akalynth/pull/331) — chill-zone gather step 2 + Android beta v9 |
| Local source | `/home/sovereign/akalynth-ops/repos/akalynth` |

**Included in main (2026-06-20):**

- Debug-client gather map overlays + wire-authority verifier
- Android **v9** (`versionCode` 9, `0.1.7-beta-shell-polish`)
- Gather client protocol + **Gthr** / **Deliv** UI
- Classic 32 UI textures (nine-slice panels, D-pad scrim, action rings)
- Client auto-update overlay + `GET /v1/client/android-update?lane=beta`
- `scripts/build-publish-beta-apk.sh`, Goal0 `goal0-android-ui-inspect*.sh`
- Beta systemd drop-ins: trust-proxy, `CHILL_ZONE_GATHER_ENABLED=1`
- Asset verifier accepts `data/assets-src/sprites/ui/ui_gameplay_v1.json` pack

---

## Android beta v9 (live)

| Field | Value |
|-------|--------|
| versionCode | 9 |
| versionName | `0.1.7-beta-shell-polish` |
| APK | https://beta.akalynth.com/download/akalynth-beta.apk |
| SHA-256 | `07e5f959f3e0fafffd5c3a560217bb1d6caa8ec211e8bfba86b25f046a6c61d6` |
| Size | 12815433 bytes |

**Key Android paths:**

- `apps/android/app/build.gradle.kts` — versionCode / versionName
- `apps/android/app/src/main/java/com/akalynth/client/ui/screens/WorldScreen.kt` — top bar layout
- `apps/android/app/src/main/java/com/akalynth/client/ui/components/DPad.kt` — scrim (`scrimAlpha`)
- `apps/android/app/src/main/java/com/akalynth/client/ui/theme/UiTextures.kt` — asset loading
- `apps/android/app/src/main/java/com/akalynth/client/game/GatherHelpers.kt` — adjacency for Gthr
- `apps/android/app/src/main/java/com/akalynth/client/update/` — auto-update install flow
- `apps/android/app/src/test/.../ProtocolParityTest.kt` — 38 client / 50 server message types

**Build note:** Fedora/local **Java 25** breaks Gradle. Build on **ops-dev-01** with `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64`, `ANDROID_HOME=/home/sovereign/Android/Sdk`.

**Install note:** Signature change vs v8 → `adb uninstall com.akalynth.client` before fresh install.

---

## Chill-zone gather

**Server** (`apps/server/src/world/gather.ts`):

- Feature flag: `CHILL_ZONE_GATHER_ENABLED=1` (enabled on beta via systemd drop-in)
- Example node: `azura_ley_mote_e` at **(34, 32)** on map Azura
- Interact radius: Manhattan ≤ 1 (adjacent or on node tile)

**Android:** `GatherIntentMessage` / `DeliverIntentMessage`; `GameStore` handlers; `ActionButtons` shows **Gthr** when `GatherHelpers.inRange`.

**Debug client:** `gatherMapOverlays.ts`, markers M/C on map canvas.

**Verifier:** `apps/debug-client/scripts/verify-gather-wire-authority.mjs`; server `verify-gather-loop.test.ts`.

---

## Hosts and lanes

| Host | IP / access | Role |
|------|-------------|------|
| **ops-dev-01** | `sovereign@194.147.221.89` | Beta API `beta-api.akalynth.com`, APK hosting, `/opt/akalynth-beta` |
| **goal0-edge-01** | SSH alias | Android emulator VM (`emulator-5576`, port 5576) |
| **akalynth-prod-01** | mesh / `api.akalynth.com` | Production server (`/opt/akalynth`) — separate from beta |

**Beta lane (ops-dev-01):**

- Runtime tree: `/opt/akalynth-beta` (rsync from source, **not** a git checkout)
- Service: `akalynth-beta.service` → `127.0.0.1:3000` behind Caddy
- State: `/var/lib/akalynth-beta`, keys `/etc/akalynth-beta`
- APK web root: `/var/www/akalynth-beta/download/`
- Client-update manifest: `/etc/akalynth-beta/android-client-update.json`
- Env: `AKALYNTH_ANDROID_BETA_UPDATE_JSON=/etc/akalynth-beta/android-client-update.json`

**Ops commands (from akalynth-ops):**

```bash
./bin/akalynth-lane-deploy.sh beta check      # read-only health
./bin/akalynth-lane-deploy.sh beta deploy       # build+restart (needs dist pre-built or run build steps first)
```

**Beta server sync pattern (after main merge):**

```bash
# on ops-dev-01, from ~/akalynth-ops/repos/akalynth at main
git fetch && git reset --hard origin/main
sudo rsync -a --delete \
  --exclude node_modules --exclude apps/server/audit --exclude apps/server/data \
  --exclude apps/server/chronicle.key --exclude apps/server/src/audit \
  ./ /opt/akalynth-beta/
sudo chown -R akalynth-beta:akalynth-beta /opt/akalynth-beta
# then npm ci + build:packages + server build as akalynth-beta user, restart service
```

---

## Publish beta APK (operator loop)

```bash
# on ops-dev-01
cd ~/akalynth-ops/repos/akalynth
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=/home/sovereign/Android/Sdk
./scripts/build-publish-beta-apk.sh
sudo cp apps/android/app/build/outputs/apk/beta/app-beta.apk /var/www/akalynth-beta/download/akalynth-beta.apk
sudo cp apps/android/app/build/outputs/apk/beta/app-beta.apk.sha256 /var/www/akalynth-beta/download/
sudo cp infra/android/beta-client-update.json /etc/akalynth-beta/android-client-update.json
sudo systemctl restart akalynth-beta   # clears in-memory client-update cache
./scripts/smoke-beta-apk.sh            # download + checksum verify
```

**API checks:**

```bash
curl -sf https://beta-api.akalynth.com/v1/health
curl -sf 'https://beta-api.akalynth.com/v1/client/android-update?lane=beta'
```

---

## Goal0 Android UI inspect pipeline

**Purpose:** Agent pulls screenshot bundles from VM for visual verification.

| Script | Role |
|--------|------|
| `scripts/goal0-android-ui-inspect.sh` | Local wrapper: scp remote scripts, ssh run, pull bundle |
| `scripts/goal0-android-ui-inspect-remote.sh` | Scenarios: `login`, `world`, `world_debug`, **`azura_gather`** |
| `scripts/goal0-android-ui-inspect-lib.sh` | D-pad automation, codex BFS paths, Tem/chat helpers |

**Usage:**

```bash
AKALYNTH_UI_SCENARIOS=azura_gather ./scripts/goal0-android-ui-inspect.sh
# bundle → /tmp/akalynth-ui-inspect-<run_id>/
# Read manifest.json → agent_read_order PNGs + inspect_checklist
```

**`azura_gather` flow:** connect → Rookguard codex (BFS paths in lib) → Azura → walk to **(34,32)** → capture `azura_gather.png`.

**Codex BFS paths (rookguard.json, match verify-rookguard-codex-path):**

- tutorial: `EAST`
- tem: `EAST×4`
- training: `EAST×8` then `SOUTH×12`
- guild: `NORTH×10`
- gate: `WEST×5` then `NORTH×2`, then `walk_to_greedy 10 2` correction

**Known flake / fixes applied:**

- Never use hardware BACK in `close_chat` (exits app to launcher)
- D-pad: short tap only (held press repeats moves via `MOVE_REPEAT_MS`)
- `bring_app_foreground` before captures
- Gate often stops at (10,3); greedy correction to (10,2) required for Azura transfer
- Full codex run ~8–15 min; `MOVE_DELAY` default 2.0s

**VM:** `goal0-edge-01`, serial `emulator-5576`, beta APK from `https://beta.akalynth.com/download/akalynth-beta.apk`

---

## CI

- Workflow: `.github/workflows/ci.yml` (+ `verify.yml` spine on PR)
- Self-hosted runners: `goal0-edge` (`ubuntu-24.04`, Android emulator job)
- Full CI on any non-codex-plugin PR
- After skill changes: `npm run verify:skills`

---

## Open / next work (as of handoff)

1. **Stabilize `azura_gather`** — codex reaches gate; Azura transfer + Gthr at (34,32) still flaky (~90% codex)
2. **Top bar** — map chip may clip in screenshots; may need wider gutters in `WorldScreen.kt`
3. **Commit manifest** — `infra/android/beta-client-update.json` pinned to v9 on main
4. **Prod** — this handoff covers **beta** lane; prod deploy is separate (`/opt/akalynth`, `deploy_beta.sh`)

---

## Claude / Codex agent setup

- **Canonical skills:** `repos/akalynth/.claude/skills/` (21 stewards + `akalynth-continue` + `goal0-akalynth-integration`)
- **User mirror:** symlink `~/.claude/skills/akalynth-continue` → repo skill (see `scripts/sync-claude-continue-skill.sh`)
- **Entry:** `CLAUDE.md` and `AGENTS.md` in repo root; this file loaded via `akalynth-continue` skill

When you finish a milestone, bump **Last updated** and edit the tables above — do not fork handoff into random markdown elsewhere.