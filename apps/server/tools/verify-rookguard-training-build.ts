// Offline verifier for AKALYNTH_ROOKGUARD_MAP_ASSET_TRAINING_BUILD_V1.
//
// This validates the source-only training bundle under data/map-training/rookguard.
// It does not import or mutate server runtime world state.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LANE = 'AKALYNTH_ROOKGUARD_MAP_ASSET_TRAINING_BUILD_V1';
const CLOSURE_STATUS = 'rookguard_training_asset_bundle_created_preview_verified_no_gameplay_mutation';
const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const BUNDLE_DIR = path.join(REPO_ROOT, 'data/map-training/rookguard');
const VERIFIER_REL = 'apps/server/tools/verify-rookguard-training-build.ts';

const CORE_FILES = [
  'rookguard.asset-register.json',
  'rookguard.map-training.jsonl',
  'rookguard.seed-map.json',
  'rookguard.asset-placement-rules.json',
  'rookguard.preview.html',
  'claim-boundary.md',
];

const GENERATED_FILES = ['receipt.json', 'MANIFEST.sha256', 'verification.log'];

const FORBIDDEN_TERMS = [
  'Rookgaard',
  'Tibia',
  'Dawnport',
  'Thais',
  'Oracle',
  'Cipfried',
  'Seymour',
  'Obi',
  'Dixi',
  'Al Dee',
];

type JsonRecord = Record<string, unknown>;

interface Asset {
  id: string;
  category: string;
  layer: string;
  blocks_training_path: boolean;
}

interface TrainingObject {
  id: string;
  role: string;
  asset_id: string;
  x: number;
  y: number;
  footprint: [number, number];
}

interface SeedMap {
  lane: string;
  status: string;
  width: number;
  height: number;
  source_ref: string;
  spawn: { x: number; y: number };
  tutorial_gate: { x: number; y: number };
  legend: Record<string, string>;
  layers: { ground: string[] };
  objects: TrainingObject[];
}

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function readText(fileName: string): string {
  return readFileSync(path.join(BUNDLE_DIR, fileName), 'utf8');
}

function readJson<T>(fileName: string): T {
  return JSON.parse(readText(fileName)) as T;
}

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

function assertRecord(value: unknown, label: string): asserts value is JsonRecord {
  assert(typeof value === 'object' && value !== null && !Array.isArray(value), `${label} must be an object`);
}

function asString(value: unknown, label: string): string {
  assert(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
  return value;
}

function asNumber(value: unknown, label: string): number {
  assert(typeof value === 'number' && Number.isInteger(value), `${label} must be an integer`);
  return value;
}

function assetMap(register: JsonRecord): Map<string, Asset> {
  const assets = register.allowed_assets;
  assert(Array.isArray(assets), 'asset register allowed_assets must be an array');
  const out = new Map<string, Asset>();
  for (const raw of assets) {
    assertRecord(raw, 'asset');
    const id = asString(raw.id, 'asset.id');
    assert(!out.has(id), `duplicate asset id: ${id}`);
    const category = asString(raw.category, `asset ${id}.category`);
    const layer = asString(raw.layer, `asset ${id}.layer`);
    assert(typeof raw.blocks_training_path === 'boolean', `asset ${id}.blocks_training_path must be boolean`);
    out.set(id, { id, category, layer, blocks_training_path: raw.blocks_training_path });
  }
  return out;
}

function parseJsonl(fileName: string): JsonRecord[] {
  return readText(fileName)
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        const parsed = JSON.parse(line) as unknown;
        assertRecord(parsed, `${fileName}:${index + 1}`);
        return parsed;
      } catch (err) {
        throw new Error(`${fileName}:${index + 1} is not valid JSON: ${err}`);
      }
    });
}

function inBounds(map: SeedMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function objectCells(obj: TrainingObject): string[] {
  const [w, h] = obj.footprint;
  const cells: string[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      cells.push(key(obj.x + dx, obj.y + dy));
    }
  }
  return cells;
}

