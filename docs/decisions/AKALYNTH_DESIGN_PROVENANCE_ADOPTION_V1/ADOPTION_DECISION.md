# AKALYNTH_DESIGN_PROVENANCE_ADOPTION_V1 — Adoption Decision

Status: **accepted with scope clarification**

Decision date: **2026-07-10**

Authority: **Project direction; durable approver identity not yet recorded**

Conformance basis: `DECISION_CONFLICT_EXPOSED`

## Decision

Akalynth adopts `docs/AKALYNTH_DECISION_RECORD_V1.md` as its
design-provenance governance contract, subject to the bounded authority model
below.

### Civil governance

`docs/GOVERNANCE_INVARIANTS.md` retains authority over Civil Guarantees G1–G15,
their enforcement, amendment, and auditability.

The design-provenance contract neither modifies nor supersedes G1–G15. Any
future change to those guarantees requires separately authorized constitutional
handling.

### Design-provenance governance

`docs/AKALYNTH_DECISION_RECORD_V1.md` governs:

- canon and design decisions;
- decision rationale and supersession;
- implementation lineage;
- observed-build evidence;
- conformance assessment;
- conflict resolution;
- governed reconsideration;
- the World Architect mandate.

### Narrative canon authority

`docs/AKALYNTH_LORE_BIBLE.md` retains authority over approved narrative lore
within its domain. It does not automatically override approved gameplay, maps,
visual canon, or later authorized canon decisions outside that domain.

Cross-domain discrepancies are classified as conflicts and enter the
design-provenance conflict-resolution procedure. No source wins solely because
it is gameplay, a map, lore, implementation, or documentation.

## Canon hierarchy clarification

The canon hierarchy in `docs/AKALYNTH_DECISION_RECORD_V1.md` is default
evidentiary precedence among explicitly approved sources. It is not an
automatic override mechanism. Domain authority and intentional approval remain
decisive.

## Classification

```text
outcome: ACCEPTED_WITH_SCOPE_CLARIFICATION
conformance_basis: DECISION_CONFLICT_EXPOSED
player_facing_change: NONE
runtime_change: NONE
civil_guarantee_change: NONE
repository_governance_change: YES
canon_change: NONE
```

## Amendment-path assessment

- **Observation:** No protected constitutional file or player guarantee is
  changed by this decision.
- **Inference:** The documented constitutional amendment procedure is not
  triggered by this decision-only lane.
- **Open question:** Whether project authority intends a broader, unwritten
  constitutional scope remains unresolved.

## Implementation status

Adoption execution is authorized for the bounded files named in
`CLAIM_BOUNDARY.md`. Commit, push, deployment, civil-governance amendment, and
narrative-canon amendment are not authorized by this decision.

## Repository custody

Repository state: **working-tree adoption candidate; unstaged**

Commit identity: **none; commit not authorized**

Durable repository adoption remains incomplete until a separately authorized
commit records this packet, the governance contract, and the index updates.

## Subsequent repository-adoption authority

The implementation and custody sections above preserve the state when this
adoption decision was created. Project direction later supplied the required
repository authority:

> Approve option 1 — recommended: retain exactly two commits by folding the
> previously accepted design-provenance contract and adoption packet into the
> first governance commit.

This directive authorizes the bounded file set in `CLAIM_BOUNDARY.md` as part
of that first governance commit. It does not authorize merge to a canonical
branch, deployment, release, runtime implementation, civil-governance
amendment, or narrative-canon amendment.
