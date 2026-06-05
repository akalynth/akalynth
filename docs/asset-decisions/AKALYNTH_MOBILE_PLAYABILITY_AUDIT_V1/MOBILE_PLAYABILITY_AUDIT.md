# AKALYNTH_MOBILE_PLAYABILITY_AUDIT_V1

Status: closed_mobile_playability_audit_no_code_change

Scope: read-only playability audit of the current debug-client mobile/desktop shell after `AKALYNTH_MOBILE_CLASSIC_GAME_SHELL_V1`.

This audit records what is visible and playable today. It does not implement fixes and does not change gameplay authority.

## Boundary

- No code changes were made by this audit.
- No CSS changes were made by this audit.
- No server, protocol, shared map, shared type, Android/native, deploy, or runtime files were changed by this audit.
- Movement, combat, pickup, inventory, economy, collision, walkability, NPC/mob, and map truth authority remain unchanged.
- Existing local uncommitted debug-client shell work predates this audit and is treated as the inspected baseline.

## Screenshots Inspected

- `screenshots/01_desktop_1440x900.png`
- `screenshots/02_mobile_portrait_390x844.png`
- `screenshots/03_mobile_landscape_932x430.png`

## Findings

### Desktop 1440x900

Result: pass with notes.

- Classic stone/iron shell is visible and coherent.
- Map canvas, player, top bar, objective chips, keypad, status, chat/log/proof dock, and action panel are visible.
- Desktop remains usable as a verbose debug surface.
- The desktop layout still feels like a debug tool rather than a final player UI, which is acceptable for this lane.

### Mobile Portrait 390x844

Result: pass.

- Rotate gate is visible.
- The gate uses the classic shell styling.
- No play controls are exposed in portrait, which matches the intended orientation gate.
- No obvious portrait scrollbar or overflow issue is visible in the capture.

### Mobile Landscape 932x430

Result: needs core play-surface refinement.

- Canvas fills the play surface.
- No visible browser scrollbars are present.
- Objective chip remains visible.
- Keypad and compact bottom dock are visible.
- The permanent surface is compact and no longer dominated by verbose debug panels.

Blocking playability issue:

- A cold mobile landscape session does not expose an obvious create/sign-in/play path. The identity/character creation HUD is hidden in landscape, while the action panel only shows `Locked`.

Secondary playability issues:

- Player visibility cannot be proven from the cold landscape capture because no active character is visible; the spawn marker is visible instead.
- Low-height landscape mode shrinks keypad cells below the preferred 44px touch target.
- The center keypad cell looks like an empty square rather than an obvious stop/cancel affordance.
- Health/link/session status are hidden in low-height landscape, leaving too little player-state feedback.
- Landmark labels and small map markers are readable on desktop but very small on phone landscape.
- Action availability is not clear in Stage 0; the player sees `Locked` but not the next step.

## Current Assessment

The current shell is a good visual foundation, but it is not yet an OK playable mobile UI. The next lane should focus on the core play surface before adding inventory/backpack sheets.

Primary next work:

1. Restore a compact mobile character/create/sign-in affordance in landscape.
2. Ensure an active character remains visible and centered where the map bounds permit.
3. Keep a minimal health/link/session status visible even at 932x430.
4. Increase or rebalance keypad targets so practical controls remain near 44px.
5. Make the center keypad cell visibly communicate stop/cancel.
6. Improve compact action hotbar clarity for locked/unavailable states.
7. Improve tiny mobile map marker readability without changing map authority.

## Closure

`AKALYNTH_MOBILE_PLAYABILITY_AUDIT_V1` is closed as:

`closed_mobile_playability_audit_no_code_change`
