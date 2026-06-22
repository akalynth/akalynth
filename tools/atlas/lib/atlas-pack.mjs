#!/usr/bin/env node
/**
 * Shelf bin-packer + sharp compositor for Classic 32 atlas sheets (PR-003).
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ASSETS_BUILT } from './paths.mjs';
import { isMvpRookguardWorldAsset, worldShortIdFromAssetId } from './world-asset-ids.mjs';

export const ATLAS_DIR = 'atlas';
export const MAX_SHEET_SIZE = 2048;
export const ATLAS_PADDING = 2;

/**
 * @typedef {{ asset_id: string, file: string, frame: { w: number, h: number } }} RegistryEntry
 */

/**
 * Group registry entries into atlas sheets per design doc Layer 2.
 * @param {RegistryEntry[]} entries
 * @returns {Record<string, RegistryEntry[]>}
 */
export function categorizeForAtlas(entries) {
  const sheets = {
    ui: [],
    items: [],
    chronicle: [],
    world: [],
  };

  for (const entry of entries) {
    if (entry.source === 'ui_pack') {
      sheets.ui.push(entry);
      continue;
    }
    if (entry.asset_type === 'item') {
      sheets.items.push(entry);
      continue;
    }
    if (entry.chronicle_kind) {
      sheets.chronicle.push(entry);
      continue;
    }
    if (entry.source === 'world_sidecar' && isMvpRookguardWorldAsset(entry.asset_id)) {
      sheets.world.push(entry);
    }
  }

  for (const [name, list] of Object.entries(sheets)) {
    list.sort((a, b) => a.asset_id.localeCompare(b.asset_id));
  }
  return sheets;
}

/**
 * Simple shelf packer with fixed padding.
 * @param {{ asset_id: string, w: number, h: number, absPath: string }[]} sprites
 */
export function shelfPack(sprites, maxSize = MAX_SHEET_SIZE, padding = ATLAS_PADDING) {
  const sorted = [...sprites].sort((a, b) => b.h - a.h || b.w - a.w);
  /** @type {Array<{ asset_id: string, w: number, h: number, absPath: string, x: number, y: number }>} */
  const placements = [];
  let cursorX = padding;
  let cursorY = padding;
  let rowHeight = 0;

  for (const sprite of sorted) {
    const needW = sprite.w + padding;
    if (cursorX + needW > maxSize) {
      cursorX = padding;
      cursorY += rowHeight + padding;
      rowHeight = 0;
    }
    if (cursorY + sprite.h + padding > maxSize) {
      throw new Error(
        `Atlas sheet overflow at ${sprite.asset_id} (${sprite.w}x${sprite.h}); increase MAX_SHEET_SIZE or split sheet`,
      );
    }
    placements.push({ ...sprite, x: cursorX, y: cursorY });
    cursorX += sprite.w + padding;
    rowHeight = Math.max(rowHeight, sprite.h);
  }

  const sheetW = Math.min(
    maxSize,
    Math.max(...placements.map((p) => p.x + p.w), 0) + padding,
  );
  const sheetH = Math.min(
    maxSize,
    Math.max(...placements.map((p) => p.y + p.h), 0) + padding,
  );

  return { placements, sheetW, sheetH };
}

/**
 * @param {string} sheetName e.g. ui.png
 * @param {ReturnType<shelfPack>['placements']} placements
 * @param {string} outAbs absolute output path
 */
export async function compositeSheet(sheetName, placements, sheetW, sheetH, outAbs) {
  if (placements.length === 0) return { sheet: sheetName, bytes: 0, sprites: 0 };

  const composites = [];
  for (const p of placements) {
    const input = await sharp(p.absPath)
      .ensureAlpha()
      .png()
      .toBuffer();
    composites.push({ input, left: p.x, top: p.y });
  }

  await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, palette: false })
    .toFile(outAbs);

  const bytes = statSync(outAbs).size;
  return {
    sheet: sheetName,
    bytes,
    sprites: placements.length,
    width: sheetW,
    height: sheetH,
  };
}

/**
 * @param {RegistryEntry[]} entries
 * @param {string} sheetFile e.g. ui.png
 */
export function resolveSpritePaths(entries, sheetFile) {
  return entries.map((entry) => {
    const absPath = join(ASSETS_BUILT, entry.file);
    if (!existsSync(absPath)) {
      throw new Error(`Missing built PNG for atlas pack: ${entry.file} (${entry.asset_id})`);
    }
    return {
      asset_id: entry.asset_id,
      w: entry.frame.w,
      h: entry.frame.h,
      absPath,
      sheet: sheetFile,
      shortId: entry.source === 'world_sidecar' ? worldShortIdFromAssetId(entry.asset_id) : undefined,
    };
  });
}