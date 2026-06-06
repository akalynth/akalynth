# AKALYNTH_HIGH_CITY_PLAYER_FACING_LANDMARK_COPY_PASS_V1

status: implemented_pending_review
mechanical_class: copy_only_no_runtime_semantics_change

## Summary

High City player-facing landmark copy was tightened so the current first-city
surface feels like the first real city after Rookguard rather than an empty
placeholder map.

The pass keeps the approved semantic split:

- High City = player-facing city name
- Azura = unchanged legacy runtime id
- GateToAzura = unchanged legacy tile identifier

## Changed Files

- `docs/WORLD_HIGH_CITY.md`
- `apps/debug-client/src/data/lore.ts`

## Copy Spine

High City is the first city a traveler reaches after Rookguard opens its gate.
Rookguard proves a living hand is present. High City asks what that hand will
leave behind.

## Boundary Summary

- `packages/shared/maps/` untouched
- `packages/shared/maps/azura.json` untouched
- `GateToAzura` unchanged
- `Azura` runtime id unchanged
- `apps/server/src/world/npcs.ts` untouched
- no mechanics, map, property, event, or server behavior changed
- `akalynth-site` untouched

## Verification Summary

- `npm -w apps/debug-client run build`: PASS
- `npm run verify:quick`: PASS, 9/9 verifiers
- `git diff --check -- docs/WORLD_HIGH_CITY.md apps/debug-client/src/data/lore.ts`: PASS

## Caveat

The repo had unrelated dirty server files before this lane. Those files are not
part of this receipt and were not cleaned, included, or modified for this lane.
