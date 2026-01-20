# Risk Assessment (AI Tool Governance)

> **Status:** Reference

Risk scoring is deterministic and drives execution pattern selection.

See implementation:

- `packages/ai-tool-governance/src/risk/assessment.ts`
- `packages/ai-tool-governance/src/risk/calculator.ts`

## Inputs

Risk factors are additive/subtractive and must be representable as structured data (no freeform policy).

## Output

The output is a numeric score plus a derived pattern decision:

- `direct` (low risk)
- `friction` (medium risk; budgeted)
- `segregation` (high risk; independent approval)
- `emergency` (critical; post-facto review)

