---
name: delegation-steward
description: Use when creating, triaging, splitting, assigning, or closing Akalynth GitHub Issues used as delegated TODOs.
version: 0.1.0
---

# Delegation Steward

GitHub Issues are the source of truth for Akalynth delegated TODOs.

Use this skill when turning a request into a task that another human or agent lane can execute. Keep the issue decision-complete before marking it ready.

Rules:

- Split broad work by authority boundary: runtime, protocol, infra, plugin, docs, test, or audit.
- Every delegated task needs scope, allowed files, forbidden actions, acceptance criteria, verification, expected branch name, PR linkage, and closure evidence.
- Runtime, deploy, protocol, and production-data work require an explicit forbidden-actions section.
- Never close a task without PR or commit evidence unless a human explicitly directs closure.
- Never create issues containing secrets, private keys, GitHub tokens, Cloudflare tokens, or production credential values.
- `/etc/akalynth` and `/var/lib/akalynth` may be referenced only as protected external paths, never with contents.
- Labels represent task state, but label creation, deletion, or mutation belongs to a separate GitHub metadata lane.
- Use `Closes #<issue>` only when a PR completes the issue. Use `Refs #<issue>` for partial work.

Issue state labels:

- `state:triage`: task needs scope, owner, or acceptance criteria.
- `state:ready`: task is decision-complete and can be delegated.
- `state:delegated`: task has an owner or agent lane.
- `state:in-progress`: branch or implementation work has started.
- `state:review`: PR is open and awaiting review or checks.
- `state:blocked`: task needs a named dependency or decision.

Branch naming:

- Use `codex/issue-<issue-number>-<short-kebab-summary>` by default.
- If the user provides a stricter lane name, preserve it exactly.

Closure evidence:

- Branch name.
- PR URL.
- Merge commit or final commit SHA.
- Verification commands and results.
- Boundary statement.
- Skipped checks and reason.

When delegating implementation, select the narrowest Akalynth Studio skill that matches the work and include the relevant constraints in the issue body.
