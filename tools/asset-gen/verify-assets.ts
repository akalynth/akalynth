// Verify Akalynth asset manifests (Factory v1 + bounded visual spritesheet sidecars).
//
// Enforces the sidecar contract (see data/assets-src/MANIFEST_SCHEMA.md):
//   A-1 pairing      every cleaned PNG has a sidecar JSON, and vice-versa
//   A-2 naming       factory files are <class>__<name>.png / .json
//   A-3 schema       required fields present with valid enums/types
//   A-4 dimensions   dims are multiples of 32; dimensions_px matches the PNG
//   A-5 sha256       once status >= cleaned_png, sha256 matches the cleaned PNG
//   A-6 lockstep     mechanics === null (art never asserts mechanics)
//   A-7 lineage      referenced prompt_file exists
//   A-8 pack spec    packs/*.json entries valid; prompt_file exists; dims 32-mult
//   A-9 visual sheets data/assets-src/sprites/{characters,creatures}/*.json stay visual-only
//   A-10 world visuals data/assets-src/sprites/world/**/*.json stay render-only
//
// Pure read-only; run from repo root: `npm run verify:assets`.

import { readFileSync, readdirSync, existsSync, statSync, realpathSync } from 'node:fs';
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
const SMOKE_CHARACTER_ROWS = ['south', 'north', 'east', 'west'];
const WORLD_VISUAL_TYPES = new Set(['terrain_tile', 'wall_overlay', 'door_overlay', 'world_object', 'floor_overlay']);
const WORLD_VISUAL_ANCHORS = new Set(['tile_top_left', 'bottom_center', 'bottom_left', 'center']);
const WORLD_VISUAL_LAYERS = new Set(['terrain', 'object_overlay', 'floor_overlay']);
const WORLD_VISUAL_Z_POLICIES = new Set(['fixed_layer', 'sort_by_anchor_y', 'fixed_above_building']);

const errors: string[] = [];
const fail = (f: string, msg: string) => errors.push(`${f}: ${msg}`);

/** Read width/height from a PNG IHDR (no deps). */
function pngDims(buf: Buffer): [number, number] | null {
  if (buf.length < 24 || buf.toString('binary', 1, 4) !== 'PNG') return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}
const isMult32 = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0 && n % 32 === 0;
const repoRel = (abs: string) => path.relative(REPO_ROOT, abs);
const arrayEq = (a: unknown, b: readonly unknown[]) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);

