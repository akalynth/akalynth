#!/usr/bin/env node
/**
 * Validate placement JSON files against tools/atlas/placement.schema.json (PR-006/008).
 * Lightweight enum/required-field check (no ajv dependency).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = new URL('../..', import.meta.url).pathname;
const SCHEMA_PATH = join(REPO_ROOT, 'tools/atlas/placement.schema.json');
const PLACEMENTS_DIR = join(REPO_ROOT, 'data/assets-built/placements');

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const allowedAssets = new Set(schema.$defs.worldVisualAssetId.enum);
const allowedVisibility = new Set(schema.$defs.worldVisualVisibility.enum);

function fail(msg) {
  console.error(`✗ validate-placement — ${msg}`);
  process.exit(1);
}

function validateManifest(relPath, data) {
  if (data == null || typeof data !== 'object') fail(`${relPath}: root must be object`);
  if (typeof data.map !== 'string' || !data.map) fail(`${relPath}: map required`);
  if (data.schema_version !== 1) fail(`${relPath}: schema_version must be 1`);
  if (data.mechanics !== null) fail(`${relPath}: mechanics must be null`);
  if (!Array.isArray(data.placements)) fail(`${relPath}: placements must be array`);

  const ids = new Set();
  for (const [index, entry] of data.placements.entries()) {
    const label = `${relPath}[${index}]`;
    if (!entry || typeof entry !== 'object') fail(`${label}: entry must be object`);
    if (typeof entry.id !== 'string' || !entry.id) fail(`${label}: id required`);
    if (ids.has(entry.id)) fail(`${label}: duplicate id ${entry.id}`);
    ids.add(entry.id);
    if (!allowedAssets.has(entry.asset_id)) fail(`${label}: unknown asset_id ${entry.asset_id}`);
    if (!Number.isInteger(entry.x) || !Number.isInteger(entry.y)) {
      fail(`${label}: x/y must be integers`);
    }
    if (entry.visibility != null && !allowedVisibility.has(entry.visibility)) {
      fail(`${label}: invalid visibility ${entry.visibility}`);
    }
  }
}

let files = [];
try {
  files = readdirSync(PLACEMENTS_DIR).filter((name) => name.endsWith('.json'));
} catch {
  fail(`missing placements dir ${PLACEMENTS_DIR}`);
}

if (files.length === 0) fail('no placement JSON files found');

for (const name of files) {
  const rel = `data/assets-built/placements/${name}`;
  const data = JSON.parse(readFileSync(join(PLACEMENTS_DIR, name), 'utf8'));
  validateManifest(rel, data);
  console.log(`✓ ${rel} — ${data.placements.length} placement(s), map=${data.map}`);
}

console.log(`✓ validate-placement — ${files.length} file(s) OK`);