# Mobile Classic UI Polish

Lane: `AKALYNTH_MOBILE_CLASSIC_UI_POLISH_V1`

Closure target: `closed_mobile_classic_ui_polish_no_gameplay_authority_change`

## Purpose

Polish the debug-client mobile classic MMO shell for visual consistency, readable controls, sheet clarity, and original Akalynth stone/iron presentation.

This is presentation-only. It does not change server behavior, protocol fields, shared types, shared maps, Android/native code, deployment, runtime state, collision, walkability, combat, inventory authority, economy, NPC/mob behavior, chat protocol, or proof semantics.

## Changes

- Added a shared mobile sheet layer/backdrop for Chat, Pack, and Proof.
- Preserved existing sheet content and callbacks.
- Improved close/tap-out behavior for modal sheets.
- Polished the mobile DPad, dock, hotbar, HUD/objective panel, and sheet styling.
- Made disabled/cooling actions readable without looking enabled.
- Added compact `844x390` evidence in addition to the `932x430` smoke flow.

## Visual Rules

- Only the active mobile sheet should be visually present.
- The play surface should remain visible behind modal sheets.
- Closing a sheet should return to a clean play surface.
- The player, DPad, dock, action hotbar, status rail, and objective panel should remain readable in landscape.
- Disabled actions should remain visible but clearly inactive.

## Evidence Limits

- The mobile smoke validates browser presentation flow only.
- DPad smoke exercises existing pointer handlers, not server movement authority.
- Pack, Chat, Log, and Proof use existing data/callbacks.
- No Android/native parity is claimed by this lane.
