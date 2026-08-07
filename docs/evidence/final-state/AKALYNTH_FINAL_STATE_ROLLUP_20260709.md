# AKALYNTH_FINAL_STATE_ROLLUP_20260709

**Lane**: AKALYNTH_FINAL_STATE_ROLLUP_APPLY_V1  
**Classification**: BOUNDED_FINAL_STATE_ROLLUP_ONLY  
**Date**: 2026-07-09  
**Status**: Rollup created (local files only; no mutations beyond this document)  
**Source repo head at creation**: da415d7 (local)

This is a single operator-readable summary of the V5 beta refresh + public projection repair + F-Droid hold workstream. All data is derived from inspected receipts, continuation state, live endpoints (read-only), and prior bounded lanes.

## 1. Current live state
- Beta runtime: commit `47690e84c797d5f183b42f2c47a9b19a4ea6e86d` (schema 25, pod 1/1 Running, healthy).
- Public site (beta.akalynth.com): Wording repaired and deployed. Browser beta described as "current pre-alpha beta"; direct Android v12 separated; F-Droid explicitly "held pending signing authority (older version)" and "not synchronized".
- Direct Android channel: v12 APK available at https://beta.akalynth.com/download/akalynth-beta.apk (independent signer, update authority, and distribution path).
- F-Droid: v5 only (older APK, placeholder metadata CurrentVersionCode=2147483647), held. Repo at https://fdroid.akalynth.com/fdroid/repo (fingerprint 7517DE35C94C589131E159E72CADDA7F4915B359948CCCE21EE6AC9D21106344).

Akalynth remains pre-alpha / controlled beta. No launch claims.

## 2. V5 beta refresh status
- Successful deployment of schema25 container-built artifact (V3 reconstruction + pinned Node 24.15.0 build).
- Controls enforced: staged publish + preflight (ws, native better-sqlite3, schema DB gate vs live, layout), G1-G9 gates, rollback backup preserved (unused).
- Evidence of prior failures (54c6 schema mismatch, provenance gap, container drift) addressed.
- Live beta healthy post-V5; direct Android v12 parity maintained.

## 3. Public projection deploy status
- Repair commit: 9fdab54af7f283de3edfaece9c86971b96a87cde (AKALYNTH_PUBLIC_PROJECTION_CLAIM_REPAIR_V1).
- Bounded static deploy only (index.html, beta.html, account.html) to /var/www/akalynth-beta.
- Post-deploy review passed: live site serves separated wording; no forbidden claims (undifferentiated Android language removed; channels explicitly distinguished).
- Deploy receipt: 20260709T0256Z-PUBLIC-PROJECTION-DEPLOY.json.

## 4. Direct Android v12 status
- Version code 12, separate signer `df2acbbf9140f61507623b68268372ee368c7abf0c070a613c47bb791787d5cd`.
- Independent update metadata and distribution (not routed through F-Droid).
- Policy-enforced separation from F-Droid channel.

## 5. F-Droid hold status
- Held at v5 (signer `b58026521f3df84808a2d18d586267c5d4021557ab82e016e5639dad2ab91442`).
- Repo/index key fingerprint: `7517DE35C94C589131E159E72CADDA7F4915B359948CCCE21EE6AC9D21106344` (distinct from APK signer).
- Custody: insufficiently evidenced (`signing_key_custody_inspected=false`, `private_keys_accessed=false`).
- Latest hold update: 20260709T050000Z-FDROID-HOLD-UPDATE.json (decision FDROID_SIGNING_AUTHORITY_STILL_BLOCKED).
- Key distinctions recorded: repo/index signing vs APK app signing vs direct channel signer. Rotation would break in-place updates (reinstall required). Signer age does not equal authority.
- Direct v12 signer must not be reused.

## 6. Evidence and receipt anchors
- V5 publish: `docs/evidence/publish-beta/20260709T0150Z-V5.json` (PASS, 47690e84, android 12).
- Schema recovery: `docs/evidence/schema25-source-recovery/20260709T0059Z/` (MANIFEST, comparison showing 25 vs 24 gap, 54c6-blocked).
- F-Droid hold: `docs/evidence/fdroid-refresh-hold/20260709T030500Z-FDROID-HOLD.json` + `20260709T050000Z-FDROID-HOLD-UPDATE.json`.
- Public deploy: `docs/evidence/public-projection-deploy/20260709T0256Z-PUBLIC-PROJECTION-DEPLOY.json` + post-*.html snapshots.
- Postmortem + runbook: `docs/postmortems/AKALYNTH_BETA_REFRESH_V5_AND_PUBLIC_PROJECTION_POSTMORTEM_20260709.md` + `docs/runbooks/beta-refresh-runbook-v1.md`.
- Evidence summary: `docs/evidence/beta-refresh-v5-postmortem-summary.json`.
- Signing policy: `infra/android/android-signing-policy.v1.json`.
- Continuation: `.claude/skills/akalynth-continue/references/CONTINUATION_STATE.md`.
- Live verification: beta-api health, beta.akalynth.com (wording), APK sizes/times.
- Rollback backups: `/opt/akalynth-beta.pre-refresh-*` (preserved).

