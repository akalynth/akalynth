// Verify Akalynth asset manifests (Factory v1).
//
// Enforces the sidecar contract (see data/assets-src/MANIFEST_SCHEMA.md):
//   A-1 pairing      every cleaned PNG has a sidecar JSON, and vice-versa
//   A-2 naming       files are <class>__<name>.png / .json
//   A-3 schema       required fields present with valid enums/types
//   A-4 dimensions   dims are multiples of 32; dimensions_px matches the PNG
//   A-5 sha256       once status >= cleaned_png, sha256 matches the cleaned PNG
//   A-6 lockstep     mechanics === null (art never asserts mechanics)
//   A-7 lineage      referenced prompt_file exists
//   A-8 pack spec    packs/*.json entries valid; prompt_file exists; dims 32-mult
//
// Pure read-only; run from repo root: `npm run verify:assets`.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SPRITES = path.join(REPO_ROOT, 'data/assets-src/sprites');
const PROMPTS = path.join(REPO_ROOT, 'data/assets-src/prompts');
const PACKS = path.join(REPO_ROOT, 'data/assets-src/packs');

const STYLE_CONTRACT = 'nostalgic_top_down_mmo_readability_original_akalynth_assets_v1';
const ASSET_TYPES = new Set(['ground', 'border', 'structure', 'prop', 'creature', 'character', 'npc', 'building', 'effect', 'ui', 'tile', 'item']);
const LIFECYCLE = ['prompt_written', 'raw_generated', 'cleaned_png', 'manifest_recorded', 'tilemap_tested', 'human_reviewed', 'promoted', 'legacy'];
const HAS_PNG_STATUS = new Set(['cleaned_png', 'manifest_recorded', 'tilemap_tested', 'human_reviewed', 'promoted', 'legacy']);

const errors: string[] = [];
const fail = (f: string, msg: string) => errors.push(`${f}: ${msg}`);

/** Read width/height from a PNG IHDR (no deps). */
function pngDims(buf: Buffer): [number, number] | null {
  if (buf.length < 24 || buf.toString('binary', 1, 4) !== 'PNG') return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}
const isMult32 = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0 && n % 32 === 0;
const repoRel = (abs: string) => path.relative(REPO_ROOT, abs);

function validateSidecar(jsonPath: string, pngPath: string) {
  const f = repoRel(jsonPath);
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    fail(f, `invalid JSON (${e})`);
    return;
  }
  const base = path.basename(pngPath, '.png');
  // A-2 naming
  if (!/^[a-z0-9]+__[a-z0-9_]+$/.test(base)) fail(f, `name '${base}' is not <class>__<name>`);
  // A-3 schema
  if (m.game !== 'Akalynth') fail(f, 'game must be "Akalynth"');
  if (typeof m.asset_id !== 'string' || !/^akalynth_[a-z0-9_]+$/.test(m.asset_id)) fail(f, 'asset_id invalid');
  if (!ASSET_TYPES.has(m.asset_type as string)) fail(f, `asset_type '${m.asset_type}' invalid`);
  if (!LIFECYCLE.includes(m.status as string)) fail(f, `status '${m.status}' invalid`);
  if (m.style_contract !== STYLE_CONTRACT) fail(f, 'style_contract mismatch');
  if (m.background !== 'transparent') fail(f, 'background must be transparent');
  if (m.camera !== 'top_down_slight_isometric') fail(f, 'camera invalid');
  if (!['hand_authored', 'original_generated_asset'].includes(m.license_status as string)) fail(f, 'license_status invalid');
  if (!['needs_human_review', 'approved', 'legacy'].includes(m.review_status as string)) fail(f, 'review_status invalid');
  if (typeof m.copyright_boundary !== 'string' || !m.copyright_boundary) fail(f, 'copyright_boundary required');
  // A-6 lockstep
  if (m.mechanics !== null) fail(f, 'mechanics MUST be null (server-metadata lockstep)');
  // tile_code: null or int 0..8
  if (m.tile_code !== null && !(Number.isInteger(m.tile_code) && (m.tile_code as number) >= 0 && (m.tile_code as number) <= 8)) {
    fail(f, 'tile_code must be null or an integer 0..8');
  }
  // A-4 dimensions
  const dt = m.dimensions_target_px;
  if (!Array.isArray(dt) || dt.length !== 2 || !isMult32(dt[0]) || !isMult32(dt[1])) fail(f, 'dimensions_target_px must be [w,h], multiples of 32');
  // A cleaned PNG exists for these statuses → check actual dims + sha256.
  if (HAS_PNG_STATUS.has(m.status as string)) {
    const buf = readFileSync(pngPath);
    const dims = pngDims(buf);
    if (!dims) { fail(f, 'cannot read PNG dimensions'); return; }
    if (!isMult32(dims[0]) || !isMult32(dims[1])) fail(f, `PNG dims ${dims[0]}x${dims[1]} not multiples of 32`);
    const dp = m.dimensions_px;
    if (!Array.isArray(dp) || dp[0] !== dims[0] || dp[1] !== dims[1]) fail(f, `dimensions_px ${JSON.stringify(dp)} != actual ${dims[0]}x${dims[1]}`);
    // A-5 sha256
    const sha = createHash('sha256').update(buf).digest('hex');
    if (m.sha256 !== sha) fail(f, `sha256 mismatch (manifest ${m.sha256} vs actual ${sha})`);
    if (m.cleaned_file !== repoRel(pngPath)) fail(f, `cleaned_file should be ${repoRel(pngPath)}`);
  }
  // A-7 lineage
  if (m.prompt_file != null) {
    if (!existsSync(path.join(REPO_ROOT, m.prompt_file as string))) fail(f, `prompt_file missing: ${m.prompt_file}`);
  }
}

