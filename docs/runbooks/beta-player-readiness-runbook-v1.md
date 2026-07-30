# Beta Player Readiness Runbook v1

Scope: source recovery, verification, and separately authorized operation of
invited, controlled, playable Akalynth pre-alpha cohorts.

This runbook does not authorize deployment, participant recruitment, a public
launch, a content-alpha claim, or a retention claim.

## Authority boundaries

Treat these as separate actions:

1. recover and verify canonical source;
2. merge the reviewed source;
3. deploy an exact merged commit;
4. open a named cohort;
5. issue invites and recruit consenting participants;
6. interpret return evidence after the eligibility window matures.

Authority for an earlier action does not imply authority for a later one.

## Source-recovery preflight

Before changing runtime state:

```bash
git status --short --branch
git log -1 --oneline
git diff --check
```

Confirm the source contract:

- v25 is the outfit-color migration;
- v26 owns `beta_cohorts` and `beta_invites`;
- beta DDL and outfit-column repair are idempotent across both historical v25
  layouts;
- invite values are persisted only as hashes plus bounded hints;
- readiness and feedback remain receipt-backed observations, not gameplay
  authority.

If the target database schema is newer than the candidate source, stop. Do not
downgrade, rewrite `_meta`, delete tables, or rebuild player data to force a
deployment.

## Recovery verification

Run the focused gates from the repository root:

```bash
npm -w apps/server run build
npm -w apps/server run verify:beta-player-readiness
npm run verify:beta-player-readiness
npm run verify:beta-account-play-portal
bash scripts/verify_beta_android_distribution.sh
bash scripts/verify_protocol_sync.sh
npm -w apps/server run test:receipts-chain
npm -w apps/debug-client run build
```

The focused migration verifier must cover:

- fresh database to v26;
- canonical v24 to v26;
- outfit-only v25 to v26;
- beta-only v25 to v26;
- combined deployed v25 to v26;
- repeated v26 initialization with no data loss or duplicate effects.

Record each command and outcome against the exact candidate commit. An
unavailable or failing gate is a gap, not a pass.

## Deployment separation

Do not deploy from a dirty checkout or from an unmerged feature branch. Before
any separately authorized deployment, verify:

- intended commit equals the checked-out commit;
- built server provenance equals the intended commit;
- static client provenance equals the intended commit;
- target database schema is compatible with code schema v26;
- backup and rollback paths are recorded;
- receipt and Chronicle paths will be preserved.

Use the canonical beta-refresh/deploy runbook for host mutation. This document
does not replace backup, service, Caddy, firewall, or exact-artifact gates.

## Release Repair v1 preflight

The accepted
[Beta Release Repair v1](../decisions/AKALYNTH_BETA_RELEASE_REPAIR_V1/DECISION.md)
is required for the current live-beta refresh path.

Before the first live-tree write:

- name explicit clean normal-clone paths and full commits for both `akalynth`
  and `akalynth-site`;
- reject worktrees, implicit source defaults, dirty/shallow/sparse clones, and
  publisher-side source pulls;
- verify the direct v12 manifest, immutable versioned APK URL, SHA-256, byte
  size, and full Android update-API projection;
- quiesce the deployment to zero writers;
- snapshot and verify `/opt/akalynth-beta`, `/var/lib/akalynth-beta`, and
  `/var/www/akalynth-beta` under a protected persistent recovery directory;
- arm a durable recovery transaction before mutation;
- verify full receipt hash/link continuity and current-key signatures from
  sequence 49 through the captured head.

Receipt sequences 1 through 48 are covered only by the bounded historical
signature-key exception in the decision. Their hash/link continuity remains
mandatory, and the chain must never be rewritten.

Run the bounded verifier against the quiesced captured head:

```bash
NODE_ENV=production npm -w apps/server run verify:receipt-key-epoch -- \
  --receipts /var/lib/akalynth-beta/audit/receipts.jsonl \
  --key /etc/akalynth-beta/chronicle.key \
  --exception docs/decisions/AKALYNTH_BETA_RELEASE_REPAIR_V1/receipt-key-exception.v1.json \
  --json
```

