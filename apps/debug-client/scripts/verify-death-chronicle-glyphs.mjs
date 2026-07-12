#!/usr/bin/env node
/**
 * PR-026 guard: chronicle glyph icons + default-on nine-slice flag.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function requireFile(rel) {
  if (!existsSync(resolve(root, rel))) {
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
  'src/chronicle/chronicleGlyphs.ts',
  'src/components/ChronicleGlyphIcon.tsx',
];

for (const rel of files) requireFile(rel);

const glyphs = read('src/chronicle/chronicleGlyphs.ts');
requirePattern('death glyph path', /effect__chronicle_death\.png/, glyphs, 'src/chronicle/chronicleGlyphs.ts');
requirePattern('event kind mapper', /chronicleGlyphKindFromEvent/, glyphs, 'src/chronicle/chronicleGlyphs.ts');

const icon = read('src/components/ChronicleGlyphIcon.tsx');
requirePattern('ChronicleGlyphIcon export', /export function ChronicleGlyphIcon/, icon, 'src/components/ChronicleGlyphIcon.tsx');
requirePattern('ASCII fallback', /chronicleGlyphExportLabel/, icon, 'src/components/ChronicleGlyphIcon.tsx');

const app = read('src/App.tsx');
requirePattern('chronicle rows use glyph icon', /ChronicleGlyphIcon eventKind=\{ev\.kind\}/, app, 'src/App.tsx');
requirePattern('death toast glyph', /ChronicleGlyphIcon eventKind="death"/, app, 'src/App.tsx');
requirePattern('emoji icons removed from render', /type ChronicleRender = \{ text: string; causal\?: CausalVisibilitySummary \}/, app, 'src/App.tsx');

const config = read('src/config.ts');
requirePattern('nine-slice default on', /VITE_USE_NINE_SLICE_WEB !== 'false'/, config, 'src/config.ts');

const pkg = read('package.json');
requirePattern('verify script wired', /verify-death-chronicle-glyphs/, pkg, 'package.json');

console.log('\nOK — death/chronicle glyph sprites + flag flip (PR-026)');