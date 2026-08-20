# Akalynth Architect — Current Brief

Last updated: **2026-08-20** against archival branch `cursor/portfolio-archive-4905`
(`03dfefa` + this note), targeting post-merge `main` after [PR #430](https://github.com/akalynth/akalynth/pull/430).

This brief orients the standing architect. It is **not** a proof artifact and
**not** a release claim. Binding claim order: `docs/CURRENT_STAGE.md` →
`docs/KNOWN_GAPS.md` → `docs/V1_SCOPE.md` → a named verifier on a named commit.

---

## Status (2026-08-20, final)

**`PORTFOLIO_READY` / `PUBLICATION_GATE_PASSED` / `INFRA_DECOMMISSIONED`**

Repository-side cleanup is complete and merged (PR #430, `9cadd35`).
Akalynth is a completed historical engineering project, not an operating
company, product, or active roadmap.

| Gate | State |
|---|---|
| PR #430 (README, archived banner, cron removed, ops Caddyfile removed, hygiene fold, tree user@host scrub) | **Merged** (`9cadd35`) |
| Current-tree credentials | Clean (gitleaks full-history; remaining hits are 8-char false positives) |
| Current-tree user@host pairs | Zero |
| Historical opaque `*.witnessops.com` hostname | **`DISCLOSURE_ACCEPTED`** — owner decision 2026-08-20: the historical hostname in Git history is explicitly accepted; no history rewrite, no rotation required. Publication gate satisfied by acceptance. |
| Repo visibility | **Private** — publication gate passed; the private → public flip is now an unblocked owner action |
| LinkedIn | After public: title **Akalynth — Server-Authoritative MMO Prototype**, Jan 2026 – Aug 2026, not currently active |

### Infrastructure decommission record (2026-08-20)

- **Beta/ops host retired.** All Akalynth services stopped and disabled,
  k8s lanes scaled to zero, all `*.akalynth.com` vhosts on that host
  quarantined to inert snippets (post-stop probes: no HTTP/TLS response on
  every Akalynth name). Non-Akalynth workloads on the shared host verified
  untouched (config-region hash equal before/after).
- **Evidence preserved before stop**: 28/28-archive manifest, verified.
  Retire receipt SHA-256:
  `19505f638a0d6fe02bd5e814c50cdc7238b05d1327ae0f7deda49397774d7e4b`
- **Prod host**: inaccessible below SSH (all ports refused/filtered; WG and
  bastion unreachable). Never meaningfully used — zero prod-lane receipts
  exist in this repository's evidence corpus, and no archived claim depends
  on prod runtime data. Recorded decision:
  **`PROD_CHAIN_UNPRESERVED_UNRECOVERABLE_ACCEPTED`** — the prod signing
  key dies with the disk, as intended at decommission. Decision addendum
  SHA-256:
  `47916904da7f6b6c4fd84ad5327422ddbc5405b789b9e9eed40b35b90d34177d`
- The retire archives live **outside Git** in operator custody; the hashes
  above anchor them. No provider, DNS, deletion, GitHub-visibility, or
  WitnessOps action is recorded here.

Remaining owner sequence: **off-box archive copy → host destroy + DNS
deletions → metadata → public → LinkedIn**. (The WitnessOps hostname step
is resolved by the accepted-disclosure decision above.)

---

## Decision (this charter)

Akalynth now has a canonical architect skill. Cross-cutting work starts here,
then routes to stewards. Specialist skills stay owners of their domains.
No new Akalynth product development, roadmap, experiments, or commercial
activity is in scope.

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

## Remaining owner-side actions (not this checkout)

1. Merge [PR #430](https://github.com/akalynth/akalynth/pull/430).
2. Rotate or retire the historical `*.witnessops.com` staging hostname, **or**
   explicitly accept that historical disclosure.
3. Before decommissioning: preserve the beta receipt chain and SQLite state
   if they are materially useful as irreconstructable project evidence.
4. Decommission `beta.akalynth.com` and remaining Akalynth infrastructure.
5. Set GitHub description and topics.
6. Re-run a post-merge full-history + current-tree scan if anything else
   landed on `main` after #430.
7. Only then decide private → public.
8. LinkedIn: **Akalynth — Server-Authoritative MMO Prototype**, January 2026 –
   August 2026, not currently active; repo as primary media once public.

---

## Forbidden claims (repeat)

- Game launch-ready / content-alpha / production-ready / current venture
- Repository is PUBLICATION_READY (it is not; the publication gate is closed)
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
