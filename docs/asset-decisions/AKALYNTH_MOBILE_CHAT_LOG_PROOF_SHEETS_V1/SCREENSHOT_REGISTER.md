# Screenshot Register

Lane: `AKALYNTH_MOBILE_CHAT_LOG_PROOF_SHEETS_V1`

Capture target: `http://127.0.0.1:5174/play/`

## Captures

| File | Viewport | Result | Notes |
| --- | ---: | --- | --- |
| `screenshots/01_desktop_debug_1440x900.png` | 1440x900 | pass | Desktop debug surface remains usable. |
| `screenshots/02_mobile_portrait_rotate_gate_390x844.png` | 390x844 | pass | Portrait rotate gate remains visible. |
| `screenshots/03_mobile_landscape_sheets_closed_932x430.png` | 932x430 | pass | Mobile landscape play surface remains clean with sheets closed. |
| `screenshots/04_mobile_landscape_chat_sheet_932x430.png` | 932x430 | pass | Chat opens as a readable sheet from the mobile dock. |
| `screenshots/05_mobile_landscape_log_sheet_932x430.png` | 932x430 | pass | Log opens as a readable sheet and does not stack with Chat. |
| `screenshots/06_mobile_landscape_proof_sheet_932x430.png` | 932x430 | pass | Proof status opens as a compact sheet using existing proof/debug state. |

## Evidence Limits

- Screenshots are debug-client presentation evidence only.
- Chat uses the existing chat data and send callback.
- Log uses the existing chronicle/log presentation path.
- Proof uses existing proof/debug state and does not add receipt or proof semantics.
- This evidence does not claim protocol, server, Android/native, deployment, or runtime-authority changes.
