# Akalynth Architect — Current Brief

Last updated: **2026-08-20** against checkout HEAD `948c944` (`fix(beta): bind stranger cohorts to release manifests`).

This brief orients the standing architect. It is **not** a proof artifact and
**not** a release claim. Binding claim order: `docs/CURRENT_STAGE.md` →
`docs/KNOWN_GAPS.md` → `docs/V1_SCOPE.md` → a named verifier on a named commit.

---

## Decision (this charter)

Akalynth now has a canonical architect skill. Cross-cutting work starts here,
then routes to stewards. Specialist skills stay owners of their domains.

---

## What may be said

Akalynth is a **pre-alpha, proof-native MMO vertical slice**: server-authoritative
simulation, receipt/chronicle audit, Tem/heat anti-cheat, and a beta play
surface on web `/play/` plus a separate direct Android channel.

It is **not** production-ready, content-alpha, launch-ready, F-Droid-aligned,
or Android-release-ready.

Repo stage label remains `0.1.0` in `docs/CURRENT_STAGE.md` (last reviewed
there against `main` on 2026-05-30). Treat that document as conservative
until a later review updates it.

---

## System map (current checkout)

| Surface | Path / contract | Owner skill |
|---|---|---|
| Game server | `apps/server/` — 100ms tick, intent → validate → apply → broadcast → receipt | `game-server-steward` |
| Persistence | SQLite projections; **source `SCHEMA_VERSION = 27`** in `apps/server/src/persist/schema.ts` | `receipt-chain-steward` |
| Shared protocol | `packages/shared/`, `docs/PROTOCOL.md`, frozen `docs/CLIENT_CONTRACT_V0_1.md` | `protocol-guardian` |
| Coordination / identity | `packages/coordination-kernel/` | `coordination-kernel-steward` |
| Verification spine | `packages/verification-spine/`, `docs/VERIFICATION_SPINE_API.md` | `test-runner`, `ci-steward` |
| Web play | `apps/debug-client/` at `/play/`; play UX frozen in `docs/CLIENT_PLAY_SURFACE_CONTRACT_V1.md` | `debug-client` |
| Android | `apps/android/` — separate signing/channel from F-Droid | `android-client` |
| Site | **Separate repo** `akalynth/akalynth-site` | site publish scripts (ops), not this monorepo |
| Studio / phone | `apps/studio/`, `apps/phone-server/` — not the default Cloud/dev boot path | own lanes |
| Chronicle rust | `crates/chronicle/` | `receipt-chain-steward` |
| Skills | Canonical `.claude/skills/` only | this skill + `release-steward` |

World: Rookguard onboarding + High City player-facing name over legacy `Azura`
runtime map id. Chill-zone gather → refine → deliver exists in source; live
beta proof is a separate lane.

---

## Lanes (do not collapse)

| Lane | Identity | Architect rule |
|---|---|---|
| Dev checkout | this tree; local `chronicle.key` / `ALLOW_INSECURE_LOCAL` | Safe to design and verify locally |
| Beta | `beta-api.akalynth.com`, `/opt/akalynth-beta` on ops-dev-01 | Deploy only via `deploy-steward` + runbooks |
| Prod | `api.akalynth.com`, `/opt/akalynth` | Separate host; no automatic beta→prod |
| Direct Android | independent APK + update JSON | Do not reuse signer onto F-Droid |
| F-Droid | held pending signing authority | No publication, no keystore inspection |

Continuation-state file
`.claude/skills/akalynth-continue/references/CONTINUATION_STATE.md` still
describes 2026-07-09 beta V5 / F-Droid hold in detail. Treat it as **ops
handoff**, then re-probe before acting. This brief is newer for **source HEAD**.

---

## Standing source decisions (accepted, not launch claims)

- **Play-surface parity (2026-08-07):** web `/play/` and direct Android must
  honor the same player-facing movement/death/gather loop
  (`docs/CLIENT_PLAY_SURFACE_CONTRACT_V1.md`). Wire authority stays
  `CLIENT_CONTRACT_V0_1`.
