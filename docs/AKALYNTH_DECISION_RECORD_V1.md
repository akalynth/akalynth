# AKALYNTH_DECISION_RECORD_V1

Status: **approved design-provenance governance contract**

Version: **1**

Effective: **2026-07-10**

Authority: **Project direction; durable approver identity not yet recorded**

Approval evidence: **[AKALYNTH_DESIGN_PROVENANCE_ADOPTION_V1](./decisions/AKALYNTH_DESIGN_PROVENANCE_ADOPTION_V1/ADOPTION_DECISION.md)**

Repository adoption status: **execution candidate; commit not authorized**

## Purpose

Preserve three forms of Akalynth continuity:

- **World continuity:** what remains true inside Akalynth.
- **Decision continuity:** what the project chose, under whose authority, and why.
- **Conformance continuity:** whether successive builds faithfully express those
  choices.

Canon answers: **What is true in the world?**

Decision answers: **What did the project choose, reject, defer, or replace?**

## Authority rules

No proposal becomes canon solely through repetition.

No implementation becomes approved solely through existence.

No decision remains authoritative after being explicitly superseded.

Therefore:

- `content approval` does not mean `repository adoption`;
- `repository adoption` does not mean `implementation`;
- `implementation` does not mean `conformance`;
- `observation` does not mean `approval`;
- `accepted` does not mean `implemented`;
- `implemented` does not mean `approved`;
- `observed` does not mean `canon`.

Memory may help locate or interpret evidence. It cannot substitute for missing
authority or complete an absent record.

> Project truth must be reconstructable, contestable, and correctable without
> depending on personal recollection.

Observed behavior follows this authority path:

```text
Observed behavior
        ↓
      Review
        ↓
Explicit approval
        ↓
Canon, where the decision concerns the world
```

The running build is evidence. It is not automatically authority. Bugs,
placeholders, obsolete content, and incidental implementation behavior do not
become canon without explicit review and approval.

## Design provenance model

| Layer | Question | Durable artifact |
| --- | --- | --- |
| Belief | What is true about the world? | Canon |
| Choice | Why did the project decide this? | Decision record |
| Build | What was implemented? | Source, assets, and maps |
| Observation | What actually happened? | Tests, build evidence, and playthroughs |
| Agreement | Does reality match intent? | Conformance result |

The governed lifecycle is:

```text
Imagination
    ↓
Proposal
    ↓
Decision
    ↓
Canon and design authority
    ↓
Implementation
    ↓
Observed build
    ↓
Verification against decision
    ↺ correction or authorized reconsideration where evidence warrants it
```

The observed build may challenge a decision, but it does not gain authority over
that decision. Reconsideration must pass through an authorized decision.

## Federated authority model

Akalynth governance is divided by domain. No document silently supersedes
another outside its authority.

- **Civil governance:** `GOVERNANCE_INVARIANTS.md` retains authority over Civil
  Guarantees G1–G15, their enforcement, amendment, and auditability.
- **Design-provenance governance:** this document governs canon and design
  decisions, implementation lineage, observed-build evidence, conformance,
  conflict resolution, governed reconsideration, and the World Architect
  mandate.
- **Narrative canon authority:** `AKALYNTH_LORE_BIBLE.md` retains authority over
  approved narrative lore within its domain.

This document neither modifies nor supersedes G1–G15. Cross-domain
discrepancies enter conflict resolution; no source wins automatically because
of its format or implementation status.

## World Architect mandate

The World Architect ensures that every feature, location, quest, item,
mechanic, interface, asset, and technical system contributes to one believable,
continuous world.

The role is bidirectional:

- **Forward authority:** clarify what should exist, under what rationale, and
  with what world consequences.
- **Backward verification:** establish what exists, what evidence demonstrates
  it, and how faithfully it expresses the authorized decision.

The World Architect must not invent missing canon, silently resolve conflicts,
or convert implementation and observation into authority.

## Vocabulary

- **Observation:** Directly evidenced by a build, asset, map, document, or test.
- **Canon:** Explicitly approved as true within Akalynth.
- **Inference:** A conclusion supported by evidence but not explicitly approved.
- **Assumption:** A temporary premise used to continue work.
- **Proposal:** A candidate addition or change awaiting resolution.
- **Conflict:** Two apparently authoritative sources disagree.
- **Open question:** Available evidence cannot responsibly resolve the matter.
- **Decision:** An authorized resolution with recorded status and rationale.

## Canon hierarchy

Use this hierarchy only for material that has been explicitly approved:

1. Approved gameplay
2. Approved maps and world
3. Approved lore
4. Approved visual language
5. Approved design decisions
6. Supporting documentation

This is default evidentiary precedence, not an automatic override mechanism.
Domain authority and intentional approval remain decisive. Higher placement is
not permission to resolve a discrepancy silently. A conflict between approved
sources must follow the conflict-resolution procedure below.

## Decision record template

Copy this section into a new record. Do not delete fields; use `none`,
`unknown`, or `not applicable` where necessary.

