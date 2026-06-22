#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const ROOT = new URL('../../', import.meta.url).pathname;
const OUT_DIR = join(ROOT, 'data/assets-src/sprites/world/city_objects');
const STYLE_CONTRACT = 'nostalgic_top_down_mmo_readability_original_akalynth_assets_v1';

const assets = [
  {
    id: 'rookguard_fishing_post',
    width: 32,
    height: 64,
    promptFile: 'data/assets-src/prompts/world/rookguard_fishing_post_001.txt',
    notes: [
      'Rookguard canal fishing post visual only.',
      'Does not encode fishing success, inventory, rewards, collision, or interaction.',
    ],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 58] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: drawFishingPost,
  },
  {
    id: 'rookguard_bait_crate',
    width: 32,
    height: 32,
    promptFile: 'data/assets-src/prompts/world/rookguard_bait_crate_001.txt',
    notes: [
      'Rookguard bait crate visual only.',
      'Does not encode inventory, loot, market price, ownership, or interaction.',
    ],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 28] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: drawBaitCrate,
  },
  {
    id: 'rookguard_canal_reeds',
    width: 32,
    height: 64,
    promptFile: 'data/assets-src/prompts/world/rookguard_canal_reeds_001.txt',
    notes: [
      'Rookguard canal-edge reeds visual only.',
      'Does not encode water, blocking, gather resources, fishing chance, or traversal.',
    ],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 58] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: drawCanalReeds,
  },
  {
    id: 'rookguard_waymarker',
    width: 32,
    height: 64,
    promptFile: 'data/assets-src/prompts/world/rookguard_waymarker_001.txt',
    notes: [
      'Rookguard starter-plaza waymarker visual only.',
      'Does not encode pathfinding, map transition, quest state, tutorial progress, or interaction.',
    ],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 58] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: drawWaymarker,
  },
  {
    id: 'rookguard_amber_lantern',
    width: 32,
    height: 64,
    promptFile: 'data/assets-src/prompts/world/rookguard_amber_lantern_001.txt',
    notes: [
      'Rookguard starter-plaza amber lantern visual only.',
      'Does not encode light radius, safety zone, heat, collision, or interaction.',
    ],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 58] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: drawAmberLantern,
  },
  {
    id: 'rookguard_supply_sack',
    width: 32,
    height: 32,
    promptFile: 'data/assets-src/prompts/world/rookguard_supply_sack_001.txt',
    notes: [
      'Rookguard plaza supply sack visual only.',
      'Does not encode loot, storage, ownership, market price, inventory, or interaction.',
    ],
    rendering: {
      filtering: 'nearest',
      display_only: true,
      draw_scale: 1,
      anchor: { type: 'bottom_center', source_pixels: [16, 28] },
      z_policy: 'sort_by_anchor_y',
      layer: 'object_overlay',
    },
    draw: drawSupplySack,
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

function ellipse(canvas, cx, cy, rx, ry, color) {
  for (let y = -ry; y <= ry; y += 1) {
    for (let x = -rx; x <= rx; x += 1) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
        setPixel(canvas, cx + x, cy + y, color);
      }
    }
  }
}

function circle(canvas, cx, cy, radius, color) {
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y <= radius * radius) setPixel(canvas, cx + x, cy + y, color);
    }
  }
}

function diamond(canvas, cx, cy, radius, color) {
  for (let y = -radius; y <= radius; y += 1) {
    const span = radius - Math.abs(y);
    fillRect(canvas, cx - span, cy + y, span * 2 + 1, 1, color);
  }
}

function drawFishingPost(canvas) {
  const dark = rgba('#22170d');
  const wood = rgba('#7b5530');
  const light = rgba('#c18a48');
  const rope = rgba('#d9c48f');
  const water = rgba('#4aa7b8');
  const red = rgba('#c84d36');
  const white = rgba('#e8e1c3');
  ellipse(canvas, 16, 58, 12, 3, rgba('#000000', 72));
  fillRect(canvas, 13, 20, 7, 38, dark);
  fillRect(canvas, 15, 21, 3, 35, wood);
  fillRect(canvas, 17, 24, 1, 27, light);
  fillRect(canvas, 8, 18, 17, 6, dark);
  fillRect(canvas, 10, 19, 14, 3, wood);
  fillRect(canvas, 10, 19, 6, 1, light);
  line(canvas, 23, 20, 27, 44, rope);
  setPixel(canvas, 24, 27, rgba('#f1dfaa'));
  setPixel(canvas, 25, 33, rgba('#f1dfaa'));
  circle(canvas, 27, 45, 2, dark);
  fillRect(canvas, 26, 43, 3, 2, white);
  fillRect(canvas, 26, 45, 3, 3, red);
  fillRect(canvas, 24, 50, 7, 2, water);
  fillRect(canvas, 25, 52, 5, 1, rgba('#2d6870'));
}

function drawBaitCrate(canvas) {
  const dark = rgba('#23180e');
  const wood = rgba('#8a5d34');
  const light = rgba('#c58d4d');
  const straw = rgba('#d7b86a');
  const teal = rgba('#6bc7b0');
  ellipse(canvas, 16, 28, 11, 3, rgba('#000000', 68));
  rect(canvas, 6, 11, 20, 16, dark);
  fillRect(canvas, 8, 13, 16, 12, wood);
  fillRect(canvas, 8, 14, 16, 2, light);
  line(canvas, 8, 24, 23, 13, dark);
  line(canvas, 9, 24, 24, 14, light);
  fillRect(canvas, 11, 17, 3, 2, straw);
  fillRect(canvas, 17, 18, 5, 2, straw);
  line(canvas, 10, 10, 18, 6, teal);
  line(canvas, 18, 6, 25, 10, teal);
  setPixel(canvas, 19, 6, rgba('#e7fff5'));
  fillRect(canvas, 5, 21, 2, 4, dark);
  fillRect(canvas, 25, 21, 2, 4, dark);
}

