# AKALYNTH_BETA_PLAYER_READINESS_AND_MEASUREMENT_V1

Status: accepted source-recovery decision; implementation, merge, deployment,
cohort activation, and release claims remain separate

Authority: project-owner authorization in the active Codex thread on
2026-07-30: `Authorize canonical source recovery`

Effective schema target: v26

Current additive successor: schema v27 release/rollback manifest binding is
governed by
[`AKALYNTH_STRANGER_PILOT_RELEASE_MANIFEST_BINDING_V1`](../AKALYNTH_STRANGER_PILOT_RELEASE_MANIFEST_BINDING_V1/DECISION.md).
This v26 decision remains the historical authority for cohort/invite recovery;
it does not authorize an unbound cohort to admit players under v27.

Stage boundary: controlled playable pre-alpha only

## Decision effect

This decision authorizes recovery of the previously deployed controlled-beta
readiness surface into canonical source. It does not:

- deploy a server or static client;
- open, expand, or recruit a beta cohort;
- claim public-launch, content-alpha, production, or retention readiness;
- make browser observations authoritative for gameplay or world state;
- amend G1-G15 or expand the V1 scope fence.

Canonical adoption occurs only through a reviewed, passing merge. Deployment
and cohort activation require their own authority and evidence.

## Context

Akalynth previously implemented a bounded invite ledger, cohort identity,
browser-readiness observations, player feedback, and an operator report path.
That vertical slice was deployed from a branch but was absent from later
canonical source.

Source archaeology also found two incompatible meanings assigned to schema
version 25:

1. Historical schema-source reconstruction used v25 for the four
   `account_characters.outfit_color_*` columns.
2. The beta-readiness branch independently used v25 for `beta_cohorts` and
   `beta_invites`.

A schema number may identify only one durable migration. Recovering the beta
surface by reusing its old v25 migration would preserve an ambiguous and unsafe
upgrade path.

## Source provenance

The recovery evidence is:

- `b929b8dd61bbea8314b0601f6912a061ebbbf3a3`,
  `2eabe81e817233e124568bf3a7230f25dd18b369`, and
  `47690e84c797d5f183b42f2c47a9b19a4ea6e86d`: historical v25 outfit migration
  reconstruction and TypeScript corrections;
- `02716dde46de13644562f764061a15580804fc51`: mixed branch commit containing
  the beta-readiness implementation alongside unrelated HUD and outfit work;
- `686bc8c6d27ba3aed24fc25d44d126cbb9bd3042`: account-portal invite and cohort
  presentation;
- `cb87f09f36d9fd146cb5eb089fd97ea86876b9e3`: additive beta-table
  self-healing;
- `e6e813b2bc50a3291be6063133bb3024075598c3`: historical rollout evidence only.

These commits are provenance inputs, not permission to cherry-pick unrelated
HUD, asset, outfit-rendering, or gameplay changes.

## Decision

### Schema identity

- Schema v25 retains its historical meaning: the four outfit color columns on
  `account_characters`.
- Schema v26 owns `beta_cohorts` and `beta_invites`.
- Initialization must converge supported historical v25 layouts
  idempotently: outfit-only v25, beta-only v25, and the deployed combined
  layout must reach one v26 structure without deleting player or cohort data.
- Re-running initialization at v26 must not duplicate, reset, or silently
  rewrite existing rows.

### Operational authority

`beta_cohorts` and `beta_invites` form a server-owned operational SQLite
ledger. They enforce cohort status, invite caps, hashed-token custody, and
single-account redemption. They are not world state, character power, or
gameplay truth.

The append-only receipt chain records the implemented beta evidence families:

- invite issued;
- invite redeemed;
- allow-listed readiness observation recorded;
- player feedback submitted;
- feedback triaged.

The original operational ledger is not fully reconstructible from those
receipts because every cohort status mutation is not represented. Documentation
must not describe the SQLite tables as receipt-derived world truth. Stronger
rebuild claims require a separately approved receipt/materialization lane.

### HTTP compatibility

The beta surface is additive on the HTTP control plane:

- `GET /v1/beta/me`;
- `POST /v1/beta/events`;
- `POST /v1/beta/feedback`;
- `POST /v1/beta/invites/redeem`;
- optional `invite_code` on `POST /v1/accounts/register`.

It introduces no WebSocket message and requires no WebSocket protocol-version
bump. Invite enforcement remains controlled by server configuration. Existing
clients that do not use these endpoints remain compatible.

### Evidence boundary

Clients may report only allow-listed browser, connection, session, and
onboarding observations. They may not submit authoritative movement, combat,
inventory, quest, economy, position, retention, or world outcomes.

Gameplay and progression metrics must be derived from server receipts.
Readiness observations may supplement those metrics but never replace them.
Public reports must omit credentials, invite tokens, session tokens, email
addresses, and player-authored feedback bodies.

## Failure states and recovery

| Failure | Required posture |
| --- | --- |
| Database reports v25 with only outfit columns | Apply idempotent v26 beta DDL and preserve outfit data. |
| Database reports v25 with only beta tables | Restore the v25 outfit columns, then converge to v26 without deleting beta rows. |
| Database reports v26 with missing required structure | Fail the verifier and repair explicitly; never downgrade the schema number. |
| Duplicate invite redemption | Reject atomically; never bind one invite to two accounts. |
| Telemetry or feedback endpoint unavailable | Gameplay continues; record the observability gap rather than inventing evidence. |
| Release source lacks this surface | Stop deployment against a newer persisted schema; recover source and pass migration gates first. |

## Interaction points

- Account registration may require and redeem an invite when the environment
  gate is enabled.
- The account portal may display the bound cohort.
- The debug client may emit bounded readiness events and authenticated
  feedback.
- Operator tools may create and manage cohorts, issue invites, triage feedback,
  and produce receipt-backed readiness reports.
- The receipt chain remains canonical for gameplay evidence; the beta SQLite
  ledger remains operational admission state.

## Health measures

Measure by named cohort, release-manifest digest, and compatibility commit:

- invite issue-to-redemption conversion;
- first authenticated session and first server-accepted meaningful action;
- world-state reach rate;
- onboarding step and completion rates;
- browser-error and disconnect observations;
- first-session duration;
- D1/D7 return only after eligibility windows mature;
- P0-P3 feedback volume, reproducibility, owner, and resolution status.

Thresholds and cohort size remain operational decisions. No metric generated by
this lane is itself proof that strangers voluntarily return.

## Verification gate

Before canonical merge, the recovery must prove:

1. fresh database initialization to v26;
2. canonical v24 to v26 migration;
3. historical outfit-v25 to v26 migration;
4. conflicting beta-v25 to v26 migration;
5. idempotent v26 re-initialization;
6. focused invite, receipt, feedback, and report behavior;
7. additive HTTP contract documentation and protocol sync;
8. account-portal and debug-client build/smoke compatibility.

Historical rollout evidence does not satisfy these gates for a new commit.
