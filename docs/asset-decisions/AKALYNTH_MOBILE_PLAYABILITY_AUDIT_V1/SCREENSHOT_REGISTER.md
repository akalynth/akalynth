# Screenshot Register

Audit: `AKALYNTH_MOBILE_PLAYABILITY_AUDIT_V1`

Capture target: `http://127.0.0.1:5174/play/`

## Captures

| File | Viewport | Result | Notes |
| --- | ---: | --- | --- |
| `screenshots/01_desktop_1440x900.png` | 1440x900 | pass_with_notes | Desktop debug surface remains visible with map, player, controls, objective/status panels, and bottom dock. |
| `screenshots/02_mobile_portrait_390x844.png` | 390x844 | pass | Rotate gate is visible and styled. |
| `screenshots/03_mobile_landscape_932x430.png` | 932x430 | needs_refinement | Canvas fills landscape surface, but cold mobile session has no obvious create/play affordance and no active character visible. |

## Image Validity

All screenshots were written as PNG files and verified by file metadata:

- desktop: 1440 x 900
- portrait: 390 x 844
- landscape: 932 x 430

## Evidence Limits

- Screenshots are visual evidence only.
- The landscape capture is a cold browser context and does not prove active-character movement.
- No runtime gameplay authority is inferred from these screenshots.