function drawCanalReeds(canvas) {
  const dark = rgba('#142213');
  const reed = rgba('#597536');
  const light = rgba('#a6b96b');
  const flower = rgba('#d6b257');
  const water = rgba('#286d78');
  ellipse(canvas, 16, 58, 11, 3, rgba('#000000', 64));
  fillRect(canvas, 7, 54, 19, 3, water);
  fillRect(canvas, 8, 56, 17, 1, rgba('#4aa7b8'));
  for (const [x, top, bend] of [
    [8, 30, -3],
    [11, 23, 2],
    [14, 27, -2],
    [17, 20, 3],
    [20, 26, -1],
    [23, 32, 2],
  ]) {
    line(canvas, x, 56, x + bend, top, dark);
    line(canvas, x + 1, 55, x + bend + 1, top + 2, reed);
    setPixel(canvas, x + bend + 1, top + 1, light);
  }
  fillRect(canvas, 10, 22, 2, 5, flower);
  fillRect(canvas, 17, 18, 2, 6, flower);
  fillRect(canvas, 22, 29, 2, 5, flower);
  fillRect(canvas, 7, 50, 5, 5, dark);
  fillRect(canvas, 21, 51, 4, 5, dark);
}

function drawWaymarker(canvas) {
  const dark = rgba('#20150d');
  const wood = rgba('#76512f');
  const light = rgba('#c18948');
  const gold = rgba('#d8ac3c');
  const blue = rgba('#52c8e8');
  ellipse(canvas, 16, 58, 11, 3, rgba('#000000', 68));
  fillRect(canvas, 14, 20, 5, 38, dark);
  fillRect(canvas, 15, 21, 3, 35, wood);
  fillRect(canvas, 17, 23, 1, 31, light);
  rect(canvas, 8, 16, 18, 8, dark);
  fillRect(canvas, 10, 18, 13, 4, wood);
  line(canvas, 22, 17, 26, 20, dark);
  line(canvas, 22, 22, 26, 19, dark);
  setPixel(canvas, 23, 19, light);
  setPixel(canvas, 24, 20, gold);
  rect(canvas, 6, 30, 16, 7, dark);
  fillRect(canvas, 8, 32, 11, 3, wood);
  line(canvas, 7, 31, 3, 34, dark);
  line(canvas, 7, 35, 3, 34, dark);
  setPixel(canvas, 6, 34, gold);
  diamond(canvas, 16, 13, 3, dark);
  diamond(canvas, 16, 13, 2, blue);
  setPixel(canvas, 16, 12, rgba('#dcfbff'));
}

function drawAmberLantern(canvas) {
  const dark = rgba('#17100b');
  const metal = rgba('#554530');
  const brass = rgba('#b08a42');
  const amber = rgba('#f0b84e');
  const ember = rgba('#ffdf7a');
  ellipse(canvas, 16, 58, 9, 3, rgba('#000000', 64));
  fillRect(canvas, 14, 22, 5, 36, dark);
  fillRect(canvas, 15, 23, 2, 33, metal);
  fillRect(canvas, 17, 24, 1, 29, brass);
  line(canvas, 16, 22, 23, 17, dark);
  line(canvas, 17, 22, 24, 17, brass);
  line(canvas, 24, 17, 24, 22, dark);
  rect(canvas, 20, 21, 9, 13, dark);
  fillRect(canvas, 22, 23, 5, 8, amber);
  fillRect(canvas, 23, 24, 3, 6, ember);
  fillRect(canvas, 21, 32, 7, 2, brass);
  setPixel(canvas, 22, 22, rgba('#fff0aa'));
  setPixel(canvas, 19, 28, rgba('#8a632e', 160));
  setPixel(canvas, 29, 28, rgba('#8a632e', 160));
}

function drawSupplySack(canvas) {
  const dark = rgba('#22170e');
  const cloth = rgba('#8f7142');
  const light = rgba('#cfaa65');
  const rope = rgba('#d8c17a');
  const blue = rgba('#56bed0');
  ellipse(canvas, 16, 28, 10, 3, rgba('#000000', 68));
  ellipse(canvas, 16, 18, 10, 11, dark);
  ellipse(canvas, 16, 18, 8, 9, cloth);
  fillRect(canvas, 11, 8, 10, 5, dark);
  fillRect(canvas, 12, 9, 8, 3, cloth);
  line(canvas, 9, 15, 22, 15, rope);
  line(canvas, 10, 16, 22, 16, dark);
  fillRect(canvas, 13, 18, 2, 5, light);
  fillRect(canvas, 18, 19, 2, 4, light);
  diamond(canvas, 16, 21, 2, dark);
  setPixel(canvas, 16, 21, blue);
  setPixel(canvas, 17, 20, rgba('#dffbff'));
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
    asset_type: 'world_object',
    source_kind: 'sprite',
    image: `${asset.id}.png`,
    frame: {
      width: asset.width,
      height: asset.height,
    },
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
  console.log(`world/city_objects/${asset.id}.png sha256:${sha}`);
}
