# Witness-Ledger Architecture v1.0 FINAL

**Status:** FINAL
**Effective Date:** 2026-01-22
**RFC:** WLA-001

---

## Declaration

The Witness-Ledger Architecture (WLA) is hereby declared **v1.0 FINAL**.

This specification is frozen. No breaking changes will be made to:
- Core artifact schemas (WitnessEvent, Snapshot, Explanation, ProofBundle, Fork)
- The five isolation invariants
- The three conformance levels (Lite, Standard, Full)
- Anchoring semantics and verification contracts

Future work proceeds only through:
- Non-breaking extensions (new optional fields)
- Additional backend implementations
- New application bindings
- Clarifying errata

---

## Component Registry

| Component | Location | Version | Status |
|-----------|----------|---------|--------|
| RFC WLA-001 | `docs/RFC_WITNESS_LEDGER.md` | 1.0 | FINAL |
| Witness Module | `packages/coordination-kernel/src/witness/` | 0.4.0 | STABLE |
| Conformance Suite | `packages/coordination-kernel/src/conformance/` | 1.0.0 | STABLE |
| Anchor Module | `packages/coordination-kernel/src/anchor/` | 1.0.0 | STABLE |
| AI Governance Binding | `packages/ai-tool-governance/src/witness/` | 1.1.0 | STABLE |

### Supporting Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| Architecture Overview | `docs/WITNESS_LEDGER_ARCHITECTURE.md` | Master pattern document |
| Proof Bundle Reference | `docs/PROOF_BUNDLES.md` | Portable evidence specification |
| Fork Discipline | `docs/SIMULATE_WITHOUT_LYING.md` | Simulation isolation rules |

---

## Core Guarantees

### 1. Witness Independence
A witness can leave the system and still be trusted. Proof bundles are self-contained, portable, and verifiable without access to the original system.

### 2. Receipt-First Persistence
Nothing is true until receipted. State changes require receipt emission. The receipt chain is the canonical source of truth.

### 3. Fork Isolation
Simulated events never contaminate confirmed truth. The five isolation invariants are enforced at the type level.

### 4. Explanation Without Inference
Systems report causality from receipts; they do not interpret or infer. Every explanation traces to code and receipts.

### 5. Anchor Immutability
Once anchored, a proof bundle's content hash is committed to external time. Verification works offline, years later.

---

## The Five Isolation Invariants

These MUST be enforced by any conforming implementation:

1. **No Confirmed Simulations** - Simulated events NEVER have `confirmed` status
2. **Source Marker** - Simulated events MUST have `source: 'client_intent'`
3. **ID Prefix** - Simulated event/action IDs MUST use `sim_` or `fork_` prefix
4. **Display Marker** - UI rendering MUST include `[SIMULATED]` indicator
5. **No Interleaving** - Fork timelines MUST NOT mix confirmed and simulated entries

---

## Conformance Levels

### Witness-Lite (6 checks)
Basic event witnessing. Suitable for logging and audit trails.

### Witness-Standard (13 checks)
Adds proof bundle generation. Suitable for portable evidence.

### Witness-Full (21 checks)
Adds fork simulation. Suitable for "what-if" analysis and debugging.

Use `validateWitnessLite()`, `validateWitnessStandard()`, or `validateWitnessFull()` from `@akalynth/coordination-kernel/conformance` to verify compliance.

---

## Stability Commitment

This declaration establishes the following commitments:

1. **Schema Stability** - Core artifact schemas will not change in breaking ways
2. **Invariant Permanence** - The five isolation invariants are permanent
3. **Verification Compatibility** - Bundles anchored today will verify in future versions
4. **Conformance Continuity** - Existing conformance levels will remain valid

---

## Acknowledgments

The Witness-Ledger Architecture emerged from the principle that **trust requires verifiable history**. A system that cannot prove what happened cannot be trusted. A witness that cannot leave cannot truly witness.

WLA v1.0 represents a complete, sufficient, and frozen specification for:
- Recording events with integrity
- Building portable evidence
- Simulating without lying
- Anchoring across time

The architecture is done. Build on it.

---

*"A witness that can leave and still be trusted."*
