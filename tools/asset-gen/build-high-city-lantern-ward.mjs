#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const ROOT = new URL('../../', import.meta.url).pathname;
const OUT_DIR = join(ROOT, 'data/assets-src/sprites/world/high_city');
const STYLE_CONTRACT = 'nostalgic_top_down_mmo_readability_original_akalynth_assets_v1';

const assets = [
  {
    id: 'high_city_lantern_post',
    width: 32,
    height: 64,
    promptFile: 'data/assets-src/prompts/world/high_city_lantern_post_001.txt',
    notes: ['Lantern Ward brass post with pale civic lantern. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 58] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: drawLanternPost,
  },
  {
    id: 'high_city_sigil_banner_blue',
    width: 32,
    height: 64,
    promptFile: 'data/assets-src/prompts/world/high_city_sigil_banner_blue_001.txt',
    notes: ['High City civic sigil banner, blue field. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 58] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: (c) => drawSigilBanner(c, 'blue'),
  },
  {
    id: 'high_city_sigil_banner_red',
    width: 32,
    height: 64,
    promptFile: 'data/assets-src/prompts/world/high_city_sigil_banner_red_001.txt',
    notes: ['High City civic sigil banner, red field. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 58] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: (c) => drawSigilBanner(c, 'red'),
  },
  {
    id: 'high_city_crystal_fountain',
    width: 32,
    height: 64,
    promptFile: 'data/assets-src/prompts/world/high_city_crystal_fountain_001.txt',
    notes: ['Crystal civic fountain for arrival spine and plaza. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 58] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: drawCrystalFountain,
  },
  {
    id: 'high_city_half_timber_wall_n',
    width: 32,
    height: 32,
    promptFile: 'data/assets-src/prompts/world/high_city_half_timber_wall_n_001.txt',
    notes: ['Half-timber north wall segment. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'tile_top_left', source_pixels: [0, 0] },
      z_policy: 'fixed_layer',
      layer: 'object_overlay',
    },
    draw: drawHalfTimberWallN,
  },
  {
    id: 'high_city_clay_roof_overlay',
    width: 32,
    height: 32,
    promptFile: 'data/assets-src/prompts/world/high_city_clay_roof_overlay_001.txt',
    notes: ['Terracotta clay roof overlay tile. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'tile_top_left', source_pixels: [0, 0] },
      z_policy: 'fixed_above_building',
      layer: 'object_overlay',
    },
    draw: drawClayRoofOverlay,
  },
  {
    id: 'high_city_plot_stake',
    width: 32,
    height: 32,
    promptFile: 'data/assets-src/prompts/world/high_city_plot_stake_001.txt',
    notes: ['House plot claim stake with small placard. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 28] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: drawPlotStake,
  },
  {
    id: 'high_city_cobble_var_02',
    width: 32,
    height: 32,
    promptFile: 'data/assets-src/prompts/world/high_city_cobble_var_02_001.txt',
    notes: ['Warm cobble floor variant for Lantern Ward spine. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'tile_top_left', source_pixels: [0, 0] },
      z_policy: 'fixed_layer',
      layer: 'floor_overlay',
    },
    draw: (c) => drawCobbleVar(c, 2),
  },
  {
    id: 'high_city_cobble_var_03',
    width: 32,
    height: 32,
    promptFile: 'data/assets-src/prompts/world/high_city_cobble_var_03_001.txt',
    notes: ['Warm cobble floor variant with moss seam. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'tile_top_left', source_pixels: [0, 0] },
      z_policy: 'fixed_layer',
      layer: 'floor_overlay',
    },
    draw: (c) => drawCobbleVar(c, 3),
  },
  {
    id: 'high_city_witness_lantern',
    width: 32,
    height: 64,
    promptFile: 'data/assets-src/prompts/world/high_city_witness_lantern_001.txt',
    notes: ['Hanging witness lantern for civic notices. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 58] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: drawWitnessLantern,
  },
  {
    id: 'high_city_merchant_crate',
    width: 32,
    height: 32,
    promptFile: 'data/assets-src/prompts/world/high_city_merchant_crate_001.txt',
    notes: ['Market merchant crate with cloth cover. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 28] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: drawMerchantCrate,
  },
  {
    id: 'high_city_temple_brazier',
    width: 32,
    height: 64,
    promptFile: 'data/assets-src/prompts/world/high_city_temple_brazier_001.txt',
    notes: ['Temple steps stone brazier with flame. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 58] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: drawTempleBrazier,
  },
  {
    id: 'high_city_grass_edge',
    width: 32,
    height: 32,
    promptFile: 'data/assets-src/prompts/world/high_city_grass_edge_001.txt',
    notes: ['Grass edge transition for outer wall margin dressing. Display only.'],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'tile_top_left', source_pixels: [0, 0] },
      z_policy: 'fixed_layer',
      layer: 'terrain',
    },
    draw: drawGrassEdge,
  },
];

function rgba(hex, alpha = 255) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha,
  ];
}

function makeCanvas(width, height) {
  return { width, height, pixels: new Uint8Array(width * height * 4) };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const idx = (y * canvas.width + x) * 4;
  canvas.pixels[idx] = color[0];
  canvas.pixels[idx + 1] = color[1];
  canvas.pixels[idx + 2] = color[2];
  canvas.pixels[idx + 3] = color[3];
}

function fillRect(canvas, x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) setPixel(canvas, xx, yy, color);
  }
}

function rect(canvas, x, y, width, height, color) {
  fillRect(canvas, x, y, width, 1, color);
  fillRect(canvas, x, y + height - 1, width, 1, color);
  fillRect(canvas, x, y, 1, height, color);
  fillRect(canvas, x + width - 1, y, 1, height, color);
}

function ellipse(canvas, cx, cy, rx, ry, color) {
  for (let y = -ry; y <= ry; y += 1) {
    for (let x = -rx; x <= rx; x += 1) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) setPixel(canvas, cx + x, cy + y, color);
    }
  }
}

