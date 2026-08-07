# AKALYNTH_RISK_CONSEQUENCE_AND_COMMITMENT_V1 — Decision

Status: **accepted**

Authority: **Project direction in Codex thread
`019fadc4-59a5-7a33-8db0-c49c205e23b1`; durable natural-person approver
identity not recorded**

Decision date: **2026-07-29**

Effective version: **Risk & Consequence Spine v0.3.1 and Standing Contexts +
ECE/RCE/MCE + CRB v0.3.1**

Supersedes: **none**

Superseded by: **none**

Decision scope: **design decision only**

Repository adoption status: **working-tree decision record; commit not
authorized**

Implementation authority: **none**

## Context

### Design problem

Akalynth requires a load-bearing risk and consequence architecture in which:

- player-earned power creates durable, legible consequences;
- recovery remains possible without becoming charitable restoration;
- pure time cannot create permanent winner immunity;
- clients submit intent but never own outcome truth;
- accepted exposure resolves exactly once across disconnect and restart;
- canonical history is append-only; and
- multi-player, item-custody, recovery, and remediation concurrency cannot
  duplicate or silently rewrite effects.

### Existing authority

- [`GOVERNANCE_INVARIANTS.md`](../../GOVERNANCE_INVARIANTS.md) and its
  authoritative Civil Guarantees index retain authority over G1–G15.
- [`AKALYNTH_DECISION_RECORD_V1.md`](../../AKALYNTH_DECISION_RECORD_V1.md)
  governs this decision's provenance, scope, approval, conformance, conflict,
  and supersession handling.
- [`AKALYNTH_LORE_BIBLE.md`](../../AKALYNTH_LORE_BIBLE.md) retains narrative
  canon authority.
- [`CURRENT_STAGE.md`](../../CURRENT_STAGE.md),
  [`KNOWN_GAPS.md`](../../KNOWN_GAPS.md), and
  [`V1_SCOPE.md`](../../V1_SCOPE.md) continue to bound current implementation
  and maturity claims.

This decision neither modifies nor supersedes those authorities.

### Accepted design inputs

Project direction accepted two dependency-ordered design texts:

1. Risk & Consequence Spine v0.3.1; and
2. Standing Contexts + ECE/RCE/MCE + CRB v0.3.1.

The approval chronology and thread locator are preserved in
[`APPROVAL_EVIDENCE.md`](./APPROVAL_EVIDENCE.md).

## Proposal

Adopt the two versioned normative attachments in this packet as one
design-decision set:

- the spine defines player-facing consequence, recovery, contestability,
  sanctuary, protection, lifecycle, operational, and health invariants; and
- the commitment/receipt package defines the server-owned identities, durable
  basis, exactly-once root and seal machinery, recovery reservations,
  authority-bounded remediation, multi-subject atomicity, evidence audiences,
  and conformance surface needed to express those invariants.

## Decision

**Accepted.**

Akalynth adopts both hashed attachments as a single, dependency-ordered design
decision:

1. [`RISK_AND_CONSEQUENCE_SPINE_V0_3_1.md`](./RISK_AND_CONSEQUENCE_SPINE_V0_3_1.md)
   defines the governing risk and consequence invariants.
2. [`STANDING_CONTEXTS_ECE_RCE_MCE_CRB_V0_3_1.md`](./STANDING_CONTEXTS_ECE_RCE_MCE_CRB_V0_3_1.md)
   refines the acceptance, resolution, recovery, remediation, custody,
   concurrency, and evidence machinery.

The package may refine the spine's machinery but cannot weaken the spine's
player-facing invariants.

Both attachments are co-normative. An apparent contradiction becomes a
recorded decision conflict under
[`AKALYNTH_DECISION_RECORD_V1.md`](../../AKALYNTH_DECISION_RECORD_V1.md).
Neither attachment silently overrides the other.

The accepted MCE interpretation is binding:

> An integrity fault is evidence and a trigger, never remediation authority by
> itself. Every MCE requires an explicit authority receipt or a preauthorized
> remediation-policy reference.

## Normative attachment manifest

| Attachment | Version | Role | SHA-256 |
| --- | --- | --- | --- |
| [`RISK_AND_CONSEQUENCE_SPINE_V0_3_1.md`](./RISK_AND_CONSEQUENCE_SPINE_V0_3_1.md) | v0.3.1 | Governing gameplay spine | `8a5f39377c574ba86bfe1f34f6ea5d0dd3eba7901525fafa7c810bff0bdcb444` |
| [`STANDING_CONTEXTS_ECE_RCE_MCE_CRB_V0_3_1.md`](./STANDING_CONTEXTS_ECE_RCE_MCE_CRB_V0_3_1.md) | v0.3.1 | Commitment and canonical evidence machinery | `3d641800cb9a4e9c2bcbe631c95777194c5051ff758bbb8f1eb3f3b29011fe40` |

