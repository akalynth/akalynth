# V1 Scope Fence

## Intent

Define what v1 covers and what it explicitly does not. This prevents scope drift and ensures v1 claims match code and CI behavior.

## In Scope (v1)

- Signed, append-only receipt chain (runtime writes + persisted file)
- Deterministic replay + bootstrap rules (fatal on missing receipts unless explicit bootstrap; lenient forbidden in production)
- CI gates (invariant guard, docs audit, protocol sync, build, MVP verify, chain discipline)
- Constitutional verifiers in CI:
  - `verify:lifecycle` (fixture receipts)
  - `verify:monetization` (fixture receipts)
  - `verify:work-contracts` (unit)
  - `verify:treasury` (unit)
- Public transparency feed exists (`/v1/receipts/public`) and docs describe what it is today

## Out of Scope (v1)

- Moderation system (Phase 7), appeals, bans, enforcement tooling
- Witness UI (Phase 6) beyond docs/spec
- Mail MMO system (doc only)
- Any “constitutional freeze” guarantees not enforced by CI/verifiers
- Cryptographic envelope verification for receipts (`verify:receipt-chain`) until PR2 lands

## Binding Guarantees (v1)

Only guarantees that are mechanically enforced today:

- Missing receipts fails fast (exit 2) unless bootstrap
- Bootstrap refused if state exists but receipts are missing
- Replay determinism (hashes match on identical inputs)
- Payout ordering enforced by tick receipts (chain-local scan)

## Non-binding / Future Specs

These documents are informative or future-facing and are **not** v1 law:

- `docs/MONETIZATION_BLUEPRINT.md`
- `docs/WORLD_EVOLUTION.md`
- `apps/server/docs/PHASE6_WITNESS_INTERFACE.md`
- `apps/server/docs/EVIDENCE_UI_SPEC.md`
- `apps/server/docs/PHASE7_MODERATION.md`
- `docs/AKALYNTH_MAIL_MMO.v1.md`
- `packages/coordination-kernel/CONSTITUTIONAL_API_FREEZE.md`
- `packages/coordination-kernel/examples/README.md`
- `packages/coordination-kernel/examples/REGULATOR_VERIFICATION.md`
- `packages/ai-tool-governance/docs/constitutional-principles.md`
- `packages/ai-tool-governance/docs/compliance-verification.md`

## Release Preconditions (before tag)

- GitHub Actions green on `main` twice in a row
- Fixture generation deterministic (fixed timestamp verified)
- No tracked forbidden artifacts (dist/build/keys/receipts)
- `./scripts/verify_mvp.sh` passes locally
- `./scripts/verify_protocol_sync.sh` passes locally
- `bash scripts/test-chain-discipline.sh` passes locally