- **Schema v27 stranger-pilot binding:** cohort rows carry release + rollback
  manifest SHA-256; unbound cohorts are admission-inert
  (`docs/decisions/AKALYNTH_STRANGER_PILOT_RELEASE_MANIFEST_BINDING_V1/DECISION.md`).
  This is a source/schema decision. It does not authorize live cohort
  activation or a release claim.
- **F-Droid:** still a separate trust line. Direct-channel signer must not be
  reused. Private signing material is out of scope.

---

## Open GitHub issues — re-triage against `948c944`

Issues #399–#403 were opened 2026-07-09 from
`AKALYNTH_TEST_FINDINGS_ISSUE_TRIAGE_PLAN_V1` / ledger `faeb9f4`. **That
commit is not in this repository.** The triage ledger file is absent on
this HEAD. Re-verify before implementing; do not treat July priorities as
current fact.

| Issue | July label | Re-probe on this HEAD | Route if still live |
|---|---|---|---|
| [#399](https://github.com/akalynth/akalynth/issues/399) BUILD-HEALTH-001 | P0 TS blockers | `AccountCharacterOutfitColors` not in `packages/shared`. Re-run `npm run build:packages && npm -w apps/server run build && npm run build:client` | `package-steward` + `debug-client` + `game-server-steward` |
| [#400](https://github.com/akalynth/akalynth/issues/400) PARITY-001 | P1 Android `outfitId` literal | Literal **is present** in `CharacterCreateScreen.kt`. Re-run `./scripts/verify_protocol_sync.sh` | `protocol-guardian` + `android-client` |
| [#401](https://github.com/akalynth/akalynth/issues/401) ASSET-001 | P2 orphan sidecar | `wall_stone_east.json` **absent**. Re-run `npm run verify:assets` | `classic-32-art-pipeline` |
| [#402](https://github.com/akalynth/akalynth/issues/402) HYGIENE-001 | P3 stale Codex refs | Still a skill-hygiene lane; do not mass-edit `.codex/` copies | `release-steward` + `ci-steward` |
| [#403](https://github.com/akalynth/akalynth/issues/403) ENV-001 | classification | Local `:3000` vs Caddy/staging topology; classify env vs code | `test-runner` + `ci-steward` |

All five remain `state:triage`. Architect next step for those issues is
**re-verify and retarget**, not blind implementation of the July bodies.

---

## Leverage — what to prefer next

From `docs/LEVERAGE_TIER_MAPPING.md` (still the decision engine) plus this
HEAD:

1. **Keep the proof spine green** — build + protocol sync + `verify:quick`
   on a named commit. Feature work that cannot build is not architecture.
2. **Do not expand world/content** until the next local showcase proof
   (`docs/KNOWN_GAPS.md` Next Closure Target) is recorded.
3. **Do not collapse channels** (beta runtime, direct APK, F-Droid, site,
   prod). Each needs its own evidence.
4. **Update stale claim docs** (`CURRENT_STAGE.md` last reviewed 2026-05-30;
   continuation last dated 2026-07-09) only with evidence, not narrative
   catch-up.

P0 items named in the leverage map (receipt CLI, protocol breaking-change
detector) remain high-leverage **if** still missing after a current audit.
Confirm with `akalynth-system-audit` before opening new issues.

---

## Next architect decisions (unresolved)

1. Re-verify #399–#403 on `948c944` (or successor) and move each to
   `state:ready` or close with evidence.
2. Whether `docs/CURRENT_STAGE.md` should be re-reviewed against current
   `main` (schema 27, play-surface contract, first-session work) without
   raising the stage label.
3. Whether `CONTINUATION_STATE.md` should be refreshed for post-July beta
   / first-session work, or left as a dated ops snapshot.
4. F-Droid remains a **human signing-authority** decision, not an agent
   implement lane.

---

## Forbidden claims (repeat)

- Game launch-ready / content-alpha / production-ready
- F-Droid refreshed or aligned with the direct Android channel
- Schema 27 or play-surface contract implies a live cohort or public launch
- This charter "resolves" #399–#403
- Continuation state is a complete picture of current `main`

---

## Verification for this charter

```bash
npm run verify:skills
```

That command only proves skill-pack hygiene. It does not prove server,
protocol, Android, or live-host health.