Any content change requires a new attachment version, new hashes, and an
authorized superseding or amending decision. The hashed files must not be
silently edited in place.

## Rationale

- Risk must remain legible before commitment and durable afterward.
- Recovery must restore agency without erasing the event or recreating lost
  identity.
- Server-owned acceptance and one authoritative root prevent client-side truth,
  duplicate resolution, and reconnect evasion.
- Immutable manifests and seals preserve append-only history while supporting
  crash completion.
- Canonical read/write claims prevent item, territory, faction, world, and
  recovery double spending while projections lag.
- Coupled interactions preserve conserved state across multiple subjects.
- RCE reservation accounting prevents recovery over-allocation and abandonment
  grief.
- MCE keeps correction typed, authority-bounded, delta-bounded, and separate
  from player-earned recovery.
- Permanent evidence and audience-specific projection preserve auditability
  without making private evidence public.

## Consequences

- World/canon impact: **none**. This record does not establish narrative or
  world canon.
- Systems impact: **design inheritance only**. Future combat, progression,
  territory, organization, economy, recovery-custody, receipt, replay,
  Chronicle, protocol, persistence, and operational designs must identify how
  they conform before implementation approval.
- Player-experience impact: **none in the current build**. If implemented, the
  intended experience is legible risk, durable consequence, earned recovery,
  contestable power, and server-authoritative history.
- Civil-guarantee impact: **none**. No G1–G15 amendment is made.
- V1 impact: **none**. V1 scope is unchanged.
- Documentation affected: this decision packet, `docs/README.md`, and
  `docs/CLAIM_INDEX.md`.
- Runtime, protocol, data, asset, economy, and deployment impact: **none from
  this decision record**.

## Explicit non-claims and deferred scope

This decision does not claim or authorize:

- implemented ECE, RCE, MCE, CRB, coupled-batch, or interaction-seal support;
- wire encoding, storage engine, transaction representation, or migration;
- current combat/death/drop/reconnect conformance;
- production persistence or production-readiness;
- combat formulas, drop tables, progression curves, reputation amounts,
  economy costs, timers, thresholds, or observation windows;
- drop-locus or corpse-entity design;
- concrete standing-context composition tables;
- client disclosure copy or UX;
- anti-cheat thresholds or enforcement changes;
- G1–G15 amendment;
- V1 expansion;
- canon promotion;
- implementation, staging, commit, push, deployment, or release claim.

## Implementation

Implementation status: **not started**

Implementation authority: **none**

Evidence: **none**

Any implementation requires a separately authorized lane. It must route receipt
and replay work through the receipt-chain steward, protocol changes through the
protocol guardian, gameplay inheritance through the applicable gameplay
stewards, and verification selection through the test runner.

## Conformance gate

No implementation or release claim may cite this decision as satisfied until:

1. a named implementation or build is identified;
2. the applicable conformance cases in both normative attachments are
   executable;
3. G1–G15 verification is selected and passes for that build;
4. receipt-chain and replay evidence demonstrates exactly-once behavior;
5. player-facing disclosure, sanctuary, recovery-floor, and contestability
   behavior is playtested where receipts alone cannot prove comprehension; and
6. a conformance record reports one outcome permitted by
   `AKALYNTH_DECISION_RECORD_V1.md`.

No conformance run was performed by this documentation-only lane.

## Repository adoption and custody

Packet creation authority: **granted by project direction's request for a
durable decision record covering the spine and package**

Working-tree base commit:
`570911b444e028dd60e541182fb5bed14ab67423`

Working branch: `codex/branch-hygiene-completion`

Repository state: **local working-tree record**

Commit identity: **none**

Commit, push, and deployment authority: **none**

The record is durable in the local workspace. Shared repository adoption
remains incomplete until a separately authorized commit records this packet and
its navigation updates.

## Change control and supersession

This decision may be changed only by:

- an authorized superseding decision;
- a versioned amendment that preserves or explicitly enters the G1–G15
  amendment path; or
- a conflict-resolution record under the design-provenance contract.

Older versions remain part of decision history. They are never deleted or
rewritten to simulate continuity.

## Approval

Approved by: **Project direction in Codex thread
`019fadc4-59a5-7a33-8db0-c49c205e23b1`; durable natural-person approver
identity not recorded**

Approval evidence:
[`APPROVAL_EVIDENCE.md`](./APPROVAL_EVIDENCE.md)
