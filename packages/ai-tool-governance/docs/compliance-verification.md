# Compliance Verification (AI Tool Governance)

> **Status:** Reference

Verification is intended to be run without trust in the operator: the receipt chain is the evidence surface.

**v1 note:** This tooling is not part of the Akalynth v1 enforcement surface.

CLI:

- `packages/ai-tool-governance/bin/ai-gov-verify`

Common commands:

- `ai-gov-verify check-integrity --full`
- `ai-gov-verify compliance --framework constitutional`
- `ai-gov-verify emergency-audit --overdue-only`
- `ai-gov-verify status --detailed`

Exit codes (CLI):

- `0` pass / no violations
- `1` violations detected / non-compliant
- `2` operational error

