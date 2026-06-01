// Deterministic Map Generator (mapgen@v1)
//
// A real, deterministic layout generator: bordered field, rectangular districts
// (paved), L-shaped roads connecting them, a spawn in a commons district, a gate
// landmark, non-overlapping house plots in a residential district, and
// reachability-preserving decor. Invariants that must stay intact:
//
//   1. Output is a valid `MapData` (passes `assertValidMapData`).
//   2. All randomness comes from the shared, pure RNG seeded only by `params`.
//      Same params -> byte-identical map AND SVG. No `Math.random`, no wall-clock,
//      no `crypto.randomUUID`, no filesystem/iteration-order authority.
//   3. Phase-derived streams: each generation phase ("districts", "roads", ...)
//      gets its own deterministic stream off the root seed, so changing one phase
//      does not destabilise the others.
//   4. The seed + algorithm id + normalized params + map_hash + svg_hash are
//      emitted in a sidecar manifest. Re-run with the same params -> same bytes.
//
// This is mapgen@v1: a useful deterministic layout, NOT a canonical world, NOT
// gameplay-balanced, NOT production-ready. Per repo convention, compilers emit to
// `data/world/maps-built/` (gitignored, generated); the runtime consumes built
// output only.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { TileCode, WALKABLE_TILES, type MapData } from '../../packages/shared/types.js';
import { assertValidMapData } from '../../packages/shared/map-validation.js';
import { stableJson, rngCommit, rngDeriveSeedV2, rngDrawU32Legacy } from '../../packages/shared/rng.js';

export const MAPGEN_ALGORITHM = 'rngDeriveSeedV2->rngDrawU32Legacy/mapgen@v1';
const MAPGEN_EVENT_DOMAIN = 'akalynth:mapgen:v1';

export type Biome = 'azura' | 'grassland' | 'stonehold';
const BIOMES: Biome[] = ['azura', 'grassland', 'stonehold'];

export interface MapGenParams {
  /** Becomes `MapData.name`. */
  name: string;
  /** Explicit, human-chosen seed string — the sole source of variation. */
  seed: string;
  width: number;
  height: number;
  /** House plots placed in the residential district (default 3). */
  housePlotCount?: number;
  /** Rectangular districts (default derived from area; clamped 3..6). */
  districtCount?: number;
  /** Flavor: floor + decor mix (default 'azura'). */
  biome?: Biome;
}

/** Params with every default resolved — this is what gets hashed and recorded. */
export interface NormalizedMapGenParams {
  name: string;
  seed: string;
  width: number;
  height: number;
  housePlotCount: number;
  districtCount: number;
  biome: Biome;
}

export interface MapGenManifest {
  algorithm: string;
  event_domain: string;
  /** Normalized params (all defaults resolved) — the reproducible input. */
  params: NormalizedMapGenParams;
  derived_seed: string;
  /** sha256 over canonical JSON of the produced map. */
  map_hash: string;
  /** sha256 over the deterministic SVG render of the map (byte-stable). */
  svg_hash: string;
}

export interface MapGenResult {
  map: MapData;
  manifest: MapGenManifest;
  svg: string;
}

// ============================================================================
// Hashing
// ============================================================================

export function hashMap(map: MapData): string {
  return `sha256:${createHash('sha256').update(stableJson(map)).digest('hex')}`;
}
export function hashSvg(svg: string): string {
  return `sha256:${createHash('sha256').update(svg).digest('hex')}`;
}

// ============================================================================
// Deterministic phase RNG
// ============================================================================
// Each phase gets a stream derived from (seed, name, domain:phase, paramsCommit).
// Draws are counter-indexed via the shared rngDrawU32Legacy — pure, no entropy.

