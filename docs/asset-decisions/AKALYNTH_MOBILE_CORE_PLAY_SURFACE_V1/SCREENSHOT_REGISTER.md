# Screenshot Register

Lane: `AKALYNTH_MOBILE_CORE_PLAY_SURFACE_V1`

Capture target: `http://127.0.0.1:5174/play/`

## Captures

| File | Viewport | Result | Notes |
| --- | ---: | --- | --- |
| `screenshots/01_desktop_1440x900.png` | 1440x900 | pass | Desktop debug surface remains usable with verbose stage controls and status panels. |
| `screenshots/02_mobile_portrait_rotate_gate_390x844.png` | 390x844 | pass | Portrait rotate gate remains visible. |
| `screenshots/03_mobile_landscape_cold_entry_932x430.png` | 932x430 | pass | Cold landscape now exposes character creation and `Enter play` path. |
| `screenshots/04_mobile_landscape_entered_play_932x430.png` | 932x430 | pass | After `Enter play`, entry panel is gone, player is visible, keypad/status/hotbar remain usable. |

## Evidence Limits

- Screenshots are debug-client presentation evidence only.
- The `Enter play` action changes the local UI stage only.
- No gameplay authority is inferred from the visual screenshots.
