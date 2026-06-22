#!/usr/bin/env node
/**
 * PR-003: Pack verified loose PNGs into category atlas sheets + manifest.json.
 *
 * Input:  data/assets-built/registry.json + mirrored loose PNGs
 * Output: data/assets-built/atlas/{ui,items,chronicle,world}.png
 *         data/assets-built/atlas/manifest.json
 *         patches registry.json entries with atlas UV rects
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ATLAS_DIR,
  ATLAS_PADDING,
  categorizeForAtlas,
  compositeSheet,
  resolveSpritePaths,
  shelfPack,
} from './lib/atlas-pack.mjs';
import { mirrorAtlasArtifacts } from './lib/loose-sync.mjs';
import { ASSETS_BUILT, REGISTRY_PATH } from './lib/paths.mjs';

const SHEET_FILES = {
  ui: 'ui.png',
  items: 'items.png',
  chronicle: 'chronicle.png',
  world: 'world.png',
};

function readRegistry() {
  const abs = join(ASSETS_BUILT, REGISTRY_PATH);
  const raw = readFileSync(abs, 'utf8');
  return JSON.parse(raw);
}

function patchRegistryWithAtlas(registry, atlasByAssetId) {
  let patched = 0;
  for (const entry of registry.entries) {
    const rect = atlasByAssetId.get(entry.asset_id);
    if (!rect) continue;
    entry.atlas = rect;
    patched += 1;
  }
  return patched;
}

async function buildSheetCategory(sheetKey, sheetFile, entries, atlasByAssetId, manifestSprites) {
  if (entries.length === 0) {
    console.log(`  · ${sheetFile} — skipped (0 sprites)`);
    return { sheet: sheetFile, bytes: 0, sprites: 0 };
  }

  const sprites = resolveSpritePaths(entries, sheetFile);
  const { placements, sheetW, sheetH } = shelfPack(sprites);
  const outAbs = join(ASSETS_BUILT, ATLAS_DIR, sheetFile);
  const stats = await compositeSheet(sheetFile, placements, sheetW, sheetH, outAbs);

  for (const p of placements) {
    const rect = {
      sheet: sheetFile,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
    };
    atlasByAssetId.set(p.asset_id, rect);
    manifestSprites.push({
      asset_id: p.asset_id,
      sheet: sheetFile,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      padding: ATLAS_PADDING,
    });
  }

  console.log(
    `  ✓ ${sheetFile} — ${stats.sprites} sprite(s), ${sheetW}x${sheetH}, ${(stats.bytes / 1024).toFixed(1)} KiB`,
  );
  return stats;
}

async function main() {
  const registry = readRegistry();
  const categories = categorizeForAtlas(registry.entries);
  const atlasOutDir = join(ASSETS_BUILT, ATLAS_DIR);
  mkdirSync(atlasOutDir, { recursive: true });

  /** @type {Map<string, { sheet: string, x: number, y: number, w: number, h: number }>} */
  const atlasByAssetId = new Map();
  /** @type {Array<Record<string, unknown>>} */
  const manifestSprites = [];
  const sheetStats = [];
  let totalBytes = 0;

  for (const [key, sheetFile] of Object.entries(SHEET_FILES)) {
    const stats = await buildSheetCategory(
      key,
      sheetFile,
      categories[key],
      atlasByAssetId,
      manifestSprites,
    );
    sheetStats.push(stats);
    totalBytes += stats.bytes ?? 0;
  }

  const manifest = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    max_sheet_size: 2048,
    padding_px: ATLAS_PADDING,
    filtering: 'nearest',
    sheets: sheetStats.filter((s) => s.sprites > 0),
    sprites: manifestSprites,
  };

  writeFileSync(join(atlasOutDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const patched = patchRegistryWithAtlas(registry, atlasByAssetId);
  writeFileSync(join(ASSETS_BUILT, REGISTRY_PATH), `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

  const totalMb = totalBytes / (1024 * 1024);
  console.log(
    `✓ build:atlas — ${manifestSprites.length} sprite(s) across ${manifest.sheets.length} sheet(s), ${totalMb.toFixed(2)} MiB total; patched ${patched} registry entries`,
  );

  if (totalMb > 1.5) {
    console.warn(`⚠ build:atlas — total size ${totalMb.toFixed(2)} MiB exceeds 1.5 MiB MVP budget`);
  }
  if (totalMb > 5) {
    console.error('✗ build:atlas — total size exceeds 5 MiB hard warn threshold');
    process.exit(1);
  }

  const { atlasFiles } = mirrorAtlasArtifacts();
  if (atlasFiles > 0) {
    console.log(`  mirrored atlas — ${atlasFiles} file(s) → client bundles`);
  }
}

main().catch((err) => {
  console.error(`✗ build:atlas — ${err.message}`);
  process.exit(1);
});