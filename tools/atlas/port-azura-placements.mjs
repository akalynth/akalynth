#!/usr/bin/env node
/**
 * Port HIGH_CITY_VISUAL_LANDMARKS from debug-client highCityVisualLandmarks.ts
 * into data/assets-built/placements/azura-overlays.json (AKALYNTH_HIGH_CITY_SPRITE Phase 1).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractHighCityLandmarkPlacements } from './lib/extract-high-city-landmark-placements.mjs';

const REPO_ROOT = new URL('../..', import.meta.url).pathname;
const SOURCE = join(REPO_ROOT, 'apps/debug-client/src/data/highCityVisualLandmarks.ts');
const OUT_DIR = join(REPO_ROOT, 'data/assets-built/placements');
const OUT_PATH = join(OUT_DIR, 'azura-overlays.json');

const source = readFileSync(SOURCE, 'utf8');
const placements = extractHighCityLandmarkPlacements(source);
const manifest = {
  map: 'azura',
  schema_version: 1,
  mechanics: null,
  placements,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`✓ port-azura-placements — ${placements.length} placement(s) → ${OUT_PATH}`);