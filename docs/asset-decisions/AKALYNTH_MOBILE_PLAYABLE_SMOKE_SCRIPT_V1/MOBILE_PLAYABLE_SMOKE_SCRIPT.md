# Mobile Playable Smoke Script

Lane: `AKALYNTH_MOBILE_PLAYABLE_SMOKE_SCRIPT_V1`

Closure target: `closed_mobile_playable_smoke_script_recorded_no_gameplay_authority_change`

## Purpose

Create a repeatable browser debug-client smoke flow for the phone landscape play surface.

This is a presentation/playability smoke only. It does not assert Android/native parity, production deployment readiness, gameplay authority, protocol behavior, server movement authority, collision, walkability, inventory authority, economy, combat, NPC/mob behavior, or receipt/proof semantics.

## Script

Run from the repository root while a debug-client dev server is available:

```sh
npm -w apps/debug-client run smoke:mobile -- --base-url http://127.0.0.1:5174/play/
```

The script uses Chrome DevTools Protocol directly through Node and does not add a browser automation dependency.

## Expected Flow

1. Open the debug client at `/play/`.
2. Verify portrait rotate gate at `390x844`.
3. Switch to landscape `932x430`.
4. Use the available cold-start path.
5. Enter play.
6. Exercise DPad press, release, leave, cancel, and stop handling.
7. Open Pack, verify the sheet is visible, then close it.
8. Open Chat, verify the sheet is visible, then close it.
9. Open Log/Chronicle, verify the sheet is visible, then close it.
10. Open Proof, verify the sheet is visible, then close it.
11. Confirm a clean play surface is restored.
12. Confirm the main phone play surface has no scrollbars.
13. Confirm desktop debug mode still renders.

## Validation Rules

- Portrait rotate gate must be visible.
- Mobile landscape cold-start entry must be visible.
- Map canvas, DPad, and dock must be visible after entry.
- The main play surface must not exceed the viewport in landscape.
- DPad pointer release, leave, cancel, and stop events must execute.
- Pack, Chat, Log, and Proof must open as sheets.
- Only the active sheet may be visible during each sheet step.
- Closing each sheet must return to no visible sheets.
- Desktop debug mode must not show the mobile rotate gate.

## Evidence Limits

- The DPad step exercises the existing browser pointer handlers; it does not prove server-side movement semantics.
- Pack uses existing inventory state and existing item intent paths only.
- Chat uses existing chat state and send callback only.
- Log uses the existing chronicle/log presentation only.
- Proof uses existing proof/debug state only.
- No runtime authority is created by this smoke.
