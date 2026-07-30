# AKALYNTH_BETA_RELEASE_REPAIR_V1

Status: accepted repair authority; implementation, commit, push, merge,
deployment, cohort activation, and release claims remain separate custody
boundaries

Authority: project-owner approval in the active Codex thread on 2026-07-30:
`Approve Release Repair v1 and a bounded historical receipt-key exception`

Target lane: controlled live beta only

## Decision effect

This decision authorizes the narrow repair needed to make the beta publication
path fail closed before live mutation. It covers:

- restoring canonical direct-Android v12 manifest parity without rebuilding or
  replacing the v12 APK;
- verifying the manifest URL, SHA-256, byte size, and complete update-API
  projection;
- publishing from explicit, clean, normal Git clones at named commits;
- preserving the public-site repository as the visual and portal source of
  truth;
- taking and verifying a writer-quiesced recovery snapshot of runtime
  artifacts, persisted state, and public static files;
- recording the bounded historical receipt-signature exception below.

It does not:

- authorize a direct-Android v13 or F-Droid release;
- authorize rewriting or re-signing receipts;
- authorize deleting or replacing player data, Chronicle data, or audit data;
- open, expand, or recruit a beta cohort;
- prove player return, retention, production readiness, or public launch;
- amend G1-G15 or expand V1.

## Release-source custody

Every apply attempt must name the exact game-source and site-source paths and
full commits. Each source must be a clean, non-shallow, non-sparse normal clone;
worktrees, dirty trees, implicit defaults, and publisher-side pulls are
rejected.

The game artifact provenance, game-source commit, site-source commit, and live
post-rollout commit are independent claims and must each be verified. Evidence
is written outside both source repositories so generating evidence cannot
invalidate source cleanliness.

The root publisher may execute only its root-custodied trusted bundle as root.
Repository-owned Git metadata and runtime verification code execute with
external helpers disabled or inside an unprivileged, network-isolated,
read-only sandbox. Publish evidence is created exclusively below the
root-custodied `/var/lib/akalynth-beta-publish-evidence` namespace.

The release candidate is built from committed `git archive` exports, not from
working-tree `dist/` or `node_modules`. Dependency acquisition runs without
credentials or lifecycle scripts; rebuild, production pruning, and runtime
preflight run network-disabled under an unprivileged identity with production
state and key paths absent. The candidate is frozen below a unique release ID
with complete `runtime/` and `public/` roots plus sealed preflight evidence.

Dry-run and apply consume that immutable candidate only through a root-owned
release intent that binds the candidate seal, both source commits, this
publisher, the gate library, Android identity, approval evidence, and one
release ID. Before any helper is sourced, the publisher also verifies the
root-custodied helper bundle against hashes embedded in that intent-bound
publisher. Client correlation, a timestamp, or a candidate directory name alone
is not release authority.

## Direct Android custody

The controlled direct Android channel remains v12:

- version code: `12`;
- version name: `0.1.10-beta-self-update-identity`;
- immutable URL:
  `https://beta.akalynth.com/download/akalynth-beta-v12.apk`;
- SHA-256:
  `99be43cf5467746f7f768ef7172cde617acb866b7546c34974d1ec35658bc1ac`;
- byte size: `42341209`.

A runtime refresh consumes this identity but does not publish a new Android
binary. The generic unversioned APK alias is not release authority. A future
Android publisher must reject version regression and same-version identity
reuse.

The machine-readable accepted identity is
[android-distribution-identity.v12.json](./android-distribution-identity.v12.json).
The distribution verifier must match the complete live manifest to that
decision artifact; self-consistency alone is not release authority.

## Portal custody

`akalynth-site` remains the public visual and portal source of truth. Runtime
publication must not replace its polished account portal with
`infra/web/beta/account.html`.

The repair may add only the compatible behavior needed by the controlled beta:

- invite codes are optional and paste-only;
- URL/query invite prefill is forbidden;
- registration omits an empty invite from the request;
- password-reset entry routing remains available;
- authenticated cohort/release status is nonblocking and hidden on failure.

Account, character, economy, recovery, and gameplay authority remain on the
server.

## Recovery transaction

Before the first live-tree write, the publisher must:

1. capture the current deployment identity, replica count, live commit, and
   schema;
2. quiesce the beta deployment to zero writers;
3. snapshot the complete `/opt/akalynth-beta`,
   `/var/lib/akalynth-beta`, and `/var/www/akalynth-beta` trees into a
   host-protected recovery directory;
4. retain deployment metadata without copying or printing signing-key material;
5. verify the SQLite snapshot, receipt head and chain, critical static files,
   Android artifact identity, and prior build identity;
6. durably arm a recovery transaction before mutation.

An unsealed or orphaned recovery transaction blocks another publish.
Recovery of an existing `ACTIVE` transaction occurs immediately after the
publisher lock is acquired and before unrelated inputs for a new release are
required.

Target pretraffic startup uses one deterministic, journaled systemd unit bound
to the sealed candidate root. The unit reaches a held notification barrier
before its identity is written to the transaction, and it cannot start until
that barrier is durably released. Probe and shutdown authority derive from the
unit and its root-custodied binding, never a caller-supplied PID. If that unit
cannot be stopped exactly, rollback and old-runtime restart remain blocked.

The runtime and public roots are prepared as complete generations. With the
deployment quiesced and Caddy stopped, each root is activated through an
inode-bound atomic exchange under one release-switch journal. The backend must
be ready and report the intended commit on the closed upstream before Caddy
reopens. Rollback closes public traffic before reversing any prepared
generation exchange, and the restored backend must pass the same closed
upstream readiness boundary before Caddy reopens. There is no in-place publish
fallback.

