# Akalynth Architect — Current Brief

Last updated: **2026-08-20** against `main` HEAD `b624190` (`feat(beta): add frozen first-playable proof tooling (#427)`); prior review point was `948c944`.

This brief orients the standing architect. It is **not** a proof artifact and
**not** a release claim. Binding claim order: `docs/CURRENT_STAGE.md` →
`docs/KNOWN_GAPS.md` → `docs/V1_SCOPE.md` → a named verifier on a named commit.

---

## Decision (this charter)

Akalynth now has a canonical architect skill. Cross-cutting work starts here,
then routes to stewards. Specialist skills stay owners of their domains.

---

## Deployed vs repo (probed 2026-08-20, external vantage)

| Surface | Observed | vs `main` `b624190` |
|---|---|---|
| Beta API | `948c944`, built 2026-08-12, HTTP 200 | Behind by #426 (docs) + #427 (proof tooling); no runtime-behavior delta |
| Beta Android manifest | `2026080704` first-session | Matches #425 ladder |
| Beta site + `/play/` | 200 | Serving |
| Sim API | `4aef0a96`, built 2026-06-23, HTTP 200 | Ancestor of main, ~2 months stale (separate lane) |
| **Prod `api.akalynth.com`** | **OUTAGE**: 443 TLS handshake EOF after ClientHello; port 80 → 502; IPv6 down; apex TLS down | Proxy partially alive, backend down, TLS termination broken |

Both deployed commits are ancestors of `main` — no off-main runtime drift.
Prod repair requires the prod host (`deploy-steward`); not reachable from the
dev/cloud checkout.

---

## Patch/Deploy Phase Plan (2026-08-20)

Decision: patch and deploy in this order. Each phase names its authority; an
earlier phase never implies a later one.

**D0 — Freeze + local proof of the target (done).** Target `b624190`.
`npm run verify:beta-first-playable-proof` PASS on that named commit
(manifest-tool fail-closed suite + full loopback account → Rookguard →
gather → reconnect journey + signed chain). `verify:skills` PASS.

**D1 — Prod restore first (incident lane, operator/root on akalynth-prod-01).**
Highest urgency; independent of D2+. Evidence order: `systemctl status`
app + caddy → `journalctl -u caddy` → `ss -ltnp` for 80/443/3000 → disk
full → cert expiry. Restore service **at its current pinned version** — do
not upgrade prod during the incident. Verify host-local Caddy/TLS health,
then public `curl -4/-6`. Record a postmortem under `docs/postmortems/`.
The 502-on-80 + TLS-EOF signature suggests dead backend + broken TLS
termination (cert renewal/disk are the usual suspects); diagnose before
restarting anything.

**D2 — Beta patch deploy to `b624190` (deploy-steward, ops-dev-01).** Follow
`docs/runbooks/beta-refresh-runbook-v1.md` (target rules updated 2026-08-20:
schema 27, ladder 2026080704). Delta from live `948c944` is docs + proof
tooling only — no schema change (27 == 27), no protocol change, Android
manifest untouched. Container build → stage → preflight (BUILD_INFO
`b624190`, schema gate 27/27, ws + better-sqlite3, update JSON 2026080704)
→ backup `/opt/akalynth-beta.pre-refresh-<stamp>` → rollout → health
reports `b624190` → smoke (`smoke:beta-account-play`, azura loop) →
receipt in `docs/evidence/publish-beta/`. Purpose: put the A1 proof harness
and manifest tool on the box that will execute proof phases.

**D3 — Frozen First Playable Proof runtime phases (beta, gated).** After D2:
Phase 0 re-probe + freeze candidate tuple (no mutation) → Phase 1 emit
proof/pilot/rollback manifest preimages (A1, read-only, tool now deployed)
→ **A2 approval required** for Phase 2 active-manifest install + restart →
**A3** for the one credentialed live journey (P1 claim) → **A4/A5** sentinel
+ 12-person pilot are human decisions. Source:
`docs/FROZEN_FIRST_PLAYABLE_PROOF_PHASE_PLAN_V1.md`.

**D4 — Sim lane refresh (optional, low priority).** `sim-api` runs June-23
`4aef0a96`. Decide refresh to `b624190` per `docs/SIM_LANE_RUNBOOK.md` or
leave frozen; not blocking D1–D3.

**D5 — Branch-debt patches (repo lanes, one PR each).**
[#407](https://github.com/akalynth/akalynth/pull/407) rebase onto `b624190`
(6 conflict files incl. protocol golden — `protocol-guardian` review; its
own body forbids merge without authority).
[#406](https://github.com/akalynth/akalynth/pull/406) recommend close as
superseded by the play-surface contract, salvage HUD panels separately.
`codex/branch-hygiene-completion` (2,363 files) needs a split-salvage lane
(fishing/caravan vs docs). Merged branches
`codex/frozen-first-playable-proof-v1` and the reconcile branch are deleted.

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

## Open GitHub issues — re-triage against `b624190`

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

1. Execute D1 (prod restore) and D2 (beta patch deploy) — operator/host
   authority; this checkout cannot reach the hosts.
2. Grant or withhold **A2** (active-manifest install + beta restart) after
   D2 + Phase 0/1 evidence.
3. Re-verify #399–#403 on `b624190` and move each to `state:ready` or close
   with evidence (initial probes: #400 literal present, #401 orphan absent,
   #399 types missing from `packages/shared`).
4. Whether `docs/CURRENT_STAGE.md` should be re-reviewed against current
   `main` (schema 27, play-surface contract, proof tooling) without raising
   the stage label. `CONTINUATION_STATE.md` was refreshed to 2026-08-12 by
   the #427 merge.
5. F-Droid remains a **human signing-authority** decision, not an agent
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