class PhaseRng {
  private i = 0;
  constructor(private readonly seed: string) {}
  u32(): number {
    return rngDrawU32Legacy(this.seed, this.i++);
  }
  /** Uniform integer in [0, n). */
  int(n: number): number {
    return n <= 0 ? 0 : this.u32() % n;
  }
  /** Uniform integer in [min, max] inclusive. */
  range(min: number, max: number): number {
    return max <= min ? min : min + this.int(max - min + 1);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
  /** True with probability num/den (deterministic). */
  chance(num: number, den: number): boolean {
    return this.int(den) < num;
  }
}

// ============================================================================
// Geometry / reachability helpers (pure)
// ============================================================================

const idx = (x: number, y: number, w: number): number => y * w + x;

interface Rect { x: number; y: number; width: number; height: number; }
type DistrictKind = 'commons' | 'residential' | 'gate' | 'harbor' | 'market';
interface District extends Rect { id: number; kind: DistrictKind; }

const centerOf = (r: Rect) => ({ x: r.x + Math.floor(r.width / 2), y: r.y + Math.floor(r.height / 2) });

/** Reachable walkable set from (sx,sy) over 4-neighbours. Result is a set, so
 *  traversal order does not affect output (no ordering authority). */
function reachableFrom(tiles: number[], w: number, h: number, sx: number, sy: number): Uint8Array {
  const seen = new Uint8Array(w * h);
  const start = idx(sx, sy, w);
  if (!WALKABLE_TILES.has(tiles[start])) return seen;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const c = stack.pop() as number;
    const cx = c % w;
    const cy = (c - cx) / w;
    const neigh = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of neigh) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny, w);
      if (seen[ni] || !WALKABLE_TILES.has(tiles[ni])) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}

/** First walkable in-bounds neighbour of (x,y), or null. */
function walkableNeighbor(tiles: number[], w: number, h: number, x: number, y: number): { x: number; y: number } | null {
  for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    if (WALKABLE_TILES.has(tiles[idx(nx, ny, w)])) return { x: nx, y: ny };
  }
  return null;
}

// ============================================================================
// SVG render (deterministic; byte-stable)
// ============================================================================

const TILE_PX = 12;
const TILE_FILL: Record<number, string> = {
  [TileCode.Grass]: '#4a7c3a',
  [TileCode.Stone]: '#9a9488',
  [TileCode.Wall]: '#3a2c1a',
  [TileCode.Water]: '#3a6ea5',
  [TileCode.Door]: '#b5862f',
  [TileCode.TutorialMove]: '#6fae5a',
  [TileCode.TutorialChat]: '#6f9fd8',
  [TileCode.TutorialTem]: '#d9a23a',
  [TileCode.GateToAzura]: '#b060c0',
};
const TILE_FILL_UNKNOWN = '#ff00ff';

/** Deterministic SVG: one rect per tile (y,x order), plot outlines, spawn marker.
 *  Pure; same map -> byte-identical string. Even TILE_PX keeps coords integral. */
export function renderMapSvg(map: MapData): string {
  const ts = TILE_PX;
  const w = map.width * ts;
  const h = map.height * ts;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">`
  );
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const code = map.tiles[y * map.width + x];
      const fill = TILE_FILL[code] ?? TILE_FILL_UNKNOWN;
      parts.push(`<rect x="${x * ts}" y="${y * ts}" width="${ts}" height="${ts}" fill="${fill}"/>`);
    }
  }
  for (const p of map.landmarks.house_plots ?? []) {
    parts.push(
      `<rect x="${p.x * ts}" y="${p.y * ts}" width="${p.width * ts}" height="${p.height * ts}" fill="none" stroke="#f0d07f" stroke-width="2"/>`
    );
  }
  parts.push(
    `<circle cx="${map.spawn.x * ts + ts / 2}" cy="${map.spawn.y * ts + ts / 2}" r="${ts / 3}" fill="#e23b3b"/>`
  );
  parts.push('</svg>');
  return parts.join('\n') + '\n';
}

// ============================================================================
// Normalization
// ============================================================================

