# AKALYNTH_RISK_CONSEQUENCE_AND_COMMITMENT_V1 — Claim Boundary

## Accepted narrow claim

Project direction accepted Risk & Consequence Spine v0.3.1 and Standing
Contexts + ECE/RCE/MCE + CRB v0.3.1 as one dependency-ordered gameplay-design
decision.

The exact accepted repository text is limited to the content-hashed normative
attachments named in [`DECISION.md`](./DECISION.md).

## What this decision establishes

- Risk is server-owned standing state and consequence episodes are
  server-bound before resolution.
- Consequence history is durable, append-only, and exactly-once.
- Recovery appends linked compensation and never edits loss.
- Ordinary PvP/PvE death preserves character continuity while consequences
  remain durable.
- At least one minimum-agency recovery route is non-monopolizable.
- G13 protection is zero-or-one, server-committed, and cannot be swapped through
  an accepted exposure.
- Gameplay power retains a credible challenge surface.
- Standing contexts compose disclosure and aggregate ceilings before
  subject-specific ECE acceptance.
- ECE, RCE, and MCE are immutable, typed commitment envelopes.
- Resolution roots commit complete manifests and canonical write claims before
  projection.
- Bundle and interaction seals prove completeness but cannot mutate outcomes.
- Coupled interactions preserve all-or-none cross-subject conserved state.
- RCE reservations are fully consumed or released exactly once.
- MCE remediation always requires authority and remains bounded to an exact
  compensable delta.
- Chronicle and audience views remain projections of canonical receipts.

## G1–G15 and V1 compatibility

- Civil Guarantees G1–G15 remain unchanged.
- The package is designed to inherit append-only receipts, deterministic
  hashing, fsync-before-projection, replay, item identity/location, server
  combat authority, deterministic drop explanation, legendary pressure,
  bounded protection, Chronicle traceability, and external auditability.
- No constitutional amendment is triggered by this documentation-only record.
- V1 scope and current-stage claims remain unchanged.

See [`COMPATIBILITY_REVIEW.md`](./COMPATIBILITY_REVIEW.md) for the bounded review.

## Explicit non-claims

This packet does not claim:

- runtime implementation;
- current-build conformance;
- production or release readiness;
- persistence completeness;
- protocol support;
- storage or batch-transaction support;
- UI disclosure support;
- balanced numbers;
- world or narrative canon;
- G1–G15 amendment; or
- V1 expansion.

It does not authorize implementation, staging, commit, push, deployment,
publication, or release claims.

## Authorized documentation mutation boundary

This lane is limited to:

- `docs/decisions/AKALYNTH_RISK_CONSEQUENCE_AND_COMMITMENT_V1/DECISION.md`
- `docs/decisions/AKALYNTH_RISK_CONSEQUENCE_AND_COMMITMENT_V1/APPROVAL_EVIDENCE.md`
- `docs/decisions/AKALYNTH_RISK_CONSEQUENCE_AND_COMMITMENT_V1/RISK_AND_CONSEQUENCE_SPINE_V0_3_1.md`
- `docs/decisions/AKALYNTH_RISK_CONSEQUENCE_AND_COMMITMENT_V1/STANDING_CONTEXTS_ECE_RCE_MCE_CRB_V0_3_1.md`
- `docs/decisions/AKALYNTH_RISK_CONSEQUENCE_AND_COMMITMENT_V1/COMPATIBILITY_REVIEW.md`
- `docs/decisions/AKALYNTH_RISK_CONSEQUENCE_AND_COMMITMENT_V1/CLAIM_BOUNDARY.md`
- `docs/README.md`
- `docs/CLAIM_INDEX.md`

Existing unrelated working-tree changes remain outside this lane.

## Closure evidence

Local documentation closure requires:

- both normative attachment hashes match `DECISION.md`;
- all packet and navigation links resolve;
- scoped whitespace checks pass;
- the documentation audit completes with outputs outside the repository;
- no packet files are staged without commit authority; and
- final custody reports local file, commit, push, and deployment status
  separately.

## Subsequent implementation and publication custody

The non-claims above bound the accepted design decision and its original
documentation-only recording lane. Separately authorized
[`IMPLEMENTATION_SLICE_01.md`](./IMPLEMENTATION_SLICE_01.md) records a partial,
server-private, non-activating implementation.

The later authority for exactly two scoped commits and an `origin`
feature-branch push does not authorize deployment, release, gameplay
activation, merge to a canonical branch, or a conformance claim. Those
boundaries remain separately governed.

## Subsequent publication-gate repair boundary

Project direction separately authorized closure of every finding surfaced by
the required publication gates before the feature-branch push. That maintenance
adjunct is limited to:

- `packages/shared/protocol.ts`;
- `packages/shared/protocol.golden.json`;
- `packages/shared/scripts/generate-protocol-golden.ts`;
- `packages/shared/builderDraft.ts`;
- `docs/PROTOCOL.md`;
- Android protocol-version mirrors, comments, and parity tests;
- `apps/server/tools/verify-rate-limits.ts`;
- `scripts/verify-web-visual-assets.mjs`;
- `scripts/smoke-web-play-shell.mjs`;
- `scripts/verify_mvp.sh`; and
- append-only authority, compatibility, verification, and custody evidence in
  this decision packet.

The repair records the already-present additive surface at protocol v2.2.0. It
also makes the default rate-limit verifier avoid exhausting its own shared IP
budget before its dedicated flood scenario, aligns a visual guard with the
already-implemented presentation layout, replaces a Node-only checksum import
with a browser-safe byte-equivalent implementation, and gives the Web smoke
harness direct custody of its Vite child process. The MVP verifier likewise
owns its direct server child, detects occupied ports without requiring `lsof`,
and only clears stale Akalynth listeners from this worktree. Runtime rate
limits, anti-cheat heat, Tem policy, gameplay behavior, and checksum output are
unchanged.

The repair does not add message or handler semantics, expose the consequence
kernel on a wire protocol, activate ECE/RCE/MCE/CRB gameplay behavior,
establish package conformance, merge the branch, or authorize deployment or
release.

## Remote PR-gate repair boundary

Project direction separately approved a lease-protected amendment of the
second commit after PR #407 exposed a clean-runner debug-client dependency on
an absent generated public Codex graph. That repair is limited to:

- `apps/debug-client/vite.config.ts`;
- `apps/debug-client/tsconfig.json`;
- `apps/debug-client/scripts/verify-nine-slice-panel.mjs`;
- `apps/debug-client/codex-fallback/**`; and
- append-only authority, compatibility, verification, and custody evidence in
  this decision packet.

The fallback is an empty public graph and is selected only when no configured
Codex root contains `out/codex-public.graph.json`. A real generated public
graph retains precedence. The fallback does not publish, duplicate, or invent
Codex content and creates no canon, gameplay, protocol, merge, release, or
deployment claim.
