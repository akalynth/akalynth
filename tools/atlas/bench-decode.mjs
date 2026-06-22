#!/usr/bin/env node
/**
 * PR-003: Atlas decode benchmark scaffold.
 * Measures sharp PNG decode time per sheet (proxy for Android cold decode baseline).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ATLAS_DIR } from './lib/atlas-pack.mjs';
import { ASSETS_BUILT } from './lib/paths.mjs';

const SHEETS = ['ui.png', 'items.png', 'chronicle.png', 'world.png'];
const WARMUP = 2;
const ITERATIONS = 5;

async function benchSheet(sheetFile) {
  const abs = join(ASSETS_BUILT, ATLAS_DIR, sheetFile);
  if (!existsSync(abs)) {
    return { sheet: sheetFile, status: 'missing' };
  }

  const buf = readFileSync(abs);
  for (let i = 0; i < WARMUP; i += 1) {
    await sharp(buf).ensureAlpha().raw().toBuffer();
  }

  const samples = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const t0 = performance.now();
    await sharp(buf).ensureAlpha().raw().toBuffer();
    samples.push(performance.now() - t0);
  }

  samples.sort((a, b) => a - b);
  const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];

  return {
    sheet: sheetFile,
    status: 'ok',
    bytes: buf.length,
    iterations: ITERATIONS,
    ms_avg: samples.reduce((a, b) => a + b, 0) / samples.length,
    ms_p95: p95,
  };
}

async function main() {
  const outPath = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
  const results = [];
  for (const sheet of SHEETS) {
    results.push(await benchSheet(sheet));
  }

  const report = {
    schema_version: 'atlas-bench/v1',
    generated_at: new Date().toISOString(),
    host: process.platform,
    node: process.version,
    results,
  };

  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (outPath) {
    writeFileSync(outPath, json, 'utf8');
    console.log(`✓ bench-decode — wrote ${outPath}`);
  } else {
    process.stdout.write(json);
  }

  for (const r of results) {
    if (r.status === 'ok') {
      console.log(`  ${r.sheet}: p95 ${r.ms_p95.toFixed(2)} ms (${(r.bytes / 1024).toFixed(1)} KiB)`);
    }
  }
}

main().catch((err) => {
  console.error(`✗ bench-decode — ${err.message}`);
  process.exit(1);
});