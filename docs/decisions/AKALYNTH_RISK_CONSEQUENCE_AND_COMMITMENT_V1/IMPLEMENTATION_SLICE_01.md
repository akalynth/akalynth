# Risk & Consequence Implementation Slice 01

Status: **partial implementation**

Decision under implementation:
[`AKALYNTH_RISK_CONSEQUENCE_AND_COMMITMENT_V1`](./DECISION.md)

Effective design:

- Risk & Consequence Spine v0.3.1
- Standing Contexts + ECE/RCE/MCE + CRB v0.3.1

Implementation date: **2026-07-29**

Implementation authority: **Project direction in Codex thread
`019fadc4-59a5-7a33-8db0-c49c205e23b1`**

Authority evidence: the user directive `Approve implementation` following the
recorded decision. Durable natural-person approver identity remains unrecorded.

Commit, push, deployment, and release authority: **none**

## Implemented boundary

This slice implements a server-private, non-activating consequence contract
kernel:

- immutable ECE, RCE, MCE, resolution-basis, root, child, and bundle-seal
  logical types;
- canonical logical hashing and effect-descriptor hashing without receipt hash
  cycles;
- canonical audit-receipt encoding and hash verification;
- deterministic replay folding by explicit logical keys and parent references;
- duplicate-identical classification and conflicting-content integrity faults;
- immutable policy, disclosure/context basis, root-manifest,
  child-descriptor, and seal checks;
- root authority before seal with mechanical projection gated on a valid seal;
- affected-episode integrity quarantine after an attributable fatal fold
  conflict, with conservative global quarantine only for unattributable
  faults and dependency propagation to recovery/remediation;
- data-carried aggregate accounting with no embedded balance values;
- RCE compensation linkage, recoverable-line bounds, competing scalar
  reservation detection, exclusive identity matching, and terminal
  consume/release conservation without recovery reminting recoverable lines;
- MCE authority-evidence retrievability, target linkage, compensable-delta
  bounds, and unsealed-target quarantine; and
- focused canonical JSONL generation with hash-verified close/reopen and
  replay.

## Source

- `apps/server/src/consequence/types.ts`
- `apps/server/src/consequence/hash.ts`
- `apps/server/src/consequence/validate.ts`
- `apps/server/src/consequence/fold.ts`
- `apps/server/src/consequence/receipt.ts`
- `apps/server/src/consequence/index.ts`
- `apps/server/tools/verify-consequence-contract-kernel.test.ts`
- `apps/server/package.json`

The production server entrypoint does not import this kernel. No current
combat, death, item, recovery, Chronicle, SQLite, HTTP, WebSocket, Android, or
debug-client behavior changes through this slice.

## Verification evidence

Focused evidence produced in the implementing working tree:

| Command | Result |
| --- | --- |
| `npx tsc -p apps/server/tsconfig.json --noEmit` | pass |
| `npm -w apps/server run test:consequence-contracts` | pass, 22/22 cases |
| `npm -w apps/server run test:receipts-chain` | pass, 6/6 synthetic cases |
| `npm -w apps/server run build` | pass |
| `git diff --check -- <slice paths>` | pass |

The focused consequence suite covers:

- canonical hash stability;
- acceptance-key idempotency classification and body conflict;
- runtime rejection of untyped acceptance, initiator, reservation, recovery
  authority, and remediation-authority discriminators;
- manifest ordinal, logical-ID, and descriptor integrity;
- immutable ECE disclosure and standing-context basis binding;
- canonical receipt close/reopen and hash-tamper rejection;
- crash-prefix-equivalent root/child/seal replay states;
- physical child interleaving with manifest-order sealing;
- child-descriptor drift, missing child ordinals, and reordered seal rejection;
- required empty seal for an empty root;
- episode-scoped post-seal conflict quarantine;
- malformed-artifact fail-closed handling and unattributable-fault global
  quarantine;
- source-quarantine propagation to sealed RCE/MCE dependents;
- retained-evidence resolution;
- competing RCE over-reservation rejection;
- RCE scalar and identity terminal conservation;
- identity recovery item/subject matching, exclusive claims, and reuse only
  after receipted release;
- exact recovery compensation targets;
- rejection of recoverable-line reminting by recovery;
- MCE authority, envelope delta, and committed-target delta bounds;
- unsealed MCE-target quarantine; and
- absence of production entrypoint activation.

## Known integrity blocker

The ignored local canonical chain at
`apps/server/audit/receipts.jsonl` currently fails
`npm -w apps/server run verify:receipts-chain`.

Observed local evidence:

- 842 receipts;
- first break between duplicate sequence `9` receipts; and
- additional duplicate sequence breaks at `12` and `37`.

The existing logger keeps chain head and sequence in process-local memory and
does not provide cross-process writer exclusion or append-time logical-key
compare-and-append. Existing canonical history was not rewritten, deleted, or
silently repaired.

## Explicitly not implemented

This slice does not establish:

- an atomic append coordinator that returns an existing receipt on retry;
- cross-process writer linearization or logical-key compare-and-append;
- canonical cross-root resource revision claims;
- coupled interaction plans, atomic member-root batches, or interaction seals;
- standing-context storage or disclosure-composition policy;
- live ECE binding from combat, zones, wars, carried power, or victim sets;
- protection, rest, sanctuary, disconnect, or logout lifecycle integration;
- durable production RCE reservation scheduling;
- authorization-capability evaluation for MCE beyond retained authority
  evidence;
- policy/disclosure/evidence artifact retention storage;
- SQLite, Chronicle, delivery, analytics, or client projection;
- protocol or wire encoding;
- drop-locus, custody, combat, reputation, economy, or balance behavior; or
- full package conformance or release readiness.

## Next prerequisite

Before production activation, Akalynth needs one canonical receipt-writer
linearization authority that:

1. excludes concurrent process/logger forks;
2. validates logical keys and root/write claims before durable append;
3. returns the original receipt for an identical retry;
4. emits a receipted integrity fault for conflicting content; and
5. supports one physical all-or-none record for a coupled member-root batch.

The existing broken local chain requires a separate custody decision. It must
not be rewritten merely to make a verifier green.

## Custody

Local implementation: **present**

Staged: **no**

Commit: **none**

Push: **none**

Deployment: **none**

Conformance claim: **none**
