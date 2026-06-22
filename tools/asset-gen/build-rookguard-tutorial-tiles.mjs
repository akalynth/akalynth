#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const ROOT = new URL('../../', import.meta.url).pathname;
const SPRITE_DIR = join(ROOT, 'data/assets-src/sprites');
const PACK_PATH = join(ROOT, 'data/assets-src/packs/rookguard-starter-v1.json');
const TILEMAP_TEST_REL = 'data/assets-src/test-maps/rookguard-tutorial-assets-v1.json';
const TILEMAP_TEST_PATH = join(ROOT, TILEMAP_TEST_REL);
const STYLE_CONTRACT = 'nostalgic_top_down_mmo_readability_original_akalynth_assets_v1';

const assets = [
  {
    assetId: 'akalynth_tile_tutorial_move_001',
    fileBase: 'tile__tutorial_move',
    tileCode: 5,
    promptFile: 'data/assets-src/prompts/tiles/akalynth_tile_tutorial_move_001.txt',
    palette: {
      bg: ['#162718', '#1b321e', '#203c24', '#263f28'],
      dark: '#071109',
      mid: '#2f6b36',
      light: '#77d76f',
      accent: '#d9b84d',
      crystal: '#55d9ff',
    },
    note: 'Movement tutorial rune: mossy stone base with an eastward step-arrow motif.',
    draw: drawMoveRune,
  },
  {
    assetId: 'akalynth_tile_tutorial_chat_001',
    fileBase: 'tile__tutorial_chat',
    tileCode: 6,
    promptFile: 'data/assets-src/prompts/tiles/akalynth_tile_tutorial_chat_001.txt',
    palette: {
      bg: ['#172932', '#1d3540', '#203c4a', '#263f46'],
      dark: '#08131a',
      mid: '#2f6f88',
      light: '#74d8e7',
      accent: '#c9e7f1',
      crystal: '#60f2ff',
    },
    note: 'Chat tutorial rune: blue-grey stone base with a carved speech-sigil motif.',
    draw: drawChatRune,
  },
  {
    assetId: 'akalynth_tile_tutorial_tem_001',
    fileBase: 'tile__tutorial_tem',
    tileCode: 7,
    promptFile: 'data/assets-src/prompts/tiles/akalynth_tile_tutorial_tem_001.txt',
    palette: {
      bg: ['#2b1723', '#351b2a', '#421f34', '#462438'],
      dark: '#120711',
      mid: '#77345b',
      light: '#c878c0',
      accent: '#e0b85b',
      crystal: '#9b70ff',
    },
    note: 'Tem tutorial rune: wine-stone base with an original eye-and-answer sigil.',
    draw: drawTemRune,
  },
  {
    assetId: 'akalynth_tile_gate_to_azura_001',
    assetType: 'tile',
    fileBase: 'tile__gate_to_azura',
    tileCode: 8,
    background: 'opaque',
    promptFile: 'data/assets-src/prompts/tiles/akalynth_tile_gate_to_azura_001.txt',
    palette: {
      bg: ['#23232b', '#2d2d36', '#353541', '#3b3a45'],
      dark: '#0c0d13',
      mid: '#685f44',
      light: '#e1b84f',
      accent: '#f6d66a',
      crystal: '#5bb9ff',
    },
    note: 'High City gate rune: dark threshold stone with aged-gold chevron and blue anchors.',
    draw: drawGateRune,
  },
  {
    assetId: 'akalynth_creature_rookguard_training_slime_001',
    assetType: 'creature',
    fileBase: 'creature__rookguard_training_slime',
    tileCode: null,
    background: 'transparent',
    promptFile: 'data/assets-src/prompts/creatures/akalynth_creature_rookguard_training_slime_001.txt',
    palette: {
      bg: [],
      dark: '#07130f',
      mid: '#1f7a5b',
      light: '#55c89b',
      accent: '#f1d36a',
      crystal: '#9ee7cf',
      shadow: '#000000',
    },
    note: 'Rookguard training slime: compact tutorial-yard creature with a pale-gold practice mark.',
    draw: drawTrainingSlime,
  },
];

for (const asset of assets) {
  asset.assetType ??= 'tile';
  asset.background ??= 'opaque';
}

function parseHex(hex) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    255,
  ];
}

function rgba(hex, alpha = 255) {
  const [r, g, b] = parseHex(hex);
  return [r, g, b, alpha];
}

