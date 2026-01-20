# Constitutional Principles (AI Tool Governance)

> **Status:** Reference

This package implements an AI tool execution governance surface intended to align with proof-native invariants.

Canonical invariants for v1 live in:

- `docs/GOVERNANCE_INVARIANTS.md`

Note: `packages/coordination-kernel/CONSTITUTIONAL_API_FREEZE.md` is a non-binding draft and not v1 law.

## Principles → Code Surface

| Principle | What it forbids | Where it lives |
|---|---|---|
| Evidence invariant | Unreceipted state transitions | `packages/coordination-kernel/src/receipt/*` |
| Temporal invariant | Permanent / unbounded authority | `packages/ai-tool-governance/src/risk/friction.ts` |
| Segregation invariant | Self-authorization of high-impact actions | `packages/ai-tool-governance/src/patterns/segregation.ts` |
| Emergency doctrine | “Loophole” emergency overrides | `packages/ai-tool-governance/src/emergency/*` |
| Finality invariant | Human override of compliance outcomes | `packages/ai-tool-governance/src/verification/verifier.ts` |

