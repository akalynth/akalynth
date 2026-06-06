# Verification

Lane: `AKALYNTH_HIGH_CITY_VISUAL_LANDMARKS_V1`

## Commands Run

```bash
git diff --check -- apps/debug-client/src/App.tsx apps/debug-client/src/components/ActionsPanel.tsx apps/debug-client/src/data/highCityVisualLandmarks.ts
```

Result: PASS.

```bash
npm -w apps/debug-client run build
```

Result: PASS.

```bash
npm run verify:quick
```

Result: PASS, 9/9 verifiers.

## Screenshot Commands

```bash
VITE_DEFAULT_MAP=Azura VITE_HTTP_BASE=http://127.0.0.1:3999 VITE_WS_BASE=ws://127.0.0.1:3999 npm -w apps/debug-client run build
npm -w apps/debug-client run preview -- --host 127.0.0.1 --port 4173
npx -y playwright@1.56.1 screenshot --wait-for-selector 'canvas[aria-label="world-map"]' --wait-for-timeout 1500 --viewport-size=1280,720 http://127.0.0.1:4173/play/ /tmp/akalynth-high-city-visual-landmarks-desktop.png
npx -y playwright@1.56.1 screenshot --wait-for-selector 'canvas[aria-label="world-map"]' --wait-for-timeout 1500 --viewport-size=844,390 http://127.0.0.1:4173/play/ /tmp/akalynth-high-city-visual-landmarks-mobile.png
```

Result: PASS.

Screenshots:

- `/tmp/akalynth-high-city-visual-landmarks-desktop.png`
- `/tmp/akalynth-high-city-visual-landmarks-mobile.png`

## Notes

The screenshot preview intentionally used offline server URLs to hold the debug
client on High City without depending on live travel state. The visible
connection error in the screenshots is expected for that preview mode.
