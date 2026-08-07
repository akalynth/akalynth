# AKALYNTH_BETA_REFRESH_V5_AND_PUBLIC_PROJECTION_POSTMORTEM_20260709

**Classification**: BOUNDED_POSTMORTEM_RUNBOOK_DOCS_ONLY (post-apply record)

**Date**: 2026-07-09

**Status**: POSTMORTEM_RUNBOOK_APPLY_READY → applied

## 1. Timeline of the beta refresh line

- **Pre-2026-07-09**: Beta runtime at ~4aef0a96. Schema drift history (origin act V22, reconcile to c537ce0, UI polish). Android progressed to direct v12 channel independently. Public site used undifferentiated "Android client" language. F-Droid at v5 with placeholder metadata.
- **2026-07-09 early**: Schema25 source recovery (AKALYNTH_SCHEMA25_SOURCE_RECOVERY_APPLY_V1). Evidence packet revealed provenance gap: deployed /opt had SCHEMA_VERSION=25 + migrateToV25 + Outfits; git/source at labeled commits was 24. No git commit carried schema 25 source.
- **V3 attempts (54c6 target)**: Multiple staging/preflight runs (e.g. 20260709T014000Z.json, preflight-test). 54c6 (SCHEMA_VERSION=24) failed staging_preflight or post-deploy. Attempted apply: stage preflight (ws + native + layout) passed in :memory:, but live rollout hit "Schema version too new: db=25 code=24" in persist/schema.js. Pod → CrashLoopBackOff. Rollback to 4aef0a96 performed. Receipt: 20260709T003838Z-V3-apply.json (ROLLBACK_COMPLETED).
- **Schema reconstruction V3 fixes**: TS2345 (`const adds: [string, number][]`), prior casts for unknown types. Rebuilt clean target matching deployed 25 + v12 JSON.
- **Containerized Node 24 build**: Pinned node:24.15.0-bookworm-slim (per .nvmrc), npm ci --ignore-scripts + rebuild better-sqlite3 + build:packages + server tsc. Image 25c9b6e0d7c2. Evidence in infra/docker/server-node24-build.Dockerfile references and build logs.
- **V5 success (47690e84c797d5f183b42f2c47a9b19a4ea6e86d)**: Full staged preflight (BUILD_INFO match, SCHEMA=25 vs live DB=25 gate, ws OK, native OK, v12 present) → publish_lane (rsync /opt, rollout, caddy). Receipt: 20260709T0150Z-V5.json (PASS, pod 1/1 Running, live health match). Rollback backup created but not used.
- **Android separation**: Direct v12 (versionCode 12, separate signer) verified via manifest + health + APK URL. F-Droid intentionally held at v5.
- **F-Droid hold record**: 20260709T030500Z-FDROID-HOLD.json. Explicit blocker FDROID_SIGNING_AUTHORITY_STILL_AMBIGUOUS. No mutation.
- **Public projection claim repair**: Wording issues identified in review (undifferentiated Android, missing hold note). PR merged to 9fdab54 (AKALYNTH_PUBLIC_PROJECTION_CLAIM_REPAIR_V1). Bounded static deploy only (rsync index.html/beta.html/account.html to /var/www/akalynth-beta). Post-deploy review (AKALYNTH_PUBLIC_PROJECTION_POST_DEPLOY_REVIEW_V1) passed.
- **Post-deploy**: Live site serves separated claims. All receipts/continuation updated. Git lane records (d97e5a6 V5, 324fe96 F-Droid, 9fdab54 public).

Live final: beta 47690e84..., direct v12, F-Droid v5 held, public wording clean.

## 2. Failed attempts and what each revealed

