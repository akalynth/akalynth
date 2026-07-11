# AKALYNTH_BETA_PLAYER_READINESS_AND_MEASUREMENT_V1

Status: accepted for implementation

Authority: project owner approval in Codex session `019f4de7-9736-7a01-ae60-69c9343c79a1`; durable approver identity not recorded

Decision date: 2026-07-11

Effective version: controlled playable pre-alpha beta

Supersedes: none

## Context

Observation: Akalynth has an account/character portal, a server-authoritative
Rookguard first-30-minute path, signed receipts, and live smoke paths. It does
not yet have a bounded invite ledger, cohort identity, player-readiness event
contract, or a player feedback workflow with P0–P3 ownership.

Canon and stage boundary: `docs/CURRENT_STAGE.md` and `docs/KNOWN_GAPS.md`
continue to define the build as a pre-alpha vertical slice. This decision does
not promote the game to content alpha, public launch, or a production MMO.

Constraint: gameplay truth remains server-authoritative. Client events can
describe browser readiness and connection observations only; they cannot claim
movement, combat, inventory, quest, or retention outcomes.

## Proposal

Add a controlled beta operations layer with:

- named cohorts carrying release commit, invite cap, platform, and rollback commit;
- hashed invite codes with atomic redemption to one opaque account;
- an opt-in invite gate for account registration;
- allow-listed browser/WS readiness events written to the signed receipt chain;
- receipt-derived activation, gameplay, stability, session, D1/D7, and feedback reporting;
- player feedback with severity P0–P3, category, reproduction steps, owner, and status;
- operator commands to issue, revoke, pause, close, and triage without exposing tokens or feedback bodies in reports.

## Decision

Accepted. Implement additively in the account/server/receipt/reporting/client
surfaces. Keep invite enforcement disabled until an operator opens a named
cohort and sets `AKALYNTH_BETA_REQUIRE_INVITE=1` for that release.

## Rationale

This gives invited players a measurable path while preserving the existing
account portal, server authority, receipt custody, rollback point, and stage
honesty. A second mutable analytics store would create an avoidable competing
truth source, so readiness observations are allow-listed receipt events and
gameplay metrics are derived from existing server receipts.

## Consequences

- World/canon impact: none.
- Systems impact: additive schema v25, beta HTTP routes, operator CLI, report tool,
  and browser feedback/readiness instrumentation.
- Player-experience impact: invited players can be admitted to a named cohort,
  report P0–P3 issues in-game, and see a controlled-beta status in the account
  portal.
- Privacy impact: invite tokens are hashed at rest; receipts/reports contain no
  email, password, session token, or player-authored feedback in report output.

## Implementation

Implementation status: implemented — source and scoped verifiers pass; no live
cohort has been opened or deployed by this lane.

Evidence: source paths listed by the implementation and the scoped verification
commands in `docs/runbooks/beta-player-readiness-runbook-v1.md`.

## Approval

Approved by: project owner in the current Codex session

Approval evidence: user message approving `BETA_PLAYER_READINESS_AND_MEASUREMENT_V1`
