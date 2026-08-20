# Akalynth continuation state

Last updated: **2026-08-20** (origin point: archived public repo at `1f0e71b`; no in-repo product lane is open).

Read this before implementing. For skill routing see `AGENTS.md` and `.codex/CODEX_MAP.md`.
Binding claim order: `docs/CURRENT_STAGE.md` → `docs/KNOWN_GAPS.md` → `docs/V1_SCOPE.md` → a named verifier on a named commit.
Standing architect map: `.claude/skills/akalynth-architect/references/CURRENT_BRIEF.md`.

**Sections dated before 2026-08-20 are historical ops handoff.** They describe beta V5, F-Droid hold, and Frozen First Playable Proof A1 as those lanes existed when they were live. They are **not** current work orders. Infra is decommissioned. Do not deploy, restart beta, inspect keystores, or treat A2 as next.

---

## 2026-08-20 — Origin point (archived portfolio)

**Status:** `PORTFOLIO_READY` / `PUBLICATION_GATE_PASSED` / `INFRA_DECOMMISSIONED`

**Probed this session (2026-08-20):**

- `main` HEAD `1f0e71b` — `docs(archive): decommission receipts, accepted disclosures, 10/10 presentation` ([PR #431](https://github.com/akalynth/akalynth/pull/431))
- Prior archive merge: `9cadd35` ([PR #430](https://github.com/akalynth/akalynth/pull/430))
- GitHub `akalynth/akalynth`: **public**; description empty; topics unset
- Open GitHub issues: 0
- Open pull requests: 0
- Linear Akalynth issues: 0

**What this origin authorizes**

- Read-only orientation and local verification of the archived tree
- Handoff and docs hygiene so agents do not reopen closed lanes
- Owner-requested metadata, LinkedIn, or provider actions only when explicitly asked

**What this origin forbids**

- New product development, roadmap, experiments, or commercial activity
- A2–A5 (trusted proof-manifest install, beta restart, live cohort)
- Beta or prod deploy, `/opt/akalynth*` mutation, signing-keystore inspection
- F-Droid publication or signer reuse
- Claims of launch-ready, content-alpha, or an operating company

**Remaining owner-side (not granted by "Start")**

1. Off-box copy of the retire archive and remanifest at the destination
2. Provider console: destroy the two decommissioned VMs; delete recorded Akalynth DNS
3. GitHub description and topics (still empty on the now-public repo)
4. LinkedIn: title **Akalynth — Server-Authoritative MMO Prototype**, January 2026 – August 2026, not currently active

**Safe claims**

- Akalynth is a completed historical engineering project and a public portfolio repository
- The source vertical slice and first-playable harness remain in tree (`npm run verify:beta-first-playable-proof` is a local loopback proof, not a live-beta claim)
- Publication gate passed by the accepted WitnessOps-hostname disclosure; the private → public flip is done

**Forbidden claims**

- Live beta or prod is up
- F-Droid aligned or refreshed
- A2 is next
- Continuation history below this section is a current work queue

---

**Postmortem / Runbook cross-ref (AKALYNTH_BETA_REFRESH_POSTMORTEM_AND_RUNBOOK_APPLY_V1)** — historical:
- Postmortem: `docs/postmortems/AKALYNTH_BETA_REFRESH_V5_AND_PUBLIC_PROJECTION_POSTMORTEM_20260709.md` (timeline, failures 54c6/V3, root causes, controls, V5 success, evidence index, safe/forbidden claims, unresolved).
- Runbook: `docs/runbooks/beta-refresh-runbook-v1.md` (preconditions, target rules, build/container, stage/preflight, schema gate, Android separation, F-Droid hold, public claim rule, rollback, receipts, hard stops).
- Evidence summary: `docs/evidence/beta-refresh-v5-postmortem-summary.json`.
- All future beta refreshes must follow these + gates + continuation.

---

## 2026-08-12 — Frozen First Playable Proof A1 source lane

**Status:** SOURCE_IMPLEMENTED_AND_LOCALLY_VERIFIED; runtime execution remains
unauthorized.

- Plan: `docs/FROZEN_FIRST_PLAYABLE_PROOF_PHASE_PLAN_V1.md`.
- Source branch: `codex/frozen-first-playable-proof-v1`.
- Added a database-free beta release-manifest preimage materializer/verifier.
  Proof and invite-enabled pilot policy produce distinct canonical digests.
- Added one credentialed first-playable harness for account entry, the six
  Rookguard marks, High City gather/refine/deliver, fresh-token reconnect,
  Chronicle restoration, and redacted receipt boundaries.
- The focused verifier runs the whole journey against a fresh loopback server,
  then verifies the isolated signed receipt chain. It performs no beta writes.
- Primary gate: `npm run verify:beta-first-playable-proof`.
- No protocol, receipt schema, economy, combat, anti-cheat, database schema,
  deployment, active manifest, invite, or cohort behavior changed.
- Next authority at the time was A2: trusted proof-manifest installation and
  beta restart. **A2 was never granted and is closed at archival (2026-08-20).**

---

## 2026-07-09 — F-Droid Refresh Hold — FDROID_REFRESH_HELD_PENDING_SIGNING_AUTHORITY

**F-Droid current state:** versionCode 5, versionName "0.1.3-beta-harvest", signer `b58026521f3df84808a2d18d586267c5d4021557ab82e016e5639dad2ab91442`, APK SHA `da7086149d0c3eb64dc72411a19e8dd91c8e454c0ac4d6ff5b15e567318b0bdc` (at /var/lib/akalynth-fdroid/public/fdroid/repo/akalynth-beta.apk). Metadata yml uses placeholder CurrentVersionCode 2147483647.

**Direct Android v12 channel:** versionCode 12, SHA `99be43cf5467746f7f768ef7172cde617acb866b7546c34974d1ec35658bc1ac`, separate signer `df2acbbf9140f61507623b68268372ee368c7abf0c070a613c47bb791787d5cd`. Remains valid and independently refreshed (V5 target `47690e84c797d5f183b42f2c47a9b19a4ea6e86d`, status PASS).

**Blocker:** FDROID_SIGNING_AUTHORITY_STILL_BLOCKED

**Hold record update (AKALYNTH_FDROID_HOLD_RECORD_UPDATE_APPLY_V1):** See 20260709T050000Z-FDROID-HOLD-UPDATE.json. Repo/index key (7517DE35...) and F-Droid v5 APK signer (b58026...) are distinct. Direct v12 signer (df2acbb...) is separate and must not be reused. Existing custody remains insufficiently evidenced (private_keys_accessed=false, signing_key_custody_inspected=false). No continuity proof for v12 on F-Droid. Rotation would require reinstall/new trust line for F-Droid users. Signer age does not equal authority. F-Droid stays held.

**Signing policy (AKALYNTH_ANDROID_SIGNING_POLICY_V1):** private_keys_accessed: False, signing_key_custody_inspected: False, cross_channel_signer_aligned: False. "Signing key custody was not inspected." "This document freezes trust rules... does not authorize signing, keystore access, builds, or publish actions." F-Droid channel authority: fdroid_client. Direct channel separate.

**Keystore:** /var/lib/akalynth-fdroid/public/fdroid/keystore.p12 exists (0600, sovereign, size 4340) but no custody approval or usage documentation found. Not inspected.

**No F-Droid mutation occurred.** Refresh intentionally held. Direct v12 key must not be reused.

**Safe claims:**
- Direct Android beta channel is v12.
- F-Droid remains separate/divergent.
- F-Droid refresh is held pending signing authority.
- No private signing material was inspected.
- No F-Droid publication occurred.

**Forbidden claims:**
- F-Droid is refreshed.
- F-Droid is aligned with direct channel.
- F-Droid v12 is available.
- Existing keystore is approved for use.
- Direct-channel signer can be reused.
- Channels are launch-ready.

**Future authority options:**
- Establish F-Droid key custody through an approved human/operator authority path.
- Rotate F-Droid signer through a separate governed lane.
- Keep F-Droid frozen.

**Evidence:** See dedicated hold record in docs/evidence/fdroid-refresh-hold/

---

## 2026-07-09 — Beta Refresh V5 (schema25 V3 target) — SUCCESS / LIVE_BETA_REFRESHED_V5_PASS

**Current live beta runtime:** `47690e84c797d5f183b42f2c47a9b19a4ea6e86d`

**Container image:** `25c9b6e0d7c2`

**Status:** LIVE_BETA_REFRESHED_V5_PASS

**Proof path:** schema25 source reconstruction (V3 with TS2345 fix `[string, number][]` + prior casts) → Node 24.15.0 container build (image 25c9b6e0d7c2, npm ci + rebuild + tsc success) → staged preflight (BUILD_INFO match, SCHEMA_VERSION=25, live DB=25, schema gate PASS, ws OK, better-sqlite3 native OK, v12 JSON present) → live rollout to /opt/akalynth-beta

**Receipt / evidence:** `docs/evidence/publish-beta/20260709T0150Z-V5.json`

**Rollback:** backup `/opt/akalynth-beta.pre-refresh-20260709T015050Z` created and preserved; rollback **not invoked** (success path).

**Android direct channel:** v12 live/intended (`version_code: 12`); APK URL/SHA verified (HTTP 200, matching sha256).

**Pod status:** 1/1 Running, no CrashLoopBackOff.

**Note on prior V3 abort (54c6):** That attempt used a non-schema25 target (code=24 vs DB=25) and was rolled back. The successful V5 used the corrected schema25 V3 reconstruction target that passed all gates.

**Current safe claims (post V5):**
- LIVE_BETA_REFRESHED_V5_PASS: live beta healthy, pod 1/1 Running, reports V5 target `47690e84c797d5f183b42f2c47a9b19a4ea6e86d`.
- Schema 25 source provenance closed via AKALYNTH_SCHEMA25_SOURCE_RECONSTRUCTION_V3 (TS fixes) + container build + full preflight.
- Direct Android v12 channel live and verified (APK URL/SHA match).
- Rollback backup preserved but not needed.
- Container-built artifact (image 25c9b6e0d7c2) successfully deployed.

**Forbidden claims:**
- F-Droid aligned with v12 or runtime line
- public projection / safety review completed
- game launch-ready
- all WIP (Android/debug-client/outfit/economy/etc) resolved by this refresh
- git pushed (local edit only)
- continuation represents full resolution of all surfaces

**Standing beta target policy (updated post-V5):** Beta is now on the V5 schema25 container-built target. F-Droid, public site projection, and unrelated WIP remain separate unresolved surfaces and require their own lanes. No automatic alignment assumed.

**Evidence references (V5):**
- V5 receipt: `docs/evidence/publish-beta/20260709T0150Z-V5.json`
- Stage: `/tmp/akalynth-schema25-v3-dist`
- Build log: `/tmp/schema25-v3-build.log`
- Rollback backup: `/opt/akalynth-beta.pre-refresh-20260709T015050Z`
- Post-refresh /opt BUILD_INFO and pod confirm V5 target.

---

## 2026-07-09 — Beta Refresh V3 (54c6 target) — ABORTED / ROLLBACK COMPLETED (historical)

**Live beta runtime (healthy, post-rollback):** `4aef0a96aed14fa043a43aae5ed980c75a5cb1b3` (superseded by V5)

**Failed target:** `54c6d37c4cfd5f70bbf3a2e911587dc13f2fb4fc`

**Block reason:** target SCHEMA_VERSION = 24 < live persisted DB schema = 25. 54c6 is **not deployable** against the current beta DB.

**Decision:** beta refresh line aborted.

**Classification:** SCHEMA25_ONLY_DEPLOYED_ARTIFACT_FOUND

**Schema 25 provenance gap:** Schema 25 is evidenced **only** in the healthy deployed `/opt/akalynth-beta` artifact (dist has 25 + `migrateToV25` / Outfits engine; source files at the labeled commit and inside snapshot trees are 24). BUILD_INFO commit label alone is **not sufficient proof** of reproducible source state for the current schema-25 runtime.

**Android v12 channel:** Live and serving independently (`version_code: 12`, correct APK URL/SHA). The direct channel is intentionally ahead of / separate from any runtime refresh. F-Droid remains separate/divergent.

**Preflight gates (now durable):** block incomplete runtime artifact layout, ws/runtime dependency resolution failure, better-sqlite3 native load failure, **and** persisted DB schema regression (current > target) **before** live mutation.

**V3 attempt summary:**
- Used verified native stage `/tmp/akalynth-native-stage-20260709T015500Z` (BUILD 54c6, v12 JSON present, ws + native preflight passed).
- Deploy (rsync + chown + rollout) produced: `Error: Schema version too new: db=25 code=24` (in `persist/schema.js:472` during `initSchema` / `createPersistenceLayer`).
- Pod: Error → CrashLoopBackOff (restarts observed in traces).
- Failure evidence preserved **first**: `/tmp/refresh-failure-evidence-20260709T003748Z/` (pods, logs, opt-BUILD 54c6, events, bg traces).
- Rollback: restored exact pre-refresh backup `/opt/akalynth-beta.pre-refresh-20260709T003647Z` + restarted deployment only.
- Post-rollback: health `4aef0a96`, pod 1/1 Running, v12 still 12.
- Receipt: `docs/evidence/publish-beta/20260709T003838Z-V3-apply.json` (status: `ROLLBACK_COMPLETED`).

**Current safe claims (historical for this aborted attempt):**
- Akalynth beta service is healthy at 4aef0a96 (pre-V5).
- 54c6 refresh attempts failed and were rolled back cleanly.
- 54c6 (schema 24) was not deployable against the current persisted beta DB (25).
- (See new V5 section above for current state; provenance gap addressed via schema25 V3 recon + container build.)

**Forbidden claims (historical):**
- beta is refreshed to 54c6
- 54c6 or current HEAD (at time) is deployable
- schema 25 has clean source provenance in git (pre-V3 recon)
- continuation state represents a successful runtime refresh (this attempt)

**Standing beta target policy:** See updated policy in V5 success section above. The 54c6 attempt is superseded.

**Evidence references:**
- V3 receipt + rollback record: `docs/evidence/publish-beta/20260709T003838Z-V3-apply.json`
- Failure traces: `/tmp/refresh-failure-evidence-20260709T003748Z/` (pod-logs showing exact "db=25 code=24" error, bg-poll-trace showing CrashLoopBackOff → rollback pod, opt-BUILD 54c6)
- Rollback backup: `/opt/akalynth-beta.pre-refresh-20260709T003647Z`
- Stage used: `/tmp/akalynth-native-stage-20260709T015500Z`
- Preflight repair (schema gate + native): committed locally in ops tooling (see prior lanes)

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

**Beta runtime — RECONCILED (clean deploy done 2026-06-22).** The two `/opt/akalynth-beta`
hotfix drifts (Origin Act server fix + UI `/play/` CSS) were folded into a full clean deploy
from `origin/main`: `/opt/akalynth-beta` hard-reset `bceaf10 → c537ce0` (via bundle, since the
host has no GitHub remote and the squash-merge was non-fast-forward), then
`bin/akalynth-lane-deploy.sh beta publish-account-play` rebuilt + restarted + republished
`/play/` + ran the live smoke. **Verified:** beta-api/web/`/play/` all 200, DB still
`schema_version=22` (606 players, no spurious migration), `smoke:beta-account-play` pass
(28 checks). Now running build `c537ce05 (main)`. Evidence:
`evidence/20260622T121804Z-beta-publish-account-play/`. **`/opt` is clean at `origin/main`** —
no more drift.

---

## Git / release line

| Item | Value |
|------|--------|
| Repo | `https://github.com/akalynth/akalynth` (public; description and topics still empty) |
| Branch | `main` |
| Head | `1f0e71b` — docs(archive): decommission receipts, accepted disclosures, 10/10 presentation (#431) |
| Last merged | #430 portfolio archive (`9cadd35`) → #431 decommission receipts + presentation (`1f0e71b`). Historical 2026-06-22 line (`c537ce0`) is superseded. |
| Local source | this checkout; historical ops path `/home/sovereign/akalynth-ops/repos/akalynth` is not this Cloud workspace |

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

## AZURA_LOOP_ALIVE_V1 (2026-06-23 strike)

**Ticket:** one vertical slice — Rookguard-cleared player completes gather → refine → deliver on
Azura via `/play/`, with live smoke + evidence.

| Phase | Status | Artifact |
|-------|--------|----------|
| T1 beta probe | pending on ops-dev-01 | `evidence/20260623T114341Z-azura-loop-alive/beta-probe.txt` |
| T2 live smoke | **landed** (unproven live) | `scripts/smoke-beta-azura-loop.mjs`, `npm run smoke:beta-azura-loop` |
| T3 web UX | **landed** | `gatherLabels.ts`, `GatherPanel.tsx`, mobile `.gather-card` CSS |
| T4 Azura flavor | **landed** | spawn lore + panel title "Ley Mote Tending" |
| T5 live proof | **blocked here** | run on ops-dev-01: `npm run smoke:beta-azura-loop:browser` |
| T6 evidence | **partial** | `evidence/20260623T114341Z-azura-loop-alive/receipt.json` |

**Close gate:** green `smoke:beta-azura-loop` on beta + screenshot in evidence folder + publish
`/play/` UI if not already deployed.

---

## Open / next work (historical 2026-06-23 list — closed at archival)

The 2026-06-23 queue is **not current**. Infra is decommissioned; no beta or prod
lane is live. Remaining work is owner-side only (see the 2026-08-20 origin-point
section). Historical close notes below are retained as record.

1. ~~**Merge PR #348** (web `/play/` UI polish)~~ — done (`0504381`).
2. ~~**Full clean deploy of beta from `origin/main`**~~ — done 2026-06-22; later
   superseded by V5 then by 2026-08-20 decommission.
3. ~~**AZURA_LOOP_ALIVE_V1 — publish + live proof**~~ — closed with archival;
   do not run live smokes against retired hosts.
4. ~~**Chronicle-rust CI cargo gate**~~ — closed with archival.
5. ~~**Chill-zone refine step 4**~~ — done (#332) while beta existed.
6. ~~**Prod**~~ — never received the 2026-06-22+ line;
   `PROD_CHAIN_UNPRESERVED_UNRECOVERABLE_ACCEPTED`.

---

## Claude / Codex agent setup

- **Canonical skills:** `repos/akalynth/.claude/skills/` (21 stewards + `akalynth-continue` + `goal0-akalynth-integration`)
- **User mirror:** symlink `~/.claude/skills/akalynth-continue` → repo skill (see `scripts/sync-claude-continue-skill.sh`)
- **Entry:** `CLAUDE.md` and `AGENTS.md` in repo root; this file loaded via `akalynth-continue` skill

When you finish a milestone, bump **Last updated** and edit the tables above — do not fork handoff into random markdown elsewhere.
