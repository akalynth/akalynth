#!/usr/bin/env node
/**
 * UI asset lane — dry-run specs for grok-cli image_gen (no OPENAI_API_KEY required).
 * Operator generate: bin/akalynth-ui-grok.sh generate
 */
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SPEC_PATH = join(ROOT, 'tools/asset-gen/ui-grok-specs.json');

const args = process.argv.slice(2);
const ONLY = args.includes('--only')
  ? args[args.indexOf('--only') + 1]
  : null;
const DRY = args.includes('--dry-run') || !process.env.AKALYNTH_UI_GROK_LIVE;

const doc = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
let specs = doc.specs;
if (ONLY) specs = specs.filter((s) => s.stem === ONLY || s.stem.includes(ONLY));

console.log('Akalynth UI — grok-cli image_gen lane');
console.log(`  mode    : ${DRY ? 'DRY RUN' : 'LIVE (expect grok-cli image_gen outputs in raw_dir)'}`);
console.log(`  assets  : ${specs.length}${ONLY ? ` (filter: ${ONLY})` : ''}`);
console.log(`  raw_dir : ${doc.raw_dir}`);
console.log(`  built   : ${doc.out_built}`);

mkdirSync(join(ROOT, doc.raw_dir), { recursive: true });

const baseBrief = existsSync(join(ROOT, 'data/assets-src/briefs/ui/_base.prompt.md'))
  ? readFileSync(join(ROOT, 'data/assets-src/briefs/ui/_base.prompt.md'), 'utf8').trim()
  : '';

let missing = 0;
for (const s of specs) {
  const briefPath = join(ROOT, s.brief);
  const rawOut = join(ROOT, doc.raw_dir, `${s.stem}.png`);
  const haveRaw = existsSync(rawOut);
  if (!existsSync(briefPath)) {
    console.log(`  ✗ ${s.stem.padEnd(28)} brief-missing`);
    missing += 1;
    continue;
  }
  const brief = readFileSync(briefPath, 'utf8').trim();
  const promptChars = `${baseBrief}\n\n${brief}`.length;
  const tag = haveRaw ? '=' : '○';
  const state = haveRaw ? 'raw-exists' : 'would-generate';
  console.log(
    `  ${tag} ${s.stem.padEnd(28)} ${state} ${s.dimensions_px[0]}x${s.dimensions_px[1]} (${promptChars} chars)`,
  );
}

if (missing) process.exit(1);
if (DRY) {
  console.log('\n  next: bin/akalynth-ui-grok.sh generate');
  console.log('        grok-cli uses image_gen → data/assets-src/grok-ui/raw/<stem>.png');
  console.log('        then: node tools/asset-gen/normalize-ui-grok.mjs');
}