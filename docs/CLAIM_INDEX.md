# Akalynth Doc Map & Claim Index

> **Purpose:** A single navigational map of every Markdown doc in the repo, plus an index of the project's material **claims** keyed to their evidence and status.
>
> **This index is navigational, not authoritative.** It must never assert more than its sources. The binding claim boundary is, in order of precedence:
> 1. [`docs/CURRENT_STAGE.md`](./CURRENT_STAGE.md) — the canonical claim boundary
> 2. [`docs/KNOWN_GAPS.md`](./KNOWN_GAPS.md) — what is *not* done
> 3. [`docs/V1_SCOPE.md`](./V1_SCOPE.md) — in/out of scope + binding guarantees
> 4. A passing verifier / proof run for a named commit
>
> If this file and any of the above disagree, the above wins and this file is the bug. Last reviewed against `main` on 2026-05-30 (repo `0.1.0`).

---

## Part 1 — Doc Map

Grouped by role. `L` = line count at last review. Entries marked **(non-binding)** are explicitly informative/future-facing per `V1_SCOPE.md`.

### Claim boundary & honesty doctrine
| Doc | L | Role |
| --- | --- | --- |
| [CURRENT_STAGE.md](./CURRENT_STAGE.md) | 112 | **Canonical** boundary on what may be claimed/shown. |
| [KNOWN_GAPS.md](./KNOWN_GAPS.md) | 65 | Release blockers, engineering/product risks, presentation rules. |
| [V1_SCOPE.md](./V1_SCOPE.md) | 65 | Scope fence: in/out of scope, binding guarantees, non-binding specs. |
| [CLAIM_INDEX.md](./CLAIM_INDEX.md) | 204 | This navigational map and claim index; non-authoritative if it disagrees with the claim boundary docs. |
| [SIMULATE_WITHOUT_LYING.md](./SIMULATE_WITHOUT_LYING.md) | 386 | Doctrine for simulating/demoing without overstating maturity. |
| [GOVERNANCE_INVARIANTS.md](./GOVERNANCE_INVARIANTS.md) | 24 | Public index for civil guarantees; points to canonical G1–G15. |

### Vision, world & lore
| Doc | L | Role |
| --- | --- | --- |
| [MANIFESTO.md](./MANIFESTO.md) | 64 | Narrative vision (aspirational; carries a "Grounding" note mapping claims to shipped systems). |
| [AKALYNTH_LORE_BIBLE.md](./AKALYNTH_LORE_BIBLE.md) | 235 | Current lore authority and naming boundary. |
| [WORLD_HIGH_CITY.md](./WORLD_HIGH_CITY.md) | 150 | Current first-city map; High City player-facing name over legacy `Azura` runtime id. |
| [WORLD_ROOKGUARD.md](./WORLD_ROOKGUARD.md) | 82 | Rookguard training zone. |
| [WORLD_EVOLUTION.md](./WORLD_EVOLUTION.md) | 342 | "Record change, don't overwrite truth" — world history doctrine **(non-binding)**. |

### Architecture & protocol
| Doc | L | Role |
| --- | --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 257 | System architecture. |
| [PROTOCOL.md](./PROTOCOL.md) | 718 | WebSocket/HTTP protocol surface. |
| [CLIENT_CONTRACT_V0_1.md](./CLIENT_CONTRACT_V0_1.md) | 219 | **Frozen** client contract v0.1. |
| [SPINE_V1.md](./SPINE_V1.md) | 126 | Spine Lock v1. |
| [PERSISTENCE_MATRIX.md](./PERSISTENCE_MATRIX.md) | 126 | Durable-state classification (documentation only; not a restore guarantee). |

### Verification, proofs & reports
| Doc | L | Role |
| --- | --- | --- |
| [VERIFICATION_SPINE_API.md](./VERIFICATION_SPINE_API.md) | 926 | Verification Spine API v1. |
| [PROOF_RUN_TEMPLATE.md](./PROOF_RUN_TEMPLATE.md) | 92 | Template for recording a reproducible proof run. |
| [RNG_OUTCOME_VERIFICATION.md](./RNG_OUTCOME_VERIFICATION.md) | 519 | Offline verifier for receipt-recorded RNG outcomes; documents trust boundaries and caveats. |
| [archive/MVP_VERIFICATION_REPORT_v1.md](./archive/MVP_VERIFICATION_REPORT_v1.md) | 217 | **Archived** — point-in-time MVP verification record (superseded by the verification spine). |
| [archive/PROOF_BUNDLES.md](./archive/PROOF_BUNDLES.md) | 282 | **Archived** — proof-export design sketch; not implemented in current game runtime. |
| [LOAD_TEST_HARNESS.md](./LOAD_TEST_HARNESS.md) | 586 | Load-test harness spec (local/staging only). |

