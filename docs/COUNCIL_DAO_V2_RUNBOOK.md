# Witness Council DAO v2 — Treasury + Reputation Runbook

Authority: `AKALYNTH_COUNCIL_DAO_V2`

Parent: `AKALYNTH_COUNCIL_DAO_V1` (lane check gate — unchanged action classes)

v2 adds **member reputation registry** and an **append-only ops treasury ledger**.
This is symbolic `ops_credit` bookkeeping — not in-game gold or real money.

## Custody Layout (v2 additions)

| Path | Purpose |
|------|---------|
| `council/members/<id>.json` | Member reputation registry (`council-member-reputation/v1`) |
| `council/ledger/entries.jsonl` | Append-only treasury ledger (`council-treasury-ledger-entry/v1`) |
| `council/proposals/` | Proposal JSON (optional `quorum.min_weighted_approvals`) |
| `council/votes/<proposal-id>/` | Vote receipts |
| `council/permits/` | Execution permits (now include `reputation_resolution`, `treasury_ledger_entry_id`) |

Schemas: `repos/akalynth-codex/schema/council-*.schema.json`

## Weight Resolution

When `--members-dir` is set (default: `council/members/`):

1. Gate loads `council-member-reputation/v1` files by `member_id`.
2. Active members contribute `reputation_score` as vote weight.
3. Unknown members fall back to `reputation_weight` on the vote receipt.
4. Optional `quorum.min_weighted_approvals` on the proposal is enforced.

## Treasury Ledger

On each permit issuance the gate appends:

1. `opening_balance` row (100 `ops_credit`) if ledger file is new
2. `permit_execution` debit (`-1 ops_credit`) referencing the permit

Ledger rows chain via `prior_entry_hash` / `entry_hash`.

## Commands

Full v2 verification (codex samples + ops gate):

```bash
cd /home/sovereign/akalynth-ops/repos/akalynth
./scripts/verify-council-dao-v2.sh
```

Ops-only (from `akalynth-ops` workspace):

```bash
cd /home/sovereign/akalynth-ops
./scripts/verify-council-dao-v2.sh
```

Issue permit with registry + ledger (skip lane on schema-only hosts):

```bash
./bin/council-execution-gate.sh \
  --proposal council/proposals/sample-beta-check-v2.json \
  --votes council/votes/sample-beta-check-v2/ \
  --members-dir council/members \
  --ledger-file council/ledger/entries.jsonl \
  --emit-permit council/permits/sample-beta-check-v2.json \
  --skip-lane-check
```

Skip ledger append (permit-only):

```bash
./bin/council-execution-gate.sh \
  --proposal council/proposals/sample-beta-check.json \
  --votes council/votes/sample-beta-check/ \
  --emit-permit council/permits/sample-beta-check.json \
  --skip-ledger \
  --skip-lane-check
```

## Proof Target

**`council_treasury_reputation_v2`**

Given `sovereign` with `reputation_score: 2.0` and
`min_weighted_approvals: 2.0`:

1. Gate resolves weight from registry (not static receipt `1.0`)
2. Weighted quorum passes and is recorded on permit
3. Ledger appends `permit_execution` debit
4. Lane `check` adapter unchanged from v1

## Non-Mutation Boundary

v2 inherits v1 boundaries. Council path still never calls `build`, `restart`,
or `deploy`. Treasury ledger is ops bookkeeping only.

## Deploy Permit Follow-On

Gated beta/staging deploy with human ack:
`docs/COUNCIL_DAO_DEPLOY_PERMIT_V1_RUNBOOK.md` (`AKALYNTH_COUNCIL_DAO_DEPLOY_PERMIT_V1`)

## Engineering Loop Receipt

`docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_COUNCIL_DAO_V2/receipt.json`