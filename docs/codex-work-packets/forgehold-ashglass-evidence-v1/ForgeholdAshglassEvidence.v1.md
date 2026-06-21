# Forgehold Act II Ashglass Evidence v1

Status: `codex:ready`

Authority object: `AKALYNTH_FORGEHOLD_ASHGLASS_EVIDENCE_V1`

Codex authority: `repos/akalynth-codex/design/forgehold-ashglass-evidence-v1.md`

## Goal

Close Forgehold **Act II — Ember Road Recovery** on `main`: recover three
server-owned evidence objects in order before Act III shipment contradiction
investigation. No travel unlock, economy promotion, or item mint.

## Act II Evidence Chain

| Order | Skill | Location | Evidence object | Receipt action |
|-------|-------|----------|-----------------|----------------|
| 1 | `route:evidence:milepost` | Ember Road Milepost | `broken_route_seal` | `forgehold_milepost_evidence_recovered` |
| 2 | `route:evidence:caravan` | Burned Caravan Site | `charred_shipment_plate` | `forgehold_caravan_evidence_recovered` |
| 3 | `route:evidence:ravine` | Ashglass Ravine | `ashglass_shard` | `forgehold_ashglass_ravine_evidence_recovered` |

Act III (`route:quest:shipment`) requires all three Act II receipts and records the
`departed / undeparted` contradiction with `act_id: act_03_burned_caravan_investigation`.

Post-gate `route:craft:ashglass` (Heartforge lab) remains separate from Act II ravine recovery.

## Source Inputs

- `repos/akalynth-codex/design/forgehold-ashglass-evidence-v1.md`
- `repos/akalynth-codex/schema/forgehold-evidence-object.schema.json`
- `repos/akalynth-codex/samples/forgehold-act-ii-evidence-chain.sample.json`
- `repos/akalynth-codex/entries/forgehold-ashglass-evidence.json`
- `repos/akalynth-codex/design/forgehold.md` (Act II)
- `docs/asset-decisions/AKALYNTH_FORGEHOLD_ROUTE_SOURCE_INTAKE_V1/`
- `packages/shared/skills.ts`
- `apps/server/src/skills/handlers.ts`
- `apps/server/src/world/onwardRoutes.ts`
- `apps/server/src/world/rookguardQuest.ts`

## Packet Work

1. Land Act II evidence skills + receipt actions in shared types and server handlers.
2. Update onward-route projection and shipment gate.
3. Add `apps/server/tools/verify-forgehold-ashglass-evidence.ts`.
4. Add `scripts/verify-forgehold-ashglass-evidence.sh` + runbook.
5. Engineering-loop receipt in `repos/akalynth`.

## Recommended Proof Target

**`forgehold_ashglass_evidence_v1`**

After Forgehold survey:

1. Three ordered Act II receipts emit with `act_id: act_02_ember_road_recovery`
2. Out-of-order / repeat recovery rejected without side effects
3. Shipment investigation gated until ravine evidence recovered
4. No travel unlock, wallet mutation, or item mint

## Branch Contract

- Branch prefix: `codex/forgehold-`
- Recommended branch: `codex/forgehold-ashglass-evidence-v1`
- Label family: `packet:forgehold-ashglass-evidence`

## Validation Gate

```bash
git diff --check
npm -w apps/server run verify:quick
npm -w apps/server run verify:forgehold-ashglass-evidence
npm -w apps/server run verify:route-surveys
bash scripts/verify-forgehold-ashglass-evidence.sh
```

## Non-Claims

- No route travel unlock or map transition promotion
- No Soulsteel crafting economy promotion beyond existing guards
- No Heartforge dungeon or boss promotion
- No runtime deploy

## Follow-On

- `AKALYNTH_ROOKGUARD_FIRST30_PRESENTATION_V1`
- `AKALYNTH_COUNCIL_DAO_V2`