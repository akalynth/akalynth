#!/usr/bin/env node
/**
 * Port ROOKGUARD_VISUAL_LANDMARKS from debug-client highCityVisualLandmarks.ts
 * into data/assets-built/placements/rookguard-overlays.json (PR-008).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = new URL('../..', import.meta.url).pathname;
const SOURCE = join(REPO_ROOT, 'apps/debug-client/src/data/highCityVisualLandmarks.ts');
const OUT_DIR = join(REPO_ROOT, 'data/assets-built/placements');
const OUT_PATH = join(OUT_DIR, 'rookguard-overlays.json');

function extractPlacements(source) {
  const start = source.indexOf('const ROOKGUARD_VISUAL_LANDMARKS');
  const end = source.indexOf('const HIGH_CITY_VISUAL_LANDMARKS');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('could not find ROOKGUARD_VISUAL_LANDMARKS section');
  }
  const section = source.slice(start, end);
  const placements = [];
  const instanceCounts = new Map();

  function add(assetId, x, y, explicitInstance = null) {
    const key = `${assetId}:${x}:${y}`;
    let instance;
    if (explicitInstance != null) {
      instance = explicitInstance;
      instanceCounts.set(key, explicitInstance + 1);
    } else {
      instance = instanceCounts.get(key) ?? 0;
      instanceCounts.set(key, instance + 1);
    }
    placements.push({
      id: `rookguard:${assetId}:${x}:${y}:${instance}`,
      asset_id: assetId,
      x,
      y,
    });
  }

  let match;
  const objRe = /obj\('([^']+)',\s*(\d+),\s*(\d+)(?:,\s*(\d+))?(?:,\s*'rookguard')?\)/g;
  while ((match = objRe.exec(section))) {
    const explicit = match[4] !== undefined ? Number(match[4]) : null;
    add(match[1], Number(match[2]), Number(match[3]), explicit);
  }

  const rowRe = /\.\.\.row\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*'rookguard'\)/g;
  while ((match = rowRe.exec(section))) {
    for (let x = Number(match[2]); x <= Number(match[3]); x += 1) {
      add(match[1], x, Number(match[4]));
    }
  }

  const patchRe = /\.\.\.floorPatch\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*'rookguard'\)/g;
  while ((match = patchRe.exec(section))) {
    for (let y = Number(match[3]); y <= Number(match[5]); y += 1) {
      for (let x = Number(match[2]); x <= Number(match[4]); x += 1) {
        add(match[1], x, y);
      }
    }
  }

  return placements;
}

const source = readFileSync(SOURCE, 'utf8');
const placements = extractPlacements(source);
const manifest = {
  map: 'rookguard',
  schema_version: 1,
  mechanics: null,
  placements,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`✓ port-rookguard-placements — ${placements.length} placement(s) → ${OUT_PATH}`);