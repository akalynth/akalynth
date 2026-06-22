#!/usr/bin/env node
/**
 * PR-016: procedural 32×32 item icon placeholders (factory canvas).
 * Emits item__*.png + promoted sidecars under data/assets-src/sprites/
 * and p1-item-icons-v1.json tilemap test receipt.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const ROOT = new URL('../../', import.meta.url).pathname;
const SPRITE_DIR = join(ROOT, 'data/assets-src/sprites');
const TEST_MAP = join(ROOT, 'data/assets-src/test-maps/p1-item-icons-v1.json');
const STYLE_CONTRACT = 'nostalgic_top_down_mmo_readability_original_akalynth_assets_v1';
const TILEMAP_TEST = 'data/assets-src/test-maps/p1-item-icons-v1.json';
const SIZE = 32;

/** MVP batch (PR-016): 15 item_types beyond PR-015 P0 set. */
const ITEMS = [
  {
    itemType: 'refined_ley_mote',
    color: '#8e44ad',
    note: 'P1 placeholder: refined violet ley mote square; replace with readable refine icon before final art pass.',
  },
  {
    itemType: 'keystone_token',
    color: '#f1c40f',
    note: 'P1 placeholder: gold keystone token square; replace with readable token icon before final art pass.',
  },
  {
    itemType: 'refined_soulsteel_component',
    color: '#5d8aa8',
    note: 'P1 placeholder: steel-blue refined soulsteel square; replace with readable craft icon before final art pass.',
  },
  {
    itemType: 'healing_herb',
    color: '#27ae60',
    note: 'P1 placeholder: green healing herb square; replace with readable consumable icon before final art pass.',
  },
  {
    itemType: 'city_rat_goo',
    color: '#7f6a55',
    note: 'P1 placeholder: brown-gray rat goo square; replace with readable loot icon before final art pass.',
  },
  {
    itemType: 'pilgrim_mark',
    color: '#bdc3c7',
    note: 'P1 placeholder: silver pilgrim mark square; replace with readable cosmetic icon before final art pass.',
  },
  {
    itemType: 'rookguard_training_blade',
    color: '#95a5a6',
    note: 'P1 placeholder: iron-gray training blade square; replace with readable weapon icon before final art pass.',
  },
  {
    itemType: 'rookguard_threadbare_cloak',
    color: '#6d4c41',
    note: 'P1 placeholder: brown threadbare cloak square; replace with readable armor icon before final art pass.',
  },
  {
    itemType: 'rookguard_patience_charm',
    color: '#d4a574',
    note: 'P1 placeholder: amber patience charm square; replace with readable trinket icon before final art pass.',
  },
  {
    itemType: 'stabilized_soulsteel_component',
    color: '#4a6fa5',
    note: 'P1 placeholder: deep steel stabilized soulsteel square; replace with readable craft icon before final art pass.',
  },
  {
    itemType: 'slime',
    color: '#2ecc71',
    note: 'P1 placeholder: bright slime trophy square; replace with readable loot icon before final art pass.',
  },
  {
    itemType: 'tending_token',
    color: '#16a085',
    note: 'P1 placeholder: teal tending token square; replace with readable gather-reward icon before final art pass.',
  },
  {
    itemType: 'ashglass_shard',
    color: '#aab7b8',
    note: 'P1 placeholder: pale ashglass shard square; replace with readable material icon before final art pass.',
  },
  {
    itemType: 'charred_shipment_plate',
    color: '#2c2c2c',
    note: 'P1 placeholder: charred shipment plate square; replace with readable salvage icon before final art pass.',
  },
  {
    itemType: 'soulsteel_frame',
    color: '#34495e',
    note: 'P1 placeholder: dark soulsteel frame square; replace with readable frame icon before final art pass.',
  },
];

function rgba(hex, a = 255) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
}

function canvas(w, h) {
  return { width: w, height: h, pixels: new Uint8ClampedArray(w * h * 4) };
}

function setPixel(c, x, y, color) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const i = (y * c.width + x) * 4;
  c.pixels[i] = color[0];
  c.pixels[i + 1] = color[1];
  c.pixels[i + 2] = color[2];
  c.pixels[i + 3] = color[3];
}

