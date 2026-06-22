import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const opsReposRoot = resolve(root, '../../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function requirePattern(label, pattern, source, rel) {
  if (!pattern.test(source)) {
    console.error(`builder-preview-render-v1: missing ${label} in ${rel}`);
    process.exit(1);
  }
}

const overlayUtil = read('src/utils/builderPreviewOverlay.ts');
const panel = read('src/components/BuilderPanel.tsx');
const app = read('src/App.tsx');
const paletteAssets = read('src/data/builderPaletteAssets.ts');
const palette = read('src/data/builderPaletteManifest.json');

requirePattern('overlay builder', /builderPreviewOverlays/, overlayUtil, 'src/utils/builderPreviewOverlay.ts');
requirePattern('room cell overlays', /map_deltas/, overlayUtil, 'src/utils/builderPreviewOverlay.ts');
requirePattern('object placement overlays', /placement/, overlayUtil, 'src/utils/builderPreviewOverlay.ts');
requirePattern('map overlay callback', /onMapOverlayChange/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('base/preview toggle', /mapView/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('palette icon asset', /resolvePaletteIcon/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('registry from namespace', /ns\.registry/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('merged map overlays', /builderMapOverlays/, app, 'src/App.tsx');
requirePattern('rookguard thumb import', /akalynth-site/, paletteAssets, 'src/data/builderPaletteAssets.ts');
requirePattern('codex poster import', /akalynth-codex/, paletteAssets, 'src/data/builderPaletteAssets.ts');

const manifest = JSON.parse(palette);
if (!manifest.icons.every((icon) => icon.icon_asset)) {
  console.error('builder-preview-render-v1: palette icons missing icon_asset');
  process.exit(1);
}

const thumbPath = resolve(opsReposRoot, 'akalynth-site/assets/akalynth/visuals/thumbs/02-rookguard-gate.thumb-480x720.webp');
const posterPath = resolve(opsReposRoot, 'akalynth-codex/assets/out/akalynth-game-loop-bible-poster-v1.png');
for (const assetPath of [thumbPath, posterPath]) {
  if (!existsSync(assetPath)) {
    console.error(`builder-preview-render-v1: missing asset ${assetPath}`);
    process.exit(1);
  }
}

console.log('OK — Builder preview map overlay + palette assets (G1/A1)');