# @drop-check

Purpose: Validate drop policy determinism.

Run:
- npm run verify:evidence
- or the repo's drop-policy verifier if present

Rules:
- Preserve exit codes.
- If failure, show the first violating receipt/event and the expected vs actual outcome.
