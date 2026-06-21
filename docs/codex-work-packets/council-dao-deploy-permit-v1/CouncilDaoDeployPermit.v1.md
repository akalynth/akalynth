# Witness Council DAO — Deploy Permit v1

Status: `codex:accepted`

Authority object: `AKALYNTH_COUNCIL_DAO_DEPLOY_PERMIT_V1`

Parent: `AKALYNTH_COUNCIL_DAO_V2` (accepted @ `12681ab`)

Codex authority: `repos/akalynth-codex/design/council-dao-deploy-permit-v1.md`

## Goal

Gate **beta and staging lane deploy** through the Witness Council with explicit
human acknowledgment — first packet permitting runtime mutation via the gate.

## Packet Work

1. Extend schemas for deploy action classes + human ack.
2. Extend `council-execution-gate.sh` with deploy adapter + ack gate.
3. Land verifier, runbook, engineering-loop receipt.
4. Validate `council_lane_deploy_permit_v1` proof target.

## Proof Target

**`council_lane_deploy_permit_v1`**

1. Without ack → `ack_required`, no deploy
2. With `--human-ack --skip-deploy` → `deploy_skipped`, ledger `-10 ops_credit`
3. With ack on operator host → `akalynth-lane-deploy.sh <lane> deploy` only

## Validation Gate

```bash
npm -w apps/server run verify:council-dao-deploy-permit-v1
./scripts/verify-council-dao-deploy-permit-v1.sh
akalynth-ops/scripts/verify-council-dao-deploy-permit-v1.sh
```

## Non-Claims

- No auto-deploy on vote approval
- No sim deploy in v1
- No standalone build/restart council classes