function diamond(canvas, cx, cy, radius, color) {
  for (let y = -radius; y <= radius; y += 1) {
    const span = radius - Math.abs(y);
    fillRect(canvas, cx - span, cy + y, span * 2 + 1, 1, color);
  }
}

function drawLanternPost(canvas) {
  const dark = rgba('#1a120c');
  const brass = rgba('#b08a42');
  const pale = rgba('#e8f0ff');
  const glow = rgba('#c8dcff');
  ellipse(canvas, 16, 58, 9, 3, rgba('#000000', 64));
  fillRect(canvas, 14, 24, 5, 34, dark);
  fillRect(canvas, 15, 25, 3, 32, brass);
  rect(canvas, 19, 20, 9, 12, dark);
  fillRect(canvas, 21, 22, 5, 8, pale);
  fillRect(canvas, 22, 23, 3, 6, glow);
  fillRect(canvas, 20, 31, 7, 2, brass);
  setPixel(canvas, 23, 21, rgba('#ffffff'));
}

function drawSigilBanner(canvas, tone) {
  const dark = rgba('#1a120c');
  const gold = rgba('#d8ac3c');
  const field = tone === 'blue' ? rgba('#3a6ea8') : rgba('#a83a3a');
  const light = tone === 'blue' ? rgba('#5a9ed8') : rgba('#d85a5a');
  ellipse(canvas, 16, 58, 8, 3, rgba('#000000', 60));
  fillRect(canvas, 15, 10, 3, 48, dark);
  fillRect(canvas, 14, 12, 5, 44, rgba('#5a4030'));
  fillRect(canvas, 10, 16, 12, 28, field);
  fillRect(canvas, 11, 18, 10, 4, light);
  diamond(canvas, 16, 28, 4, gold);
  diamond(canvas, 16, 28, 2, rgba('#fff5c8'));
  fillRect(canvas, 12, 40, 8, 2, gold);
}

