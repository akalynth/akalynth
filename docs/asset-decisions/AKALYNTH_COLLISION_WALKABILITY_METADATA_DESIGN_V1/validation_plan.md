# Validation Plan

Status: draft validation plan.

## Current Gate Checks

- Draft schema JSON parses.
- Draft example JSON parses.
- Negative collision/walkability cases are flagged.
- Protected runtime files remain unchanged.
- `npm run verify:quick` passes.

## Consistency Checks

- `collision.blocked + walkability.walkable = invalid`.
- `collision.clear + walkability.not_walkable = allowed, but must have reason`.
- `collision.unknown + any walkability = warning`.
- `walkability.walkable without collision entry = warning in draft, invalid in production candidate`.
- `collision.blocked on doorway candidate = warning unless reserved_conditional`.
- `doorway/threshold tiles should be reserved_conditional until door authority is designed`.
- `sewer entrance should be reserved_conditional until transition authority is designed`.
- `visual object references are evidence only, never authority`.

## Protected Boundary

This gate must not touch:

- `apps/server/src/world/npcs.ts`
- `apps/server/src/world/mobs.ts`
- `packages/shared/maps/*.json`
- `packages/shared/types.ts`
- network protocol files
- runtime collision registries
- runtime walkability registries
- door / house / ownership / access-list systems
- shop / dialogue / faction / spawn / AI / combat systems
