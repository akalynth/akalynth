// Verify Deterministic Map Generation (mapgen@v1)
//
// Invariants:
//   M-G1  determinism      same params -> byte-identical map (stableJson equal)
//   M-G2  validity         generated map passes the shared map validator
//   M-G3  seed sensitivity  changing only the seed changes the map
//   M-G4  manifest binding  manifest.map_hash == recomputed hash of the map
//   M-G5  landmark seeding  output carries the requested house plots
//   M-G6  svg determinism   same params -> byte-identical SVG
//   M-G7  svg binding       manifest.svg_hash == hashSvg(renderMapSvg(map))
//   M-G8  layout usefulness  districts/roads/gate present; blocked + walkable mix
//   M-G9  reachability       spawn reaches gate + an access tile of every plot
//   M-G10 house plot validity  count, in-bounds, no overlap, off spawn/gate, access
//   M-G11 phase stability    same params -> identical map + svg + both hashes
//   M-G12 seed materiality   changed seed -> different map + svg + both hashes
//   M-G13 no hidden entropy  generator source has no Math.random/Date.now/etc.
//   M-G14 validator gate     generateMap output passes assertValidMapData
//
// Run from apps/server/: `npm run verify:mapgen`. Pure generator only.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  generateMap,
  hashMap,
  hashSvg,
  renderMapSvg,
  type MapGenParams,
} from '../../../tools/map-compiler/generate.js';
import { validateMapData, assertValidMapData } from '../../../packages/shared/map-validation.js';
import { TileCode, WALKABLE_TILES, type MapData } from '../../../packages/shared/types.js';
import { stableJson } from '../../../packages/shared/rng.js';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err}`);
    process.exit(1);
  }
}
function assert(condition: unknown, msg: string) {
  if (!condition) throw new Error(msg);
}

const BASE: MapGenParams = {
  name: 'GenTest',
  seed: 'verify-mapgen-0001',
  width: 48,
  height: 32,
  housePlotCount: 3,
  districtCount: 4,
  biome: 'azura',
};

// --- Independent reachability (does NOT reuse the generator's own helper) ---
function reachable(map: MapData): Uint8Array {
  const { width: w, height: h, tiles, spawn } = map;
  const seen = new Uint8Array(w * h);
  const start = spawn.y * w + spawn.x;
  if (!WALKABLE_TILES.has(tiles[start])) return seen;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const c = stack.pop() as number;
    const cx = c % w;
    const cy = (c - cx) / w;
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (seen[ni] || !WALKABLE_TILES.has(tiles[ni])) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}
function count(tiles: number[], code: number): number {
  let n = 0;
  for (const t of tiles) if (t === code) n++;
  return n;
}
function findGate(map: MapData): { x: number; y: number } {
  const i = map.tiles.indexOf(TileCode.GateToAzura);
  return { x: i % map.width, y: Math.floor(i / map.width) };
}

test('M-G1 determinism: same params -> identical map', () => {
  const a = generateMap(BASE);
  const b = generateMap({ ...BASE });
  assert(stableJson(a.map) === stableJson(b.map), 'maps differ for identical params');
  assert(a.manifest.map_hash === b.manifest.map_hash, 'map_hash differs for identical params');
  assert(a.manifest.derived_seed === b.manifest.derived_seed, 'derived_seed not deterministic');
});

test('M-G2 validity: generated map passes the shared validator', () => {
  const { map } = generateMap(BASE);
  const result = validateMapData(map);
  assert(result.ok, `validator rejected generated map: ${result.errors.join('; ')}`);
});

test('M-G3 seed sensitivity: different seed -> different map', () => {
  const a = generateMap(BASE);
  const b = generateMap({ ...BASE, seed: 'verify-mapgen-0002' });
  assert(stableJson(a.map) !== stableJson(b.map), 'map ignored the seed');
  assert(a.manifest.map_hash !== b.manifest.map_hash, 'map_hash ignored the seed');
});

test('M-G4 manifest binding: map_hash matches recomputed hash', () => {
  const { map, manifest } = generateMap(BASE);
  assert(manifest.map_hash === hashMap(map), 'manifest.map_hash does not bind the produced map');
  assert(manifest.algorithm.endsWith('mapgen@v1'), 'manifest algorithm id not versioned');
});

test('M-G5 landmark seeding: output exposes the requested house plots', () => {
  const { map } = generateMap(BASE);
  const plots = map.landmarks.house_plots ?? [];
  assert(plots.length === BASE.housePlotCount, `expected ${BASE.housePlotCount} plots, got ${plots.length}`);
});

test('M-G6 svg determinism: same params -> identical SVG', () => {
  const a = generateMap(BASE);
  const b = generateMap({ ...BASE });
  assert(a.svg === b.svg, 'SVG differs for identical params');
  assert(a.manifest.svg_hash === b.manifest.svg_hash, 'svg_hash differs for identical params');
});

test('M-G7 svg binding: svg_hash binds renderMapSvg(map); well-formed SVG', () => {
  const { map, svg, manifest } = generateMap(BASE);
  assert(svg === renderMapSvg(map), 'result.svg differs from a fresh render');
  assert(manifest.svg_hash === hashSvg(svg), 'manifest.svg_hash does not bind result.svg');
  assert(svg.startsWith('<svg') && svg.trimEnd().endsWith('</svg>'), 'not a well-formed SVG document');
});

test('M-G8 layout usefulness: districts/roads + gate + blocked/walkable mix', () => {
  const { map } = generateMap(BASE);
  const stone = count(map.tiles, TileCode.Stone);
  const gates = count(map.tiles, TileCode.GateToAzura);
  const walls = count(map.tiles, TileCode.Wall);
  const interior = (map.width - 2) * (map.height - 2);
  let walkable = 0;
  for (const t of map.tiles) if (WALKABLE_TILES.has(t)) walkable++;
  assert(stone > 20, `expected paved districts/roads (Stone), got ${stone}`);
  assert(gates === 1, `expected exactly one gate, got ${gates}`);
  assert(walls > (map.width + map.height) * 2, 'no interior blocked tiles beyond the border');
  assert(walkable > interior * 0.3, 'walkable space is trivially small');
  assert(walkable < map.width * map.height, 'everything is walkable (no structure)');
});

test('M-G9 reachability: spawn reaches gate + every plot access tile', () => {
  const { map } = generateMap(BASE);
  const seen = reachable(map);
  const gate = findGate(map);
  assert(seen[gate.y * map.width + gate.x] === 1, 'gate not reachable from spawn');
  for (const p of map.landmarks.house_plots ?? []) {
    let ok = false;
    for (const [nx, ny] of [[p.x + 1, p.y], [p.x - 1, p.y], [p.x, p.y + 1], [p.x, p.y - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      if (seen[ny * map.width + nx] === 1) { ok = true; break; }
    }
    assert(ok, `plot ${p.id} has no reachable access tile`);
  }
});

test('M-G10 house plot validity: count/bounds/overlap/placement', () => {
  const { map } = generateMap(BASE);
  const plots = map.landmarks.house_plots ?? [];
  assert(plots.length === BASE.housePlotCount, 'plot count mismatch');
  const occupied = new Set<number>();
  const gate = findGate(map);
  for (const p of plots) {
    assert(p.x > 0 && p.y > 0 && p.x + p.width <= map.width - 1 && p.y + p.height <= map.height - 1, `plot ${p.id} out of bounds`);
    for (let y = p.y; y < p.y + p.height; y++) {
      for (let x = p.x; x < p.x + p.width; x++) {
        const i = y * map.width + x;
        assert(!occupied.has(i), `plot ${p.id} overlaps another plot`);
        occupied.add(i);
        assert(!(x === map.spawn.x && y === map.spawn.y), `plot ${p.id} overlaps spawn`);
        assert(!(x === gate.x && y === gate.y), `plot ${p.id} overlaps gate`);
      }
    }
  }
});

test('M-G11 phase stability: same params -> identical map + svg + hashes', () => {
  const a = generateMap(BASE);
  const b = generateMap({ ...BASE });
  assert(stableJson(a.map) === stableJson(b.map), 'map not stable');
  assert(a.svg === b.svg, 'svg not stable');
  assert(a.manifest.map_hash === b.manifest.map_hash && a.manifest.svg_hash === b.manifest.svg_hash, 'hashes not stable');
});

test('M-G12 seed materiality: changed seed -> different map + svg + hashes', () => {
  const a = generateMap(BASE);
  const b = generateMap({ ...BASE, seed: 'verify-mapgen-0003' });
  assert(stableJson(a.map) !== stableJson(b.map), 'map unchanged by seed');
  assert(a.svg !== b.svg, 'svg unchanged by seed');
  assert(a.manifest.map_hash !== b.manifest.map_hash, 'map_hash unchanged by seed');
  assert(a.manifest.svg_hash !== b.manifest.svg_hash, 'svg_hash unchanged by seed');
});

test('M-G13 no hidden entropy in the generator source', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../../../tools/map-compiler/generate.ts', import.meta.url)),
    'utf8'
  );
  // Strip comments first so the header's "no Math.random / crypto.randomUUID"
  // disclaimer is not a false positive; then assert the bare identifiers.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const banned of ['Math.random', 'Date.now', 'performance.now', 'crypto.randomUUID']) {
    assert(!code.includes(banned), `generator source contains forbidden entropy: ${banned}`);
  }
});

test('M-G14 validator gate: generateMap output passes assertValidMapData', () => {
  const { map } = generateMap(BASE);
  assertValidMapData(map); // throws on failure
  // a couple of other sizes/biomes to exercise normalization
  assertValidMapData(generateMap({ name: 'G2', seed: 's2', width: 24, height: 18, biome: 'grassland' }).map);
  assertValidMapData(generateMap({ name: 'G3', seed: 's3', width: 64, height: 40, housePlotCount: 6, districtCount: 6, biome: 'stonehold' }).map);
});

console.log('\n✓ All mapgen tests passed');