function walkFiles(dir: string, seen = new Set<string>()): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    // statSync follows symlinks (entry.isDirectory() is false for a symlinked
    // dir), so symlinked sprite subtrees are still verified; a realpath visited
    // set prevents infinite recursion on cyclic links.
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      continue; // broken symlink or unreadable entry
    }
    if (stat.isDirectory()) {
      const real = realpathSync(abs);
      if (seen.has(real)) continue;
      seen.add(real);
      out.push(...walkFiles(abs, seen));
    } else if (stat.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

function validateFactorySidecar(jsonPath: string, pngPath: string) {
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
  // A cleaned PNG exists for these statuses -> check actual dims + sha256.
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

function validateVisualSpritesheetSidecar(jsonPath: string, pngPath: string, expectedAssetType: 'character' | 'creature') {
  const f = repoRel(jsonPath);
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    fail(f, `invalid JSON (${e})`);
    return;
  }

  const base = path.basename(pngPath, '.png');
  if (m.id !== base) fail(f, `id must match PNG basename '${base}'`);
  if (m.asset_type !== expectedAssetType) fail(f, `asset_type must be ${expectedAssetType}`);
  if (m.source_kind !== 'spritesheet') fail(f, 'source_kind must be spritesheet');
  if (m.image !== `${base}.png`) fail(f, `image must be ${base}.png`);
  if (m.mechanics !== null) fail(f, 'mechanics MUST be null (server-metadata lockstep)');
  for (const prohibited of ['collision', 'walkability', 'npc_behavior', 'server_protocol']) {
    if (Object.prototype.hasOwnProperty.call(m, prohibited)) fail(f, `${prohibited} must not be encoded in visual manifests`);
  }

  const buf = readFileSync(pngPath);
  const dims = pngDims(buf);
  if (!dims) { fail(f, 'cannot read PNG dimensions'); return; }
  const dimensions = m.dimensions as Record<string, unknown> | undefined;
  if (!dimensions || dimensions.width !== 256 || dimensions.height !== 256) fail(f, 'dimensions must be {width:256,height:256}');
  if (dims[0] !== 256 || dims[1] !== 256) fail(f, `PNG dims ${dims[0]}x${dims[1]} must be 256x256`);

  const frame = m.frame as Record<string, unknown> | undefined;
  if (!frame || frame.width !== 64 || frame.height !== 64) fail(f, 'frame must be {width:64,height:64}');
  const directions = m.directions as Record<string, unknown> | undefined;
  if (!directions || !arrayEq(directions.rows, SMOKE_CHARACTER_ROWS)) fail(f, 'directions.rows must be [south,north,east,west]');
  const animations = m.animations as Record<string, unknown> | undefined;
  const walk = animations?.walk as Record<string, unknown> | undefined;
  const idle = animations?.idle as Record<string, unknown> | undefined;
  if (!walk || !arrayEq(walk.columns, [0, 1, 2, 3]) || walk.frames !== 4) fail(f, 'animations.walk must use columns [0,1,2,3] and frames 4');
  if (!idle || idle.column !== 0) fail(f, 'animations.idle.column must be 0');
  const rendering = m.rendering as Record<string, unknown> | undefined;
  if (!rendering || rendering.filtering !== 'nearest' || rendering.display_only !== true) fail(f, 'rendering must be nearest/display_only');
  const anchor = m.render_anchor as Record<string, unknown> | undefined;
  if (!anchor || !arrayEq(anchor.feet, [32, 54]) || anchor.unit !== 'source_pixels') fail(f, 'render_anchor.feet must be [32,54] source_pixels');
}

function validateWorldVisualSidecar(jsonPath: string, pngPath: string) {
  const f = repoRel(jsonPath);
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    fail(f, `invalid JSON (${e})`);
    return;
  }

  const base = path.basename(pngPath, '.png');
  if (m.id !== base) fail(f, `id must match PNG basename '${base}'`);
  if (!WORLD_VISUAL_TYPES.has(m.asset_type as string)) fail(f, `asset_type '${m.asset_type}' invalid for world visual`);
  if (!['sprite', 'tile'].includes(m.source_kind as string)) fail(f, 'source_kind must be sprite or tile');
  if (m.image !== `${base}.png`) fail(f, `image must be ${base}.png`);
  if (m.mechanics !== null) fail(f, 'mechanics MUST be null (server-metadata lockstep)');
  for (const prohibited of ['collision', 'walkability', 'npc_behavior', 'server_protocol', 'interaction', 'authority']) {
    if (Object.prototype.hasOwnProperty.call(m, prohibited)) fail(f, `${prohibited} must not be encoded in visual manifests`);
  }

  const buf = readFileSync(pngPath);
  const dims = pngDims(buf);
  if (!dims) { fail(f, 'cannot read PNG dimensions'); return; }
  const frame = m.frame as Record<string, unknown> | undefined;
  if (!frame || frame.width !== dims[0] || frame.height !== dims[1]) fail(f, `frame must match PNG dimensions ${dims[0]}x${dims[1]}`);

  const rendering = m.rendering as Record<string, unknown> | undefined;
  if (!rendering) { fail(f, 'rendering required'); return; }
  if (rendering.filtering !== 'nearest') fail(f, 'rendering.filtering must be nearest');
  if (rendering.display_only !== true) fail(f, 'rendering.display_only must be true');
  if (typeof rendering.draw_scale !== 'number' || rendering.draw_scale <= 0) fail(f, 'rendering.draw_scale must be a positive number');
  if (!WORLD_VISUAL_LAYERS.has(rendering.layer as string)) fail(f, `rendering.layer '${rendering.layer}' invalid`);
  if (rendering.z_policy != null && !WORLD_VISUAL_Z_POLICIES.has(rendering.z_policy as string)) fail(f, `rendering.z_policy '${rendering.z_policy}' invalid`);

  const anchor = rendering.anchor as Record<string, unknown> | undefined;
  if (!anchor) { fail(f, 'rendering.anchor required'); return; }
  if (!WORLD_VISUAL_ANCHORS.has(anchor.type as string)) fail(f, `rendering.anchor.type '${anchor.type}' invalid`);
  const sp = anchor.source_pixels as unknown;
  if (!Array.isArray(sp) || sp.length !== 2 || typeof sp[0] !== 'number' || typeof sp[1] !== 'number') fail(f, 'rendering.anchor.source_pixels must be numeric [x,y]');
}

function run() {
  // A-1 pairing over sprites/ recursively.
  const entries = existsSync(SPRITES) ? walkFiles(SPRITES) : [];
  const pngs = entries.filter((e) => e.endsWith('.png'));
  const jsons = entries.filter((e) => e.endsWith('.json'));
  const rels = new Set(entries.map((e) => repoRel(e)));

  for (const pngPath of pngs) {
    const rel = repoRel(pngPath);
    const sidecarRel = rel.replace(/\.png$/, '.json');
    const sidecarPath = path.join(REPO_ROOT, sidecarRel);
    if (!rels.has(sidecarRel)) fail(rel, 'missing sidecar JSON');
    else {
      const relFromSprites = path.relative(SPRITES, pngPath);
      if (relFromSprites.startsWith(`characters${path.sep}`)) validateVisualSpritesheetSidecar(sidecarPath, pngPath, 'character');
      else if (relFromSprites.startsWith(`creatures${path.sep}`)) validateVisualSpritesheetSidecar(sidecarPath, pngPath, 'creature');
      else if (relFromSprites.startsWith(`world${path.sep}`)) validateWorldVisualSidecar(sidecarPath, pngPath);
      else validateFactorySidecar(sidecarPath, pngPath);
    }
  }
  for (const jsonPath of jsons) {
    const rel = repoRel(jsonPath);
    const pngRel = rel.replace(/\.json$/, '.png');
    if (!rels.has(pngRel)) fail(rel, 'orphan sidecar (no matching PNG)');
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
  console.log(`✓ verify:assets — ${pngs.length} sprite manifest(s) + ${packFiles.length} pack(s) valid (Factory v1 + visual spritesheet/world render sidecars; lockstep mechanics=null).`);
}

run();