```markdown
# <DECISION_ID> — <Subject>

Status: proposed | accepted | rejected | deferred | superseded
Authority: <person or decision body; unknown is permitted>
Decision date: <YYYY-MM-DD or unknown>
Effective version: <version, milestone, or not applicable>
Supersedes: <decision IDs or none>
Superseded by: <decision ID or none>

## Context

<Established observations, canon, constraints, and open questions. Label each.>

## Proposal

<The candidate choice stated precisely.>

## Decision

<The authorized outcome. For proposed records, write "Pending".>

## Rationale

<Why this outcome was chosen, rejected, deferred, or replaced.>

## Consequences

- World/canon impact: <impact or none>
- Systems impact: <impact or none>
- Player-experience impact: <impact or none>
- Documentation/assets affected: <paths or unknown>

## Implementation

Implementation status: not started | partial | implemented | verified | not applicable
Evidence: <commits, tests, builds, maps, assets, or none>

## Approval

Approved by: <authority or pending>
Approval evidence: <durable reference or pending>
```

## Conformance results

Every conformance review uses exactly one primary outcome:

- `CONFORMS`
- `PARTIALLY_CONFORMS`
- `DOES_NOT_CONFORM`
- `UNINTENDED_BEHAVIOR_OBSERVED`
- `DECISION_CONFLICT_EXPOSED`
- `RECONSIDERATION_RECOMMENDED`
- `INSUFFICIENT_EVIDENCE`

A result reports evidence; it does not confer authority. In particular:

- `DOES_NOT_CONFORM` does not automatically invalidate the decision.
- `RECONSIDERATION_RECOMMENDED` does not supersede the decision.
- `CONFORMS` does not establish that the decision was wise.
- `INSUFFICIENT_EVIDENCE` must not be converted into presumed compliance.

Use this compact record:

```markdown
# <CONFORMANCE_ID> — <Decision or scope>

Decision under review: <decision ID and effective version>
Build under review: <commit, build, map, asset set, or version>
Outcome: <one conformance result>
Evidence: <durable references>
Scope and method: <what was and was not examined>
Findings: <observations separated from inferences>
Required correction: <action or none>
Reconsideration request: <decision question or none>
Reviewed by: <reviewer or authority>
Review date: <YYYY-MM-DD>
```

## Conflict-resolution procedure

1. **Open a conflict record.** Name the disputed claim and every known source.
   Do not alter canon or implementation yet.
2. **Classify each source.** Label it as observation, canon, inference,
   assumption, proposal, decision, or supporting documentation. Record its
   approval and supersession status separately.
3. **Establish provenance.** Record author or authority, date/version, intended
   scope, approval evidence, implementation evidence, and any decision it
   supersedes.
4. **Test whether the conflict is real.** Determine whether the sources address
   different versions, scopes, contexts, or layers. Record that conclusion;
   never reconcile them by implication.
5. **Assess consequences.** Explain the world, gameplay, visual, engineering,
   UX, economy, and migration effects of each viable resolution. Mark unknown
   effects explicitly.
6. **Request an authorized decision.** The applicable authority accepts,
   rejects, defers, or supersedes a position. If the authority is unknown, the
   conflict remains open.
7. **Apply the resolution atomically where practical.** Update the decision
   record, affected canon sources, implementation status, and navigational
   indexes together. If work must be staged, list every remaining discrepancy.
8. **Verify and close.** Confirm that affected build behavior and sources agree
   with the decision. Link evidence. Closure means the contradiction is
   resolved, not merely documented.

Until resolution, do not present either side as settled canon. If implementation
must continue, state the temporary assumption, its scope, and its expiry or
review trigger.

## Supersession rule

A superseding record must identify every decision it replaces and explain why.
The older record remains part of decision history but loses current authority.
Do not erase or silently rewrite it. Update its `Status` to `superseded` and its
`Superseded by` field to the new decision ID.

## Deferred future idea: intent continuity

Classification: `FUTURE_IDEA`

Status: `DEFERRED`

Authority: `none`

Current model impact: `none`

Adoption trigger: decision history no longer explains cross-decision direction.

Intent continuity may later preserve the enduring design objective connecting a
family of decisions. It is not a sixth layer of the current model and must not
be treated as authority unless separately proposed and approved.

## Subsequent repository-adoption authority

The repository-adoption status at the top of this contract preserves the state
when the contract was first accepted. Project direction later authorized its
bounded repository adoption as the prerequisite portion of the first of
exactly two scoped commits:

> Approve option 1 — recommended: retain exactly two commits by folding the
> previously accepted design-provenance contract and adoption packet into the
> first governance commit.

That authority includes this contract, the adoption packet, and their scoped
`docs/README.md` and `docs/CLAIM_INDEX.md` navigation entries. It does not
authorize implementation beyond the separately approved Risk & Consequence
slice, merge to a canonical branch, deployment, release, G1–G15 amendment, V1
expansion, or canon promotion.
