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

Commit and feature-push authority: **Project direction's directive
`execute the two commits and feature push to origin; no deployment.`**

Deployment and release authority: **none**

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
- `.github/workflows/ci.yml`

The production server entrypoint does not import this kernel. No current
combat, death, item, recovery, Chronicle, SQLite, HTTP, WebSocket, Android, or
debug-client behavior changes through this slice.

## Verification evidence

Focused evidence revalidated in an isolated worktree based on `origin/main`:

| Command | Result |
| --- | --- |
| `npm run build:packages` | pass |
| `npx tsc -p apps/server/tsconfig.json --noEmit` | pass |
| `npm -w apps/server run test:consequence-contracts` | pass, 26/26 cases |
| `npm -w apps/server run test:receipts-chain` | pass, 6/6 synthetic cases |
| `npm -w apps/server run build` | pass |
| `bash scripts/test-chain-discipline.sh` | pass, 15/15 checks |
| `npm -w apps/server run verify:quick` | pass; live data checks skipped in the fresh worktree |
| `env -u NODE_ENV ./scripts/verify_mvp.sh` | pass |
| `./scripts/verify_protocol_sync.sh` | pass |
| CI workflow parse + deterministic documentation audit | pass |
| `git diff --check -- <slice paths>` | pass |

Before the later publication-gate repair authority, the broader
`env -u NODE_ENV npm run verify` composite reached 8/9 passing verifiers and
stopped on the inherited `protocol-drift` gate. That historical result remains
recorded here; the separately authorized closure below supersedes it as the
current publication-gate result without rewriting the original evidence.

## Subsequent publication-gate closure

Closure date: **2026-07-30**

Authority evidence: the later user directive `Plan to fix all findings and pump
version then apply and Authorize the feature-branch push`.

The gate-closure adjunct:

- records 19 already-present additive protocol changes in a canonical v2.2.0
  golden snapshot and aligns the shared version, Android mirror, parity tests,
  and protocol documentation;
- gives the golden snapshot a stable repository-relative source path;
- reorders only the default rate-limit verifier scenarios so the verifier does
  not exhaust its own shared IP budget before the dedicated flood case;
- aligns a stale Web visual assertion with the already-implemented responsive
  presentation layout;
- replaces the shared draft checksum's Node-only crypto import with a
  browser-safe byte-equivalent implementation;
- gives the Web smoke harness direct custody of its Vite process so a successful
  smoke run exits cleanly; and
- gives the MVP verifier direct custody of its server processes and an `ss`
  port-detection fallback when `lsof` is unavailable, preventing orphan
  listeners from being mistaken for the verifier's isolated server.

This closure does not change runtime rate limits, anti-cheat heat, Tem policy,
gameplay behavior, checksum output, or ECE/RCE/MCE/CRB activation. It does not
establish full package conformance, deployment, release, or merge authority.

| Closure verification | Result |
| --- | --- |
| Protocol drift verifier | pass, 2/2 |
| Shared protocol typecheck/build + protocol sync | pass |
| Android `ProtocolParityTest` | pass |
| Debug-client production build and browser-bundle scan | pass |
| Builder-draft checksum regression | pass, 2/2 |
| Focused rate-limit verifier against an isolated server | pass |
| Web visual and presentation-layout verifiers | pass |
| Web play-shell smoke with generated Codex projection | pass; clean exit |
| `env -u NODE_ENV ./scripts/verify_mvp.sh` after server-process custody repair | pass; no orphan listeners |
| Full `env -u NODE_ENV npm run verify` composite | pass, 33/33, against an isolated server and temporary generated Codex projection |

## Remote PR-gate closure

PR #407 subsequently proved that a clean GitHub Actions checkout could not
build the debug client because the separately governed, generated
`akalynth-codex/out/codex-public.graph.json` artifact was absent.
`repo-metadata` mirrored that fast-gate failure; it was not an independent
metadata defect.

Authority evidence: project direction replied `Approved` to the explicit
request to amend commit 2 and update the existing feature branch with
`--force-with-lease` while preserving exactly two commits.

The bounded repair:

- adds a tracked empty public-graph fallback carrying no lore, publication,
  acceptance, or canon claim;
- selects a Codex root only when the required public-graph artifact exists, so
  a valid external generated graph always precedes the fallback;
- gives TypeScript the same ordered fallback path; and
- extends the existing debug-client guard to require and validate the empty
  fallback.

Local verification passed both a fallback-forced production build and the
ordinary production build while the existing external Codex repository lacked
the generated graph. The full repository verifier then passed 33/33 against a
fresh isolated server with the tracked fallback in place. The repair changes no
server, protocol, consequence, combat, economy, anti-cheat, or deployed
public-Codex semantics.

The focused consequence suite covers:

- canonical hash stability;
- acceptance-key idempotency classification and body conflict;
- runtime rejection of untyped acceptance, initiator, reservation, recovery
  authority, and remediation-authority discriminators;
- fail-closed validation of optional envelope/basis fields and compensation
  reference shape;
- rejection of inherited-only record fields before canonical hashing;
- prototype-safe ECE ceiling, RCE allocation, and MCE remediation accounting;
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

Local implementation: **present, server-private, and non-activating**

Publication identity: **the enclosing implementation commit and its
`origin/codex/risk-consequence-contract-kernel-v1` feature ref**

Commit and feature-push authority: **granted for the scoped two-commit lane**

Deployment: **none; explicitly unauthorized**

Conformance claim: **none**
