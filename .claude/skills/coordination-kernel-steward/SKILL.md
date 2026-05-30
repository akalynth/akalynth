---
name: coordination-kernel-steward
description: Use when modifying the Akalynth coordination kernel (packages/coordination-kernel/) — identity, token, witness proofs, receipt signing/verification, anchor, capability, compliance, conformance, or resolution subsystems.
---

# Coordination Kernel Steward

`packages/coordination-kernel/` is the security and identity core. Changes here have the widest blast radius in the codebase — they affect every receipt, every token, every proof, and every server compliance check.

## Subsystems

**Identity** (`src/identity/`)
- `key.ts` — key derivation and management
- `token.ts` — token issuance, parsing, and validation
- `explanation.ts` — human-readable identity explanation for audit/why UI

**Witness** (`src/witness/`)
- `fork.ts` — witness fork/branch logic
- `proof.ts` — proof construction
- `hasher.ts` — deterministic hash functions
- `types.ts` — witness type definitions

**Receipt** (`src/receipt/`)
- `key.ts` — receipt signing key derivation
- `logger.ts` — canonical receipt emission
- `verify.ts` — receipt chain verification

**Other subsystems**
- `src/anchor/` — identity anchoring
- `src/capability/` — capability grants and checks
- `src/compliance.ts` — compliance assertions
- `src/conformance/` — conformance rules
- `src/resolution/` — identity resolution
- `src/nonconstitutional.ts` — explicit list of non-constitutional behaviors

## Rules

- Any change to `token.ts` or `key.ts` must be reviewed against the token spec in `docs/IDENTITY_VERIFICATION.md`. If they diverge, that is CRITICAL.
- Receipt logger changes require a replay test. Do not change receipt schema without versioning or migration.
- Witness proof changes must preserve determinism. Any non-determinism in proof construction invalidates audit replay.
- `nonconstitutional.ts` is an allowlist of explicitly forbidden behaviors. Do not remove entries.
- Production signing keys are in `/etc/akalynth` — never in the repo. Do not add key material to any source file.
- Do not print or log secret key material at any level.
- Changes to `compliance.ts` or `conformance/` affect CI invariant checks — coordinate with `ci-steward`.

## Verification

- Build: `npm -w packages/coordination-kernel run build`
- Tests: `npm -w packages/coordination-kernel run test`
- For token changes: verify `/v1/transparency` still exposes `auth_public_key_hex` and derivation string.
- For receipt changes: run `npm run verify:receipt-hygiene` and confirm chain status.
- For witness changes: run proof replay against a known-good JSONL snapshot.

## Output must include

- Subsystem touched (identity / witness / receipt / anchor / capability / compliance / conformance / resolution).
- Determinism impact — does this change affect what gets hashed or signed?
- Receipt schema impact.
- Verification commands and outputs.
- Whether `docs/IDENTITY_VERIFICATION.md` is still in sync.
