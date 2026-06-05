# Screenshot Register

Lane: `AKALYNTH_MOBILE_INVENTORY_BACKPACK_SHEET_V1`

Capture target: `http://127.0.0.1:5174/play/`

## Captures

| File | Viewport | Result | Notes |
| --- | ---: | --- | --- |
| `screenshots/01_desktop_debug_inventory_1440x900.png` | 1440x900 | pass | Desktop debug surface remains usable. |
| `screenshots/02_mobile_portrait_rotate_gate_390x844.png` | 390x844 | pass | Portrait rotate gate remains visible. |
| `screenshots/03_mobile_landscape_backpack_closed_932x430.png` | 932x430 | pass | Mobile landscape play surface has a clear `Pack` affordance and remains uncluttered when closed. |
| `screenshots/04_mobile_landscape_backpack_open_932x430.png` | 932x430 | pass | Backpack opens as a classic sheet, shows existing inventory data, and leaves the play surface visible behind it. |

## Evidence Limits

- Screenshots are debug-client presentation evidence only.
- The backpack sheet uses existing client inventory data.
- The sheet does not add drop, equip, item semantics, inventory authority, or new protocol behavior.