function run() {
  // A-1 pairing over sprites/
  const entries = existsSync(SPRITES) ? readdirSync(SPRITES) : [];
  const pngs = entries.filter((e) => e.endsWith('.png'));
  const jsons = entries.filter((e) => e.endsWith('.json'));
  for (const png of pngs) {
    const sidecar = png.replace(/\.png$/, '.json');
    if (!entries.includes(sidecar)) fail(`data/assets-src/sprites/${png}`, 'missing sidecar JSON');
    else validateSidecar(path.join(SPRITES, sidecar), path.join(SPRITES, png));
  }
  for (const j of jsons) {
    const png = j.replace(/\.json$/, '.png');
    if (!entries.includes(png)) fail(`data/assets-src/sprites/${j}`, 'orphan sidecar (no matching PNG)');
  }

  // A-8 pack specs
  const packFiles = existsSync(PACKS) ? readdirSync(PACKS).filter((e) => e.endsWith('.json')) : [];
  for (const pf of packFiles) {
    const f = `data/assets-src/packs/${pf}`;
    let pack: Record<string, unknown>;
    try { pack = JSON.parse(readFileSync(path.join(PACKS, pf), 'utf8')); } catch (e) { fail(f, `invalid JSON (${e})`); continue; }
    const assets = pack.assets;
    if (!Array.isArray(assets) || assets.length === 0) { fail(f, 'pack.assets must be a non-empty array'); continue; }
    for (const a of assets as Array<Record<string, unknown>>) {
      const id = a.id ?? '(no id)';
      if (typeof a.id !== 'string' || !/^akalynth_[a-z0-9_]+$/.test(a.id)) fail(f, `asset id invalid: ${id}`);
      if (!ASSET_TYPES.has(a.asset_type as string)) fail(f, `${id}: asset_type invalid`);
      if (!LIFECYCLE.includes(a.status as string)) fail(f, `${id}: status invalid`);
      const td = a.target_dims;
      if (!Array.isArray(td) || !isMult32(td[0]) || !isMult32(td[1])) fail(f, `${id}: target_dims must be [w,h] multiples of 32`);
      if (typeof a.prompt_file !== 'string' || !existsSync(path.join(REPO_ROOT, a.prompt_file))) fail(f, `${id}: prompt_file missing: ${a.prompt_file}`);
    }
  }

  if (errors.length) {
    console.error(`\n✗ verify:assets — ${errors.length} problem(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✓ verify:assets — ${pngs.length} sprite manifest(s) + ${packFiles.length} pack(s) valid (Factory v1; lockstep mechanics=null).`);
}

run();
