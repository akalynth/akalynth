#!/usr/bin/env node
/**
 * PR-025 guard: character create sprite preview in debug-client.
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
  'src/data/characterCreatePreview.ts',
  'src/components/CharacterSpritePreview.tsx',
];

for (const rel of files) requireFile(rel);

const previewData = read('src/data/characterCreatePreview.ts');
requirePattern('outfit preview table', /OUTFIT_PREVIEW/, previewData, 'src/data/characterCreatePreview.ts');
requirePattern(
  'female wanderer preview',
  /female_wanderer[\s\S]*?(?:base_human_female_01|Rookguard traveler)/,
  previewData,
  'src/data/characterCreatePreview.ts',
);
requirePattern('bundledSpriteForPreview export', /export function bundledSpriteForPreview/, previewData, 'src/data/characterCreatePreview.ts');

const preview = read('src/components/CharacterSpritePreview.tsx');
requirePattern('south-facing draw', /DIRECTION_ROW\.south/, preview, 'src/components/CharacterSpritePreview.tsx');
requirePattern('sprite id test id', /CharacterCreateScreen_SpriteId/, preview, 'src/components/CharacterSpritePreview.tsx');

const characterBar = read('src/components/CharacterBar.tsx');
requirePattern('CharacterSpritePreview wired', /CharacterSpritePreview/, characterBar, 'src/components/CharacterBar.tsx');
requirePattern('resolveOutfitPreview wired', /resolveOutfitPreview/, characterBar, 'src/components/CharacterBar.tsx');

const pkg = read('package.json');
requirePattern('verify script wired', /verify-character-create-preview/, pkg, 'package.json');

console.log('\nOK — character create sprite preview (PR-025)');