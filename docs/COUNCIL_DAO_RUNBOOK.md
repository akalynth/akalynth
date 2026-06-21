# Witness Council DAO — Local Ops Runbook (v1)

Authority: `AKALYNTH_COUNCIL_DAO_V1`

This runbook describes the **local ops Witness Council** — not in-fiction Accord
Council governance. v1 gates **read-only lane preflight only**.

## Custody Layout

All council artifacts live under the `akalynth-ops` workspace (not in `repos/akalynth`):

| Path | Purpose |
|------|---------|
| `council/proposals/` | Proposal JSON (`council-proposal/v1`) |
| `council/votes/<proposal-id>/` | Vote receipt JSON per proposal |
| `council/permits/` | Execution permit JSON after gate run |
| `council/members/` | Member reputation registry (v2) |
| `council/ledger/` | Append-only ops treasury ledger (v2) |

Schemas: `repos/akalynth-codex/schema/council-*.schema.json`

## v1 Action Classes (only)

- `lane:beta:check`
- `lane:staging:check`
- `lane:sim:check`

No `build`, `restart`, or `deploy` in v1.

## Flow

```text
1. Author proposal JSON (status: approved after vote window)
2. Record vote receipts in council/votes/<proposal-id>/
3. Run council-execution-gate.sh
4. Gate validates quorum → emits permit → runs akalynth-lane-deploy.sh <lane> check
5. Permit records check_passed or check_failed
```

## Commands

Verify schemas + gate contract (no lane required):

```bash
cd /home/sovereign/akalynth-ops
./scripts/verify-council-dao-v1.sh
```

Issue permit + lane check (operator host with lane tree present):

```bash
./bin/council-execution-gate.sh \
  --proposal council/proposals/sample-beta-check.json \
  --votes council/votes/sample-beta-check/ \
  --emit-permit council/permits/sample-beta-check.json
```

Skip lane check (schema/permit-only hosts):

```bash
./bin/council-execution-gate.sh \
  --proposal council/proposals/sample-beta-check.json \
  --votes council/votes/sample-beta-check/ \
  --emit-permit council/permits/sample-beta-check.json \
  --skip-lane-check
```

## Sample Fixtures

Copied from `repos/akalynth-codex/samples/` by the verifier:

- `council/proposals/sample-beta-check.json`
- `council/votes/sample-beta-check/sovereign.json`

## Non-Mutation Boundary

Council v1 never:

- auto-executes on vote approval;
- calls `build`, `restart`, or `deploy`;
- mutates `/opt`, `/var/lib`, or `/etc` by itself.

Lane `check` is read-only preflight on the operator host. Deploy remains a
separate explicit operator action per `AGENTS.md`.

## v2 Follow-On

Treasury + reputation: see `docs/COUNCIL_DAO_V2_RUNBOOK.md` and
`AKALYNTH_COUNCIL_DAO_V2`.

## Engineering Loop Receipt

`docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_COUNCIL_DAO_V1/receipt.json`