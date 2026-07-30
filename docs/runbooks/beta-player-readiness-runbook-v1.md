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
