# AKALYNTH_ENGINEERING_LOOP_COUNCIL_DAO_V2

Authority: `AKALYNTH_COUNCIL_DAO_V2`

Proof target: `council_treasury_reputation_v2`

Parent proof: `council_lane_check_permit_v1` (`AKALYNTH_COUNCIL_DAO_V1`)

## Scope

- Member reputation registry (`council/members/`)
- Append-only ops treasury ledger (`council/ledger/entries.jsonl`)
- Gate weight resolution + weighted quorum
- v1 lane-check action classes unchanged

## Deliverables

| Artifact | Path |
|----------|------|
| Runbook | `docs/COUNCIL_DAO_V2_RUNBOOK.md` |
| Contract verifier | `apps/server/tools/verify-council-dao-v2.ts` |
| Shell verifier | `scripts/verify-council-dao-v2.sh` |
| Work packet | `docs/codex-work-packets/council-dao-v2/CouncilDao.v2.md` |
| Ops gate | `akalynth-ops/bin/council-execution-gate.sh` |
| Ops verifier | `akalynth-ops/scripts/verify-council-dao-v2.sh` |

## Receipt

`receipt.json` in this directory records validation and merge closure.