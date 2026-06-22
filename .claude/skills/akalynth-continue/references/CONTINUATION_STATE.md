# Akalynth continuation state

Last updated: **2026-06-22** (Origin Act crash fix + beta patch, 226dd25 reconcile onto main, chronicle CI fix, web /play/ UI polish + beta patch, full repo cleanup/archive).

Read this before implementing. For skill routing see `AGENTS.md` and `.codex/CODEX_MAP.md`.

---

## 2026-06-22 session — what landed

> `origin/main` advanced `f536a3b → 4e36524 → d088eb8`. Two hotfixes were applied
> directly to the beta runtime `/opt/akalynth-beta` (drift), each reconciling on the
> next full deploy now that their PRs are on main.

1. **Origin Act crash fix — PR #345 MERGED (`4e36524`).** A divergent-history merge
   (the `beta-runtime/main` lineage) had silently dropped the Origin Act schema migration
   + materializer while keeping the reads → live `SqliteError: no such column:
   origin_receipt_id` on origin-worthy actions. Fix: additive `migrateToV22` (adds
   `players.origin_receipt_id/origin_action/origin_sealed_at`, `SCHEMA_VERSION 21→22`) +
   restored `handleOriginActSealed` (reads `receipt.actor_id`). **Beta patched live**:
   DB migrated 21→22, 592 player rows preserved, health 200. Evidence:
   `evidence/20260622T101500Z-beta-origin-fix-patch/`. CI follow-up bumped
   `verify-account-handle.test.ts` schema assertion to 22. See [[project-origin-act-lost-migration]].
2. **Deployed-state reconcile — PR #346 MERGED (squash `d088eb8`).** `226dd25` ("ship
   Rookguard assets + Rust bridge cleanup", 111 files incl. play surface, `hashUtf8Hex`
   item-id cleanup, **and the `crates/chronicle/` Rust napi bridge** — the previously
   *parked* chronicle-rust now un-parked on main) existed only on local `main`/deployed
   beta; now reconciled onto `origin/main`. Conflicts resolved with the deployed `bceaf10`
   versions.
3. **Chronicle CI fix (in #346).** `generate-chronicle-log.js` imported the never-built
   `packages/shared/chronicleChain.js`; CI step now runs it via `npx tsx` (resolves
   `.js→.ts`). This had blocked #346/#347.
4. **Web `/play/` UI polish — PR #348 (against main, polish-only +196 `index.css`).**
   Aesthetic pass on `apps/debug-client`: tactile button system (hover-lift/press,
   category glows, focus rings), larger/well-placed mobile skill·magic·combat buttons,
   scrollable action hotbar, single-row bottom dock, gold-accent cards. **Beta `/play/`
   patched live** (bundle `index-CTOIVXJe.css`, HTTP 200). Evidence:
   `evidence/20260622T120000Z-beta-play-ui-polish/`. (Supersedes auto-closed #347.)
5. **Full repo + git cleanup/archive.** All `repos/` git repos clean; stale `/tmp`
   worktrees removed; uncommitted/parked work archived to
   `evidence/20260622T094357Z-repo-cleanup-archive/` (MANIFEST.md) — incl. the parked
   `witness-kernel-rust` skill, the forgehold Act IV packet, and the reconciled-handoff
   WIP patch. **Note:** this file was reverted during cleanup; this update restores
   accurate state.

**Beta runtime drift (ops):** `/opt/akalynth-beta` carries the Origin Act server hotfix
**and** the UI `/play/` CSS hotfix on top of git `bceaf10`. Both are now on `origin/main`
(#345 + #348-pending), so a clean full deploy from `origin/main` reconciles the drift.
Rollback `.bak`/tar paths are in each evidence dir.

---

## Git / release line

| Item | Value |
|------|--------|
| Repo | `https://github.com/akalynth/akalynth` |
| Branch | `main` |
| Head | `d088eb8` — Reconcile deployed beta state (226dd25): Rookguard assets + Rust bridge cleanup (#346) |
| Last merged | #345 Origin Act fix (`4e36524`) → #346 226dd25 reconcile + chronicle CI fix (`d088eb8`); #348 web /play/ UI polish pending |
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

## Beta entry point — web-first (2026-06-21)

Focus shifted from the Android APK to the browser client at **https://beta.akalynth.com/play/**
("use webclient first"). `/play/` is live (HTTP 200, serves the debug-client build).

- **Site source is a SEPARATE repo:** `github.com/akalynth/akalynth-site` (cloned at
  `repos/akalynth-site` here and on ops-dev-01). The game monorepo's `infra/web/beta/` is **not**
  what's deployed. Site is published with `bin/akalynth-site-publish.sh beta <commit>` (clones the
  pinned commit, backs up, rsyncs to `/var/www/akalynth-beta`, validates + reloads Caddy).
- **`main` is branch-protected** (PR + `site-checks` status check; no direct push).
- **DONE — PR [#74](https://github.com/akalynth/akalynth-site/pull/74) merged + deployed**
  (`e19798b`): `index.html` + `beta.html` lead with **Play in browser ▶** → `/play/`; F-Droid/APK
  demoted to "Or get the Android client". Published to beta 2026-06-21
  (`site-beta-publication-20260621T032444Z`); verified live — landing + beta page show the browser
  CTA, `/play/` 200, APK still reachable (demoted). Rollback tar in
  `/var/backups/akalynth-beta-site/`.
- **Re-publish pattern:** `gh pr merge <n> --squash` then
  `sudo bin/akalynth-site-publish.sh beta <merged-sha>` (`--dry-run` first).
- **Follow-up:** `akalynth-site/js/app.js` account-portal CTAs still say "Download the Android beta
  to play" — left untouched (that file has unrelated in-progress library-discovery edits in the
  working tree; separate cleanly before editing).

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

## Open / next work (as of 2026-06-22 handoff)

1. **Merge PR #348** (web `/play/` UI polish → main) once CI is green — completes the
   2026-06-22 set. Then `origin/main` fully matches what's live on beta.
2. **Full clean deploy of beta from `origin/main`** to reconcile the two `/opt/akalynth-beta`
   hotfix drifts (Origin Act server fix + UI CSS). Use the supported publish flow
   (`bin/akalynth-lane-deploy.sh beta publish-account-play`) — needs explicit auth.
3. **Chronicle-rust now on main (`crates/chronicle/`).** It was previously *parked* as
   premature; reconciled via #346. The CI fixture generator runs via tsx; the Rust parity
   gate still needs a `cargo` toolchain on the runners before it can run (per chronicle
   `CI_WIRING.md`). Decide whether to wire it or leave the crate inert.
4. **Chill-zone refine step 4** — economy/Tem tuning + enable `CHILL_ZONE_REFINE_ENABLED=1`
   on beta. (Beta already has the gather+refine flags on per `systemctl show`.) Steps 1-3 done.
5. **Prod** — every 2026-06-22 change is **beta-only**; prod (`/opt/akalynth`, `api.akalynth.com`)
   is a separate host and has NOT received any of it.

---

## Claude / Codex agent setup

- **Canonical skills:** `repos/akalynth/.claude/skills/` (21 stewards + `akalynth-continue` + `goal0-akalynth-integration`)
- **User mirror:** symlink `~/.claude/skills/akalynth-continue` → repo skill (see `scripts/sync-claude-continue-skill.sh`)
- **Entry:** `CLAUDE.md` and `AGENTS.md` in repo root; this file loaded via `akalynth-continue` skill

When you finish a milestone, bump **Last updated** and edit the tables above — do not fork handoff into random markdown elsewhere.