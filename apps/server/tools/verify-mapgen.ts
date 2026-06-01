// Verify Deterministic Map Generation (mapgen@v1) — SKELETON
//
// Invariants:
//   M-G1 determinism      same params -> byte-identical map (stableJson equal)
//   M-G2 validity         generated map passes the shared map validator
//   M-G3 seed sensitivity  changing only the seed changes the map (seed is wired)
//   M-G4 manifest binding  manifest.map_hash == recomputed hash of the map
//   M-G5 landmark seeding  output carries a house_plot so property seeding binds
//
// Run from apps/server/: `npm run verify:mapgen`
// This exercises the PURE generator only — no filesystem, no server runtime.

import {
  generateMap,
  hashMap,
  type MapGenParams,
} from '../../../tools/map-compiler/generate.js';
import { validateMapData } from '../../../packages/shared/map-validation.js';
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
  width: 24,
  height: 18,
  seed: 'verify-mapgen-0001',
  wallCount: 12,
};

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
  assert(stableJson(a.map) !== stableJson(b.map), 'map ignored the seed (identical output)');
  assert(a.manifest.map_hash !== b.manifest.map_hash, 'map_hash ignored the seed');
});

test('M-G4 manifest binding: map_hash matches recomputed hash', () => {
  const { map, manifest } = generateMap(BASE);
  assert(manifest.map_hash === hashMap(map), 'manifest.map_hash does not bind the produced map');
  assert(manifest.algorithm.endsWith('mapgen@v1'), 'manifest algorithm id not versioned');
});

test('M-G5 landmark seeding: output exposes a house_plot', () => {
  const { map } = generateMap(BASE);
  const plots = map.landmarks.house_plots ?? [];
  assert(plots.length >= 1, 'generated map has no house_plots for property seeding');
  const p = plots[0];
  assert(
    p.x > 0 && p.y > 0 && p.x < map.width - 1 && p.y < map.height - 1,
    'house_plot must sit inside the map border',
  );
});

console.log('\n✓ All mapgen tests passed');
