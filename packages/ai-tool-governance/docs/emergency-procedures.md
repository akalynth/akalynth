# Emergency Procedures (AI Tool Governance)

> **Status:** Reference

Emergency powers are legal states with stricter downstream obligations, not loopholes.

See:

- `packages/ai-tool-governance/src/emergency/override.ts`
- `packages/ai-tool-governance/src/emergency/review.ts`

## Requirements

Emergency overrides should:

- Require explicit justification (structured fields, not only prose)
- Emit receipts for: request, override, execution, and review state transitions
- Enforce review deadlines mechanically

