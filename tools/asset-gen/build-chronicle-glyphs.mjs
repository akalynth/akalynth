#!/usr/bin/env node
/**
 * PR-021: procedural 32×32 chronicle glyph placeholders (factory canvas; ~24×24 motif).
 * Emits effect__chronicle_*.png + sidecars under data/assets-src/sprites/.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const ROOT = new URL('../../', import.meta.url).pathname;
const SPRITE_DIR = join(ROOT, 'data/assets-src/sprites');
const STYLE_CONTRACT = 'nostalgic_top_down_mmo_readability_original_akalynth_assets_v1';
const SIZE = 32;
const PAD = 4; // ~24×24 glyph area inside 32×32 factory canvas

const GLYPHS = [
  {
    fileBase: 'effect__chronicle_death',
    assetId: 'akalynth_effect_chronicle_death_001',
    chronicleKind: 'death',
    note: 'Death chronicle glyph placeholder; skull motif. Display-only.',
    draw: drawDeath,
  },
  {
    fileBase: 'effect__chronicle_zone',
    assetId: 'akalynth_effect_chronicle_zone_001',
    chronicleKind: 'zone_enter',
    note: 'Zone-enter chronicle glyph placeholder; arch motif. Display-only.',
    draw: drawZone,
  },
  {
    fileBase: 'effect__chronicle_pickup',
    assetId: 'akalynth_effect_chronicle_pickup_001',
    chronicleKind: 'item_pickup',
    note: 'Item-pickup chronicle glyph placeholder; crate motif. Display-only.',
    draw: drawPickup,
  },
  {
    fileBase: 'effect__chronicle_drop',
    assetId: 'akalynth_effect_chronicle_drop_001',
    chronicleKind: 'item_drop',
    note: 'Item-drop chronicle glyph placeholder; outbound crate motif. Display-only.',
    draw: drawDrop,
  },
  {
    fileBase: 'effect__chronicle_combat',
    assetId: 'akalynth_effect_chronicle_combat_001',
    chronicleKind: 'combat_kill',
    note: 'Combat-kill chronicle glyph placeholder; crossed blades motif. Display-only.',
    draw: drawCombat,
  },
  {
    fileBase: 'effect__chronicle_tutorial',
    assetId: 'akalynth_effect_chronicle_tutorial_001',
    chronicleKind: 'tutorial_complete',
    note: 'Tutorial-complete chronicle glyph placeholder; cap motif. Display-only.',
    draw: drawTutorial,
  },
  {
    fileBase: 'effect__chronicle_create',
    assetId: 'akalynth_effect_chronicle_create_001',
    chronicleKind: 'character_created',
    note: 'Character-created chronicle glyph placeholder; sparkle motif. Display-only.',
    draw: drawCreate,
  },
  {
    fileBase: 'effect__chronicle_world',
    assetId: 'akalynth_effect_chronicle_world_001',
    chronicleKind: 'world_event',
    note: 'World-event chronicle glyph placeholder; starburst motif. Display-only.',
    draw: drawWorld,
  },
  {
    fileBase: 'effect__chronicle_unknown',
    assetId: 'akalynth_effect_chronicle_unknown_001',
    chronicleKind: 'unknown',
    note: 'Unknown chronicle glyph placeholder; question-mark motif. Display-only fallback.',
    draw: drawUnknown,
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

function drawDeath(c) {
  const bone = rgba('#e8e4dc');
  const dark = rgba('#3a3038');
  fillRect(c, PAD + 8, PAD + 4, 8, 8, bone);
  fillRect(c, PAD + 6, PAD + 12, 12, 4, bone);
  fillRect(c, PAD + 4, PAD + 16, 4, 6, bone);
  fillRect(c, PAD + 16, PAD + 16, 4, 6, bone);
  setPixel(c, PAD + 10, PAD + 6, dark);
  setPixel(c, PAD + 13, PAD + 6, dark);
}

function drawZone(c) {
  const stone = rgba('#8aa0b8');
  const gold = rgba('#d4b04a');
  fillRect(c, PAD + 4, PAD + 14, 16, 4, stone);
  fillRect(c, PAD + 6, PAD + 8, 3, 6, stone);
  fillRect(c, PAD + 15, PAD + 8, 3, 6, stone);
  fillRect(c, PAD + 9, PAD + 4, 6, 4, stone);
  fillRect(c, PAD + 10, PAD + 10, 4, 2, gold);
}

function drawPickup(c) {
  const wood = rgba('#8b5a2b');
  const lid = rgba('#a86f3d');
  fillRect(c, PAD + 6, PAD + 8, 12, 10, wood);
  fillRect(c, PAD + 6, PAD + 6, 12, 3, lid);
  fillRect(c, PAD + 10, PAD + 11, 4, 4, rgba('#f0d090'));
}

function drawDrop(c) {
  const wood = rgba('#8b5a2b');
  const arrow = rgba('#6ec8e8');
  fillRect(c, PAD + 6, PAD + 10, 12, 8, wood);
  fillRect(c, PAD + 11, PAD + 4, 2, 6, arrow);
  setPixel(c, PAD + 9, PAD + 6, arrow);
  setPixel(c, PAD + 13, PAD + 6, arrow);
}

function drawCombat(c) {
  const blade = rgba('#c8d0dc');
  const guard = rgba('#8a4a2a');
  for (let i = 0; i < 10; i += 1) {
    setPixel(c, PAD + 6 + i, PAD + 6 + i, blade);
    setPixel(c, PAD + 16 - i, PAD + 6 + i, blade);
  }
  fillRect(c, PAD + 8, PAD + 14, 8, 2, guard);
}

function drawTutorial(c) {
  const cap = rgba('#4a5a9a');
  const tassel = rgba('#e8c84a');
  fillRect(c, PAD + 5, PAD + 10, 14, 4, cap);
  fillRect(c, PAD + 7, PAD + 6, 10, 4, cap);
  fillRect(c, PAD + 11, PAD + 14, 2, 5, tassel);
}

function drawCreate(c) {
  const glow = rgba('#f0e878');
  const core = rgba('#ffffff');
  setPixel(c, PAD + 12, PAD + 4, glow);
  setPixel(c, PAD + 12, PAD + 18, glow);
  setPixel(c, PAD + 4, PAD + 11, glow);
  setPixel(c, PAD + 20, PAD + 11, glow);
  fillRect(c, PAD + 10, PAD + 9, 4, 4, core);
  setPixel(c, PAD + 8, PAD + 8, glow);
  setPixel(c, PAD + 15, PAD + 8, glow);
  setPixel(c, PAD + 8, PAD + 14, glow);
  setPixel(c, PAD + 15, PAD + 14, glow);
}

function drawWorld(c) {
  const star = rgba('#9ad0ff');
  fillRect(c, PAD + 11, PAD + 4, 2, 14, star);
  fillRect(c, PAD + 4, PAD + 11, 14, 2, star);
  fillRect(c, PAD + 7, PAD + 7, 2, 2, star);
  fillRect(c, PAD + 15, PAD + 7, 2, 2, star);
  fillRect(c, PAD + 7, PAD + 15, 2, 2, star);
  fillRect(c, PAD + 15, PAD + 15, 2, 2, star);
}

function drawUnknown(c) {
  const ink = rgba('#b8c0c8');
  fillRect(c, PAD + 10, PAD + 6, 4, 2, ink);
  fillRect(c, PAD + 9, PAD + 8, 6, 2, ink);
  fillRect(c, PAD + 10, PAD + 10, 4, 2, ink);
  setPixel(c, PAD + 11, PAD + 14, ink);
  fillRect(c, PAD + 10, PAD + 16, 4, 2, ink);
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

function manifest(glyph, sha) {
  return {
    asset_id: glyph.assetId,
    game: 'Akalynth',
    asset_type: 'effect',
    biome: null,
    status: 'manifest_recorded',
    dimensions_px: [SIZE, SIZE],
    dimensions_target_px: [SIZE, SIZE],
    camera: 'top_down_slight_isometric',
    background: 'transparent',
    style_contract: STYLE_CONTRACT,
    prompt_file: null,
    raw_file: null,
    cleaned_file: `data/assets-src/sprites/${glyph.fileBase}.png`,
    sha256: sha,
    tilemap_test: null,
    license_status: 'hand_authored',
    review_status: 'needs_human_review',
    tile_code: null,
    chronicle_kind: glyph.chronicleKind,
    mechanics: null,
    copyright_boundary:
      'original hand-authored script-rendered asset; no copied third-party sprite, UI, logo, or map layout',
    notes: glyph.note,
  };
}

for (const glyph of GLYPHS) {
  const c = canvas(SIZE, SIZE);
  glyph.draw(c);
  const pngPath = join(SPRITE_DIR, `${glyph.fileBase}.png`);
  const jsonPath = join(SPRITE_DIR, `${glyph.fileBase}.json`);
  const buf = encodePng(c);
  const sha = createHash('sha256').update(buf).digest('hex');
  writeFileSync(pngPath, buf);
  writeFileSync(jsonPath, `${JSON.stringify(manifest(glyph, sha), null, 2)}\n`);
  console.log(`wrote ${glyph.fileBase}.png (${sha.slice(0, 12)}…)`);
}

console.log(`✓ ${GLYPHS.length} chronicle glyph asset(s) under data/assets-src/sprites/`);