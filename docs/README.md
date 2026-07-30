# Akalynth

A classic-feel MMO with authoritative server architecture.

> **Platform Policy**: This repo targets Linux and Android only. Windows is intentionally unsupported.

## Current Stage

Akalynth v0.1 is a **pre-alpha, proof-native MMO vertical slice**.

It is not a production MMO, not content-alpha, and not a public launch candidate. The canonical current-stage boundary is maintained in [Current Stage](./CURRENT_STAGE.md).

> **Lost in the docs?** Start at the [Doc Map & Claim Index](./CLAIM_INDEX.md) — every doc grouped by role, plus an index of the project's claims keyed to their evidence and status.

## Quick Start

### 1. Bootstrap (Debian/Ubuntu)

```bash
sudo ./scripts/bootstrap_linux.sh
```

This installs: `ca-certificates curl git build-essential nodejs npm`

### 2. Run the Server

```bash
cd apps/server
npm install
AKALYNTH_BOOTSTRAP=1 npm run dev   # first run only (creates canonical receipts file)
```

Server starts on `ws://localhost:3000`

### 3. Test Connection

```bash
# Install wscat if needed
npm install -g wscat

# Connect
wscat -c ws://localhost:3000
```

Send a test message:
```json
{"type":"connect"}
```

## Showcase Preflight

From the repository root:

```bash
npm run verify:showcase
```

This checks protocol sync, server build, MVP verification, and debug-client build. It does not start the server or client and does not prove production readiness.

## Account-Character Parity

Run `npm run verify:account-character` before changing account-character entry,
client parity, or account-owned gameplay routes. It covers `/v1/characters`,
protocol drift, server create/select play-token handoff and login projection proof,
shared account-character HTTP type proof, server shop/work/property gameplay route proof, debug-client guards, debug-client gameplay wire-authority proof,
Android account-character unit tests, Android account-character token login handoff proof,
and Android gameplay wire-authority protocol proof.

The public website and four Codex surfaces (Public, Builder, Operator, Agent) live
in the separate `akalynth-site` source repo. Before changing the account portal,
beta page, Codex routes, public boundary wording, or site-side shop/work/property
hooks, run `./scripts/verify-account-character-site.sh` from `akalynth-site`.
That wrapper runs `scripts/verify-site-e2d-character-gameplay.mjs`, which includes
executable site E2D character and gameplay action proof for account-scoped
create/select/shop/work/property requests plus explicit no-session/no-CSRF inline helper proof.

## Project Structure

```
akalynth/
  apps/server/        # Authoritative MMO server (TypeScript)
  apps/debug-client/  # Debug web client (Vite)
  apps/studio/        # Studio web app (Vite)
  apps/phone-server/  # Phone/companion server (TypeScript)
  apps/android/       # Android client (Kotlin/Compose)
  packages/           # Shared libraries (shared, coordination-kernel, verification-spine, ...)
  crates/             # Rust crates (chronicle witness kernel)
  docs/               # Specifications and stage boundaries
  scripts/            # Bootstrap, verification, and dev scripts (Linux)
  tools/              # Tooling and validators
  infra/              # Deploy notes, CI/CD, Docker runtime, infrastructure
  data/               # Map/data sources
  drop/               # Imported source material for future lore/gameplay/assets
```

## Docker Runtime

The server Docker runtime is documented in `../infra/README.md`.

Useful local checks:

```bash
npm run verify:docker-runtime
npm run render:docker-runtime
npm run smoke:docker-runtime
npm run verify:account-character
```

The render command writes reviewable host runtime files to `.tmp/` by default.
The smoke command uses disposable Docker state only. Live host migration still
requires backup, rollback, and single-runtime-owner gates.
`npm run verify:account-character` is the focused gate for account/session +
CSRF-gated character creation/select across the server, debug client, and
Android client.

## Documentation

Showcase / driver packet:

- [Current Stage](./CURRENT_STAGE.md) - canonical claim boundary for the repo now
- [Showcase Runbook](./SHOWCASE_RUNBOOK.md) - bounded local demonstration path
- [Proof Run Template](./PROOF_RUN_TEMPLATE.md) - template for recording a run without overclaiming
- [Known Gaps](./KNOWN_GAPS.md) - release blockers, engineering risks, and presentation rules

Design / production notes:

