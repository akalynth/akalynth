// Deterministic Map Generator — STUB / SCAFFOLD (mapgen@v1)
//
// Status: scaffold. This produces a trivial, fully-deterministic room so the
// generate -> validate -> load seam can be proved end-to-end. The actual layout
// algorithm (biomes, rooms, corridors, plot placement) is a TODO. What is NOT a
// TODO and must stay intact:
//
//   1. Output is a valid `MapData` (passes `assertValidMapData`).
//   2. All randomness comes from the shared, pure RNG seeded only by `params`.
//      Same params -> byte-identical map. No `Math.random`, no wall-clock, no
//      `rngRevealHex32` (that one is non-pure crypto — fine as a commit nonce,
//      fatal as a layout source).
//   3. The seed + algorithm id + params + resulting map hash are emitted in a
//      sidecar manifest, mirroring the receipt convention used by combat
//      (`rngDeriveSeedV2->rngDrawU32Legacy/...@vN`). The manifest is the audit
//      artifact: re-run with the same params, get the same map.
//
// Per repo convention (tools/map-compiler/README.md): editors write to
// `data/world/maps-src/`, compilers emit to `data/world/maps-built/`, and the
// runtime (`apps/server` via `loadSharedMap`) consumes only built output.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { TileCode, type MapData } from '../../packages/shared/types.js';
import { assertValidMapData } from '../../packages/shared/map-validation.js';
import {
  stableJson,
  rngCommit,
  rngDeriveSeedV2,
  rngDrawU32Legacy,
} from '../../packages/shared/rng.js';

export const MAPGEN_ALGORITHM = 'rngDeriveSeedV2->rngDrawU32Legacy/mapgen@v1';
const MAPGEN_EVENT_DOMAIN = 'akalynth:mapgen:v1';

export interface MapGenParams {
  /** Becomes `MapData.name`. NOTE: the runtime `MapName` union in
   *  packages/shared/http.ts is currently closed ('Rookguard' | 'Azura').
   *  Widen it (and `isMapName` in apps/server/src/api/http.ts) before a
   *  generated map can be served as a first-class world. */
  name: string;
  width: number;
  height: number;
  /** Explicit, human-chosen seed string. This is the sole source of variation;
   *  the manifest records it so the map is reproducible. */
  seed: string;
  /** Number of interior obstacle tiles to scatter (stub knob). */
  wallCount?: number;
}

export interface MapGenManifest {
  algorithm: string;
  event_domain: string;
  params: MapGenParams;
  /** Derived seed actually fed to the draw function (audit trail). */
  derived_seed: string;
  /** sha256 over canonical JSON of the produced map. Replay re-derives the map
   *  from `params` and asserts this hash matches. */
  map_hash: string;
}

export interface MapGenResult {
  map: MapData;
  manifest: MapGenManifest;
}

/** Canonical hash of a produced map (stable key order). */
export function hashMap(map: MapData): string {
  return `sha256:${createHash('sha256').update(stableJson(map)).digest('hex')}`;
}

/**
 * Pure, deterministic map generation. No I/O, no clock, no global state.
 * Exported so `verify:mapgen` can exercise it without touching the filesystem
 * or the server runtime.
 */
export function generateMap(params: MapGenParams): MapGenResult {
  const { name, width, height, seed } = params;
  const wallCount = params.wallCount ?? 0;

  if (!Number.isInteger(width) || width <= 0) throw new Error('width must be a positive integer');
  if (!Number.isInteger(height) || height <= 0) throw new Error('height must be a positive integer');

  // Derive a single seed from the params via the shared primitives. The
  // "reveal" here is the explicit params.seed (build-time reproducible), bound
  // to the world name, a mapgen domain, and a commitment over the full params.
  const paramsCommit = rngCommit(stableJson(params));
  const derivedSeed = rngDeriveSeedV2(seed, name, MAPGEN_EVENT_DOMAIN, paramsCommit);

  // --- Stub layout: solid wall border, grass interior. ---------------------
  const tiles: number[] = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      tiles[y * width + x] = edge ? TileCode.Wall : TileCode.Grass;
    }
  }

  // --- Seeded obstacle scatter (proves randomness flows from the seed). -----
  // TODO: replace with the real layout algorithm (rooms/corridors/biomes).
  const innerW = Math.max(0, width - 2);
  const innerH = Math.max(0, height - 2);
  const innerArea = innerW * innerH;
  for (let i = 0; i < wallCount && innerArea > 0; i++) {
    const r = rngDrawU32Legacy(derivedSeed, i) % innerArea;
    const ix = 1 + (r % innerW);
    const iy = 1 + Math.floor(r / innerW);
    tiles[iy * width + ix] = TileCode.Wall;
  }

  // --- Spawn: first walkable tile, scanning from top-left interior. ---------
  let spawn = { x: 1, y: 1 };
  outer: for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y * width + x] === TileCode.Grass) {
        spawn = { x, y };
        break outer;
      }
    }
  }
  // Guarantee a walkable spawn even on degenerate dimensions.
  tiles[spawn.y * width + spawn.x] = TileCode.Grass;

  // --- Landmarks: one house plot so property seeding has something to bind.
  // index.ts:1639 seeds the property registry from landmarks.house_plots; a
  // generated zone with no landmarks has no spawns/plots/places downstream.
  const plotX = Math.min(width - 2, spawn.x + 1);
  const plotY = spawn.y;
  const map: MapData = {
    name,
    width,
    height,
    spawn,
    tiles,
    landmarks: {
      house_plots: [
        {
          id: 'H1',
          x: plotX,
          y: plotY,
          width: 1,
          height: 1,
          district: 'generated',
          primary_price_gold: 100,
        },
      ],
    },
  };

  // Hard gate: a generated map must satisfy the same validator as authored maps.
  assertValidMapData(map);

  const manifest: MapGenManifest = {
    algorithm: MAPGEN_ALGORITHM,
    event_domain: MAPGEN_EVENT_DOMAIN,
    params,
    derived_seed: derivedSeed,
    map_hash: hashMap(map),
  };

  return { map, manifest };
}

// ---------------------------------------------------------------------------
// CLI: `tsx tools/map-compiler/generate.ts --name Foo --seed bar [--width 32 ...]`
// Emits data/world/maps-built/<name>.json + <name>.mapgen.json (manifest).
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): MapGenParams {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const name = get('--name');
  const seed = get('--seed');
  if (!name || !seed) {
    throw new Error('usage: generate.ts --name <name> --seed <seed> [--width N] [--height N] [--walls N]');
  }
  return {
    name,
    seed,
    width: Number(get('--width') ?? 32),
    height: Number(get('--height') ?? 32),
    wallCount: Number(get('--walls') ?? 0),
  };
}

function main() {
  const params = parseArgs(process.argv.slice(2));
  const { map, manifest } = generateMap(params);

  const outDir = path.resolve(process.cwd(), 'data/world/maps-built');
  fs.mkdirSync(outDir, { recursive: true });
  const mapPath = path.join(outDir, `${params.name}.json`);
  const manifestPath = path.join(outDir, `${params.name}.mapgen.json`);
  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2) + '\n');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`[mapgen] wrote ${mapPath}`);
  console.log(`[mapgen] wrote ${manifestPath}`);
  console.log(`[mapgen] map_hash=${manifest.map_hash}`);
}

// Run only when invoked directly (not when imported by verify:mapgen).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
