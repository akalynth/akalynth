# Scope And Consequences

## What This Decision Authorizes

Ratifying High City as canonical unblocks (but does **not** itself perform) the
following downstream lanes, in recommended order:

1. **Flamebound / new-district reconciliation** — resolve the open items in
   `CANONICAL_WORLD_DECISION.md` (Flamebound/Emberworks placement; lore roles for
   Sky Spires and Ley Core; align world-bible district names).
2. **Azura → High City naming migration design execution** — build on
   `AKALYNTH_AZURA_IDENTIFIER_MIGRATION_PLAN_V1` (compatibility/alias prep first).
3. **Runtime map id strategy** — decide `high_city` id rollout, keeping `azura`
   readable in historical receipts forever.
4. **Rookguard gate target strategy** — `gate_to_azura` → `gate_to_high_city`
   with aliasing.
5. **High City production-map promotion candidate** — promote a built High City map
   only after authority/projection lanes pass.
6. **Beta / deploy verification** — last, behind the protocol bump (`1.2.0`).

## What This Decision Does NOT Do

Decision-only. Promotion is explicitly **deferred** (per owner: "decision only,
defer promotion"). This lane does not:

- rename Azura in runtime (`packages/shared/maps/azura.json`, `GateToAzura`, ids)
- change shared protocol, shared types, or wire map names
- change server movement, collision, walkability, spawns, transitions
- change NPCs, mobs, shops, economy, quests, ownership, or character creation
- promote any map to production
- bump the protocol version
- deploy anything

## Dependency Direction

```text
AKALYNTH_LORE_BIBLE (canon)
        │
        ├── VAULTCORE_WORLD_BIBLE_EXTRACTION (lore)
        │
        └── HIGH_CITY_CANONICAL_WORLD_DECISION  ← this lane (ratify canon + name)
                    │
                    ├── district/Flamebound reconciliation
                    ├── AZURA_IDENTIFIER_MIGRATION (execution)
                    ├── runtime map id strategy
                    ├── Rookguard gate target
                    └── production-map promotion → beta/deploy verification
```

## Consequence Summary

After this lane is accepted, all future High City work may treat "High City is the
canonical first city of Akalynth" as settled, and reference this lane as the
authority. Runtime remains on Azura ids until the migration lanes run.