function validateAssetRegister(register: JsonRecord): Map<string, Asset> {
  assert(register.lane === LANE, 'asset register lane mismatch');
  assert(register.status === 'training_only', 'asset register must be training_only');
  assert(register.source_ref === 'original_akalynth_training_build_v1', 'asset register source_ref must be original');
  const boundary = register.ip_boundary;
  assertRecord(boundary, 'asset register ip_boundary');
  assert(boundary.no_external_map_derivation === true, 'asset register must reject external map derivation');
  assert(boundary.no_external_names_or_layouts === true, 'asset register must reject external names/layouts');
  assert(boundary.no_copied_art_or_tile_composition === true, 'asset register must reject copied art/tile composition');

  const assets = assetMap(register);
  for (const required of [
    'ground',
    'path',
    'fence',
    'training_dummy',
    'small_house',
    'sign',
    'gate',
    'water_edge',
    'cave_mouth',
    'shrine_chronicle_marker',
  ]) {
    assert([...assets.values()].some((asset) => asset.category === required), `missing asset category: ${required}`);
  }
  return assets;
}

function validateTrainingRows(rows: JsonRecord[], assets: Map<string, Asset>): void {
  assert(rows.length >= 8, `expected at least 8 training rows, got ${rows.length}`);
  const ids = new Set<string>();
  for (const row of rows) {
    const id = asString(row.id, 'training row id');
    assert(!ids.has(id), `duplicate training row id: ${id}`);
    ids.add(id);
    asString(row.prompt, `${id}.prompt`);
    asString(row.expected_tile_intention, `${id}.expected_tile_intention`);
    asString(row.reason, `${id}.reason`);
    assert(Array.isArray(row.allowed_assets), `${id}.allowed_assets must be an array`);
    assert(Array.isArray(row.rejected_assets), `${id}.rejected_assets must be an array`);
    for (const assetId of row.allowed_assets) {
      assert(typeof assetId === 'string', `${id}.allowed_assets entries must be strings`);
      assert(assets.has(assetId), `${id}.allowed asset not registered: ${assetId}`);
    }
    for (const rejected of row.rejected_assets) {
      assert(typeof rejected === 'string', `${id}.rejected_assets entries must be strings`);
      assert(!assets.has(rejected), `${id}.rejected asset should not be an allowed registered asset: ${rejected}`);
    }
  }
}

function validateSeedMap(seed: SeedMap, assets: Map<string, Asset>): void {
  assert(seed.lane === LANE, 'seed map lane mismatch');
  assert(seed.status === 'training_only_not_canonical_gameplay_state', 'seed map status must remain training-only');
  assert(seed.width === 32, `seed map width must equal 32, got ${seed.width}`);
  assert(seed.height === 32, `seed map height must equal 32, got ${seed.height}`);
  assert(seed.source_ref === 'original_akalynth_training_build_v1', 'seed map source_ref must be original');
  assert(inBounds(seed, seed.spawn.x, seed.spawn.y), 'spawn out of bounds');
  assert(inBounds(seed, seed.tutorial_gate.x, seed.tutorial_gate.y), 'tutorial_gate out of bounds');
  assert(Array.isArray(seed.layers.ground), 'seed map ground layer must be an array');
  assert(seed.layers.ground.length === seed.height, `ground row count must equal height ${seed.height}`);

  for (const [symbol, assetId] of Object.entries(seed.legend)) {
    assert(symbol.length === 1, `legend symbol must be one character: ${symbol}`);
    assert(assets.has(assetId), `legend asset not registered: ${assetId}`);
    assert(assets.get(assetId)?.layer === 'ground', `legend asset must be ground-layer: ${assetId}`);
  }

  for (let y = 0; y < seed.layers.ground.length; y++) {
    const row = seed.layers.ground[y];
    assert(row.length === seed.width, `ground row ${y} length must equal ${seed.width}, got ${row.length}`);
    for (const symbol of row) {
      assert(seed.legend[symbol], `ground row ${y} uses unknown legend symbol: ${symbol}`);
      assert(assets.has(seed.legend[symbol]), `ground tile symbol ${symbol} references unregistered asset`);
    }
  }

  assert(Array.isArray(seed.objects), 'seed map objects must be an array');
  const objectIds = new Set<string>();
  for (const obj of seed.objects) {
    assert(typeof obj.id === 'string' && obj.id.length > 0, 'object id must be non-empty');
    assert(!objectIds.has(obj.id), `duplicate object id: ${obj.id}`);
    objectIds.add(obj.id);
    assert(typeof obj.role === 'string' && obj.role.length > 0, `${obj.id}.role must be non-empty`);
    assert(assets.has(obj.asset_id), `${obj.id} references unregistered asset ${obj.asset_id}`);
    asNumber(obj.x, `${obj.id}.x`);
    asNumber(obj.y, `${obj.id}.y`);
    assert(Array.isArray(obj.footprint) && obj.footprint.length === 2, `${obj.id}.footprint must be [w,h]`);
    const [w, h] = obj.footprint;
    assert(Number.isInteger(w) && w > 0 && Number.isInteger(h) && h > 0, `${obj.id}.footprint values must be positive integers`);
    for (const cell of objectCells(obj)) {
      const [x, y] = cell.split(',').map(Number);
      assert(inBounds(seed, x, y), `${obj.id} footprint cell ${cell} out of bounds`);
    }
  }

  const gates = seed.objects.filter((obj) => obj.role === 'tutorial_gate');
  assert(gates.length === 1, `expected exactly one tutorial_gate object, got ${gates.length}`);
  assert(gates[0].x === seed.tutorial_gate.x && gates[0].y === seed.tutorial_gate.y, 'tutorial_gate object must match tutorial_gate coordinate');

  const firstSigns = seed.objects.filter((obj) => obj.role === 'first_instruction_sign');
  assert(firstSigns.length === 1, `expected exactly one first_instruction_sign object, got ${firstSigns.length}`);
  const dist = Math.abs(firstSigns[0].x - seed.spawn.x) + Math.abs(firstSigns[0].y - seed.spawn.y);
  assert(dist <= 5, `first instruction sign must be within 5 tiles of spawn, got ${dist}`);

  const spawnObjects = seed.objects.filter((obj) => obj.role === 'spawn');
  assert(spawnObjects.length === 1, `expected exactly one spawn object, got ${spawnObjects.length}`);
  assert(spawnObjects[0].x === seed.spawn.x && spawnObjects[0].y === seed.spawn.y, 'spawn object must match spawn coordinate');
}

