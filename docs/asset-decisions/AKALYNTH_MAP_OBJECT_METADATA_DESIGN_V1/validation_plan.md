# Validation Plan

Status: draft design validation plan.

This gate defines future verifier checks. It does not add production validators or runtime schema consumers.

## Current Gate Checks

- Draft artifacts exist under `docs/asset-decisions/AKALYNTH_MAP_OBJECT_METADATA_DESIGN_V1/`.
- Draft schemas are valid JSON.
- Draft example files are valid JSON.
- Design text explicitly separates visual metadata from gameplay authority.
- Protected runtime files remain unchanged.
- `npm run verify:quick` passes.

## Future Visual Object Checks

- Every visual object references an existing visual asset id.
- Every visual object has `mechanics: null`.
- Every visual object has `plane: "visual"`.
- Every visual object has explicit authority `none` values.
- Visual objects may not contain blocking, walkable, interaction, shop, dialogue, spawn, AI, combat, ownership, access, house, or door-permission fields.
- Visual examples may cite accepted visual receipts only; they may not cite production promotion receipts that do not exist.

## Future Overlay Checks

- Overlay zones use `plane: "presentation_overlay"`.
- Overlay zones define presentation states only.
- Overlay `interior_footprint` and `doorway_tiles` are marked review-only unless a later authority gate promotes them.
- Overlay zones may not define ownership, access lists, protection zones, door permissions, collision, or walkability.

## Future Collision And Walkability Checks

- Collision metadata is stored in a collision plane, not visual object metadata.
- Walkability metadata is stored in a walkability plane, not visual object metadata.
- Collision and walkability evidence cites the relevant authority design gate.
- Visual asset ids are not used as the source of blocking or traversal truth.

## Protected Files

This design gate may not change:

- `apps/server/src/world/npcs.ts`
- `apps/server/src/world/mobs.ts`
- `packages/shared/maps/*.json`
- `packages/shared/types.ts`
- network protocol files
- collision or walkability registries
- house, ownership, access-list, shop, dialogue, faction, spawn, AI, or combat systems

## Promotion Rule

Any production map candidate must cite:

- an accepted visual layout receipt
- a separate collision/walkability evidence receipt
- a separate interaction/door/house authority receipt if those semantics are present

No production promotion can be inferred from debug-client fixture examples.
