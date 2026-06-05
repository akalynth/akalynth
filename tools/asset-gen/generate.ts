// Akalynth Asset Factory — generation scaffold (stage 1→2: prompt → raw).
//
// Reads a prompt file and, with OPENAI_API_KEY set, calls the OpenAI image API to
// produce ONE raw asset under data/assets-src/_raw/ (gitignored) plus a DRAFT
// sidecar at status `raw_generated`. Downstream stages (cleanup → 32px normalize →
// sha256 → manifest → tilemap test → human review → promote) are intentionally
// NOT automated here; see data/assets-src/FACTORY.md.
//
// Safety: without a key this makes NO network call — it prints how to set the key
// and exits. `--dry-run` prints the exact request it would make and exits 0.
//
// Usage:
//   tsx tools/asset-gen/generate.ts --prompt <prompt-file> --id <asset_id> [--size 1024x1024] [--dry-run]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const ENDPOINT = 'https://api.openai.com/v1/images/generations';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (flag: string) => process.argv.includes(flag);

const USAGE = `Akalynth Asset Factory — generate one raw asset.

  tsx tools/asset-gen/generate.ts --prompt <file> --id <asset_id> [--size 1024x1024] [--dry-run]

  --prompt    path to a prompt file (data/assets-src/prompts/<class>/<name>.txt)
  --id        asset_id (akalynth_<type>_<name>_NNN); names the raw output
  --size      OpenAI image size (default 1024x1024; downscaled to 32px later, by hand)
  --background  transparent | opaque | auto (default transparent). Use 'opaque' for
              seamless terrain TILES (a tile is a full fill, not a cut-out object).
  --dry-run   print the request that WOULD be made; no network call
  --help      this help

Notes:
  - Needs OPENAI_API_KEY (e.g. via tools/asset-gen/.env; never committed).
  - Output: data/assets-src/_raw/<id>_raw.png (gitignored) + a DRAFT sidecar.
  - The high-res output must be normalized to the Classic 32 base (32x32 / 32x64 /
    64x64) and silhouette-cleaned BY HAND before it becomes a tracked sprite.
`;

if (has('--help') || process.argv.length <= 2) {
  console.log(USAGE);
  process.exit(0);
}

const promptFile = arg('--prompt');
const assetId = arg('--id');
const size = arg('--size') || '1024x1024';
const background = arg('--background') || 'transparent';
if (!promptFile || !assetId) {
  console.error('error: --prompt and --id are required.\n');
  console.error(USAGE);
  process.exit(1);
}
if (!['transparent', 'opaque', 'auto'].includes(background)) {
  console.error(`error: --background must be transparent | opaque | auto (got '${background}').`);
  process.exit(1);
}
const promptPath = path.isAbsolute(promptFile) ? promptFile : path.join(REPO_ROOT, promptFile);
if (!existsSync(promptPath)) {
  console.error(`error: prompt file not found: ${promptFile}`);
  process.exit(1);
}
const prompt = readFileSync(promptPath, 'utf8').trim();
const rawDir = path.join(REPO_ROOT, 'data/assets-src/_raw');
const rawOut = path.join(rawDir, `${assetId}_raw.png`);

if (has('--dry-run')) {
  console.log('[asset-gen] DRY RUN — no network call.');
  console.log(`  model:  ${MODEL}`);
  console.log(`  size:   ${size}`);
  console.log(`  bg:     ${background}`);
  console.log(`  prompt: ${promptPath}`);
  console.log(`  ${prompt.split('\n')[0]} …`);
  console.log(`  would POST ${ENDPOINT}`);
  console.log(`  would write: ${path.relative(REPO_ROOT, rawOut)} (gitignored) + draft sidecar`);
  process.exit(0);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  // Hard stop BEFORE any network access.
  console.error('error: OPENAI_API_KEY is not set — no network call was made.');
  console.error('  Set it (e.g. in tools/asset-gen/.env, never committed) then re-run,');
  console.error('  or use --dry-run to preview the request. See tools/asset-gen/README.md.');
  process.exit(1);
}

// --- Live path (only reached WITH a key) ------------------------------------
async function main() {
  mkdirSync(rawDir, { recursive: true });
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, prompt, size, n: 1, background }),
  });
  if (!res.ok) {
    console.error(`error: image API ${res.status}: ${(await res.text()).slice(0, 400)}`);
    process.exit(1);
  }
  const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    console.error('error: no image returned.');
    process.exit(1);
  }
  writeFileSync(rawOut, Buffer.from(b64, 'base64'));
  console.log(`[asset-gen] wrote raw ${path.relative(REPO_ROOT, rawOut)} (status: raw_generated)`);
  console.log('[asset-gen] NEXT (by hand): normalize to 32px base, clean silhouette/transparency,');
  console.log('  save under data/assets-src/sprites/, then complete the manifest + verify:assets.');
}
main().catch((e) => { console.error(e); process.exit(1); });