- **Schema provenance attempts**: Revealed deployed artifact (25) vs git (24) gap. BUILD_INFO label insufficient for reproducible source. Led to artifact-driven reconstruction requirement.
- **54c6 V3 staging/preflight fails**: Multiple receipts showed "staging_preflight" FAIL for 54c6. Revealed need for strict staging before any live touch and better artifact layout validation.
- **54c6 apply + rollback**: Pre :memory: preflight missed persisted DB schema check. Post-rollout error + CrashLoop. Revealed missing schema compatibility gate against live DB (current > target must block). Rollback worked cleanly when evidence preserved first.
- **Container / host build issues (prior to pinned Dockerfile)**: ABI/gyp errors (node 24.17 vs 24.15), missing node_modules in clean worktrees. Revealed host build env insufficiency; mandated containerized pinned Node 24 + rebuild step.
- **Public projection**: Undifferentiated "or get the Android client" + missing F-Droid hold note. Revealed claim ambiguity risk; required dedicated review + repair + deploy lane before any public change.
- **General**: Early attempts lacked full evidence packets, continuation updates, and bounded lanes. Failed attempts produced rollback backups and failure traces that informed durable controls.

## 3. Root causes discovered

- Incomplete artifact layout (missing node_modules, dist overlay, manifests in early stages).
- Native module runtime mismatch (better-sqlite3 ABI requiring explicit rebuild in container).
- Schema regression against live DB (target 24 < persisted 25; :memory: preflight insufficient).
- Host build environment insufficiency (variable Node versions, no pinned Dockerfile enforcement early).
- Public projection claim ambiguity (no separation of browser beta / direct Android v12 / F-Droid hold; overclaim risk).

## 4. Controls added

- **Staged publish path**: Always prepare_staged_release (rsync clean monorepo + dist + materialized node_modules from lockfile source) to /tmp/... before any /opt mutation. Requires .preflight-passed sentinel.
- **Pod-equivalent runtime preflight**: run_preflight_in_stage using pod_node: ws resolve, entrypoint layout + ws import check, BUILD_INFO sanity, Android JSON presence, schema/DB compare.
- **better-sqlite3 native load check**: Explicit npm rebuild + resolution test in container and stage.
- **Schema compatibility gate**: Compare target SCHEMA_VERSION vs live persisted DB (block if target < current). Added after 54c6 failure.
- **Containerized Node 24 build path**: server-node24-build.Dockerfile pins 24.15.0, full ci/rebuild/build sequence. Produces reproducible dist.
- **F-Droid hold record**: Dedicated lane + receipt documenting v5 vs v12, separate signers, ambiguous authority, no mutation.
- **Public projection claim repair + bounded deploy**: Separate review lane → repair PR → static-only rsync deploy (no runtime/APK/F-Droid touch) + post-deploy verification of wording.

Gates (G1-G9+ in akalynth-publish-gates.sh): G1 intended commit, G2/G3 BUILD_INFO + dist match, G4 health commit, G5/G6 APK disk+URL, G7 k8s parity + android manifest, G8 codex healthy, manifest/site dist checks, plus staging preflight.

## 5. Final V5 success path

1. Schema25 V3 reconstruction (source fixes for TS errors) + v12 JSON in target.
2. Container build (node 24.15.0, npm ci --ignore-scripts + rebuild + tsc) → image 25c9b6e0d7c2, dist verified.
3. Stage prepare (clean layout).
4. Full preflight (ws, layout, BUILD match, schema 25==live DB 25, native).
5. Publish (rsync /opt, chown, k8s rollout, caddy reload).
6. Post checks: health commit match, pod 1/1, Android v12 parity, rollback backup preserved (unused).
7. Public wording repaired and deployed separately.
8. Receipts + continuation updated. F-Droid held.

Result: live 47690e84c797d5f183b42f2c47a9b19a4ea6e86d, PASS.

## 6. Evidence and receipt index