function trainingBlockedCells(seed: SeedMap, assets: Map<string, Asset>): Set<string> {
  const blocked = new Set<string>();
  for (let y = 0; y < seed.height; y++) {
    const row = seed.layers.ground[y];
    for (let x = 0; x < seed.width; x++) {
      const asset = assets.get(seed.legend[row[x]]);
      if (asset?.blocks_training_path) blocked.add(key(x, y));
    }
  }

  for (const obj of seed.objects) {
    const asset = assets.get(obj.asset_id);
    if (!asset?.blocks_training_path || obj.role === 'tutorial_gate') continue;
    for (const cell of objectCells(obj)) blocked.add(cell);
  }
  blocked.delete(key(seed.spawn.x, seed.spawn.y));
  blocked.delete(key(seed.tutorial_gate.x, seed.tutorial_gate.y));
  return blocked;
}

function reachable(seed: SeedMap, assets: Map<string, Asset>): Set<string> {
  const blocked = trainingBlockedCells(seed, assets);
  const start = key(seed.spawn.x, seed.spawn.y);
  const seen = new Set<string>([start]);
  const queue: Array<{ x: number; y: number }> = [{ ...seed.spawn }];

  while (queue.length > 0) {
    const current = queue.shift() as { x: number; y: number };
    for (const [nx, ny] of [
      [current.x + 1, current.y],
      [current.x - 1, current.y],
      [current.x, current.y + 1],
      [current.x, current.y - 1],
    ] as const) {
      const next = key(nx, ny);
      if (!inBounds(seed, nx, ny) || seen.has(next) || blocked.has(next)) continue;
      seen.add(next);
      queue.push({ x: nx, y: ny });
    }
  }

  return seen;
}

function validateReachability(seed: SeedMap, assets: Map<string, Asset>): void {
  const seen = reachable(seed, assets);
  assert(seen.has(key(seed.tutorial_gate.x, seed.tutorial_gate.y)), 'spawn cannot reach tutorial gate');
}

function validateWaterEdges(seed: SeedMap, assets: Map<string, Asset>): void {
  for (let y = 0; y < seed.height; y++) {
    for (let x = 0; x < seed.width; x++) {
      const symbol = seed.layers.ground[y][x];
      const asset = assets.get(seed.legend[symbol]);
      if (asset?.category !== 'water_edge') continue;

      let hasLandNeighbor = false;
      let hasEdgeOrOffMapNeighbor = false;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
        [x + 1, y + 1],
        [x - 1, y + 1],
        [x + 1, y - 1],
        [x - 1, y - 1],
      ] as const) {
        if (!inBounds(seed, nx, ny)) {
          hasEdgeOrOffMapNeighbor = true;
          continue;
        }
        const neighborAsset = assets.get(seed.legend[seed.layers.ground[ny][nx]]);
        if (neighborAsset?.category === 'ground' || neighborAsset?.category === 'path') hasLandNeighbor = true;
        const orthogonal = nx === x || ny === y;
        if (orthogonal && neighborAsset?.category === 'water_edge') hasEdgeOrOffMapNeighbor = true;
      }
      assert(hasLandNeighbor, `water edge at ${x},${y} has no land/path neighbor`);
      assert(hasEdgeOrOffMapNeighbor, `water edge at ${x},${y} has no edge/off-map neighbor`);
    }
  }
}

