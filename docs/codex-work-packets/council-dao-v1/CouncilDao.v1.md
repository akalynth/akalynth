# Witness Council DAO v1

Status: `codex:accepted`

Authority object: `AKALYNTH_COUNCIL_DAO_V1`

Local forge issue authority: Gitea issue to be created from this packet.

Codex authority: `repos/akalynth-codex/design/council-dao-v1.md` @ `a691d76`

## Goal

Close the ops governance proof gap: a **local Witness Council** with proposal schema,
vote receipts, execution permits, and a read-only lane-check adapter — connecting
approved proposals to Akalynth **only** through `akalynth-lane-deploy.sh <lane> check`.

Zero runtime auto-mutation. No build, restart, or deploy in v1.

## Why This Packet Now

- Engineering loops (Forgehold, chill-zone showcase) already use receipt-backed
  authority but lack a shared proposal → vote → permit shell.
- `akalynth-ops/AGENTS.md` requires explicit operator authorization before runtime
  mutation; council permits make that authorization machine-readable.
- Codex schemas and ops adapter seeded @ `akalynth-codex` `a691d76`.

## Source Inputs

- `repos/akalynth-codex/design/council-dao-v1.md`
- `repos/akalynth-codex/schema/council-proposal.schema.json`
- `repos/akalynth-codex/schema/council-vote-receipt.schema.json`
- `repos/akalynth-codex/schema/council-execution-permit.schema.json`
- `repos/akalynth-codex/entries/council-dao.json`
- `akalynth-ops/bin/council-execution-gate.sh`
- `akalynth-ops/scripts/verify-council-dao-v1.sh`
- `akalynth-ops/bin/akalynth-lane-deploy.sh`
- `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_CHILL_ZONE_SHOWCASE_V1/receipt.json`

## Packet Work

1. Land engineering-loop record +
   `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_COUNCIL_DAO_V1/receipt.json`.

2. Land `docs/COUNCIL_DAO_RUNBOOK.md` documenting proposal → vote → permit →
   lane check flow and custody paths under `akalynth-ops/council/`.

3. Validate ops adapter + schemas via `akalynth-ops/scripts/verify-council-dao-v1.sh`.

4. Record worked example permit for `council_lane_check_permit_v1` in ops evidence.

5. Accept `council-dao` codex entry after upstream merge.

6. Open local Gitea issue + PR, then GitHub upstream PR.

## Recommended Proof Target

**`council_lane_check_permit_v1`**

Given an approved proposal with `action_class: lane:beta:check` and quorum met:

1. Council gate emits execution permit
2. Adapter invokes only `akalynth-lane-deploy.sh beta check` (read-only)
3. Permit records `check_passed` or `check_failed` with exit code
4. No `/opt`, `/var/lib`, or `/etc` mutation from the council path

## Branch Contract

- Branch prefix: `codex/council-`
- Recommended branch: `codex/council-dao-v1`
- Local Gitea labels:
  - `codex:ready`
  - `codex:running`
  - `codex:needs-review`
  - `codex:accepted`
  - `codex:blocked`
  - `packet:council-dao`
- Local PR target: `main`
- GitHub remains the canonical public/source remote.

## Validation Gate

```bash
git diff --check
test -f ../akalynth-codex/schema/council-proposal.schema.json
bash -n ../../bin/council-execution-gate.sh   # from akalynth-ops workspace root
../../scripts/verify-council-dao-v1.sh
```

From `akalynth-ops` workspace root:

```bash
akalynth-ops/scripts/verify-council-dao-v1.sh
```

Optional live lane check (operator host):

```bash
akalynth-ops/bin/council-execution-gate.sh \
  --proposal akalynth-ops/council/proposals/sample-beta-check.json \
  --votes akalynth-ops/council/votes/sample-beta-check/ \
  --emit-permit akalynth-ops/council/permits/sample-beta-check.json
```

## Non-Claims

This packet does not:

- deploy, restart, build, or mutate beta/staging/sim runtime trees;
- enable automatic execution on vote approval;
- move treasury funds or custodial keys;
- grant in-game governance or player reputation;
- replace GitHub as canonical public/source remote.

## Acceptance Evidence

The packet is accepted only after:

1. Codex entry `council-dao` is `accepted`.
2. Engineering-loop receipt records validation green.
3. `verify-council-dao-v1.sh` passes.
4. GitHub upstream PR merged to `main`.

## Follow-On Loop (not this packet)

- `AKALYNTH_COUNCIL_DAO_V2` — treasury ledger + reputation weighting
- `AKALYNTH_COUNCIL_DAO_DEPLOY_PERMIT_V1` — gated deploy with human ack
- `AKALYNTH_FORGEHOLD_ASHGLASS_EVIDENCE_V1` — Forgehold Act II evidence ordering