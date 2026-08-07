# beta-refresh-runbook-v1.md

**AKALYNTH BETA REFRESH RUNBOOK V1**

**Scope**: Runtime beta lane (browser + direct Android v12). Separate from F-Droid (held), public projection (bounded review/deploy), and WIP surfaces.

**Authority**: Execute only under approved lanes (e.g. AKALYNTH_BETA_REFRESH_..._APPLY_V1). No ad-hoc or merge-triggered publishes. Read this + continuation + all evidence first.

## 1. Preconditions before any beta refresh

- Read `.claude/skills/akalynth-continue/references/CONTINUATION_STATE.md` (current live commit, V5 policy, safe/forbidden claims, F-Droid hold, public state).
- Read latest postmortem (`docs/postmortems/AKALYNTH_BETA_REFRESH_V5_AND_PUBLIC_PROJECTION_POSTMORTEM_20260709.md`) and this runbook.
- Confirm current live: `curl https://beta-api.akalynth.com/v1/health` (commit + schema).
- Git: clean or accounted WIP; note any worktrees. Use `git status --porcelain`.
- Evidence dir writable for new receipts: `docs/evidence/publish-beta/`.
- No pending F-Droid or public changes without their lanes.
- Target commit must include schema25 source + v12 JSON parity.
- Rollback capability confirmed (prior backups exist; test procedure mentally).

Hard stop if preconditions fail.

## 2. Required target selection rules

- Must be schema25 (SCHEMA_VERSION=25 + migrateToV25 + outfit_color_* columns + Outfits engine).
- Must contain matching `infra/android/beta-client-update.json` with version_code 12 (direct channel).
- Verify vs live DB: target schema >= live persisted (never regress). Use preflight.
- Prefer container-built artifact over host-built.
- Do not select targets with known 54c6-class schema mismatch (24 vs 25).
- Record intended full SHA in every receipt and continuation update.

## 3. Build requirements

- Use pinned Node 24.15.0 (from .nvmrc).
- Lockfile-bound: `npm ci --ignore-scripts`.
- Native rebuild: `npm rebuild better-sqlite3`.
- Full: `npm run build:packages && npm -w apps/server run build`.
- Verify: `test -f dist/server/apps/server/src/index.js`, BUILD_INFO.json present with commit, Android manifest present.
- Host build discouraged for production lanes; prefer container.

## 4. Container build requirements

- Use `infra/docker/server-node24-build.Dockerfile` (or equivalent pinned 24.15.0-bookworm-slim).
- Steps inside container:
  - apt deps for native (python3, make, g++).
  - COPY source + lockfiles.
  - npm ci --ignore-scripts.
  - npm rebuild better-sqlite3.
  - build:packages + server build.
  - Verify outputs + package.json copies for workspace resolution.
- Output: dist/ artifact + BUILD_INFO.
- Tag image (e.g. 25c9b6e0d7c2 for V5 reference).
- Extract dist for staging (never run runtime from build image unless separate runtime stage).

## 5. Stage/preflight requirements

- **Always stage first** (never mutate /opt or rollout without verified stage).
- Command pattern (from beta-publish.sh):
  - `prepare_staged_release <intended>`:
    - rm -rf /tmp/akalynth-beta-stage-...
    - rsync monorepo (exclude .git .github apps/android verify-out .tmp node_modules) to stage.
    - Overlay dist/ from source.
    - Copy manifests (package.json, package-lock, server package.json).
    - Materialize node_modules from lockfile-resolved source (or healthy /opt copy for demo).
    - Require `dist/server/apps/server/src/index.js`.
  - `run_preflight_in_stage <stage>` (pod-equivalent node):
    - ws resolve test (`require.resolve("ws")`).
    - entrypoint layout + ws import check (non-listening).
    - BUILD_INFO present + commit sane.
    - Android beta update JSON present + version_code.
    - Schema compatibility: target SCHEMA_VERSION vs live DB (block if regression).
    - better-sqlite3 native load / :memory: test.
    - Any additional (k8s parity, codex healthy via gates).
  - Touch `.preflight-passed`.
- Use `--stage-only` or gate-only mode for verification.
- Only proceed if preflight PASS. Hard stop on any failure.

## 6. Schema compatibility requirements

- Gate: persisted DB schema_version (from live health or direct query) <= target SCHEMA_VERSION.
- After 54c6 failure: schema gate is mandatory and must run against real DB (not just :memory:).
- If target < live: block, abort, record, rollback if partial.
- Record in receipt and continuation: "schema gate PASS" + versions.
- For schema25: confirm migrateToV25 + 4 outfit_color_* columns present in dist.

## 7. Runtime dependency requirements

- ws: must resolve in stage (critical for server).
- better-sqlite3: native rebuild + load test required.
- Full node_modules from lockfile (or verified copy).
- Server entrypoint: dist/server/apps/server/src/index.js + required imports.
- Android manifest + debug-client dist + site index.html presence (G2 checks).
- No drift: dist BUILD_INFO must match intended.