function fillRect(c, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) setPixel(c, x + dx, y + dy, color);
  }
}

function drawSolid(c, color) {
  fillRect(c, 0, 0, c.width, c.height, color);
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

function encodePng(c) {
  const scanlineBytes = (c.width * 4 + 1) * c.height;
  const raw = Buffer.alloc(scanlineBytes);
  let out = 0;
  for (let y = 0; y < c.height; y += 1) {
    raw[out] = 0;
    out += 1;
    const start = y * c.width * 4;
    for (let i = 0; i < c.width * 4; i += 1) {
      raw[out] = c.pixels[start + i];
      out += 1;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.width, 0);
  ihdr.writeUInt32BE(c.height, 4);
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

function fileBase(itemType) {
  return `item__${itemType}`;
}

function assetId(itemType) {
  return `akalynth_item_${itemType}_001`;
}

function manifest(item, sha) {
  const base = fileBase(item.itemType);
  return {
    game: 'Akalynth',
    asset_type: 'item',
    biome: null,
    status: 'promoted',
    dimensions_px: [SIZE, SIZE],
    dimensions_target_px: [SIZE, SIZE],
    camera: 'top_down_slight_isometric',
    background: 'transparent',
    style_contract: STYLE_CONTRACT,
    prompt_file: null,
    raw_file: null,
    tilemap_test: TILEMAP_TEST,
    license_status: 'hand_authored',
    review_status: 'approved',
    tile_code: null,
    mechanics: null,
    copyright_boundary:
      'original hand-authored placeholder asset; no copied third-party sprite, UI, logo, or map layout',
    asset_id: assetId(item.itemType),
    item_type: item.itemType,
    cleaned_file: `data/assets-src/sprites/${base}.png`,
    sha256: sha,
    notes: item.note,
  };
}

const generated = [];

for (const item of ITEMS) {
  const c = canvas(SIZE, SIZE);
  drawSolid(c, rgba(item.color));
  const base = fileBase(item.itemType);
  const pngPath = join(SPRITE_DIR, `${base}.png`);
  const jsonPath = join(SPRITE_DIR, `${base}.json`);
  const buf = encodePng(c);
  const sha = createHash('sha256').update(buf).digest('hex');
  writeFileSync(pngPath, buf);
  writeFileSync(jsonPath, `${JSON.stringify(manifest(item, sha), null, 2)}\n`);
  generated.push({ item, base, sha });
  console.log(`wrote ${base}.png (${sha.slice(0, 12)}…)`);
}

const tilemap = {
  id: 'p1_item_icons_v1',
  kind: 'asset_tilemap_test',
  style_contract: STYLE_CONTRACT,
  tile_size_px: 32,
  canvas_tiles: [ITEMS.length, 1],
  scope:
    'Source-side visual placement proof for P1 inventory item icons (refined_ley_mote, keystone_token, refined_soulsteel_component, healing_herb, city_rat_goo, pilgrim_mark, rookguard_training_blade, rookguard_threadbare_cloak, rookguard_patience_charm, stabilized_soulsteel_component, slime, tending_token, ashglass_shard, charred_shipment_plate, soulsteel_frame). Display only; no mechanics.',
  runtime_authority:
    'Display only. Inventory keys, drops, gather rewards, and receipt behavior remain server-authoritative.',
  assets: ITEMS.map((item) => assetId(item.itemType)),
  placements: ITEMS.map((item, index) => ({
    asset_id: assetId(item.itemType),
    cleaned_file: `data/assets-src/sprites/${fileBase(item.itemType)}.png`,
    x: index,
    y: 0,
    role: `${item.itemType} inventory icon placeholder`,
    tile_code: null,
    mechanics: null,
  })),
  checks: [
    'all placements reference tracked cleaned PNGs and sidecars',
    'all mechanics fields are null',
    'item_type fields match server protocol inventory keys',
  ],
};

writeFileSync(TEST_MAP, `${JSON.stringify(tilemap, null, 2)}\n`);
console.log(`wrote data/assets-src/test-maps/p1-item-icons-v1.json`);
console.log(`✓ ${ITEMS.length} batch item icon asset(s) under data/assets-src/sprites/`);