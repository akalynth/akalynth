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
    console.error(`studio-map-builder-bridges-v1: missing ${label} in ${rel}`);
    process.exit(1);
  }
}

const app = read('src/App.tsx');
const build = read('src/views/BuildView.tsx');
const preview = read('src/services/builderPreview.ts');
const mapPath = resolve(root, '../../packages/shared/maps/rookguard.json');

requirePattern('studio shell views', /build.*assets.*review/s, app, 'src/App.tsx');
requirePattern('preview env cycle (no prod)', /Local.*Beta.*Staging/s, app, 'src/App.tsx');
requirePattern('production direct link', /PRODUCTION_PLAY_URL|studio-prod-link/, app, 'src/App.tsx');
requirePattern('preview lane api map', /previewApiBase/, read('src/config/studioLanes.ts'), 'src/config/studioLanes.ts');
requirePattern('rookguard json import', /rookguard\.json/, build, 'src/views/BuildView.tsx');
requirePattern('save and sign', /Save.*sign/, build, 'src/views/BuildView.tsx');
requirePattern('preview start route', /\/v1\/builder\/preview\/start/, preview, 'src/services/builderPreview.ts');
requirePattern('builder fork overlay', /showFork/, build, 'src/views/BuildView.tsx');
requirePattern('manifest fixture', /rookguardBuilderDraftManifest/, preview, 'src/services/builderPreview.ts');

if (!existsSync(mapPath)) {
  console.error(`studio-map-builder-bridges-v1: missing ${mapPath}`);
  process.exit(1);
}

const map = JSON.parse(readFileSync(mapPath, 'utf8'));
if (map.width !== 32 || map.height !== 32 || map.tiles.length !== 1024) {
  console.error('studio-map-builder-bridges-v1: rookguard map shape mismatch');
  process.exit(1);
}

console.log('OK — Studio map builder bridges B1+B3+B5 (rookguard grid + preview API + unified shell)');