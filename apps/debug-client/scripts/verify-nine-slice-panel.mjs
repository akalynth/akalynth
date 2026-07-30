#!/usr/bin/env node
/**
 * PR-024 guard: NineSlicePanel chrome scaffolding present in debug-client.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CODEX_PUBLIC_GRAPH_SOURCE_COMMIT = '26e6fcfbbdcb05a47181205e2877123ce964bc7e';
const CODEX_PUBLIC_GRAPH_SHA256 = '2419f693e0cdd9b94fcba2091bcfbb7fb8e710b31bf50501f708db01f3cb7faa';

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

function forbidPattern(name, pattern, source, rel) {
  if (pattern.test(source)) {
    console.error(`FAIL  ${name} — forbidden in ${rel}`);
    process.exit(1);
  }
  console.log(`PASS  ${name}`);
}

const files = [
  'src/lib/atlasPaths.ts',
  'src/lib/uiPaths.ts',
  'src/lib/codexPaths.ts',
  'src/lib/nineSlice.ts',
  'src/data/codexPublicGraph.json',
  'src/hooks/useAssetRegistry.ts',
  'src/hooks/useUiTextures.ts',
  'src/hooks/useCodexGraph.ts',
  'src/components/NineSlicePanel.tsx',
  'src/components/TextureCircle.tsx',
  'src/components/UiStatBar.tsx',
  'src/components/PlayShellDock.tsx',
  'src/components/CodexShelfPanel.tsx',
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

const uiPaths = read('src/lib/uiPaths.ts');
requirePattern('UI built root', /data\/assets-built\/ui/, uiPaths, 'src/lib/uiPaths.ts');

const codexPaths = read('src/lib/codexPaths.ts');
requirePattern('codex repo path', /akalynth-codex/, codexPaths, 'src/lib/codexPaths.ts');

const codexHook = read('src/hooks/useCodexGraph.ts');
requirePattern('repo-local codex graph import', /\.\.\/data\/codexPublicGraph\.json/, codexHook, 'src/hooks/useCodexGraph.ts');
forbidPattern('external codex graph import', /@codex\//, codexHook, 'src/hooks/useCodexGraph.ts');

const codexGraphRel = 'src/data/codexPublicGraph.json';
const codexGraphSource = read(codexGraphRel);
let codexGraph;
try {
  codexGraph = JSON.parse(codexGraphSource);
} catch (error) {
  console.error(`FAIL  pinned codex graph JSON — ${error.message}`);
  process.exit(1);
}
if (!Array.isArray(codexGraph) || codexGraph.length !== 25) {
  console.error(`FAIL  pinned codex graph entries — expected 25 in ${codexGraphRel}`);
  process.exit(1);
}
if (!codexGraph.some((node) => node?.id === 'play-build-govern-surface')) {
  console.error(`FAIL  pinned codex graph system node — missing play-build-govern-surface in ${codexGraphRel}`);
  process.exit(1);
}
const canonicalCodexGraph = JSON.stringify(codexGraph, null, 2);
const codexGraphHash = createHash('sha256').update(canonicalCodexGraph).digest('hex');
if (codexGraphHash !== CODEX_PUBLIC_GRAPH_SHA256) {
  console.error(`FAIL  pinned codex graph hash — expected ${CODEX_PUBLIC_GRAPH_SHA256}, got ${codexGraphHash}`);
  process.exit(1);
}
console.log(`PASS  pinned codex graph projection (${CODEX_PUBLIC_GRAPH_SOURCE_COMMIT})`);

const vite = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
requirePattern('vite @codex alias', /akalynth-codex/, vite, 'vite.config.ts');

const app = read('src/App.tsx');
requirePattern('HudChromePanel wired', /HudChromePanel/, app, 'src/App.tsx');
requirePattern('Codex shelf wired', /CodexShelfPanel/, app, 'src/App.tsx');
requirePattern('Play shell dock wired', /PlayShellDock/, app, 'src/App.tsx');

const pkg = read('package.json');
requirePattern('verify script wired', /verify-nine-slice-panel/, pkg, 'package.json');

console.log('\nOK — NineSlicePanel chrome scaffolding (PR-024/027)');
