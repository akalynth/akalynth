# Stranger Pilot Admission Gate v1

Status: **NO-GO**

Observed: 2026-08-12T01:15:22Z

Machine evidence: [`admission-gate.v1.json`](./admission-gate.v1.json)

## Decision

Do not create or open the Rookguard stranger cohort yet.

The live beta surfaces are healthy and individually traceable, but they are not
one commit:

| Surface | Bound identity |
| --- | --- |
| Backend | `86bcf0fb0af204e715600a5ec59f4c9a2b8524b8` |
| Portal | merged site `main` commit `121cb9900a4ddff1f01a6c95f02a9f5ec85d2e57` |
| `/play/` | published client source `2dca7bedb27c9f1537d426032e28e4b167fbc3ef`; unchanged through current `main` `146527a88593bf7a2f6f21cc59543127f14e2c03` |
| Direct Android | `2026080704`, source `146527a88593bf7a2f6f21cc59543127f14e2c03` |

The canonicalized observed tuple hashes to
`97d41126cad27e1690d202d535a03d4d81861a025687875f771e5c7f8e5d0510`.

Schema v26 stores only `release_commit` and `rollback_commit` on a cohort. One
backend commit cannot distinguish later client-only ships, portal identity,
policy flags, or their rollback counterparts. Binding the cohort to
`86bcf0f...` would omit the served client; binding it to `146527a...` would
contradict `/v1/health`.

This is the sole hard blocker found by this gate.

## What passed

- Root-custodied sealed backend publication is `PASS`; intended, built, and
  served backend commits all equal `86bcf0f...`.
- Seven checked live portal files exactly match the publisher's clean merged
  site commit `121cb990...`.
- A fresh debug-client build exactly reproduces the live `index.html`, JS, and
  CSS hashes.
- Beta schema recovery, cohort/invite behavior, HTTP router, beta client, and
  static decision contracts passed.
- Credential-free live account/play portal checks passed (`51/51`).
- The site account-character verifier, Android distribution verifier, protocol
  sync, and all six receipt-chain tamper fixtures passed.
- The Rookguard six-window presentation, quest replay, and local WebSocket
  Codex path passed.
- The canonical live receipt chain passed full framing/hash/link verification
  through sequence `27648`; signatures `49..27648` passed under the current
  key. Sequences `1..48` remain covered only by the accepted historical
  exception.

The current-checkout server compile was not claimed green: TypeScript ran, but
the existing partial `node_modules` omitted declared `@types/ws` and
`@types/better-sqlite3`. This is classified as local dependency state, not a
source failure. The sealed backend publish preflight passed, and there is no
server/shared source diff between the served backend commit and current main.

## Minimal repair proposal

This proposal is not approved, adopted, or implemented by this packet.

1. Add `release_manifest_sha256` and `rollback_manifest_sha256` to
   `beta_cohorts` in a separately approved migration.
2. Define canonical JSON manifests binding backend commit and build hash, site
   commit and portal hashes, `/play/` source and asset hashes, policy flags,
   routing identity, and optional Android identity.
3. Require `beta:cohort create` to receive both manifests, recompute their
   digests, compare them to live state, and fail closed on drift.
4. Additively expose the release-manifest digest in cohort status, beta
   receipts, and readiness reports. No WebSocket protocol change is needed.
5. Retain the existing commit fields for compatibility, but never open a new
   cohort without a bound manifest.

## Before GO

- Approve and implement the manifest-binding repair.
- Pass migration, CLI, report, HTTP compatibility, and protocol-sync gates.
- Produce immutable release and rollback manifests for one frozen web cohort.
- Separately authorize and run the credentialed live account/Rookguard smoke;
  it writes account, character, and gameplay receipts and was not run here.
- Capture a new canonical receipt head after that smoke and before participant
  one.
- Separately authorize cohort activation, invitations, and recruitment.

## Authority boundary

This packet records read-only observations and local/ephemeral verification.
It does not authorize deployment, runtime mutation, cohort creation, invite
issuance, recruitment, or any retention claim. The receipt head above is an
observed boundary, not a frozen cohort boundary.