function defaultDistrictCount(innerArea: number): number {
  if (innerArea < 700) return 3;
  if (innerArea < 1300) return 4;
  if (innerArea < 2200) return 5;
  return 6;
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

function normalize(params: MapGenParams): NormalizedMapGenParams {
  const { name, seed, width, height } = params;
  if (!name) throw new Error('name is required');
  if (!seed) throw new Error('seed is required');
  if (!Number.isInteger(width) || width <= 0) throw new Error('width must be a positive integer');
  if (!Number.isInteger(height) || height <= 0) throw new Error('height must be a positive integer');
  // Need room for >=3 districts on a grid with >=5x5 cells inside the border.
  if (width < 16 || height < 16) throw new Error('mapgen@v1 needs width and height >= 16');

  const innerArea = (width - 2) * (height - 2);
  const districtCount = clampInt(params.districtCount ?? defaultDistrictCount(innerArea), 3, 6);
  const housePlotCount = clampInt(params.housePlotCount ?? 3, 1, 8);
  const biome: Biome = params.biome && BIOMES.includes(params.biome) ? params.biome : 'azura';

  return { name, seed, width, height, housePlotCount, districtCount, biome };
}

// ============================================================================
// Generation
// ============================================================================

export function generateMap(rawParams: MapGenParams): MapGenResult {
  const params = normalize(rawParams);
  const { name, seed, width, height, biome } = params;

  // Root commitment + per-phase streams.
  const paramsCommit = rngCommit(stableJson(params));
  const derivedSeed = rngDeriveSeedV2(seed, name, MAPGEN_EVENT_DOMAIN, paramsCommit);
  const stream = (phase: string): PhaseRng =>
    new PhaseRng(rngDeriveSeedV2(seed, name, `${MAPGEN_EVENT_DOMAIN}:${phase}`, paramsCommit));

  const floorTile = biome === 'grassland' ? TileCode.Grass : TileCode.Stone;

  // --- Phase: bordered base field -----------------------------------------
  const tiles: number[] = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      tiles[idx(x, y, width)] = edge ? TileCode.Wall : TileCode.Grass;
    }
  }

  // --- Phase: districts (deterministic grid; never retries forever) --------
  const dr = stream('districts');
  const cols = Math.ceil(Math.sqrt(params.districtCount));
  const rows = Math.ceil(params.districtCount / cols);
  const cellW = Math.floor((width - 2) / cols);
  const cellH = Math.floor((height - 2) / rows);
  const districts: District[] = [];
  for (let i = 0; i < params.districtCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = 1 + col * cellW;
    const cellY = 1 + row * cellH;
    // Leave a 1-tile margin inside each cell so districts never touch/overlap.
    const maxW = Math.max(3, cellW - 2);
    const maxH = Math.max(3, cellH - 2);
    const dw = dr.range(Math.min(3, maxW), maxW);
    const dh = dr.range(Math.min(3, maxH), maxH);
    const dx = cellX + 1 + dr.int(Math.max(1, maxW - dw + 1));
    const dy = cellY + 1 + dr.int(Math.max(1, maxH - dh + 1));
    // Required kinds: [0]=commons (spawn), [1]=residential (houses), last=gate.
    let kind: DistrictKind = 'commons';
    if (i === 1) kind = 'residential';
    else if (i === params.districtCount - 1) kind = 'gate';
    else if (i > 1) kind = dr.pick(['harbor', 'market', 'commons'] as const);
    districts.push({ id: i, kind, x: dx, y: dy, width: dw, height: dh });
  }

  // Paint district floors (paved → visually distinct from grass).
  for (const d of districts) {
    for (let y = d.y; y < d.y + d.height; y++) {
      for (let x = d.x; x < d.x + d.width; x++) {
        tiles[idx(x, y, width)] = floorTile;
      }
    }
  }

  // --- Phase: roads (L-shaped corridors between district centers) ----------
  const rr = stream('roads');
  const carveH = (x0: number, x1: number, y: number) => {
    const [a, b] = x0 <= x1 ? [x0, x1] : [x1, x0];
    for (let x = a; x <= b; x++) if (tiles[idx(x, y, width)] !== TileCode.Wall) tiles[idx(x, y, width)] = TileCode.Stone;
  };
  const carveV = (y0: number, y1: number, x: number) => {
    const [a, b] = y0 <= y1 ? [y0, y1] : [y1, y0];
    for (let y = a; y <= b; y++) if (tiles[idx(x, y, width)] !== TileCode.Wall) tiles[idx(x, y, width)] = TileCode.Stone;
  };
  for (let i = 0; i + 1 < districts.length; i++) {
    const a = centerOf(districts[i]);
    const b = centerOf(districts[i + 1]);
    if (rr.chance(1, 2)) {
      carveH(a.x, b.x, a.y);
      carveV(a.y, b.y, b.x);
    } else {
      carveV(a.y, b.y, a.x);
      carveH(a.x, b.x, b.y);
    }
  }

  // --- Phase: spawn (commons district center) ------------------------------
  const commons = districts.find((d) => d.kind === 'commons') ?? districts[0];
  const spawn = centerOf(commons);
  tiles[idx(spawn.x, spawn.y, width)] = floorTile; // ensure walkable

  // --- Phase: gate landmark (gate district center) -------------------------
  const gateDistrict = districts.find((d) => d.kind === 'gate') ?? districts[districts.length - 1];
  const gate = centerOf(gateDistrict);
  tiles[idx(gate.x, gate.y, width)] = TileCode.GateToAzura;

  // --- Phase: house plots (residential district; non-overlapping) ----------
  const hr = stream('houses');
  const residential = districts.find((d) => d.kind === 'residential') ?? districts[1];
  const housePlots: NonNullable<MapData['landmarks']['house_plots']> = [];
  // Lay plots on a coarse grid inside the residential interior (spacing 2 so each
  // plot has a walkable gap/access tile around it).
  const startX = residential.x + 1;
  const startY = residential.y + 1;
  const stepX = 2;
  const stepY = 2;
  const taken = new Set<number>();
  let placed = 0;
  for (let py = startY; py < residential.y + residential.height - 1 && placed < params.housePlotCount; py += stepY) {
    for (let px = startX; px < residential.x + residential.width - 1 && placed < params.housePlotCount; px += stepX) {
      // Never sit on spawn or the gate tile.
      if ((px === spawn.x && py === spawn.y) || (px === gate.x && py === gate.y)) continue;
      taken.add(idx(px, py, width));
      placed++;
      housePlots.push({
        id: `H${placed}`,
        x: px,
        y: py,
        width: 1,
        height: 1,
        district: residential.kind,
        primary_price_gold: 100 * placed,
      });
    }
  }
  // Deterministic fallback: if the residential grid was too small, place the
  // remaining plots on the next free interior floor tiles (scan order is fixed).
  for (let y = 1; y < height - 1 && placed < params.housePlotCount; y++) {
    for (let x = 1; x < width - 1 && placed < params.housePlotCount; x++) {
      const i = idx(x, y, width);
      if (taken.has(i)) continue;
      if ((x === spawn.x && y === spawn.y) || (x === gate.x && y === gate.y)) continue;
      if (!WALKABLE_TILES.has(tiles[i])) continue;
      taken.add(i);
      placed++;
      housePlots.push({ id: `H${placed}`, x, y, width: 1, height: 1, district: 'residential', primary_price_gold: 100 * placed });
    }
  }

  // --- Phase: decor (reachability-preserving obstacles) --------------------
  // Required reachability anchors: gate + a walkable access neighbour per plot.
  const anchors: Array<{ x: number; y: number }> = [gate];
  for (const p of housePlots) {
    const acc = walkableNeighbor(tiles, width, height, p.x, p.y);
    if (acc) anchors.push(acc);
  }
  const stillConnected = (): boolean => {
    const seen = reachableFrom(tiles, width, height, spawn.x, spawn.y);
    return anchors.every((a) => seen[idx(a.x, a.y, width)] === 1);
  };

  const er = stream('decor');
  const innerArea = (width - 2) * (height - 2);
  const attempts = Math.floor(innerArea * 0.08);
  const protectedTiles = new Set<number>([idx(spawn.x, spawn.y, width), idx(gate.x, gate.y, width)]);
  for (const p of housePlots) protectedTiles.add(idx(p.x, p.y, width));
  for (const a of anchors) protectedTiles.add(idx(a.x, a.y, width));
  for (let i = 0; i < attempts; i++) {
    const x = 1 + er.int(width - 2);
    const y = 1 + er.int(height - 2);
    const ti = idx(x, y, width);
    if (protectedTiles.has(ti)) continue;
    if (!WALKABLE_TILES.has(tiles[ti])) continue; // already blocked
    const prev = tiles[ti];
    // azura gets occasional water; everything else is wall-like cover.
    const obstacle = biome === 'azura' && er.chance(1, 4) ? TileCode.Water : TileCode.Wall;
    tiles[ti] = obstacle;
    if (!stillConnected()) tiles[ti] = prev; // reject: would cut reachability
  }

  // --- Phase: validation / repair ------------------------------------------
  if (!stillConnected()) {
    // Decor is accept-if-reachable, so this should be unreachable; surface it
    // loudly rather than emit a disconnected map.
    throw new Error('mapgen invariant violated: required anchors unreachable after generation');
  }

  const map: MapData = {
    name,
    width,
    height,
    spawn,
    tiles,
    landmarks: { house_plots: housePlots },
  };

  // Hard gate: a generated map must satisfy the same validator as authored maps.
  assertValidMapData(map);

  const svg = renderMapSvg(map);
  const manifest: MapGenManifest = {
    algorithm: MAPGEN_ALGORITHM,
    event_domain: MAPGEN_EVENT_DOMAIN,
    params,
    derived_seed: derivedSeed,
    map_hash: hashMap(map),
    svg_hash: hashSvg(svg),
  };

  return { map, manifest, svg };
}