- [Classic 32 Art And Mobile UI Direction](./CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md) - old-school 32x32 art direction, OpenAI asset pipeline, and mobile HUD rules
- [Asset Sync Policy](./ASSET_SYNC_POLICY.md) - git policy for `data/assets-built/` vs Android/debug-client mirrors; contributor sync workflow
- [Asset Decision Packets](./asset-decisions/README.md) - receipt-backed asset/map/mobile decision-packet index and cleanup boundary

Core docs:

- [V1 Scope Fence](./V1_SCOPE.md) - what v1 includes and explicitly defers
- [Architecture](./ARCHITECTURE.md) - server loop, world state, anti-cheat pipeline
- [Protocol](./PROTOCOL.md) - message types and examples
- [Client Contract v0.1 (Frozen)](./CLIENT_CONTRACT_V0_1.md) - frozen Android/client wire compatibility contract
- [Anti-Cheat](./ANTICHEAT.md) - detection signals, Tem challenge, enforcement
- [Identity Verification v0.1](./IDENTITY_VERIFICATION.md) - external verification protocol for identity tokens
- [Persistence Matrix](./PERSISTENCE_MATRIX.md) - state classified by durability, authority, and evidence
- [Manifesto](./MANIFESTO.md) - narrative manifesto: the world's tone, the Ledger, and why it endures
- [World: High City](./WORLD_HIGH_CITY.md) - first-city layout, spawn zone, landmarks
- [World: Rookguard](./WORLD_ROOKGUARD.md) - mandatory 32×32 onboarding/training map
- [Rookguard First 30 Minutes v1](./ROOKGUARD_FIRST_30_MINUTES_V1.md) - 0-30 minute onboarding experience and sim-visible game plan
- [Rookguard City Expansion v1](./ROOKGUARD_CITY_EXPANSION_V1.md) - plaza/guild/profession/training/Codex landmarks and first wiring slice
- [World Evolution](./WORLD_EVOLUTION.md) - epochs, sunsets, and founder-absence survival rules
- [Akalynth Lore Bible](./AKALYNTH_LORE_BIBLE.md) - current lore authority and naming boundary
- [Drop Source Index](./DROP_SOURCE_INDEX.md) - imported source material for future lore/gameplay/assets; not runtime authority
- [Copilot Delegation](./COPILOT_DELEGATION.md) - custom agents, domain specialists, constraint enforcement

Verification, governance, and proof docs:

- [Design-Provenance Governance Contract](./AKALYNTH_DECISION_RECORD_V1.md) - federated authority, decision records, conformance, conflict resolution, and the World Architect mandate
- [Design-Provenance Adoption Decision](./decisions/AKALYNTH_DESIGN_PROVENANCE_ADOPTION_V1/ADOPTION_DECISION.md) - accepted scope relationship among civil governance, design provenance, and narrative canon
- [Risk & Consequence Spine Decision](./decisions/AKALYNTH_RISK_CONSEQUENCE_AND_COMMITMENT_V1/DECISION.md) - accepted design decision for durable risk, recovery, standing contexts, ECE/RCE/MCE, CRB, coupled outcomes, and receipt evidence; implementation remains unauthorized
- [Verification Spine API v1](./VERIFICATION_SPINE_API.md) - the mandatory pre-merge verification system contract
- [Spine Lock v1](./SPINE_V1.md) - locked spine surface and verifier registration rules
- [Simulation Lane Runbook](./SIM_LANE_RUNBOOK.md) - `sim-api.akalynth.com` / `sim.akalynth.com` lane contract, state custody, and verification steps
- [Sim Life Viewer v1](./SIM_LIFE_VIEWER_V1.md) - visible-agent dashboard, Rookguard 0-30 gameplan, and `/v1/sim/snapshot` contract
- [Governance Invariants](./GOVERNANCE_INVARIANTS.md) - civil guarantees and auditability constraints
- [Repo Hygiene Architecture](./REPO_HYGIENE_ARCHITECTURE.md) - root/doc/archive/drop cleanup rules
- [Constitutional Amendment Process](./CONSTITUTIONAL_AMENDMENTS.md) - formal process for modifying constitutional files
- [RNG Outcome Verification](./RNG_OUTCOME_VERIFICATION.md) - offline verifier for receipt-recorded RNG outcomes and its caveats
- [Simulate Without Lying](./SIMULATE_WITHOUT_LYING.md) - Fork/Replay system for counterfactuals isolated from truth
- [MVP Verification Report v1](./archive/MVP_VERIFICATION_REPORT_v1.md) - **archived** point-in-time verification record (superseded by the verification spine)
- [Archived Asset Decision Packets](./archive/asset-decisions/README.md) - **archived** superseded decision lanes
- [Load Test Harness](./LOAD_TEST_HARNESS.md) - load-test spec (authorized local/staging only)
- [High-Leverage Decision Checklist](./HIGH_LEVERAGE_DECISION_CHECKLIST.md) - checklist for high-leverage task selection
- [Leverage Tier Mapping](./LEVERAGE_TIER_MAPPING.md) - current-state leverage tier mapping