### Identity & anti-cheat
| Doc | L | Role |
| --- | --- | --- |
| [IDENTITY_VERIFICATION.md](./IDENTITY_VERIFICATION.md) | 473 | Identity Verification v0.1. |
| [ANTICHEAT.md](./ANTICHEAT.md) | 176 | Anti-cheat system (Tem, heat, enforcement). |

### Monetization
| Doc | L | Role |
| --- | --- | --- |
| [MONETIZATION_CONSTITUTION.md](./MONETIZATION_CONSTITUTION.md) | 186 | Constitutional rules for monetization. |
| [MONETIZATION_JUSTIFICATIONS.md](./MONETIZATION_JUSTIFICATIONS.md) | 23 | "Not power" justification registry. |
| [MONETIZATION_RECEIPTS.md](./MONETIZATION_RECEIPTS.md) | 144 | Monetization receipt schema (draft). |

### Gameplay / UI specs
| Doc | L | Role |
| --- | --- | --- |
| [UI_PROPOSAL.md](./UI_PROPOSAL.md) | 508 | Mobile UI v0 (**FREEZE**). |
| [UI_IMPLEMENTATION_PROPOSAL.md](./UI_IMPLEMENTATION_PROPOSAL.md) | 1258 | UI implementation proposal. |
| [UI_MAPPING_CHECKLIST.md](./UI_MAPPING_CHECKLIST.md) | 64 | UI v0 implementation mapping checklist. |
| [UI_REGRESSION_MATRIX.md](./UI_REGRESSION_MATRIX.md) | 270 | UI regression matrix. |
| [CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md](./CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md) | 409 | Classic-32 art + mobile UI direction. |
| [asset-decisions/README.md](./asset-decisions/README.md) | 46 | Asset/map/mobile decision-packet index and cleanup boundary. |

### Governance & process
| Doc | L | Role |
| --- | --- | --- |
| [CONSTITUTIONAL_AMENDMENTS.md](./CONSTITUTIONAL_AMENDMENTS.md) | 126 | Amendment process for constitutional surfaces. |
| [decisions/AKALYNTH_BETA_PLAYER_READINESS_AND_MEASUREMENT_V1/DECISION.md](./decisions/AKALYNTH_BETA_PLAYER_READINESS_AND_MEASUREMENT_V1/DECISION.md) | 176 | Accepted source-recovery boundary for controlled beta readiness; no deployment or release claim. |
| [decisions/AKALYNTH_BETA_RELEASE_REPAIR_V1/DECISION.md](./decisions/AKALYNTH_BETA_RELEASE_REPAIR_V1/DECISION.md) | 278 | Accepted live-beta repair and bounded historical receipt-key exception boundary. |
| [decisions/AKALYNTH_BETA_RELEASE_REPAIR_V1/android-distribution-identity.v12.json](./decisions/AKALYNTH_BETA_RELEASE_REPAIR_V1/android-distribution-identity.v12.json) | 12 | Machine-readable accepted Android v12 distribution identity. |
| [decisions/AKALYNTH_BETA_RELEASE_REPAIR_V1/receipt-key-exception.v1.json](./decisions/AKALYNTH_BETA_RELEASE_REPAIR_V1/receipt-key-exception.v1.json) | 67 | Machine-readable approved receipt-key exception, exact boundary, and nonclaims. |
| [decisions/AKALYNTH_BETA_RELEASE_REPAIR_V1/receipt-key-exception.v1.schema.json](./decisions/AKALYNTH_BETA_RELEASE_REPAIR_V1/receipt-key-exception.v1.schema.json) | 259 | Closed JSON Schema for the bounded receipt-key exception record. |
| [HIGH_LEVERAGE_DECISION_CHECKLIST.md](./HIGH_LEVERAGE_DECISION_CHECKLIST.md) | 288 | Decision checklist for high-leverage tasks. |
| [LEVERAGE_TIER_MAPPING.md](./LEVERAGE_TIER_MAPPING.md) | 266 | Leverage-tier mapping of current state. |
| [REPO_HYGIENE_ARCHITECTURE.md](./REPO_HYGIENE_ARCHITECTURE.md) | 96 | Cleanup policy: root/doc/archive/drop custody and guardrails. |
| [COPILOT_DELEGATION.md](./COPILOT_DELEGATION.md) | 577 | Delegation guidance. |

