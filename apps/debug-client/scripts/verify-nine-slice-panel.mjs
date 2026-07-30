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
  'src/lib/uiPaths.ts',
  'src/lib/codexPaths.ts',
  'src/lib/nineSlice.ts',
  'src/hooks/useAssetRegistry.ts',
  'src/hooks/useUiTextures.ts',
  'src/hooks/useCodexGraph.ts',
  'src/components/NineSlicePanel.tsx',
  'src/components/TextureCircle.tsx',
  'src/components/UiStatBar.tsx',
  'src/components/PlayShellDock.tsx',
  'src/components/CodexShelfPanel.tsx',
  'codex-fallback/README.md',
  'codex-fallback/out/codex-public.graph.json',
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

const vite = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
requirePattern('vite @codex alias', /akalynth-codex/, vite, 'vite.config.ts');
requirePattern('vite validates Codex graph artifact', /hasPublicGraph/, vite, 'vite.config.ts');
requirePattern('vite Codex fallback', /codex-fallback/, vite, 'vite.config.ts');
const viteFallback = "path.resolve(__dirname, 'codex-fallback')";
const viteFallbackIndex = vite.indexOf(viteFallback);
const viteExternalCandidates = [
  "path.resolve(monorepoReposRoot, 'akalynth-codex')",
  "path.resolve(__dirname, '../../../akalynth-codex')",
  "'/home/sovereign/akalynth-ops/repos/akalynth-codex'",
];
if (
  viteFallbackIndex < 0
  || viteExternalCandidates.some((candidate) => {
    const candidateIndex = vite.indexOf(candidate);
    return candidateIndex < 0 || candidateIndex >= viteFallbackIndex;
  })
) {
  console.error('FAIL  real Codex candidates must precede the build fallback');
  process.exit(1);
}
console.log('PASS  real Codex candidates precede fallback');

const tsconfig = read('tsconfig.json');
const tsconfigJson = JSON.parse(tsconfig);
const tsCodexPaths = tsconfigJson?.compilerOptions?.paths?.['@codex/*'];
const expectedTsCodexPaths = ['../../../akalynth-codex/*', 'codex-fallback/*'];
if (JSON.stringify(tsCodexPaths) !== JSON.stringify(expectedTsCodexPaths)) {
  console.error('FAIL  TypeScript Codex paths must keep the real source before the fallback');
  process.exit(1);
}
console.log('PASS  TypeScript Codex source precedes fallback');

const fallbackGraph = JSON.parse(read('codex-fallback/out/codex-public.graph.json'));
if (!Array.isArray(fallbackGraph) || fallbackGraph.length !== 0) {
  console.error('FAIL  Codex fallback must be an empty public graph');
  process.exit(1);
}
console.log('PASS  empty Codex public graph fallback');

const app = read('src/App.tsx');
requirePattern('HudChromePanel wired', /HudChromePanel/, app, 'src/App.tsx');
requirePattern('Codex shelf wired', /CodexShelfPanel/, app, 'src/App.tsx');
requirePattern('Play shell dock wired', /PlayShellDock/, app, 'src/App.tsx');

const pkg = read('package.json');
requirePattern('verify script wired', /verify-nine-slice-panel/, pkg, 'package.json');

console.log('\nOK — NineSlicePanel chrome scaffolding (PR-024/027)');
