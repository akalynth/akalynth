import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function requirePattern(label, pattern, source, rel) {
  if (!pattern.test(source)) {
    console.error(`builder-panel-v1: missing ${label} in ${rel}`);
    process.exit(1);
  }
}

const service = read('src/services/builderPreview.ts');
const panel = read('src/components/BuilderPanel.tsx');
const app = read('src/App.tsx');

requirePattern('start preview route', /\/v1\/builder\/preview\/start/, service, 'src/services/builderPreview.ts');
requirePattern('end preview route', /\/v1\/builder\/preview\/end/, service, 'src/services/builderPreview.ts');
requirePattern('namespace route', /\/v1\/builder\/preview\/namespace/, service, 'src/services/builderPreview.ts');
requirePattern('rookguard fixture import', /rookguardBuilderDraftManifest/, service, 'src/services/builderPreview.ts');
requirePattern('manifest checksum helper', /computeManifestChecksum/, service, 'src/services/builderPreview.ts');
requirePattern('BuilderPanel export', /export function BuilderPanel/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('palette manifest', /builderPaletteManifest/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('preview_only phase label', /preview_only/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('App imports BuilderPanel', /BuilderPanel/, app, 'src/App.tsx');
requirePattern('builder env gate', /VITE_ENABLE_BUILDER_PREVIEW/, app, 'src/App.tsx');

for (const rel of [
  'src/fixtures/rookguardBuilderDraftManifest.json',
  'src/data/builderPaletteManifest.json',
]) {
  if (!existsSync(resolve(root, rel))) {
    console.error(`builder-panel-v1: missing ${rel}`);
    process.exit(1);
  }
}

requirePattern('display state hook', /onDisplayChange/, panel, 'src/components/BuilderPanel.tsx');
requirePattern('guest token on start', /guest_token/, service, 'src/services/builderPreview.ts');
requirePattern('palette asset resolver', /resolvePaletteIcon/, panel, 'src/components/BuilderPanel.tsx');

console.log('OK — BuilderPanel scaffolding (PR-8 + G1/A1/G2)');