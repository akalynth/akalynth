# Changed Files

Lane: `AKALYNTH_HIGH_CITY_PLAYER_FACING_LANDMARK_COPY_PASS_V1`

## Included In This Lane

- `docs/WORLD_HIGH_CITY.md`
  - tightened first-city arrival language after Rookguard
  - clarified spawn as arrival/orientation, not reward or progression
  - clarified Central Plaza as civic gathering space
  - clarified Guild Hall as visible placeholder with no enter logic
  - clarified `H1`-`H3` as three marked address plots, not implemented interiors
  - restated the High City / Azura / GateToAzura naming boundary

- `apps/debug-client/src/data/lore.ts`
  - aligned display-only spawn copy with the approved copy spine
  - aligned landmark tooltip copy for Central Plaza, Guild Hall, and house plots
  - preserved existing map keys, tile codes, markers, and runtime identifiers

## Explicitly Not Included

- No `packages/shared/maps/` edits
- No `apps/server/src/world/npcs.ts` edits
- No `akalynth-site` edits
- No server, property, event, economy, NPC behavior, map, tile, collision, or spawn changes

## Existing Dirty Files Not Part Of This Lane

The following unrelated server files were already dirty before this pass and are
not covered by this receipt:

- `apps/server/package.json`
- `apps/server/src/index.ts`
- `apps/server/src/persist/index.ts`
- `apps/server/src/persist/materializers.ts`
- `apps/server/src/persist/queries.ts`
- `apps/server/src/persist/schema.ts`
- `apps/server/src/persist/types.ts`
- `apps/server/tools/verify-herb-use.ts`
