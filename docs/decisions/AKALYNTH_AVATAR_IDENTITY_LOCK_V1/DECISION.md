# AKALYNTH_AVATAR_IDENTITY_LOCK_V1

**Date:** 2026-08-07  
**Status:** APPROVED (PR-D)  
**Contract:** `CLIENT_PLAY_SURFACE_CONTRACT_V1` §2.4.1, §2.6

## Audit matrix (create → world)

| Surface | Source of truth | Outfit picker? |
|---------|-----------------|----------------|
| Server catalog | `apps/server/src/character/catalog.ts` `OUTFITS` | N/A |
| Web create preview | `outfitIdentity.ts` → `characterCreatePreview.ts` | Yes — CharacterBar / entry only |
| Web world self | `PlayerPublic.sprite_id` from server | **No** |
| Web play identity strip | `IdentityStrip` from `me.name` + `me.sprite_id` | **No** |
| Android create | CharacterCreateActivity + IdentityApi outfits | Yes — create activity only |
| Android world self | `PlayerPublic.spriteId` + GameCanvas | **No** |
| Android HUD identity | `OutfitIdentity.identityLabel` from `me.spriteId` | **No** |

## Female art
Server `sprite_id: null` for female outfits (E7 pending). Client create preview uses **labeled** bundled stand-in (`fallbackArt: true`). World must not invent a different outfit’s final art as success.

## Placement
Outfit / recolor UI only in create or character sheets — never on play d-pad/hotbar/map (CharacterBar already gated to non-play entry; IdentityStrip is display-only).

## Verify
- Web: `verify-character-create-preview`, identity helpers unit checks, build
- Android: `OutfitIdentityTest`, compileBetaKotlin
