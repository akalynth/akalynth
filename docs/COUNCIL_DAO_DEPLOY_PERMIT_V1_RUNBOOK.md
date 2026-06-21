# Witness Council DAO — Deploy Permit v1 Runbook

Authority: `AKALYNTH_COUNCIL_DAO_DEPLOY_PERMIT_V1`

Parent: `AKALYNTH_COUNCIL_DAO_V2`

First council packet that permits **runtime mutation** — gated
`lane:beta:deploy` and `lane:staging:deploy` with **explicit human ack**.

## Action Classes

| Class | Lane adapter |
|-------|----------------|
| `lane:beta:deploy` | `akalynth-lane-deploy.sh beta deploy` |
| `lane:staging:deploy` | `akalynth-lane-deploy.sh staging deploy` |

Check classes (`lane:*:check`) unchanged from v1.

## Human Ack Requirement

Deploy never runs unless the operator provides ack at gate invocation:

```bash
# Option A — environment variable
AKALYNTH_COUNCIL_DEPLOY_ACK=1 ./bin/council-execution-gate.sh ...

# Option B — gate flag
./bin/council-execution-gate.sh --human-ack ...
```

Without ack the gate:

1. Emits permit with `execution_status: ack_required`
2. Records `human_ack.status: missing`
3. Exits `2` — **no deploy invoked**

Proposals must set `action_params.execution_ack_required: true`.

## Flow

```text
1. Author deploy proposal (beta or staging)
2. Record vote receipts (v2 registry weights apply)
3. Run council-execution-gate.sh WITHOUT ack → verify ack_required permit
4. Re-run WITH --human-ack → deploy executes (or --skip-deploy for permit-only)
5. Permit records human_ack, treasury ledger debit (-10 ops_credit), boundary
```

## Commands

Full verification:

```bash
cd /home/sovereign/akalynth-ops/repos/akalynth
./scripts/verify-council-dao-deploy-permit-v1.sh
```

Permit-only (verifier hosts):

```bash
cd /home/sovereign/akalynth-ops
./bin/council-execution-gate.sh \
  --proposal council/proposals/sample-beta-deploy.json \
  --votes council/votes/sample-beta-deploy/ \
  --members-dir council/members \
  --ledger-file council/ledger/entries.jsonl \
  --emit-permit council/permits/sample-beta-deploy.json \
  --human-ack \
  --skip-deploy
```

Live deploy (operator host — **mutates runtime**):

```bash
AKALYNTH_COUNCIL_DEPLOY_ACK=1 ./bin/council-execution-gate.sh \
  --proposal council/proposals/<your-proposal>.json \
  --votes council/votes/<proposal-id>/ \
  --human-ack \
  --emit-permit council/permits/<proposal-id>.json
```

Dry-run deploy:

Set `action_params.dry_run: true` on the proposal.

## Proof Target

**`council_lane_deploy_permit_v1`**

## Non-Mutation Boundary

- Without ack: `deployment: not_performed`
- With ack + `--skip-deploy`: `deployment: skipped`
- With ack + live deploy: `deployment: performed`, runtime trees mutated
- `auto_execution: not_performed` always — gate must be invoked explicitly

## Engineering Loop Receipt

`docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_COUNCIL_DAO_DEPLOY_PERMIT_V1/receipt.json`