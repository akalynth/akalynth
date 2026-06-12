# Screenshots

Lane: `AKALYNTH_HIGH_CITY_VISUAL_LANDMARKS_V1`

Status: `implemented_committed_local_green`

Branch: `codex/high-city-visual-landmarks-v1`

Implementation commit: `163815bc8decf26570af478d6658c157c4bedcd4`

## Captured Files

- Desktop: `/tmp/akalynth-high-city-visual-landmarks-desktop.png`
- Mobile landscape: `/tmp/akalynth-high-city-visual-landmarks-mobile.png`

## Capture Method

Screenshots were captured from a temporary offline High City preview:

```bash
VITE_DEFAULT_MAP=Azura VITE_HTTP_BASE=http://127.0.0.1:3999 VITE_WS_BASE=ws://127.0.0.1:3999 npm -w apps/debug-client run build
npm -w apps/debug-client run preview -- --host 127.0.0.1 --port 4173
npx -y playwright@1.56.1 screenshot --wait-for-selector 'canvas[aria-label="world-map"]' --wait-for-timeout 1500 --viewport-size=1280,720 http://127.0.0.1:4173/play/ /tmp/akalynth-high-city-visual-landmarks-desktop.png
npx -y playwright@1.56.1 screenshot --wait-for-selector 'canvas[aria-label="world-map"]' --wait-for-timeout 1500 --viewport-size=844,390 http://127.0.0.1:4173/play/ /tmp/akalynth-high-city-visual-landmarks-mobile.png
```

## Expected Preview State

The preview intentionally used dead server URLs so the debug client could hold
the local High City map without depending on live travel state. A visible
connection `error` state is expected for this capture mode.

## Visual Result

- Desktop screenshot shows the Guild Hall facade, civic paving, and High City
  objective copy.
- Mobile landscape screenshot shows the spawn court, fountain, banners, benches,
  and High City objective copy.