## 7. Local commit index
- da415d7: AKALYNTH_FDROID_SIGNING_AUTHORITY_HOLD_UPDATE_V1 (this rollup context)
- 05acfba: AKALYNTH_BETA_REFRESH_POSTMORTEM_RUNBOOK_V1
- 9fdab54: AKALYNTH_PUBLIC_PROJECTION_CLAIM_REPAIR_V1 (public repair)
- 324fe96: AKALYNTH_FDROID_REFRESH_HOLD_RECORD_V1
- d97e5a6: AKALYNTH_BETA_REFRESH_V5_RECORD_V1
- Earlier schema/container/Android policy commits (1c3648f, dcc97ab, 54c6d37, 8b3a7e6, d77f3f4, etc.).

All local only; no push in these lanes.

## 8. Safe claims
- Akalynth beta is live and healthy after V5 (commit 47690e84c797d5f183b42f2c47a9b19a4ea6e86d, schema 25, pod 1/1).
- Direct Android beta channel is v12 (independent, verified).
- Public site wording has been repaired and deployed (browser beta / direct Android v12 / F-Droid hold clearly separated).
- F-Droid is held pending signing authority (v5 only; separate from direct v12).
- Akalynth remains pre-alpha / controlled beta.
- No F-Droid, direct, or public mutation in latest lanes; evidence chain preserved.
- Staging/preflight/gates and bounded lanes were enforced for V5 and public deploy.

## 9. Forbidden claims
- F-Droid is aligned (with direct or runtime).
- Android channels are synchronized.
- Akalynth is launch-ready.
- All WIP is resolved (Android, debug-client, etc.).
- F-Droid v12 is available.
- Existing F-Droid key is approved for use.
- Direct signer can be reused for F-Droid.
- Git custody/push is complete (local edits only; unrelated WIP present).
- Signer age proves authority or continuity.
- Any overclaim of F-Droid refresh or cross-channel alignment.

## 10. Unresolved surfaces
- F-Droid signing authority/custody (insufficiently evidenced; repo key vs APK signer distinction unconfirmed for continuity; hold maintained at FDROID_SIGNING_AUTHORITY_STILL_BLOCKED).
- Git custody/push (all work local; no push performed in these lanes).
- In-flight WIP (Android client changes, debug-client, protocol, builder, etc.; ~71 unrelated lines in working tree).
- Public projection future changes (requires process; current state is post-repair only).
- Launch readiness (explicitly pre-alpha/controlled beta).
- Full cross-channel alignment or single "beta" identity (intentionally separated).
- Long-term F-Droid resolution (recovery, rotation with reinstall note, or frozen).

## 11. Git custody state
- All referenced work committed locally only.
- Key commits: 9fdab54 (public), 05acfba (postmortem/runbook), da415d7 (F-Droid hold update).
- Unrelated WIP (Android/debug-client etc.) deliberately excluded from all commits in this workstream.
- No git push in V5/public/F-Droid lanes. "Ahead" status is local only.
- Evidence of local-only discipline preserved in receipts and continuation.

## 12. Recommended next lanes
- AKALYNTH_FINAL_STATE_ROLLUP_COMMIT_APPLY_V1 (to commit this rollup locally)
- AKALYNTH_GIT_CUSTODY_PUSH_PLAN_V2 (for any future push decisions)
- AKALYNTH_FDROID_SIGNING_AUTHORITY_EVIDENCE_PLAN_V1 (to gather custody/continuity proof before any F-Droid action)
- AKALYNTH_OPERATIONS_HOLD_RECORD_APPLY_V1 (if broader ops hold updates needed)

No automatic next action; each requires its own approved lane.

---

**End of rollup.** All statements are traceable to the listed evidence. Akalynth beta V5 is operational with separated channels; F-Droid authority remains the active blocker. Unrelated WIP and git custody are explicitly called out as open. 

This document was created under BOUNDED_FINAL_STATE_ROLLUP_ONLY with no forbidden mutations.