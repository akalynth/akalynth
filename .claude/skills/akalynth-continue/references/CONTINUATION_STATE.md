# Akalynth continuation state

Last updated: **2026-06-21** (chill-zone refine steps 1-3: server core + wire + both clients, behind CHILL_ZONE_REFINE_ENABLED; step 4 = economy/Tem tuning).

Read this before implementing. For skill routing see `AGENTS.md` and `.codex/CODEX_MAP.md`.

---

## Git / release line

| Item | Value |
|------|--------|
| Repo | `https://github.com/akalynth/akalynth` |
| Branch | `main` |
| Head | `69558e4` — feat(android): chill-zone refine UI + protocol parity (step 3b) |
| Last merged | web client P0-P3 feature gap (12 commits since `8ee2d90`) |
| Local source | `/home/sovereign/akalynth-ops/repos/akalynth` |

**Included in main since `8ee2d90` (2026-06-20 → 2026-06-21):**

- Account portal with character list + Play button (`8bd911d`)
- Account play hardening verifier + reusable smoke (`9bc78ae`, `e0676df`)
- Account character name preserved on token login (`c45afe9`)
- Portal CSRF token preserved for Play flow (`48e5b17`)
- Android **v10** committed (`versionCode` 10, `0.1.8-beta-character-sprites`) — character sprites from assets-src wired into APK (`26514af`, `32f3b22`)
- `fix(deps)`: ws audit finding patched (`7dd7490`)
- `fix(debug-client)`: prefer shared ts sources in vite (`2118b4d`)

**Beta publish pipeline (ops):**
- `bin/beta-publish-helper.sh` (or equivalent) fixed: empty `remote_bundle` now uses `-` sentinel so `$4` stays `remote_evidence`. `bash -n` passes.
- Last confirmed rerun: `merge_method=already-current`, publish=pass, smoke=pass (28 checks), portal source=live.

---

## Android beta (live vs committed)

| Field | Live on beta | Committed on main |
|-------|-------------|-------------------|
| versionCode | **9** | **10** |
| versionName | `0.1.7-beta-shell-polish` | `0.1.8-beta-character-sprites` |
| APK SHA-256 | `07e5f959f3e0fafffd5c3a560217bb1d6caa8ec211e8bfba86b25f046a6c61d6` | not yet built |

**`infra/android/beta-client-update.json` still pins v9.** v10 APK has not been built or published yet — this is the next publish milestone.

**Key Android paths:**

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

**Refine extension (`gather → refine → deliver`)** — design `.codex/design/chill-zone-refine.md`; flag `CHILL_ZONE_REFINE_ENABLED` (default off, independent of gather flag):

- **Step 1 done** (`2171a3e`): `gather.ts` core — `StationDef.kind`, `PlayerGather` `refining` variant, `startRefine`/`cancelRefine`, `tickGather` in-place upgrade `ley_mote → refined_ley_mote`, graded reward (`tending_token`/`keystone_token`), `AZURA_REFINE_STATIONS` @ (33,33). Tier-1 R1–R14 in `verify-gather.test.ts` (76 checks green).
- **Step 2 done** (`4f67a61`): wire — `refine_intent` (+ `parseClientMessage` allowlist), `refine_result`/`refine_progress`/`refine_completed`, `GatherStationPublic.kind`, `deliver_result.refined`, `already_refining`/`not_refinable`; refinery placed behind flag; receipt folds `refined`+`refined_at_station`; WS harness S6 leg.
- **Step 3 done** (`5a316b7` web, `69558e4` android): debug-client Refn action + amber `R` refinery marker, `sendRefine`, keystone token count, wire-authority verifier extended; Android `nearestRefineryStation`, `ActionButtons` Refn, `GameStore` refine handlers, `ProtocolParityTest` bumped to **39 client / 53 server**.
- **Step 4 next:** economy/Tem tuning — finalize `keystone_token` value (token-only), decide whether to emit a `refine_cadence` heat signal.
- **Notes:** (a) enable on beta with `CHILL_ZONE_REFINE_ENABLED=1` (systemd drop-in, alongside the gather flag). (b) Tier-2 `verify-gather-loop.test.ts` needs node matching the prebuilt `better-sqlite3` (Node 22); it won't boot under a Node 24 shell (ABI mismatch) — runs in CI / on beta. (c) Android builds on ops-dev-01 (Java 21); push-to-main runs the ParityTest job.

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
- Gate often stops at (10,3); greedy correction budget raised to 10 steps, forced NORTH tap fallback if still not at (10,2), sleep 4→6 before text wait
- `wait_pos_at 32 32 20` removed — replaced with `ui_wait_pos 30` (accept any spawn position on new map, not exact (32,32))
- Scenario fallback: `ui_wait_text "High City" 8` raised to 30s, `walk_to_greedy` budget 16→20 steps; `ensure_hud_ready` re-run before gather walk
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

1. ~~**Stabilize `azura_gather`**~~ — **done** (gate greedy+forced tap, arrival accepts any spawn pos, scenario extended waits)
2. ~~**Top bar**~~ — **done** (`statusBarsPadding()` on HUD and MapChip Column in `WorldScreen.kt`)
3. ~~**Deploy web client to beta**~~ — **done** (beta runtime verified at `2ec22a2`, `/play/` returns 200)
4. **Chill-zone refine step 4** — economy/Tem tuning (`keystone_token` value; optional `refine_cadence` heat) + enable `CHILL_ZONE_REFINE_ENABLED=1` on beta. Steps 1-3 done. See § Chill-zone gather → Refine extension.
5. **Prod** — this handoff covers **beta** lane; prod deploy is separate (`/opt/akalynth`, `deploy_beta.sh`)

---

## Claude / Codex agent setup

- **Canonical skills:** `repos/akalynth/.claude/skills/` (21 stewards + `akalynth-continue` + `goal0-akalynth-integration`)
- **User mirror:** symlink `~/.claude/skills/akalynth-continue` → repo skill (see `scripts/sync-claude-continue-skill.sh`)
- **Entry:** `CLAUDE.md` and `AGENTS.md` in repo root; this file loaded via `akalynth-continue` skill

When you finish a milestone, bump **Last updated** and edit the tables above — do not fork handoff into random markdown elsewhere.