function makeCanvas(width = 32, height = 32) {
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

function diamond(canvas, cx, cy, radius, color) {
  for (let y = -radius; y <= radius; y += 1) {
    const span = radius - Math.abs(y);
    fillRect(canvas, cx - span, cy + y, span * 2 + 1, 1, color);
  }
}

function circle(canvas, cx, cy, radius, color) {
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y <= radius * radius) setPixel(canvas, cx + x, cy + y, color);
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

function baseTile(canvas, palette, seed) {
  const shades = palette.bg.map((hex) => rgba(hex));
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const n = (x * 17 + y * 29 + seed * 13 + ((x ^ y) * 7)) % shades.length;
      setPixel(canvas, x, y, shades[n]);
    }
  }
  rect(canvas, 0, 0, 32, 32, rgba(palette.dark));
  for (let i = 4; i < 29; i += 6) {
    setPixel(canvas, i, 2, rgba(palette.mid));
    setPixel(canvas, 2, i, rgba(palette.mid));
  }
}

function drawMoveRune(canvas, palette) {
  baseTile(canvas, palette, 1);
  diamond(canvas, 16, 16, 12, rgba(palette.dark));
  diamond(canvas, 16, 16, 10, rgba(palette.mid));
  fillRect(canvas, 8, 14, 11, 5, rgba(palette.dark));
  fillRect(canvas, 10, 15, 9, 3, rgba(palette.light));
  line(canvas, 18, 10, 24, 16, rgba(palette.dark));
  line(canvas, 18, 22, 24, 16, rgba(palette.dark));
  line(canvas, 19, 11, 24, 16, rgba(palette.accent));
  line(canvas, 19, 21, 24, 16, rgba(palette.accent));
  setPixel(canvas, 6, 6, rgba(palette.crystal));
  setPixel(canvas, 25, 25, rgba(palette.crystal));
}

function drawChatRune(canvas, palette) {
  baseTile(canvas, palette, 2);
  rect(canvas, 7, 9, 18, 13, rgba(palette.dark));
  fillRect(canvas, 9, 11, 14, 8, rgba(palette.mid));
  fillRect(canvas, 12, 20, 4, 3, rgba(palette.mid));
  fillRect(canvas, 10, 12, 12, 2, rgba(palette.light));
  fillRect(canvas, 10, 16, 9, 2, rgba(palette.crystal));
  setPixel(canvas, 21, 15, rgba(palette.accent));
  setPixel(canvas, 20, 16, rgba(palette.accent));
  setPixel(canvas, 19, 17, rgba(palette.accent));
}

function drawTemRune(canvas, palette) {
  baseTile(canvas, palette, 3);
  diamond(canvas, 16, 16, 11, rgba(palette.dark));
  line(canvas, 8, 16, 16, 10, rgba(palette.accent));
  line(canvas, 16, 10, 24, 16, rgba(palette.accent));
  line(canvas, 8, 16, 16, 22, rgba(palette.accent));
  line(canvas, 16, 22, 24, 16, rgba(palette.accent));
  circle(canvas, 16, 16, 4, rgba(palette.light));
  circle(canvas, 16, 16, 2, rgba(palette.dark));
  setPixel(canvas, 16, 16, rgba(palette.crystal));
  fillRect(canvas, 6, 6, 2, 5, rgba(palette.accent));
  fillRect(canvas, 24, 21, 2, 5, rgba(palette.accent));
}

function drawGateRune(canvas, palette) {
  baseTile(canvas, palette, 4);
  rect(canvas, 6, 7, 20, 20, rgba(palette.dark));
  fillRect(canvas, 8, 9, 16, 16, rgba(palette.mid));
  fillRect(canvas, 10, 11, 12, 12, rgba(palette.dark));
  line(canvas, 11, 12, 16, 18, rgba(palette.light));
  line(canvas, 21, 12, 16, 18, rgba(palette.light));
  line(canvas, 12, 22, 16, 18, rgba(palette.accent));
  line(canvas, 20, 22, 16, 18, rgba(palette.accent));
  circle(canvas, 9, 9, 2, rgba(palette.crystal));
  circle(canvas, 23, 9, 2, rgba(palette.crystal));
  fillRect(canvas, 14, 24, 5, 2, rgba(palette.accent));
}

