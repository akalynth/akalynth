# AKALYNTH_AZURA_LOOP_PRESENTATION_V1

**Date:** 2026-08-07  
**Status:** APPROVED (implement on clients; no protocol change)  
**Depends on:** live gather→refine→deliver proof; `CLIENT_PLAY_SURFACE_CONTRACT_V1`

## Player question
I finished the chill loop on beta — why did it feel like a debug tool, and why does my outfit UI float into play?

## Decision
1. **Presentation ritual** on both clients when gather content is enabled: compact **Gather → Attune → Deliver** steps derived only from server-backed held item; held chip with human labels; deliver status from `deliver_result` fields only.
2. **HUD placement:** outfit/recolor only in create + sheets; never on d-pad/hotbar/map.
3. **Identity lock:** create `outfit_id` → world `sprite_id` consistent on web and APK for catalog outfits.

## Non-decisions
- No new items, nodes, economy rates, or WS message types.
- Full map-marker parity Android ↔ web remains P1.
- Shared npm package for labels deferred; Android may mirror `gatherLabels.ts` strings.

## Copy table (shared)
Source: `apps/debug-client/src/data/gatherLabels.ts` — Ley Mote Tending, node/station labels, held/reward helpers.

## Verify
- Wire authority + gather unit/loop verifiers still green.
- `npm run smoke:beta-azura-loop` still PASS (protocol independent of UI chrome).
- Manual: steps/held/status visible on web (and Android when PR-C lands).
