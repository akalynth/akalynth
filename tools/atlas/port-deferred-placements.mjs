#!/usr/bin/env node
/**
 * Port HIGH_CITY_SHOWCASE_EXTRAS from debug-client fullWorldShowcase.ts
 * into data/assets-built/placements/azura-deferred-overlays.json (PR-011).
 * Filters to the 13 deferred world visual asset ids only.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFERRED_WORLD_ASSET_IDS } from './lib/world-asset-ids.mjs';

const REPO_ROOT = new URL('../..', import.meta.url).pathname;
const SOURCE = join(REPO_ROOT, 'apps/debug-client/src/data/fullWorldShowcase.ts');
const OUT_DIR = join(REPO_ROOT, 'data/assets-built/placements');
const OUT_PATH = join(OUT_DIR, 'azura-deferred-overlays.json');

const DEFERRED_SET = new Set(DEFERRED_WORLD_ASSET_IDS);

function extractPlacements(source) {
  const start = source.indexOf('const HIGH_CITY_SHOWCASE_EXTRAS');
  const end = source.indexOf('export function fullWorldVisualLandmarksForMap');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('could not find HIGH_CITY_SHOWCASE_EXTRAS section');
  }
  const section = source.slice(start, end);
  const placements = [];
  const instanceCounts = new Map();

  function add(assetId, x, y, prefix, explicitInstance = null) {
    if (!DEFERRED_SET.has(assetId)) return;
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
      id: `${prefix}:${assetId}:${x}:${y}:${instance}`,
      asset_id: assetId,
      x,
      y,
    });
  }

  let match;
  const objRe =
    /obj\('([^']+)',\s*(\d+),\s*(\d+)(?:,\s*(\d+))?(?:,\s*'([^']+)')?\)/g;
  while ((match = objRe.exec(section))) {
    const explicit = match[4] !== undefined ? Number(match[4]) : null;
    const prefix = match[5] ?? 'azura-deferred';
    add(match[1], Number(match[2]), Number(match[3]), prefix, explicit);
  }

  const patchRe =
    /\.\.\.floorPatch\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*'([^']+)')?\)/g;
  while ((match = patchRe.exec(section))) {
    const prefix = match[6] ?? 'azura-deferred';
    for (let y = Number(match[3]); y <= Number(match[5]); y += 1) {
      for (let x = Number(match[2]); x <= Number(match[4]); x += 1) {
        add(match[1], x, y, prefix);
      }
    }
  }

  return placements;
}

const source = readFileSync(SOURCE, 'utf8');
const placements = extractPlacements(source);
const manifest = {
  map: 'azura',
  schema_version: 1,
  mechanics: null,
  placements,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`✓ port-deferred-placements — ${placements.length} placement(s) → ${OUT_PATH}`);