function drawCrystalFountain(canvas) {
  const stone = rgba('#7a7a82');
  const dark = rgba('#4a4a52');
  const water = rgba('#5ad0e8');
  const crystal = rgba('#9ef0ff');
  ellipse(canvas, 16, 58, 12, 3, rgba('#000000', 68));
  fillRect(canvas, 8, 44, 16, 12, dark);
  fillRect(canvas, 9, 45, 14, 10, stone);
  fillRect(canvas, 10, 48, 12, 5, water);
  fillRect(canvas, 12, 46, 8, 2, crystal);
  fillRect(canvas, 14, 30, 5, 16, stone);
  diamond(canvas, 16, 24, 4, crystal);
  setPixel(canvas, 16, 22, rgba('#ffffff'));
  fillRect(canvas, 6, 52, 20, 2, dark);
}

function drawHalfTimberWallN(canvas) {
  const plaster = rgba('#d8cbb0');
  const timber = rgba('#5a3a22');
  const shadow = rgba('#9a8a70');
  fillRect(canvas, 0, 0, 32, 32, plaster);
  fillRect(canvas, 0, 0, 32, 6, shadow);
  fillRect(canvas, 0, 0, 32, 4, timber);
  fillRect(canvas, 4, 8, 4, 20, timber);
  fillRect(canvas, 14, 8, 4, 20, timber);
  fillRect(canvas, 24, 8, 4, 20, timber);
  fillRect(canvas, 0, 18, 32, 3, timber);
}

function drawClayRoofOverlay(canvas) {
  const clay = rgba('#b85a38');
  const dark = rgba('#7a3820');
  const highlight = rgba('#d88058');
  fillRect(canvas, 0, 0, 32, 32, clay);
  for (let y = 0; y < 32; y += 4) {
    for (let x = (y / 4) % 2; x < 32; x += 8) fillRect(canvas, x, y, 6, 3, dark);
  }
  fillRect(canvas, 0, 0, 32, 2, highlight);
  fillRect(canvas, 0, 28, 32, 4, dark);
}

function drawPlotStake(canvas) {
  const wood = rgba('#7b5530');
  const dark = rgba('#3a2818');
  const parchment = rgba('#e8d8b0');
  ellipse(canvas, 16, 28, 10, 3, rgba('#000000', 64));
  fillRect(canvas, 15, 8, 3, 20, dark);
  fillRect(canvas, 16, 9, 1, 18, wood);
  rect(canvas, 10, 10, 12, 8, dark);
  fillRect(canvas, 11, 11, 10, 6, parchment);
  fillRect(canvas, 12, 13, 8, 1, dark);
  fillRect(canvas, 12, 15, 6, 1, rgba('#8a7048'));
}

function drawCobbleVar(canvas, variant) {
  const base = variant === 2 ? rgba('#8a7a68') : rgba('#7a6a58');
  const stone = variant === 2 ? rgba('#6a5a48') : rgba('#5a4a38');
  const moss = rgba('#5a7a48', 180);
  fillRect(canvas, 0, 0, 32, 32, base);
  for (let y = 0; y < 32; y += 8) {
    for (let x = (y / 8) % 2; x < 32; x += 8) {
      fillRect(canvas, x + 1, y + 1, 6, 6, stone);
    }
  }
  if (variant === 3) {
    fillRect(canvas, 0, 30, 32, 2, moss);
    setPixel(canvas, 4, 12, moss);
    setPixel(canvas, 22, 20, moss);
  }
}

function drawWitnessLantern(canvas) {
  const chain = rgba('#6a6a72');
  const brass = rgba('#a88a48');
  const glass = rgba('#f0e8c8');
  const glow = rgba('#ffe8a0');
  ellipse(canvas, 16, 58, 8, 3, rgba('#000000', 60));
  fillRect(canvas, 15, 6, 2, 14, chain);
  fillRect(canvas, 14, 18, 5, 3, brass);
  rect(canvas, 11, 20, 11, 14, brass);
  fillRect(canvas, 13, 22, 7, 9, glass);
  fillRect(canvas, 14, 23, 5, 7, glow);
  setPixel(canvas, 16, 21, rgba('#ffffff'));
}

