#!/usr/bin/env node
/**
 * Merge azura-overlays.json (landmarks) + azura-deferred-overlays.json into
 * azura-all-overlays.json for Android/web bundled consumption.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = new URL('../..', import.meta.url).pathname;
const PLACEMENTS_DIR = join(REPO_ROOT, 'data/assets-built/placements');
const LANDMARKS_PATH = join(PLACEMENTS_DIR, 'azura-overlays.json');
const DEFERRED_PATH = join(PLACEMENTS_DIR, 'azura-deferred-overlays.json');
const OUT_PATH = join(PLACEMENTS_DIR, 'azura-all-overlays.json');

function readManifest(path) {
  const raw = readFileSync(path, 'utf8');
  const manifest = JSON.parse(raw);
  if (manifest.mechanics !== null) {
    throw new Error(`${path}: mechanics must be null`);
  }
  if (!Array.isArray(manifest.placements)) {
    throw new Error(`${path}: placements must be an array`);
  }
  return manifest;
}

const landmarks = readManifest(LANDMARKS_PATH);
const deferred = readManifest(DEFERRED_PATH);

const seen = new Set();
const merged = [];
for (const placement of [...landmarks.placements, ...deferred.placements]) {
  if (seen.has(placement.id)) {
    console.warn(`merge-azura-placements: skipping duplicate id ${placement.id}`);
    continue;
  }
  seen.add(placement.id);
  merged.push(placement);
}

const out = {
  map: 'azura',
  schema_version: 1,
  mechanics: null,
  placements: merged,
};

writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `✓ merge-azura-placements — ${landmarks.placements.length} landmark + ${deferred.placements.length} deferred → ${merged.length} total → ${OUT_PATH}`,
);