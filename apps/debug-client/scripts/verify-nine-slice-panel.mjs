#!/usr/bin/env node
/**
 * PR-024 guard: NineSlicePanel chrome scaffolding present in debug-client.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function requireFile(rel) {
  const abs = resolve(root, rel);
  if (!existsSync(abs)) {
    console.error(`FAIL  missing ${rel}`);
    process.exit(1);
  }
}

function requirePattern(name, pattern, source, rel) {
  if (!pattern.test(source)) {
    console.error(`FAIL  ${name} — expected in ${rel}`);
    process.exit(1);
  }
  console.log(`PASS  ${name}`);
}

const files = [
  'src/lib/atlasPaths.ts',
  'src/lib/nineSlice.ts',
  'src/hooks/useAssetRegistry.ts',
  'src/hooks/useUiTextures.ts',
  'src/components/NineSlicePanel.tsx',
  'src/components/TextureCircle.tsx',
];

for (const rel of files) requireFile(rel);

const nineSlice = read('src/lib/nineSlice.ts');
requirePattern('drawNineSlice export', /export function drawNineSlice/, nineSlice, 'src/lib/nineSlice.ts');

const panel = read('src/components/NineSlicePanel.tsx');
requirePattern('NineSlicePanel export', /export function NineSlicePanel/, panel, 'src/components/NineSlicePanel.tsx');
requirePattern('panel variant stem', /ui_panel_frame/, panel, 'src/components/NineSlicePanel.tsx');

const registryHook = read('src/hooks/useAssetRegistry.ts');
requirePattern('registry fetch', /registry\.json/, registryHook, 'src/hooks/useAssetRegistry.ts');

const config = read('src/config.ts');
requirePattern('USE_NINE_SLICE_WEB flag', /VITE_USE_NINE_SLICE_WEB/, config, 'src/config.ts');
requirePattern('nine-slice default on (PR-026)', /VITE_USE_NINE_SLICE_WEB !== 'false'/, config, 'src/config.ts');

const hudChrome = read('src/components/HudChromePanel.tsx');
requirePattern('HudChromePanel export (PR-027)', /export function HudChromePanel/, hudChrome, 'src/components/HudChromePanel.tsx');

const app = read('src/App.tsx');
requirePattern('HudChromePanel wired', /HudChromePanel/, app, 'src/App.tsx');

const pkg = read('package.json');
requirePattern('verify script wired', /verify-nine-slice-panel/, pkg, 'package.json');

console.log('\nOK — NineSlicePanel chrome scaffolding (PR-024/027)');