function drawMerchantCrate(canvas) {
  const wood = rgba('#7a5530');
  const dark = rgba('#3a2818');
  const cloth = rgba('#6a8ab0');
  const rope = rgba('#c8b878');
  ellipse(canvas, 16, 28, 11, 3, rgba('#000000', 68));
  rect(canvas, 7, 12, 18, 14, dark);
  fillRect(canvas, 9, 14, 14, 10, wood);
  fillRect(canvas, 8, 11, 16, 4, cloth);
  line(canvas, 8, 11, 24, 11, rope);
  fillRect(canvas, 11, 16, 4, 3, rgba('#d8c890'));
}

function line(canvas, x0, y0, x1, y1, color) {
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    setPixel(canvas, x0, y0, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function drawTempleBrazier(canvas) {
  const stone = rgba('#6a6a72');
  const dark = rgba('#3a3a42');
  const flame = rgba('#f0a040');
  const core = rgba('#ffe878');
  ellipse(canvas, 16, 58, 10, 3, rgba('#000000', 64));
  fillRect(canvas, 9, 46, 14, 10, dark);
  fillRect(canvas, 10, 47, 12, 8, stone);
  fillRect(canvas, 12, 40, 8, 8, dark);
  fillRect(canvas, 13, 41, 6, 6, stone);
  diamond(canvas, 16, 30, 5, flame);
  diamond(canvas, 16, 28, 3, core);
  setPixel(canvas, 16, 24, rgba('#ffffff'));
}

function drawGrassEdge(canvas) {
  const grass = rgba('#5a8a48');
  const dark = rgba('#3a5a30');
  const soil = rgba('#6a5a40');
  fillRect(canvas, 0, 0, 32, 20, grass);
  fillRect(canvas, 0, 20, 32, 12, soil);
  for (let x = 0; x < 32; x += 4) fillRect(canvas, x, 18, 2, 6, dark);
  fillRect(canvas, 0, 16, 32, 4, rgba('#7aaa58'));
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffers) {
  let c = 0xffffffff;
  for (const buffer of buffers) {
    for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32([typeBuf, data]), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(canvas) {
  const scanlineBytes = (canvas.width * 4 + 1) * canvas.height;
  const raw = Buffer.alloc(scanlineBytes);
  let out = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    raw[out] = 0;
    out += 1;
    const start = y * canvas.width * 4;
    for (let i = 0; i < canvas.width * 4; i += 1) {
      raw[out] = canvas.pixels[start + i];
      out += 1;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND'),
  ]);
}

function sidecar(asset, sha) {
  return {
    id: asset.id,
    asset_type: asset.rendering.layer === 'floor_overlay' ? 'floor_overlay' : asset.rendering.layer === 'terrain' ? 'terrain_tile' : asset.rendering.layer === 'object_overlay' && asset.id.includes('wall') ? 'wall_overlay' : 'world_object',
    source_kind: 'sprite',
    image: `${asset.id}.png`,
    frame: { width: asset.width, height: asset.height },
    rendering: asset.rendering,
    mechanics: null,
    style_contract: STYLE_CONTRACT,
    prompt_file: asset.promptFile,
    sha256: sha,
    copyright_boundary:
      'original hand-authored script-rendered asset; no copied third-party sprite, UI, logo, or map layout',
    visual_notes: asset.notes,
  };
}

for (const asset of assets) {
  const canvas = makeCanvas(asset.width, asset.height);
  asset.draw(canvas);
  const pngBuffer = png(canvas);
  const pngPath = join(OUT_DIR, `${asset.id}.png`);
  const jsonPath = join(OUT_DIR, `${asset.id}.json`);
  mkdirSync(dirname(pngPath), { recursive: true });
  writeFileSync(pngPath, pngBuffer);
  const sha = createHash('sha256').update(pngBuffer).digest('hex');
  writeFileSync(jsonPath, `${JSON.stringify(sidecar(asset, sha), null, 2)}\n`);
  console.log(`world/high_city/${asset.id}.png sha256:${sha}`);
}