function validateRules(rules: JsonRecord): void {
  assert(rules.lane === LANE, 'placement rules lane mismatch');
  assert(rules.status === 'training_only', 'placement rules must be training_only');
  assert(rules.source_ref === 'original_akalynth_training_build_v1', 'placement rules source_ref must be original');
  assert(Array.isArray(rules.deterministic_rules), 'placement rules deterministic_rules must be an array');
  const ruleIds = new Set(rules.deterministic_rules.map((rule) => {
    assertRecord(rule, 'deterministic rule');
    return asString(rule.id, 'deterministic rule id');
  }));
  for (const required of [
    'map_dimensions_32x32',
    'asset_ids_registered',
    'spawn_exactly_once',
    'tutorial_gate_exactly_once',
    'spawn_to_gate_reachable',
    'first_sign_near_spawn',
    'critical_path_clear',
    'valid_water_edge_neighbors',
    'no_external_map_geometry',
    'forbidden_reference_scan',
    'no_gameplay_promotion',
  ]) {
    assert(ruleIds.has(required), `placement rules missing required rule ${required}`);
  }
  assert(Array.isArray(rules.manifest_scope), 'placement rules manifest_scope must be an array');
  assert(JSON.stringify(rules.manifest_scope) === JSON.stringify(CORE_FILES), 'placement rules manifest_scope must match verifier core files');
}

function extractJsonConst<T>(html: string, constName: string): T {
  const match = html.match(new RegExp(`const ${constName} = (\\[[\\s\\S]*?\\]);`));
  assert(match, `preview missing ${constName}`);
  return JSON.parse(match[1]) as T;
}

function validatePreview(seed: SeedMap): void {
  const html = readText('rookguard.preview.html');
  assert(html.includes('data-training-only="true"'), 'preview must be marked training-only');
  assert(html.includes('function renderMap()'), 'preview must include renderMap function');
  const rows = extractJsonConst<string[]>(html, 'TRAINING_MAP_ROWS');
  assert(JSON.stringify(rows) === JSON.stringify(seed.layers.ground), 'preview map rows must match seed map rows');
  const objects = extractJsonConst<Array<{ id: string; role: string; x: number; y: number }>>(html, 'TRAINING_OBJECTS');
  assert(objects.some((obj) => obj.role === 'spawn' && obj.x === seed.spawn.x && obj.y === seed.spawn.y), 'preview missing spawn marker');
  for (const seedObj of seed.objects) {
    assert(
      objects.some((obj) => obj.id === seedObj.id && obj.role === seedObj.role && obj.x === seedObj.x && obj.y === seedObj.y),
      `preview missing object ${seedObj.id}`
    );
  }
}

function validateForbiddenTerms(): void {
  const scanFiles = [...CORE_FILES, ...GENERATED_FILES].filter((fileName) => existsSync(path.join(BUNDLE_DIR, fileName)));
  for (const fileName of scanFiles) {
    const text = readText(fileName);
    for (const term of FORBIDDEN_TERMS) {
      assert(!text.includes(term), `${fileName} contains forbidden external reference: ${term}`);
    }
  }
}

function validateNoGameplayPromotion(assets: Map<string, Asset>): void {
  const gameplayFiles = [
    'packages/shared/maps/rookguard.json',
    'apps/android/app/src/main/assets/maps/rookguard.json',
    'apps/server/src/index.ts',
    'apps/server/src/world/npcs.ts',
    'packages/shared/protocol.ts',
    'packages/shared/types.ts',
  ];
  const trainingNeedles = [
    LANE,
    'rookguard-seed-map-training-only',
    'rookguard-map-asset-training-build',
    ...assets.keys(),
  ];

  for (const rel of gameplayFiles) {
    const abs = path.join(REPO_ROOT, rel);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, 'utf8');
    for (const needle of trainingNeedles) {
      assert(!text.includes(needle), `${rel} imports/promotes training bundle marker: ${needle}`);
    }
  }
}

