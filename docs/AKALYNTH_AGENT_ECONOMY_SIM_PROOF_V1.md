# AKALYNTH_AGENT_ECONOMY_SIM_PROOF_V1

Status: source-local proof contract.

## Purpose

This proof lane closes the agent economy simulator as a local proof artifact for
the pre-alpha Akalynth vertical slice.

It proves that the offline simulator can replay a deterministic, receipt-backed
economy/gameplay loop using server-domain code without starting beta, staging,
or any deployed runtime service.

This is not a launch claim, production deployment proof, Android release proof,
or content-alpha claim.

## Scope

The proof covers:

- worker, homesteader, and merchant simulation roles;
- Rookguard and Azura map traversal;
- treasury credits and debits;
- work contract completions;
- presence receipts;
- loot minting and pickup;
- property sales and resale auction settlement;
- combat, death, and dropped world items;
- NPC dialogue samples;
- Witness Moth Bloom world-event receipts;
- SQLite materializer idempotence for simulator receipts.

The proof does not cover:

- live beta or staging services;
- production Caddy, systemd, firewall, or key custody;
- Android release readiness;
- full high-city runtime-id migration;
- anti-snipe auction behavior;
- long-lived persistent-world guarantees.

## Required Commands

Run from the repository root:

```bash
npm run verify:showcase
```

The showcase preflight includes the simulator verifier.

The focused simulator verifier may also be run directly:

```bash
cd apps/server
npm run verify:agent-economy-simulation
```

Optional artifact exports:

```bash
cd apps/server
npm run simulate:agent-economy -- --format=summary
npm run simulate:agent-economy -- --format=training-jsonl
npm run simulate:agent-economy -- --format=receipts-jsonl
```

## Expected Summary

For the default proof seed and duration, the verifier must emit:

- `agent_count` = 4
- `receipt_count` = 133
- `training_steps` = 12
- `chronicle_events` = 25 in the materialized projection
- `full_world_maps_touched` includes `Azura` and `Rookguard`
- final line: `[verify-agent-economy-simulation] all checks passed`

Any change to these expected values must be reviewed as a proof contract change,
not treated as harmless output churn.

## Artifact Format

A named local proof packet should include:

- `PROOF_PACKET.md` with commit, branch, dirty state, command list, and bounded
  claims;
- `first-five-minutes-agent-economy-v1.md` copied from
  `docs/FIRST_FIVE_MINUTES_AGENT_ECONOMY_V1.md`;
- `verify-showcase.txt` containing the complete `npm run verify:showcase`
  transcript;
- `agent-economy-simulation.txt` containing the focused simulator verifier
  transcript;
- `agent-economy-summary.json` from `simulate:agent-economy -- --format=summary`;
- `agent-economy-training.jsonl` from
  `simulate:agent-economy -- --format=training-jsonl`;
- `agent-economy-receipts.jsonl` from
  `simulate:agent-economy -- --format=receipts-jsonl`;
- `known-gaps-snapshot.md` copied from `docs/KNOWN_GAPS.md`;
- `current-stage-snapshot.md` copied from `docs/CURRENT_STAGE.md`;
- optional CI artifact URL if this proof is promoted from local-only to CI and
  local.

## Bounded Claim

When the required commands pass and the artifacts are preserved, the supported
claim is:

> Akalynth has a local pre-alpha proof packet for a deterministic agent economy
> loop, backed by simulator receipts, materialized SQLite projection checks, and
> the standard local showcase preflight.

Do not claim production readiness, public launch readiness, content-alpha
readiness, Android release readiness, or complete persistence guarantees from
this proof lane.

## First-Five-Minutes Link

`docs/FIRST_FIVE_MINUTES_AGENT_ECONOMY_V1.md` maps the simulator roles to the
deterministic first-five-minutes path. That document is a design target backed
by this proof lane; it is not a claim that every beat is already polished in the
live client UI.