function drawTrainingSlime(canvas, palette) {
  ellipse(canvas, 16, 25, 10, 3, rgba(palette.shadow, 72));
  ellipse(canvas, 16, 19, 12, 9, rgba(palette.dark));
  ellipse(canvas, 16, 18, 10, 8, rgba(palette.mid));
  ellipse(canvas, 13, 14, 5, 3, rgba(palette.light));
  fillRect(canvas, 10, 17, 3, 3, rgba(palette.dark));
  fillRect(canvas, 20, 17, 3, 3, rgba(palette.dark));
  fillRect(canvas, 14, 20, 4, 4, rgba(palette.accent));
  setPixel(canvas, 15, 21, rgba(palette.crystal));
  setPixel(canvas, 18, 22, rgba(palette.crystal));
  fillRect(canvas, 8, 24, 3, 3, rgba(palette.dark));
  fillRect(canvas, 22, 24, 3, 3, rgba(palette.dark));
  fillRect(canvas, 9, 24, 2, 2, rgba(palette.mid));
  fillRect(canvas, 22, 24, 2, 2, rgba(palette.mid));
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

function manifest(asset, sha) {
  return {
    asset_id: asset.assetId,
    game: 'Akalynth',
    asset_type: asset.assetType,
    biome: 'rookguard',
    status: 'tilemap_tested',
    dimensions_px: [32, 32],
    dimensions_target_px: [32, 32],
    camera: 'top_down_slight_isometric',
    background: asset.background,
    style_contract: STYLE_CONTRACT,
    prompt_file: asset.promptFile,
    raw_file: null,
    cleaned_file: `data/assets-src/sprites/${asset.fileBase}.png`,
    sha256: sha,
    tilemap_test: TILEMAP_TEST_REL,
    license_status: 'hand_authored',
    review_status: 'needs_human_review',
    tile_code: asset.tileCode,
    mechanics: null,
    copyright_boundary:
      'original hand-authored script-rendered asset; no copied third-party sprite, UI, logo, or map layout',
    notes: asset.assetType === 'tile'
      ? `${asset.note} Display-only; server TileCode ${asset.tileCode} remains the sole movement/tutorial authority.`
      : `${asset.note} Display-only; server mob definition remains the sole authority for HP, attacks, loot, respawn, and quest progress.`,
  };
}

function packManifest() {
  return {
    pack: 'AKALYNTH_ROOKGUARD_STARTER_PACK_V1',
    version: 1,
    style_contract: STYLE_CONTRACT,
    description:
      'Rookguard tutorial visuals. The tutorial rune tiles and training slime are normalized source sprites, display-only, tilemap-tested, not atlas-packed, not human-reviewed, and not promoted as server authority.',
    tilemap_test: TILEMAP_TEST_REL,
    assets: assets.map((asset) => ({
      id: asset.assetId,
      asset_type: asset.assetType,
      target_dims: [32, 32],
      status: 'tilemap_tested',
      prompt_file: asset.promptFile,
      cleaned_file: `data/assets-src/sprites/${asset.fileBase}.png`,
      tilemap_test: TILEMAP_TEST_REL,
    })),
  };
}

function tilemapTestManifest() {
  return {
    id: 'rookguard_tutorial_assets_v1',
    kind: 'asset_tilemap_test',
    style_contract: STYLE_CONTRACT,
    tile_size_px: 32,
    canvas_tiles: [7, 5],
    scope:
      'Source-side visual placement proof for Rookguard tutorial rune tiles and the training slime. This is not a runtime map and grants no mechanics.',
    runtime_authority:
      'Display only. Movement, tutorial completion, gate transition, creature stats, drops, rewards, respawn, and receipt behavior remain server-authoritative.',
    assets: assets.map((asset) => asset.assetId),
    placements: [
      placement(assets[0], 1, 1, 'movement tutorial rune'),
      placement(assets[1], 2, 1, 'chat tutorial rune'),
      placement(assets[2], 3, 1, 'Tem tutorial rune'),
      placement(assets[3], 4, 1, 'Azura gate threshold rune'),
      placement(assets[4], 3, 3, 'training yard creature sprite'),
    ],
    checks: [
      'all placements reference tracked cleaned PNGs and sidecars',
      'all mechanics fields are null',
      'tile rune assets use existing TileCode values only as display links',
      'asset family remains pending human visual review before promotion',
    ],
  };
}

function placement(asset, x, y, role) {
  return {
    asset_id: asset.assetId,
    cleaned_file: `data/assets-src/sprites/${asset.fileBase}.png`,
    x,
    y,
    role,
    tile_code: asset.tileCode,
    mechanics: null,
  };
}

for (const asset of assets) {
  if (!existsSync(join(ROOT, asset.promptFile))) {
    throw new Error(`missing prompt file: ${asset.promptFile}`);
  }
  const canvas = makeCanvas();
  asset.draw(canvas, asset.palette);
  const pngBuffer = png(canvas);
  const pngPath = join(SPRITE_DIR, `${asset.fileBase}.png`);
  const jsonPath = join(SPRITE_DIR, `${asset.fileBase}.json`);
  mkdirSync(dirname(pngPath), { recursive: true });
  writeFileSync(pngPath, pngBuffer);
  const sha = createHash('sha256').update(pngBuffer).digest('hex');
  writeFileSync(jsonPath, `${JSON.stringify(manifest(asset, sha), null, 2)}\n`);
  console.log(`${asset.fileBase}.png sha256:${sha}`);
}

mkdirSync(dirname(TILEMAP_TEST_PATH), { recursive: true });
writeFileSync(TILEMAP_TEST_PATH, `${JSON.stringify(tilemapTestManifest(), null, 2)}\n`);
writeFileSync(PACK_PATH, `${JSON.stringify(packManifest(), null, 2)}\n`);
console.log(TILEMAP_TEST_REL);
console.log('data/assets-src/packs/rookguard-starter-v1.json');
