# Recommended Next Lane

Lane name: AKALYNTH_CHAT_RETENTION_AND_RECEIPT_REDACTION_DECISION_V1

Status: decision-only recommendation. No implementation.

## Goal

Decide whether current plaintext world/local chat bodies should remain in audit receipt inputs for pre-alpha, be redacted, be hash-only, or be retained under a bounded policy before any private-message or encryption implementation is planned.

## Reason

The authority decision keeps world chat accountable and server-readable, but the retention boundary is still a policy decision. The next lane should decide what the project promises about stored chat bodies, receipt visibility, retention duration, and operator access.

## Inputs

- CHAT_AUTHORITY_DECISION.md
- CHAT_SURFACE_POLICY.md
- REPORTING_AND_MODERATION_DECISION.md
- RECEIPT_BOUNDARY_DECISION.md
- CHAT_ENCRYPTION_RESEARCH.md
- RECEIPT_AND_PROOF_IMPACT.md

## Required Decisions

- Whether plaintext `inputs.message` remains acceptable in current `chat` receipts.
- Whether chat receipt bodies are private operational evidence or public/debug evidence.
- Whether chronicle hash/length evidence is sufficient for any public proof surface.
- Whether a future redaction model should preserve replay determinism.
- Whether chat retention is unbounded, bounded, or environment-specific.
- Whether moderation needs message excerpts before encrypted whispers are considered.

## Forbidden

- No code edits.
- No schema edits.
- No protocol edits.
- No encryption libraries.
- No runtime mutation.
- No build, deploy, service, /opt, /var/lib, /etc, Caddy, or systemd change.

## Closure

closed_chat_retention_and_receipt_redaction_decision_no_implementation_no_runtime_mutation