Snapshot rollback never restores or truncates the live receipt JSONL. Target
startup and shutdown append lifecycle receipts after the captured boundary.
While traffic remains closed, restore the prior runtime/static trees and the
captured derived database, WAL/SHM companions, and replay marker, then let the
prior runtime replay that preserved lifecycle-only tail.

If the post-boundary tail contains any player, account, gameplay, economy,
admission-ledger, or other non-lifecycle write, preserve the new history and
use a forward repair instead of restoring stale state.

When verifying a snapshot or rehearsal copy rather than the canonical path,
also pass
`--copied-from-canonical /var/lib/akalynth-beta/audit/receipts.jsonl`.
The flag declares lineage only; the publisher must separately prove byte-prefix
custody and may never use the production key to extend the copy.

Never boot an isolated rehearsal copy with the production signing key. Verify
the captured live prefix, use a fresh `0600` ephemeral key for any synthetic
rehearsal tail, retain no raw key or forked receipt chain in repository
evidence, and destroy the temporary key/tree afterward. The production key may
extend only the one live receipt JSONL.

Before arming the recovery transaction, the disposable rehearsal must prove
target schema-v26 migration, old-runtime rejection of the v26 copy, restoration
of the captured schema-v25 state, old-runtime replay/health with the synthetic
lifecycle tail, byte-identical prefix custody, and ephemeral-key verification
of the complete synthetic suffix. Missing or failed rehearsal evidence is a
hard deployment stop.

### Sealed candidate and apply custody

Provision the dedicated rehearsal account separately from publication, using
the reviewed `services/sysusers.d/akalynth-rehearsal.conf` file. Install the
publisher and its complete trusted-helper bundle below
`/usr/local/libexec/akalynth-beta-release` as root-owned, single-link,
non-group-writable files before staging. Direct execution from the
developer-owned ops checkout is forbidden. The publisher verifies its trusted
install path and the helper hashes before sourcing them; installation or
identity drift is a hard stop.

Publisher evidence is written only below the root-custodied
`/var/lib/akalynth-beta-publish-evidence` directory through exclusive,
no-follow creation. The developer-owned ops tree is never an evidence-write
authority. The manual systemd unit creates that directory with
`StateDirectory=akalynth-beta-publish-evidence` and mode `0700`; apply
preflights its custody, writability, and exact unused receipt name before live
mutation.

The durable `PASS` release receipt is the final evidence boundary. Recovery
must remain armed and `ACTIVE` must remain present until that receipt is
fsynced. If the process restarts after the append but before marker cleanup,
orphan recovery validates the root-owned single-link receipt and preserves the
committed release. Any fail-closed rollback path stops Caddy before waiting for
replicas to reach zero. An indeterminate receipt result with a final path
present is not an ordinary failure: keep `ACTIVE`, do not roll back, and
reconcile the strict receipt plus evidence-directory fsync first.

The publisher has no default mode. Preserve one explicit input set across these
separate operator decisions:

1. run `--gate-only` against clean normal clones at the named full commits;
2. set a unique `AKALYNTH_RELEASE_ID` and immutable `AKALYNTH_BUILD_REF`, then
   run `--stage-only`;
3. retain the emitted candidate at
   `/var/lib/akalynth-beta-release-candidates/<release-id>` and its
   `.akalynth-artifact-seal.v1.json`;
4. after the seal exists, author a root-owned release intent outside the source
   repositories. It must bind the release ID, both commits, Android identity,
   decision approval evidence, receipt-exception hash, publisher and gate
   hashes, and sealed-manifest hash;
5. set `AKALYNTH_RELEASE_INTENT` and
   `AKALYNTH_SEALED_ARTIFACT_MANIFEST`, then run `--dry-run`;
6. only after a separate live-deployment decision, run `--apply` with the exact
   same intent, manifest, source commits, and candidate. If systemd is used,
   write those inputs to the root-owned
   `/etc/akalynth-beta/release.env` and start the manual-only
   `akalynth-beta-publish.service`; the unit is not a boot or push-triggered
   publisher.

