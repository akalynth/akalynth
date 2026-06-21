# Forgehold Act II Ashglass Evidence — Runbook (v1)

Authority: `AKALYNTH_FORGEHOLD_ASHGLASS_EVIDENCE_V1`

Proof target: `forgehold_ashglass_evidence_v1`

## Scope

Server-owned Forgehold route slice **Act II — Ember Road Recovery**. Players recover
three evidence objects through `use_skill` route actions before Act III shipment
investigation. This runbook covers source validation only — no runtime deploy.

## Evidence Chain

| Step | Skill | Receipt action | Evidence object |
|------|-------|----------------|-----------------|
| 1 | `route:evidence:milepost` | `forgehold_milepost_evidence_recovered` | `broken_route_seal` |
| 2 | `route:evidence:caravan` | `forgehold_caravan_evidence_recovered` | `charred_shipment_plate` |
| 3 | `route:evidence:ravine` | `forgehold_ashglass_ravine_evidence_recovered` | `ashglass_shard` |

Prerequisite: `route:survey:forgehold` → `route_surveyed` receipt.

Act III gate: `route:quest:shipment` requires all three Act II receipts.

## Authority Guards (all Act II + Act III investigation)

- `travel_unlocked: false`
- `economy_impact: none`
- `item_mint: false`
- No wallet debit/credit

## Distinction from Heartforge Lab

`route:craft:ashglass` (post Heartforge gate) records `ashglass_evidence_recovered`
with `heartforge_ashglass_evidence_v1` and `tempered_slag_trace`. Act II ravine
recovery uses `forgehold_ashglass_evidence_v1` and does not mint items.

## Validation Commands

From `repos/akalynth`:

```bash
npm -w apps/server run verify:quick
npm -w apps/server run verify:forgehold-ashglass-evidence
npm -w apps/server run verify:route-surveys
bash scripts/verify-forgehold-ashglass-evidence.sh
```

## Codex Custody

| Path | Purpose |
|------|---------|
| `repos/akalynth-codex/design/forgehold-ashglass-evidence-v1.md` | Packet authority |
| `repos/akalynth-codex/schema/forgehold-evidence-object.schema.json` | Evidence object schema |
| `repos/akalynth-codex/samples/forgehold-act-ii-evidence-chain.sample.json` | Ordered chain sample |
| `repos/akalynth-codex/entries/forgehold-ashglass-evidence.json` | Live codex entry |

## Non-Mutation Boundary

- No `/opt/akalynth-*` deploy
- No `/var/lib/akalynth-*` or `/etc/akalynth-*` changes
- No Caddy or systemd restart from this packet