Monetization docs:

- [Monetization Constitution](./MONETIZATION_CONSTITUTION.md) - formal, enforceable monetization policy
- [Monetization Receipts](./MONETIZATION_RECEIPTS.md) - receipt schema for auditable, reversible monetization
- [Monetization Justifications](./MONETIZATION_JUSTIFICATIONS.md) - registry of “not power” justification IDs
- [Monetization Blueprint](./archive/MONETIZATION_BLUEPRINT.md) - **archived** pre-formalization design sketch; do not cite as policy

UI / client docs:

- [UI Proposal (FREEZE)](./UI_PROPOSAL.md) - frozen Mobile UI v0 spec
- [UI Implementation Proposal](./UI_IMPLEMENTATION_PROPOSAL.md) - normative Android UI implementation guidance
- [UI Mapping Checklist](./UI_MAPPING_CHECKLIST.md) - implementation mapping checklist against the UI spec
- [UI Regression Matrix](./UI_REGRESSION_MATRIX.md) - behavioral contract for Android UI, mapped to tests

Audits:

- [System Audit — Post-Repair v1](./AUDITS/ARCHIVED/SYSTEM_AUDIT_POST_REPAIR_v1.md) - **archived** point-in-time audit result (superseded by the Codex audit procedure)
- [System Audit — Codex Post-Repair](./AUDITS/SYSTEM_AUDIT_CODEX_POST_REPAIR.md) - Codex post-repair audit prompt
- [Static Site Retirement](./archive/SITE_RETIRED_FROM_MONOREPO.md) - **archived** record of retiring the old monorepo static-site copy

Archived planning and reference docs:

- [Technical Driver Brief](./archive/DRIVER_BRIEF.md) - archived technical-driver orientation.
- [30-Day Driver Plan](./archive/DRIVER_30_DAY_PLAN.md) - archived bounded execution sketch.
- [Proof Bundles](./archive/PROOF_BUNDLES.md) - archived proof-export design sketch; not implemented.
- [APK Distribution Checklist](./archive/APK_DISTRIBUTION_CHECKLIST.md) - archived ship-and-observe checklist.
- [Witness-Ledger Architecture](./archive/reference/WITNESS_LEDGER_ARCHITECTURE.md) - archived WLA narrative reference.
- [WLA v1.0 Final](./archive/reference/WLA_V1_FINAL.md) - archived finality declaration.
- [RFC WLA-001](./archive/reference/RFC_WITNESS_LEDGER.md) - archived WLA draft specification.
- [Mail MMO System](./archive/speculative/AKALYNTH_MAIL_MMO.v1.md) - archived speculative design doctrine, not active.

## V1 Claim Boundary

The original MVP was:

- Guest login (no registration required)
- Authoritative grid movement
- Chat
- Audit receipts (JSONL)
- Tem anti-bot challenge

The repository now contains additional implemented systems, including combat, death, item handling, protected slots, chronicle evidence, treasury, work contracts, NPC recognition, Android client code, and a load-test harness.

These systems are not automatically release-claimed. A system is release-claimed only when it is:

1. listed in [Current Stage](./CURRENT_STAGE.md),
2. covered by a named verifier or smoke test,
3. included in a passing CI/local proof run,
4. and documented in the release or proof-run artifact.

## Explicitly Not Claimed

- Production deployment readiness
- Commercial MMO readiness
- Content-alpha gameplay depth
- Public launch readiness
- Android release readiness
- Long-lived persistent-world guarantees