- V5 publish: `docs/evidence/publish-beta/20260709T0150Z-V5.json` (PASS, intended 47690e84, android 12, pod 1/1, rollback backup noted).
- V3 rollback: `docs/evidence/publish-beta/20260709T003838Z-V3-apply.json` (ROLLBACK_COMPLETED, failure "db=25 code=24", traces in /tmp/refresh-failure-evidence-20260709T003748Z).
- Staging fails: `docs/evidence/publish-beta/20260709T014000Z.json`, `preflight-test-20260709T014439.json`.
- Schema recovery packet: `docs/evidence/schema25-source-recovery/20260709T0059Z/` (MANIFEST.txt, comparison.txt "dist 25 vs source 24", 54c6-blocked.txt, db-schema 25, health/build-info at 4aef0a96, android-v12.json, sha256s).
- F-Droid hold: `docs/evidence/fdroid-refresh-hold/20260709T030500Z-FDROID-HOLD.json` (v5 details, v12 direct, policy, safe/forbidden, no mutation).
- Public deploy: `docs/evidence/public-projection-deploy/20260709T0256Z-PUBLIC-PROJECTION-DEPLOY.json` (commit 9fdab54, 3 HTML files only, pre/post checks, non-claims).
- Post-deploy review: referenced in prior lane outputs + live verification.
- Continuation: `.claude/skills/akalynth-continue/references/CONTINUATION_STATE.md` (V3 abort, V5 success, F-Droid hold, safe claims).
- Container/Docker: `infra/docker/server-node24-build.Dockerfile` (and related).
- Rollback backups: `/opt/akalynth-beta.pre-refresh-20260709T015050Z` (V5), `...003647Z` (V3).
- Git lane records: 47690e84 lineage, d97e5a6 (V5 record), 9fdab54 (public repair).
- Live verification: beta-api /v1/health, beta.akalynth.com (wording), APK sizes/times (direct ~42MB vs F-Droid ~12MB).

## 7. Safe claims and forbidden claims

**Safe claims (post V5 + public repair + hold):**
- Live beta V5 refresh passed (commit 47690e84c797d5f183b42f2c47a9b19a4ea6e86d, schema 25, pod 1/1 Running).
- Direct Android beta channel is independently v12 (verified APK URL/SHA, manifest, separate signer).
- F-Droid remains separate/divergent (v5 held pending signing authority, older version, explicitly "not synchronized").
- Public site wording clearly separates: browser "current pre-alpha beta", "Direct channel (current v12)", "Android options (separate channels)", "F-Droid ... held pending signing authority ... It is not synchronized with the current beta."
- Schema 25 provenance closed for V5 target via reconstruction + container build + preflight.
- Staged publish + preflight + gates enforced for V5.
- Rollback capability preserved; evidence chain complete.
- No F-Droid mutation, no private key access, no cross-signer reuse.
- Public projection review/deploy passed with no overclaims.

**Forbidden claims:**
- F-Droid is refreshed / aligned / v12 / launch-ready.
- Android channels synchronized or "the" Android client undifferentiated.
- Akalynth (beta or overall) launch-ready.
- Schema 25 source always clean in git at deployed commit (pre-recon).
- All WIP (Android tests, debug-client, etc.) resolved by V5.
- Git push or full custody occurred (local edits only).
- Existing F-Droid keystore approved or direct signer reusable for F-Droid.
- Future beta refresh can skip staging/preflight/gates/evidence.
- Public projection "complete" without process.

## 8. Remaining unresolved surfaces

- F-Droid signing authority/custody (ambiguous; v5 frozen; separate path required).
- Git custody/push (lane records local; no push in these ops).
- In-flight WIP (Android client tests/mods, debug-client, protocol, builder, etc.; worktrees present).
- Public projection future changes (now clean; require review/deploy lane).
- Launch readiness (pre-alpha / controlled beta explicitly).
- Full cross-surface alignment or single "beta" identity (deliberately separated).
- Long-term Android/F-Droid resolution post-signing authority.

---

**End of postmortem.** See runbook for future refresh requirements. All data derived from inspected receipts, continuation, live state, and scripts. No runtime or source mutation in this record.