`--stage-only` and `--dry-run` do not authorize live mutation. A dry-run pass is
not transferable to a changed intent, helper, candidate, source commit, APK, or
receipt boundary. If an existing recovery `ACTIVE` marker is present, apply
must resolve that transaction immediately after acquiring the publisher lock,
before admitting unrelated inputs for a new release.

## Open a cohort

Only after deployment and cohort activation are explicitly authorized, create a
named cohort bound to the exact served release and rollback commits:

```bash
npm -w apps/server run beta:cohort -- create \
  --cohort beta-YYYY-MM-DD-a \
  --release <served-release-sha> \
  --rollback <last-known-good-sha> \
  --cap <authorized-cap> \
  --platform web
```

Set invite enforcement only for the authorized controlled cohort:

```text
AKALYNTH_BETA_ENABLED=1
AKALYNTH_BETA_REQUIRE_INVITE=1
```

Do not enable invite enforcement until registration, account recovery, rollback,
and operator access have been verified on the deployed commit.

## Issue and deliver invites

```bash
npm -w apps/server run beta:cohort -- issue \
  --cohort beta-YYYY-MM-DD-a \
  --count <authorized-count>
```

The command prints each raw invite once. Deliver it through the approved private
channel. Never place raw invites in:

- Git;
- receipts;
- issue or pull-request text;
- shared logs;
- screenshots or public evidence;
- readiness report output.

Persist only the token hash and bounded hint. A redeemed invite may bind to one
account only.

## Player evidence loop

The client may emit:

- browser mount/error;
- WebSocket connect/disconnect;
- world-state reached;
- play-session start/end;
- onboarding start/completion.

The server must reject events outside the allow-list. Client observations never
prove movement, combat, inventory, quest completion, rewards, position, or
retention. Those outcomes come from server receipts.

Authenticated feedback accepts P0-P3 severity, category, title, body, optional
reproduction steps, map, and current onboarding step. Reports may expose
metadata and reproducibility presence, but not the player-authored body.

## Review a cohort

```bash
npm -w apps/server run report:beta-player-readiness -- \
  --cohort beta-YYYY-MM-DD-a \
  --health-url https://beta-api.akalynth.com/v1/health \
  --out docs/evidence/beta-player-readiness/beta-YYYY-MM-DD-a.json
```

Interpret the report conservatively:

| Area | Primary evidence | Stop signal |
| --- | --- | --- |
| Admission | invite issued, redeemed, first account session | redemption or first-login failures |
| Playability | browser mount, world state, first server-accepted action | no world state or repeatable blank/error path |
| Adventure | server-receipted movement, chat, Tem, training, profession, gate | a required mark cannot complete |
| Stability | browser observations, WS receipts, API health, receipt-chain health | reproducible P0 or repeated P1 |
| Engagement | first-session duration and eligible D1/D7 sessions | early exits requiring investigation |
| Feedback | severity, reproduction present, owner, status | unowned or uninvestigated P0/P1 |
| Operations | cohort, release, cap, rollback commit | any mismatch with served artifacts |

The optional canal observation is not an onboarding-completion gate. D1/D7
results are valid only after their eligibility windows mature. A report is not
proof of voluntary return until independent participants actually return.

## Triage

```bash
npm -w apps/server run beta:cohort -- list
npm -w apps/server run beta:cohort -- triage \
  --feedback bf_<id> \
  --status in_progress \
  --owner <operator>
```

Keep feedback text private. Link fixes and verification evidence through the
feedback id without copying sensitive text into public artifacts.

## Pause, close, and recover

```bash
npm -w apps/server run beta:cohort -- pause --cohort beta-YYYY-MM-DD-a
npm -w apps/server run beta:cohort -- close --cohort beta-YYYY-MM-DD-a
```

Pause admission on:

- a reproducible P0;
- repeated P1 failures in a core action;
- schema or receipt-chain integrity failure;
- release/provenance mismatch;
- invite leakage or cohort-cap breach.

Preserve the SQLite database, receipt chain, Chronicle data, report outputs, and
rollback evidence before repair. Never release reservations or rewrite cohort
history through direct database edits merely to clear an incident.

After repair, re-run the full recovery verification and obtain separate
authority before deployment or cohort reactivation.