function manifestText(): string {
  return CORE_FILES.map((fileName) => `${sha256(readText(fileName))}  ${fileName}`).join('\n') + '\n';
}

function validateManifest(): string {
  const expected = manifestText();
  const manifestPath = path.join(BUNDLE_DIR, 'MANIFEST.sha256');
  assert(existsSync(manifestPath), 'MANIFEST.sha256 missing');
  const actual = readText('MANIFEST.sha256');
  assert(actual === expected, 'MANIFEST.sha256 does not match core bundle files');
  return sha256(actual);
}

function validateReceipt(manifestSha: string): void {
  const receiptPath = path.join(BUNDLE_DIR, 'receipt.json');
  assert(existsSync(receiptPath), 'receipt.json missing');
  const receipt = readJson<JsonRecord>('receipt.json');
  assert(receipt.lane === LANE, 'receipt lane mismatch');
  assert(receipt.closure_status === CLOSURE_STATUS, 'receipt closure status mismatch');
  assert(receipt.training_only === true, 'receipt must declare training_only true');
  assert(receipt.no_gameplay_mutation === true, 'receipt must declare no_gameplay_mutation true');
  assert(receipt.no_canonical_map_promotion === true, 'receipt must declare no_canonical_map_promotion true');
  assert(receipt.no_deploy === true, 'receipt must declare no_deploy true');
  assert(receipt.manifest_sha256 === manifestSha, 'receipt manifest_sha256 mismatch');
  assert(Array.isArray(receipt.manifest_scope), 'receipt manifest_scope must be an array');
  assert(JSON.stringify(receipt.manifest_scope) === JSON.stringify(CORE_FILES), 'receipt manifest_scope mismatch');
  assert(receipt.verifier === VERIFIER_REL, 'receipt verifier path mismatch');
}

function validateVerificationLog(): void {
  const logPath = path.join(BUNDLE_DIR, 'verification.log');
  assert(existsSync(logPath), 'verification.log missing');
  const log = readText('verification.log');
  assert(log.includes(CLOSURE_STATUS), 'verification.log missing closure status');
  assert(log.includes('verification passed'), 'verification.log missing pass marker');
}

function writeReceiptAndManifest(): void {
  const manifest = manifestText();
  writeFileSync(path.join(BUNDLE_DIR, 'MANIFEST.sha256'), manifest, 'utf8');
  const receipt = {
    lane: LANE,
    closure_status: CLOSURE_STATUS,
    status: 'accepted_training_bundle',
    created_utc: new Date().toISOString(),
    training_only: true,
    no_gameplay_mutation: true,
    no_canonical_map_promotion: true,
    no_npc_behavior_change: true,
    no_collision_or_walkability_protocol_change: true,
    no_deploy: true,
    source_ref: 'original_akalynth_training_build_v1',
    bundle_dir: 'data/map-training/rookguard',
    manifest_scope: CORE_FILES,
    manifest_sha256: sha256(manifest),
    verifier: VERIFIER_REL,
    preview: 'data/map-training/rookguard/rookguard.preview.html',
    evidence_note: 'Manifest excludes receipt, manifest, and verification log to avoid self-referential hashes.',
  };
  writeFileSync(path.join(BUNDLE_DIR, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
}

function validateCore(): void {
  for (const fileName of CORE_FILES) {
    assert(existsSync(path.join(BUNDLE_DIR, fileName)), `${fileName} missing`);
  }
  const register = readJson<JsonRecord>('rookguard.asset-register.json');
  const assets = validateAssetRegister(register);
  validateTrainingRows(parseJsonl('rookguard.map-training.jsonl'), assets);
  const seed = readJson<SeedMap>('rookguard.seed-map.json');
  validateSeedMap(seed, assets);
  validateReachability(seed, assets);
  validateWaterEdges(seed, assets);
  validateRules(readJson<JsonRecord>('rookguard.asset-placement-rules.json'));
  validatePreview(seed);
  validateForbiddenTerms();
  validateNoGameplayPromotion(assets);
}

function main() {
  const writeMode = process.argv.includes('--write-receipt');
  validateCore();

  if (writeMode) {
    writeReceiptAndManifest();
  }

  const manifestSha = validateManifest();
  validateReceipt(manifestSha);

  if (!writeMode) {
    validateVerificationLog();
  }

  console.log(`[${LANE}] verification passed`);
  console.log(`[${LANE}] ${CLOSURE_STATUS}`);
}

main();