## 8. Android direct-channel separation

- Direct v12 is independent of runtime beta commit.
- Verify: `beta-client-update.json` version_code=12, APK URL/SHA match on disk + HTTP, live API reports same.
- Do not mutate direct APK or update JSON in runtime refresh lane.
- Self-update resolver routes F-Droid vs direct appropriately.
- Record in every receipt: "android_version_code": 12, "apk_url", sha if known.
- Never claim synchronization with F-Droid.

## 9. F-Droid hold rule

- F-Droid is held pending signing authority (v5 vs direct v12).
- No F-Droid refresh, index update, signing, or metadata mutation in beta runtime lanes.
- Reference hold receipt: `docs/evidence/fdroid-refresh-hold/20260709T030500Z-FDROID-HOLD.json`.
- Safe: "F-Droid remains separate/divergent", "held pending signing authority".
- Forbidden: any claim of alignment, refresh, v12 on F-Droid, keystore approval.
- Future F-Droid action requires separate approved lane (e.g. AKALYNTH_FDROID_SIGNING_CUSTODY...).

## 10. Public projection claim rule

- Public site (akalynth-site) is separate repo and deployment target.
- Any wording change requires: review lane → claim repair if needed → bounded static deploy only (no runtime/APK/F-Droid/k8s).
- Current (post 9fdab54 + deploy): browser beta as "current pre-alpha", direct v12 explicit, F-Droid "held pending... not synchronized", "Android options (separate channels)".
- Verify post any public change: curl/grep for separation phrases; no old undifferentiated claims.
- Reference: public-projection-deploy receipt + post-deploy review.
- Never deploy public changes as side-effect of beta runtime publish.

## 11. Rollback procedure

- Pre-any mutation: create backup `cp -a /opt/akalynth-beta /opt/akalynth-beta.pre-refresh-${STAMP}`.
- On failure (post-deploy health != intended, pod CrashLoopBackOff, schema error, etc.):
  1. Preserve failure evidence first (`/tmp/refresh-failure-evidence-${STAMP}/` : pod logs, events, BUILD_INFO, traces).
  2. Restore exact backup: `cp -a /opt/akalynth-beta.pre-refresh-... /opt/akalynth-beta`.
  3. Restart deployment only (kubectl rollout restart ... or equivalent).
  4. Verify: health back to pre, pod 1/1 Running.
  5. Record in receipt: rollback_performed, post_rollback_commit, status ROLLBACK_COMPLETED.
- Never leave partial state. Gate G4 health check would fail on mismatch.
- Backups are evidence; do not delete without audit.

## 12. Receipt/evidence requirements

- Every action (stage, preflight, apply, gate-only, rollback) writes receipt to `docs/evidence/publish-beta/${STAMP}.json` (or specific named).
- Minimum fields (from V5/V3 examples): schema_version, stamp, lane, mode, intended_commit, dist_build_info_commit, live_health_commit, status, failed_gate, android_version_code, apk_url, rollback_backup, pod_status, notes.
- Also: full evidence packet for schema recovery (MANIFEST + shas + comparison).
- Update continuation state: bump Last updated, add V5/F-Droid/public sections with safe/forbidden claims + evidence refs.
- Preserve pre/post live snapshots for public changes.
- Git commit messages for lane records use exact lane names (e.g. AKALYNTH_BETA_REFRESH_V5_RECORD_V1).
- All receipts must be referenced in postmortem/runbook and continuation.

## 13. Hard stop conditions

STOP and abort (do not proceed to live mutation) if:
- Target schema < live DB schema.
- Preflight fails (ws, layout, native, BUILD match, schema gate).
- No .preflight-passed or stage incomplete.
- G1-G9 or manifest gates fail.
- Intended commit does not match dist BUILD_INFO.
- Public wording would introduce forbidden claims (run separate review first).
- F-Droid or direct APK would be mutated in this lane.
- Continuation/evidence not read or updated.
- WIP unaccounted that affects target (e.g. uncommitted schema changes).
- Any hard stop from prior lanes (live path ambiguous, no rollback backup, etc.).

On stop: record failure receipt, preserve evidence, rollback if partial, update continuation.

---

**Usage**: Source or reference in approved beta publish lanes. Combined with gates script and publish.sh staging logic.

**Related**:
- Postmortem: `docs/postmortems/AKALYNTH_BETA_REFRESH_V5_AND_PUBLIC_PROJECTION_POSTMORTEM_20260709.md`
- Gates: `bin/lib/akalynth-publish-gates.sh`
- Publish: `bin/akalynth-beta-publish.sh`
- Evidence: `docs/evidence/`
- Continuation: `.claude/skills/akalynth-continue/references/CONTINUATION_STATE.md`

No future refresh may skip these controls.
