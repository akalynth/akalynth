# AKALYNTH_ENGINEERING_LOOP_COUNCIL_DAO_DEPLOY_PERMIT_V1

Authority: `AKALYNTH_COUNCIL_DAO_DEPLOY_PERMIT_V1`

Proof target: `council_lane_deploy_permit_v1`

Parent: `council_treasury_reputation_v2`

## Scope

- `lane:beta:deploy` and `lane:staging:deploy` action classes
- Human ack via `AKALYNTH_COUNCIL_DEPLOY_ACK=1` or `--human-ack`
- First council path permitting runtime mutation

## Deliverables

| Artifact | Path |
|----------|------|
| Runbook | `docs/COUNCIL_DAO_DEPLOY_PERMIT_V1_RUNBOOK.md` |
| Contract verifier | `apps/server/tools/verify-council-dao-deploy-permit-v1.ts` |
| Shell verifier | `scripts/verify-council-dao-deploy-permit-v1.sh` |
| Ops gate | `akalynth-ops/bin/council-execution-gate.sh` |
| Ops verifier | `akalynth-ops/scripts/verify-council-dao-deploy-permit-v1.sh` |