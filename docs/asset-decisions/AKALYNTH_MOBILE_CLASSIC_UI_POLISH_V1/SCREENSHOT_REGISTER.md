# Screenshot Register

Lane: `AKALYNTH_MOBILE_CLASSIC_UI_POLISH_V1`

Capture target: `http://127.0.0.1:5174/play/`

## Captures

| File | Viewport | Result | Notes |
| --- | ---: | --- | --- |
| `screenshots/01_portrait_rotate_gate_390x844.png` | 390x844 | pass | Portrait rotate gate remains visible. |
| `screenshots/02_landscape_entry_play_surface_932x430.png` | 932x430 | pass | Polished play surface shows canvas, DPad, dock, hotbar, status, and objective. |
| `screenshots/03_dpad_press_release_cancel_932x430.png` | 932x430 | pass | DPad smoke exercised press/release/leave/cancel/stop behavior. |
| `screenshots/04_pack_sheet_932x430.png` | 932x430 | pass | Pack sheet opens as the only active sheet. |
| `screenshots/05_chat_sheet_932x430.png` | 932x430 | pass | Chat sheet opens as the only active sheet. |
| `screenshots/06_log_sheet_932x430.png` | 932x430 | pass | Log/Chronicle sheet opens as the only active sheet. |
| `screenshots/07_proof_sheet_932x430.png` | 932x430 | pass | Proof sheet opens as the only active sheet. |
| `screenshots/08_clean_play_surface_restored_932x430.png` | 932x430 | pass | Closing sheets restores the clean play surface. |
| `screenshots/09_desktop_debug_mode_1440x900.png` | 1440x900 | pass | Desktop debug mode remains usable. |
| `screenshots/10_compact_landscape_play_surface_844x390.png` | 844x390 | pass | Compact landscape play surface remains readable. |
| `screenshots/11_compact_landscape_chat_sheet_844x390.png` | 844x390 | pass | Compact Chat sheet fits and remains readable. |
| `screenshots/12_compact_landscape_proof_sheet_844x390.png` | 844x390 | pass | Compact Proof sheet fits and remains readable. |

## Validation Reports

- `validation/mobile_classic_ui_polish_smoke_report.json`
- `validation/compact_844x390_visual_report.json`

## Evidence Limits

- Screenshots are debug-client presentation evidence only.
- This evidence does not claim Android/native parity, production deployment, server authority, protocol behavior, or gameplay semantics.