### Ops, deploy, distribution & runbooks
| Doc | L | Role |
| --- | --- | --- |
| [SHOWCASE_RUNBOOK.md](./SHOWCASE_RUNBOOK.md) | 142 | Local pre-alpha proof showcase runbook. |
| [runbooks/beta-player-readiness-runbook-v1.md](./runbooks/beta-player-readiness-runbook-v1.md) | 329 | Source-recovery, repaired release preflight, and separately authorized controlled-cohort operations. |
| [NEW_BOX_PROVISIONING.md](./NEW_BOX_PROVISIONING.md) | 237 | New-box provisioning runbook. |
| [archive/APK_DISTRIBUTION_CHECKLIST.md](./archive/APK_DISTRIBUTION_CHECKLIST.md) | 220 | **Archived** — Android ship-and-observe checklist. |
| [archive/MMO_SITE_AND_LOOT_RUNBOOK.md](./archive/MMO_SITE_AND_LOOT_RUNBOOK.md) | 126 | **Archived** — completed-work log (mmo-site PR #75, mob-loot fix PR #81). |
| [archive/DRIVER_BRIEF.md](./archive/DRIVER_BRIEF.md) | 69 | **Archived** — technical driver brief. |
| [archive/DRIVER_30_DAY_PLAN.md](./archive/DRIVER_30_DAY_PLAN.md) | 97 | **Archived** — 30-day driver plan. |
| [README.md](./README.md) | 228 | Docs index / single source of truth pointer. |

### Archived reference — Witness-Ledger architecture
| Doc | L | Role |
| --- | --- | --- |
| [archive/reference/RFC_WITNESS_LEDGER.md](./archive/reference/RFC_WITNESS_LEDGER.md) | 561 | **Archived** — RFC: witness-ledger architecture. |
| [archive/reference/WITNESS_LEDGER_ARCHITECTURE.md](./archive/reference/WITNESS_LEDGER_ARCHITECTURE.md) | 246 | **Archived** — witness-ledger architecture narrative. |
| [archive/reference/WLA_V1_FINAL.md](./archive/reference/WLA_V1_FINAL.md) | 107 | **Archived** — WLA v1 finality declaration. |

### Archived speculative / future **(non-binding)**
| Doc | L | Role |
| --- | --- | --- |
| [archive/speculative/AKALYNTH_MAIL_MMO.v1.md](./archive/speculative/AKALYNTH_MAIL_MMO.v1.md) | 412 | **Archived** — mail-edge "golden receipt" concept (doc only; out of v1 scope). |

### Imported source material
| Doc | Role |
| --- | --- |
| [DROP_SOURCE_INDEX.md](./DROP_SOURCE_INDEX.md) | Source corpus index for future lore, gameplay, systems, world, and asset packages. Not runtime authority and not proof of implemented behavior. |

### Audits & signal reports
| Doc | L | Role |
| --- | --- | --- |
| [AUDITS/SYSTEM_AUDIT_CODEX_POST_REPAIR.md](./AUDITS/SYSTEM_AUDIT_CODEX_POST_REPAIR.md) | 291 | Post-repair system audit (Codex). |
| [AUDITS/ARCHIVED/SYSTEM_AUDIT_POST_REPAIR_v1.md](./AUDITS/ARCHIVED/SYSTEM_AUDIT_POST_REPAIR_v1.md) | 36 | **Archived** — point-in-time audit result (superseded by the Codex audit procedure). |
| [archive/MONETIZATION_BLUEPRINT.md](./archive/MONETIZATION_BLUEPRINT.md) | 182 | **Archived** — superseded monetization design sketch; formal policy is `MONETIZATION_CONSTITUTION.md`. |
| [archive/SITE_RETIRED_FROM_MONOREPO.md](./archive/SITE_RETIRED_FROM_MONOREPO.md) | 38 | **Archived** — record that the old `mmo-site/` copy was retired from this monorepo. |
| [archive/asset-decisions/README.md](./archive/asset-decisions/README.md) | 12 | **Archived** — index for superseded decision-packet lanes. |

### Component & tooling READMEs
| Doc | Role |
| --- | --- |
| [`/README.md`](../README.md) | Repo overview: Linux+Android, server-authoritative, anti-bot-first. |
| `apps/README.md`, `apps/android/README.md`, `apps/server/README.md` | App-level overviews. |
| `crates/chronicle/README.md` | Chronicle: append-only witness kernel. |
| `infra/README.md`, `data/README.md`, `packages/README.md`, `scripts/README.md`, `scripts/verify/README.md`, `tests/README.md`, `tools/README.md`, `tools/atlas/README.md`, `tools/map-compiler/README.md`, `tools/validator/README.md` | Directory/tooling overviews. |
| `packages/ai-tool-governance/README.md` | Constitutional AI tool governance. |
| `packages/ci-cd-change-control/README.md` | CI/CD change-control. |
| `rulebook/SKILL_SYSTEM_AUDIT.md`, `rulebook/invariants/invariants.md` | Skill-system audit + invariants. |
| `.codex/CODEX_MAP.md`, `.devcontainer/README.md`, `.github/PULL_REQUEST_TEMPLATE.md` | Codex map, devcontainer, PR template. |
| `packages/GOVERNANCE_INVARIANTS.md` | **Legacy draft — NON-BINDING** (superseded by `docs/GOVERNANCE_INVARIANTS.md`). |
| `packages/coordination-kernel/CONSTITUTIONAL_API_FREEZE.md` | **Draft — NON-BINDING** per `V1_SCOPE.md`. |

---

## Part 2 — Claim Index

Each row pairs a claim with the **source** that makes it and the **status anchor** that backs (or bounds) it. Status terms are taken verbatim from `CURRENT_STAGE.md`. A claim is evidence-backed only when it names a source file, protocol contract, receipt fixture, verifier output, CI artifact, reproducible command, or commit SHA (`CURRENT_STAGE.md` §Evidence Path).

### A. Binding guarantees — mechanically enforced today
Backed by a verifier/CI job for a specific commit (`CURRENT_STAGE.md` §Mechanically Enforced Today, `V1_SCOPE.md` §Binding Guarantees).

| Claim | Evidence (command / source) |
| --- | --- |
| Server-authoritative WebSocket intent handling | `docs/PROTOCOL.md`; `apps/server/src`; protocol-sync `./scripts/verify_protocol_sync.sh` |
| Guest login / session flow; grid-movement validation; chat | `./scripts/verify_mvp.sh` |
| Signed, append-only receipt chain (runtime + persisted file) | `V1_SCOPE.md` §In Scope; `crates/chronicle` |
| Deterministic replay; missing receipts fail fast unless bootstrap | `V1_SCOPE.md` §Binding Guarantees; `bash scripts/test-chain-discipline.sh` |
| Civil Guarantees **G1–G15** preserved | `apps/server/docs/CIVIL_GUARANTEES.md`; `npm run verify` (root spine) / `apps/server` `verify:quick` (`tools/verify-guarantees.ts`) |
| Treasury (gold) accounting integrity | `apps/server` `npm run verify:treasury` |
| Work-contract faucet + payout ordering (tick receipts) | `apps/server` `npm run verify:work-contracts`; `V1_SCOPE.md` |
| Receipt/chronicle hygiene; lifecycle (fixture receipts) | `apps/server` `verify:receipt-hygiene`, `verify:lifecycle` |
| Monetization rules (fixture receipts) | `apps/server` `npm run verify:monetization` |
| Mob-loot item ids are receipt-derived (deterministic/replay-safe) | `apps/server` `npm run verify:mob-loot` *(added this session)* |
| Property ownership v0: single owner (P-H1), gold conserved/no-mint (P-H2), receipt-derived state (P-H3), guard rails incl. ungated buy (P-H4), replay determinism (P-H5), projection==DB (P-H6) | `apps/server` `npm run verify:property`; `apps/server/src/world/property.ts`; `docs/PERSISTENCE_MATRIX.md` |
| Public transparency surfaces exist (`/v1/receipts/public`, `/v1/transparency`) | `apps/server/src/api/http.ts`; `V1_SCOPE.md` |

> **Nuance:** Treasury, work-contracts, NPC recognition, etc. have **unit verifiers** (mechanically checked, above) yet are listed under *Implemented But Not Release-Claimed* below as **gameplay features**. Both are true: the verifier passes; the feature is not release-claimed.

### B. Implemented but NOT release-claimed
Code exists; existence is not a production/release claim (`CURRENT_STAGE.md` §Implemented But Not Release-Claimed). Release-claim requires: listed as release-claimed + named verifier + passing proof run + run artifact.

Combat · Death/respawn · Item drop/pickup · Protected slots · Chronicle evidence · Treasury/gold · Work contracts · NPC recognition · Android observe/play client · Load-test harness · Public/private receipt & rumor surfaces · Controlled-beta cohort, readiness-observation, and feedback surfaces.

### C. Debug-only / environment-gated
Must not be presented as production behavior (`CURRENT_STAGE.md` §Debug-Only Or Environment-Gated).

Runestone debug behavior · Sovereign debug grants · Test death triggers · Dev minting · Local insecure transport · Debug-only raw/public inspection routes · Local/staging-only load testing · Controlled-beta measurement and invite enforcement.

### D. In-memory / restart-reset (not durable without a persistence proof)
`CURRENT_STAGE.md` §In-Memory/Restart-Reset; classified in `PERSISTENCE_MATRIX.md` (documentation only).

Heat runtime state · Witness pending requests & cooldowns · Some session/world state · Sovereign session/echo · Capability runtime state · Selected combat/session timers.

### E. Explicitly NOT claimed
`CURRENT_STAGE.md` §Not Claimed and `KNOWN_GAPS.md` §Presentation Rules — do **not** describe Akalynth as any of:

Production-deployment-ready · Commercial-MMO-ready · Content-alpha · Public-launch-ready · Appeals/moderation-ops-ready · Long-lived persistent-world guaranteed · Android-release-ready · Externally/auditor-verified · Anti-cheat complete · Persistence complete · Cryptographic receipt-envelope complete (unless a named verifier covers it).

### F. Vision / aspirational / non-binding
Design intent, not current capability. Treat as future-facing.

- **Narrative vision:** `MANIFESTO.md` (the Ledger, Origin Act, the Stone) — partially grounded in `world/origin.ts`, `world/runestone.ts`; where it outpaces the build it is design intent.
- **Imported source material:** `drop/` packages are source inputs for future canon/gameplay/assets, not current runtime claims until promoted through a reviewed lane.
- **Non-binding specs (per `V1_SCOPE.md`):** `docs/archive/MONETIZATION_BLUEPRINT.md`, `WORLD_EVOLUTION.md`, `docs/archive/speculative/AKALYNTH_MAIL_MMO.v1.md`, `packages/coordination-kernel/CONSTITUTIONAL_API_FREEZE.md`, plus `apps/server/docs/PHASE6_WITNESS_INTERFACE.md`, `EVIDENCE_UI_SPEC.md`, `PHASE7_MODERATION.md`.
- **Frozen contracts (shape locked, not a maturity claim):** `CLIENT_CONTRACT_V0_1.md`, `SPINE_V1.md`, `UI_PROPOSAL.md`.

### G. Open gaps / release blockers
`KNOWN_GAPS.md` §Release Blockers — no documented two-green-`main` proof run in this packet · no production-deployment proof · Android release path unproved · some runtime state resets on restart · scope docs need ongoing alignment · some verifier coverage depends on fixtures, not full live-world execution.

---

## How to back a claim (Evidence Path)

Per `CURRENT_STAGE.md` and `PROOF_RUN_TEMPLATE.md`, a statement about the repo is evidence-backed only when it names at least one: source file · protocol contract · receipt fixture · verifier output · CI run artifact · reproducible local command · commit SHA. Narrative descriptions are explanatory only — they are not proof artifacts.

To assemble evidence: follow `SHOWCASE_RUNBOOK.md` and record with `PROOF_RUN_TEMPLATE.md`. The old proof-bundle export sketch is archived at `docs/archive/PROOF_BUNDLES.md` and is not a current runtime capability.