Any rollback failure path closes Caddy and verifies ports 80 and 443 closed
before waiting for deployment scale-down. A failed post-reopen public check
therefore cannot remain exposed during a replica wait.

The apply path must prove the root-custodied evidence directory writable and
the exact receipt destination unclaimed before the first recovery or live
mutation. The final `PASS` release receipt is durably appended before recovery
is disarmed or the active marker is cleared. A failure before that append
rolls back; a crash after it preserves the committed release and lets orphan
recovery validate the strict receipt before clearing the stale marker. Final
publication uses atomic no-replace rename plus directory fsync. If publication
is indeterminate and any final receipt path exists, rollback is forbidden:
`ACTIVE` remains held until strict evidence and directory durability can be
reconciled.

Rollback never restores, replaces, or truncates the live
`audit/receipts.jsonl`. Target startup and shutdown necessarily append lifecycle
receipts after the captured boundary.

While traffic remains closed, rollback may restore the prior runtime and public
trees plus the captured derived database, WAL/SHM companions, and replay marker.
The prior binary must then replay the preserved lifecycle-only receipt tail. If
the post-boundary tail contains a player, account, gameplay, economy,
admission-ledger, or other non-lifecycle write, snapshot rollback is forbidden:
the publisher preserves the evidence and stops for forward repair.

An offline rehearsal must never start a copied receipt chain with the live
production signing key. That would create a second valid signed successor from
the same canonical head. Rehearsal verifies the captured live prefix, uses a
fresh restricted ephemeral key for any synthetic tail, records no raw key or
forked receipts in repository evidence, and destroys the temporary key and
tree. Only an actual rollback may extend the one live JSONL with the production
key.

The recovery transaction may not arm until that disposable rehearsal proves:
target migration to schema v26; prior-runtime fail-closed behavior against the
v26 copy; restoration of the captured schema-v25 state; prior-runtime replay
and health against the preserved synthetic lifecycle tail; exact prefix
custody; and ephemeral-key verification of every synthetic receipt.

## Bounded historical receipt-key exception

### Scope

This exception applies only to receipt sequences `1` through `48` in the
existing controlled-beta receipt chain.

Observed preflight evidence showed:

- the chain is contiguous;
- receipt hashes and predecessor links verify across the full observed chain;
- the current signing key verifies sequence `49` onward;
- the current key does not verify sequences `1` through `48`;
- key-file timing aligns with the sequence `48`/`49` restart boundary;
- the prior verification key and a key-rotation receipt were not recoverable.

### Permitted claim

Sequences `1` through `48` have verified structural hash/link continuity but
have an unresolved historical signature-key custody gap.

### Forbidden claims and actions

The exception does not permit:

- claiming signatures `1` through `48` were verified;
- re-signing, deleting, truncating, reordering, or replacing those receipts;
- accepting a hash/link failure at any sequence;
- accepting a signature failure at sequence `49` or later under the current key
  epoch;
- weakening receipt requirements for new events;
- treating Chronicle projection rows as replacement mechanical history.

### Release gate

At every release boundary:

- full hash/link verification must pass;
- the exception range must remain exactly `1..48`;
- the current key must verify every receipt from `49` through the captured
  head;
- any failure outside the exception range is a hard stop;
- no secret or raw key material may enter Git or public evidence.

If the prior key is later recovered under approved custody, append verification
evidence and supersede the operational need for this exception. Never rewrite
this decision or the original chain.

The machine-readable accepted boundary is in
[receipt-key-exception.v1.json](./receipt-key-exception.v1.json), governed by
[receipt-key-exception.v1.schema.json](./receipt-key-exception.v1.schema.json).
The release verifier binds the live boundary and current public-key fingerprint
to that record; a command-line range alone is not exception authority.

Because legacy signatures are not inputs to their receipt event hashes, the
exception also pins the exact newline-framed bytes of sequences `1..48`,
including every historical signature. The accepted prefix is `33195` bytes
with SHA-256
`9b82d24a1d6113779a6e070b101d7fe138c4f2748f582f132e61f222464ec030`.
Any byte change in that prefix is a hard stop even when hash/link continuity
would otherwise pass.

## Failure states and recovery

| Failure | Required posture |
| --- | --- |
| Source path implicit, dirty, shallow, sparse, or wrong commit | Reject before staging. |
| Android URL, SHA-256, size, or API projection differs | Reject before mutation or roll back before accepting writes. |
| Site source differs from the named commit | Reject; do not publish from the divergent checkout. |
| SQLite/WAL snapshot cannot be proven | Resume the unchanged old runtime; no live-tree write. |
| Snapshot or transaction marker is incomplete | Hold the deployment at zero until recovery is explicit. |
| Disposable ephemeral-key rollback rehearsal fails or has no durable evidence | Do not arm the transaction or apply the release; resume the unchanged prior runtime if safe. |
| Post-boundary receipt tail contains only approved release lifecycle events | Preserve the live chain; restore derived state and replay the tail under the prior runtime. |
| Post-boundary receipt tail contains a player, account, gameplay, economy, or admission-ledger write | No snapshot rollback; preserve history and use forward repair. |
| Signature failure occurs at sequence 49 or later | Hard stop; the historical exception does not apply. |

## Health measures

- strict-source gate rejection rate;
- Android identity/parity failures;
- recovery-snapshot verification failures;
- orphaned recovery transactions;
- rollback attempts and rollback verification failures;
- receipt exception range drift, which must remain zero;
- current-key signature failures from sequence 49 onward, which must remain
  zero;
- portal registration, reset, and nonblocking beta-status verification.

## Custody status

This text records repair authority and the bounded exception. It becomes source
authority only through a reviewed merge. A live apply requires exact merged
commits, passing stage evidence, a verified recovery boundary, and separately
reported deployment custody.
