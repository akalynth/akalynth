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
  'src/data/outfitIdentity.ts',
  'src/components/CharacterSpritePreview.tsx',
  'src/components/IdentityStrip.tsx',
];

for (const rel of files) requireFile(rel);

const previewData = read('src/data/characterCreatePreview.ts');
requirePattern('outfit preview table', /OUTFIT_PREVIEW/, previewData, 'src/data/characterCreatePreview.ts');
requirePattern('female wanderer label', /base_human_female_01/, previewData, 'src/data/characterCreatePreview.ts');
requirePattern('bundledSpriteForPreview export', /export function bundledSpriteForPreview/, previewData, 'src/data/characterCreatePreview.ts');
requirePattern('preview uses outfitIdentity', /outfitIdentity/, previewData, 'src/data/characterCreatePreview.ts');

const identity = read('src/data/outfitIdentity.ts');
requirePattern('identity table', /OUTFIT_IDENTITY_TABLE/, identity, 'src/data/outfitIdentity.ts');
requirePattern('male wanderer protocol sprite', /male_wanderer[\s\S]*base_human_male_01/, identity, 'src/data/outfitIdentity.ts');
requirePattern('identityLabel export', /export function identityLabel/, identity, 'src/data/outfitIdentity.ts');

const preview = read('src/components/CharacterSpritePreview.tsx');
requirePattern('south-facing draw', /DIRECTION_ROW\.south/, preview, 'src/components/CharacterSpritePreview.tsx');
requirePattern('sprite id test id', /CharacterCreateScreen_SpriteId/, preview, 'src/components/CharacterSpritePreview.tsx');

const characterBar = read('src/components/CharacterBar.tsx');
requirePattern('CharacterSpritePreview wired', /CharacterSpritePreview/, characterBar, 'src/components/CharacterBar.tsx');
requirePattern('resolveOutfitPreview wired', /resolveOutfitPreview/, characterBar, 'src/components/CharacterBar.tsx');

const app = read('src/App.tsx');
requirePattern('IdentityStrip on play shell', /IdentityStrip/, app, 'src/App.tsx');
requirePattern('IdentityStrip not an outfit picker', /IdentityStrip[\s\S]{0,200}spriteId/, app, 'src/App.tsx');
// CharacterBar create UI must not render when play shell is the only mode path for outfit mid-map.
if (/showPlayShell[\s\S]{0,80}CharacterBar/.test(app)) {
  console.error('FAIL  CharacterBar must not be gated on showPlayShell (outfit picker on play surface)');
  process.exit(1);
}
console.log('PASS  CharacterBar not mounted via showPlayShell');

const strip = read('src/components/IdentityStrip.tsx');
requirePattern('IdentityStrip display-only', /identityLabel/, strip, 'src/components/IdentityStrip.tsx');
if (strip.includes('onChange') || strip.includes('outfit_id')) {
  console.error('FAIL  IdentityStrip must not host outfit selection');
  process.exit(1);
}
console.log('PASS  IdentityStrip has no outfit picker controls');

const pkg = read('package.json');
requirePattern('verify script wired', /verify-character-create-preview/, pkg, 'package.json');

console.log('\nOK — character create sprite preview (PR-025) + identity lock (PR-D)');