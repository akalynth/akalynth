# Priority Fix List

Audit: `AKALYNTH_MOBILE_PLAYABILITY_AUDIT_V1`

Recommended next implementation lane:

`AKALYNTH_MOBILE_CORE_PLAY_SURFACE_V1`

## P0

1. Mobile landscape needs a compact create/sign-in/play affordance.

   Current cold landscape state hides the identity/character creation HUD and shows only a locked action panel. A new mobile player can be stranded before play begins.

2. Active player visibility must be validated in landscape.

   The shell should keep the player visible and follow-centered where map bounds permit. At map edges, clamping is acceptable, but the capture should clearly show the active character when a character exists.

## P1

3. Keep minimal player state visible in low-height landscape.

   Health/link/session feedback disappears at 932x430 because the stats HUD is hidden. Replace it with a smaller badge instead of removing all status.

4. Rebalance keypad sizing for practical touch targets.

   Low-height landscape shrinks keypad buttons to about 41px. Keep targets closer to 44px where practical, or enlarge the press region while preserving compact visuals.

5. Make stop/cancel visually obvious.

   The center keypad cell has an accessible label, but visually reads like an empty square. It should communicate stop/cancel without adding a joystick dependency.

6. Improve compact hotbar locked/unavailable states.

   `Locked` is technically clear, but it does not tell the player how to become playable. Add a compact next-step hint without bringing verbose panels back to the permanent phone surface.

## P2

7. Improve mobile marker readability.

   Landmark labels and small map markers are very small in landscape. Increase contrast or simplify mobile marker presentation without changing map semantics.

8. Preserve desktop debug mode while refining mobile.

   Desktop may keep verbose debug panels. Phone landscape should stay compact.

## P3

9. Defer inventory/backpack sheet.

   Inventory can sprawl into item semantics and gameplay UX. Keep it behind the core play-surface lane.

10. Defer chat/log/proof sheet polish.

   Chat/log/proof sheets are important but should follow the core play surface.

## Proposed Lane Order

1. `AKALYNTH_MOBILE_CORE_PLAY_SURFACE_V1`
2. `AKALYNTH_MOBILE_INVENTORY_BACKPACK_SHEET_V1`
3. `AKALYNTH_MOBILE_CHAT_LOG_PROOF_SHEETS_V1`
4. `AKALYNTH_MOBILE_CLASSIC_SKIN_POLISH_V1`
5. `AKALYNTH_MOBILE_PLAYABLE_SMOKE_SCRIPT_V1`
