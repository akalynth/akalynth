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
const gameClient = read('src/hooks/useGameClient.ts');
const paletteAssets = read('src/data/builderPaletteAssets.ts');
const palette = read('src/data/builderPaletteManifest.json');

requirePattern('overlay builder', /builderPreviewOverlays/, overlayUtil, 'src/utils/builderPreviewOverlay.ts');
requirePattern('world fork overlays', /BuilderPreviewWorldFork/, overlayUtil, 'src/utils/builderPreviewOverlay.ts');
requirePattern('room cell overlays', /map_deltas|source\.rooms/, overlayUtil, 'src/utils/builderPreviewOverlay.ts');
requirePattern('object placement overlays', /placement/, overlayUtil, 'src/utils/builderPreviewOverlay.ts');
requirePattern('display callback', /onDisplayChange/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('guest token bind', /guestToken/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('base/preview toggle', /mapView/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('palette icon asset', /resolvePaletteIcon/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('registry from namespace', /ns\.registry/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('server fork in world snapshot', /builderPreview/, gameClient, 'src/hooks/useGameClient.ts');
requirePattern('world_state builder_preview parse', /builder_preview/, gameClient, 'src/hooks/useGameClient.ts');
requirePattern('merged server overlays', /serverBuilderOverlays/, app, 'src/App.tsx');
requirePattern('world builderPreview source', /state\.world\.builderPreview/, app, 'src/App.tsx');


const manifest = JSON.parse(palette);
if (!manifest.icons.every((icon) => icon.icon_asset)) {
  console.error('builder-preview-render-v1: palette icons missing icon_asset');
  process.exit(1);
}

const thumbPath = resolve(root, 'src/assets/builder/rookguard-gate.thumb.webp');
const posterPath = resolve(root, 'src/assets/builder/game-loop-poster-v1.png');
for (const assetPath of [thumbPath, posterPath]) {
  if (!existsSync(assetPath)) {
    console.error(`builder-preview-render-v1: missing vendored asset ${assetPath}`);
    process.exit(1);
  }
}
requirePattern('vendored thumb import', /src\/assets\/builder/, paletteAssets, 'src/data/builderPaletteAssets.ts');

console.log('OK — Builder preview world_state fork overlays + palette assets (G1/A1/G2)');