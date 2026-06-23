#!/usr/bin/env node
/**
 * Downscale grok-cli image_gen raw UI PNGs to exact Classic 32 dimensions (nearest-neighbor).
 * Requires: npm rebuild sharp (or run on host with sharp in node_modules).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SPEC_PATH = join(ROOT, 'tools/asset-gen/ui-grok-specs.json');

async function loadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default;
  } catch {
    console.error('✗ normalize-ui-grok — sharp not available; run npm ci in repo root');
    process.exit(1);
  }
}

const doc = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
const sharp = await loadSharp();
let ok = 0;
let skip = 0;

for (const s of doc.specs) {
  const raw = join(ROOT, doc.raw_dir, `${s.stem}.png`);
  if (!existsSync(raw)) {
    console.log(`  skip ${s.stem} (no raw PNG — run grok-cli generate first)`);
    skip += 1;
    continue;
  }
  const [w, h] = s.dimensions_px;
  const builtPath = join(ROOT, doc.out_built, `${s.stem}.png`);
  const srcPath = join(ROOT, doc.out_src, `${s.stem}.png`);
  mkdirSync(dirname(builtPath), { recursive: true });
  const buf = await sharp(raw)
    .resize(w, h, { kernel: sharp.kernel.nearest, fit: 'fill' })
    .png()
    .toBuffer();
  writeFileSync(builtPath, buf);
  copyFileSync(builtPath, srcPath);
  console.log(`  ✓ ${s.stem} → ${w}x${h} (built + src)`);
  ok += 1;
}

console.log(`✓ normalize-ui-grok — ${ok} normalized, ${skip} skipped`);
if (ok === 0) process.exit(1);