# Akalynth Modern HUD Browser QA

## Source visual truth

- Before/reference screenshot: `/tmp/codex-remote-attachments/019f504b-d1b9-75d3-97ab-4f4a0546c97a/689a9fd2-d600-4c63-9373-819f2fc3794b/1-Photo-1.jpg`
- Intended redesign: modern game HUD approved by the user; the supplied screenshot remains the structural and defect reference, not a pixel-level modern style target.

## Implementation evidence

- Browser report: `docs/evidence/modern-ui-browser-qa-final/web_play_shell_smoke.json`
- Browser smoke report: `docs/evidence/modern-ui-browser-qa-final/mobile_playable_smoke_report.json`
- 1280x568 reference capture: `docs/evidence/modern-ui-browser-qa-final/screenshots/09_modern_ui_1280x568.png`
- 1440x900 desktop capture: `docs/evidence/modern-ui-browser-qa-final/screenshots/09_desktop_debug_mode_1440x900.png`
- 932x430 landscape capture: `docs/evidence/modern-ui-browser-qa-final/screenshots/02_landscape_entry_play_surface_932x430.png`
- 390x844 portrait capture: `docs/evidence/modern-ui-browser-qa-final/screenshots/01_portrait_rotate_gate_390x844.png`

## Browser environment

- Chromium: `/snap/chromium/current/usr/lib/chromium-browser/chrome`
- Local Vite client with deterministic fake HTTP/WebSocket playable peer.
- Browser protocol: Chromium DevTools Protocol.
- Runtime checks: console errors, runtime exceptions, failed network loads.

## Full-view comparison evidence

The final implementation preserves the original playfield, world scale, interaction regions, and mobile landscape composition while replacing the dense retro chrome with compact modern surfaces. The former white checkerboard panel is gone. HUD, controls, objective rail, action rail, and command dock remain visible within the viewport.

## Focused region comparison

- Top bar: compact dark surface, readable connection state, Layout entry point, and no accidental drag outside customization mode.
- Player/status HUD: grouped data card with readable health, position, respect, standing, gold, and link states.
- Objective rail: moved below the top bar on desktop so it is not visually buried underneath it.
- Touch controls: modern translucent control well with 44px-plus D-pad targets and 52px primary action targets.
- Command dock: modern raised surface with readable sheet actions and no desktop overflow.
- Customization: explicit Move handles, keyboard nudge, persistence, Reset, Done, and orientation-specific storage.

## Findings and fix history

- [P1 fixed] Desktop controls were pushed below the viewport by a generic `position: relative` customization rule. Removed the override and preserved the existing fixed positioning. Verified in the final 1440x900 capture.
- [P1 fixed] React Fast Refresh crashed the first browser lane with `$RefreshSig$ is not defined` before mount. The smoke environment now uses the direct Chromium binary and disables the HMR plugin only for the fixed browser smoke lane. Normal development keeps the React plugin.
- [P2 fixed] Desktop objective rail overlapped the top bar and became low contrast. Moved it below the top bar for desktop viewports.
- [P2 fixed] The screenshot-facing UI texture family contained the white checkerboard panel artifact. Regenerated and synchronized the complete 13-asset UI family.

## Final browser results

- 61 checks passed.
- Console errors: 0.
- Runtime exceptions: 0.
- Failed network loads: 0.
- Fake peer received login, enter-world, and movement intents.
- No main scrollbars at tested play surfaces.
- Portrait rotate gate passed.
- D-pad press/release/stop interaction passed.
- Pack, chat, and log sheet flows passed.
- Layout drag, keyboard nudge, reload persistence, reset, and orientation isolation passed.
- 1280x568, 932x430, 390x844, and 1440x900 captures produced.

## Follow-up polish

- P3: create a dedicated modern art-direction board for pixel-level visual comparison in a future asset pass. The current browser QA intentionally uses the approved modern token system while retaining Akalynth’s world art identity.

final result: passed