// ---------------------------------------------------------------------------
// CLI: tsx tools/map-compiler/generate.ts --name Foo --seed bar [--width 48 ...]
// Emits data/world/maps-built/<name>.{json,mapgen.json,svg} (gitignored output).
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): MapGenParams {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const name = get('--name');
  const seed = get('--seed');
  if (!name || !seed) {
    throw new Error(
      'usage: generate.ts --name <name> --seed <seed> [--width N] [--height N] [--houses N] [--districts N] [--biome azura|grassland|stonehold]'
    );
  }
  const biomeArg = get('--biome') as Biome | undefined;
  return {
    name,
    seed,
    width: Number(get('--width') ?? 48),
    height: Number(get('--height') ?? 32),
    housePlotCount: get('--houses') !== undefined ? Number(get('--houses')) : undefined,
    districtCount: get('--districts') !== undefined ? Number(get('--districts')) : undefined,
    biome: biomeArg,
  };
}

function main() {
  const params = parseArgs(process.argv.slice(2));
  const { map, manifest, svg } = generateMap(params);

  const outDir = path.resolve(process.cwd(), 'data/world/maps-built');
  fs.mkdirSync(outDir, { recursive: true });
  const mapPath = path.join(outDir, `${manifest.params.name}.json`);
  const manifestPath = path.join(outDir, `${manifest.params.name}.mapgen.json`);
  const svgPath = path.join(outDir, `${manifest.params.name}.svg`);
  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2) + '\n');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(svgPath, svg);

  console.log(`[mapgen] wrote ${mapPath}`);
  console.log(`[mapgen] wrote ${manifestPath}`);
  console.log(`[mapgen] wrote ${svgPath}`);
  console.log(`[mapgen] districts=${manifest.params.districtCount} houses=${manifest.params.housePlotCount} biome=${manifest.params.biome}`);
  console.log(`[mapgen] map_hash=${manifest.map_hash}`);
  console.log(`[mapgen] svg_hash=${manifest.svg_hash}`);
}

// Run only when invoked directly (not when imported by verify:mapgen).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
