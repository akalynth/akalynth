# Witness Council DAO v2 — Treasury + Reputation

Status: `codex:candidate`

Authority object: `AKALYNTH_COUNCIL_DAO_V2`

Parent: `AKALYNTH_COUNCIL_DAO_V1` (accepted @ `bcae5f5`)

Codex authority: `repos/akalynth-codex/design/council-dao-v2.md`

## Goal

Extend the local Witness Council with **member reputation registry** and an
**append-only ops treasury ledger** — without changing v1 lane-check action
classes or introducing runtime auto-mutation.

## Why This Packet Now

- v1 shipped proposal → vote → permit → lane `check` with static vote weights.
- Follow-on explicitly named treasury ledger + reputation weighting.
- Weighted quorum enables multi-member council posture before deploy-permit v1.

## Source Inputs

- `repos/akalynth-codex/design/council-dao-v2.md`
- `repos/akalynth-codex/schema/council-member-reputation.schema.json`
- `repos/akalynth-codex/schema/council-treasury-ledger-entry.schema.json`
- `repos/akalynth-codex/samples/council-proposal-v2-weighted.sample.json`
- `akalynth-ops/bin/council-execution-gate.sh`
- `akalynth-ops/scripts/verify-council-dao-v2.sh`
- `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_COUNCIL_DAO_V1/receipt.json`

## Packet Work

1. Land engineering-loop record +
   `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_COUNCIL_DAO_V2/receipt.json`.

2. Land `docs/COUNCIL_DAO_V2_RUNBOOK.md` and
   `apps/server/tools/verify-council-dao-v2.ts`.

3. Extend ops gate with `--members-dir`, `--ledger-file`, weighted quorum.

4. Validate via `scripts/verify-council-dao-v2.sh` (ops + codex contract).

5. Accept `council-dao` codex entry v2 packet after upstream merge.

## Recommended Proof Target

**`council_treasury_reputation_v2`**

Given `sovereign` with `reputation_score: 2.0` and
`min_weighted_approvals: 2.0`:

1. Gate resolves vote weight from member registry
2. Weighted quorum passes; permit records `reputation_resolution`
3. Ledger appends `permit_execution` debit in `ops_credit`
4. Lane `check` adapter behavior unchanged from v1

## Branch Contract

- Branch: `codex/council-dao-v2`
- Labels: `packet:council-dao`, `codex:ready` → `codex:accepted`
- GitHub canonical for `repos/akalynth`

## Validation Gate

```bash
git diff --check
npm -w apps/server run verify:council-dao-v2
./scripts/verify-council-dao-v2.sh
akalynth-ops/scripts/verify-council-dao-v2.sh
```

## Non-Claims

This packet does not:

- deploy, restart, build, or mutate runtime trees;
- move real money or custodial keys;
- auto-adjust reputation from gameplay;
- grant in-game governance or player reputation.

## Acceptance Evidence

The packet is accepted only after:

1. Codex entry `council-dao` lists v2 schemas and packet.
2. `verify-council-dao-v2.sh` passes (including v1 regression).
3. GitHub upstream PR merged to `main`.

## Follow-On Loop (not this packet)

- `AKALYNTH_COUNCIL_DAO_DEPLOY_PERMIT_V1` — gated deploy with human ack