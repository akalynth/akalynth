# Design-Provenance Compatibility Review

Review date: **2026-07-10**

Primary outcome: `DECISION_CONFLICT_EXPOSED`

Repository mutation during review: **none**

## Scope and method

The untracked design-provenance contract was compared read-only against the
repository's claim boundaries, civil-governance surface, narrative-canon
authority, decision-packet conventions, documentation lanes, and amendment
procedure.

## Findings

### Conflict 1: governance scope

`docs/GOVERNANCE_INVARIANTS.md` calls itself the single source of v1 governance
law while stating a substantive scope of Civil Guarantees G1–G15, enforcement,
and auditability. A design-provenance constitution therefore required an
explicit non-supersession boundary.

Resolution: civil governance retains its existing domain. Design-provenance
governance is a complementary authority and cannot modify G1–G15.

### Conflict 2: canon-domain authority

`docs/AKALYNTH_LORE_BIBLE.md` claims authority over canon lore, while the
proposed canon hierarchy placed approved gameplay and maps above lore. Treating
either statement as a universal automatic override would create an authority
collision.

Resolution: the lore bible retains authority over approved narrative lore. The
canon hierarchy is evidentiary precedence among approved sources, not an
override mechanism. Cross-domain disagreement enters conflict resolution.

## Strong compatibility evidence

Existing Akalynth practice already separates:

- implementation from release claims;
- visual acceptance from runtime authority;
- source material from promoted canon;
- decisions from downstream implementation;
- active decisions from preserved superseded history.

The adopted model formalizes these practices without changing runtime behavior,
player guarantees, or world canon.

## Review closure

```text
compatibility_review: complete
primary_outcome: DECISION_CONFLICT_EXPOSED
conceptual_compatibility: strong
adoption_ready: conditional
authority_conflicts: 2
files_modified_by_review: none
```

The conditions were resolved by `ADOPTION_DECISION.md`.
