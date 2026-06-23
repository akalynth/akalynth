#!/usr/bin/env node
/**
 * Studio Sim lane E2E — mirrors Build → Save & sign → Review against live sim-api.
 * Usage: node scripts/e2e-studio-sim-lane-v1.mjs [--api-base URL]
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const manifest = JSON.parse(
  readFileSync(resolve(root, 'src/fixtures/rookguardBuilderDraftManifest.json'), 'utf8'),
);

const apiBase = (process.argv.includes('--api-base')
  ? process.argv[process.argv.indexOf('--api-base') + 1]
  : 'https://sim-api.akalynth.com'
).replace(/\/$/, '');

const sessionId = `AKALYNTH_STUDIO_E2E_SIM_${Date.now()}`;
const namespace = manifest.preview_namespace;

async function get(path) {
  const resp = await fetch(`${apiBase}${path}`);
  const body = await resp.json().catch(() => ({}));
  return { status: resp.status, body };
}

async function post(path, payload) {
  const resp = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await resp.json().catch(() => ({}));
  return { status: resp.status, body };
}

function assertStep(name, ok, detail) {
  if (!ok) {
    console.error(`FAIL ${name}:`, detail);
    process.exit(1);
  }
  console.log(`OK  ${name}`);
}

console.log(`E2E Studio Sim lane → ${apiBase}`);

const health = await get('/v1/health');
assertStep('health', health.status === 200 && health.body.ok === true, health);
assertStep('health commit present', typeof health.body.commit === 'string' && health.body.commit.length >= 7, health.body);

const snapshot = await get('/v1/sim/snapshot');
assertStep(
  'sim snapshot',
  snapshot.status === 200 &&
    snapshot.body.ok === true &&
    snapshot.body.mode === 'sim_life_viewer_v1' &&
    snapshot.body.authority?.receipt_boundary === 'simulated_receipts_only',
  snapshot.body,
);

const start = await post('/v1/builder/preview/start', {
  manifest,
  session_id: sessionId,
  draft_manifest_ref: 'codex/samples/rookguard-builder-draft-manifest.sample.json',
});
assertStep(
  'save and sign (preview start)',
  start.status === 200 &&
    start.body.ok === true &&
    start.body.preview_only === true &&
    start.body.builder_preview?.placement_validation?.ok === true,
  start.body,
);
assertStep(
  'preview namespace',
  start.body.builder_preview?.namespace === namespace,
  start.body.builder_preview,
);
assertStep('preview receipts', Array.isArray(start.body.receipts) && start.body.receipts.length >= 1, start.body.receipts);

const nsMeta = await get(`/v1/builder/preview/namespace?ns=${encodeURIComponent(namespace)}`);
assertStep('namespace loaded', nsMeta.status === 200 && nsMeta.body.ok === true, nsMeta.body);

const world = await get(`/v1/builder/preview/world-state?ns=${encodeURIComponent(namespace)}`);
assertStep(
  'world-state fork',
  world.status === 200 &&
    world.body.ok === true &&
    world.body.builder_preview?.objects?.length >= 1,
  world.body,
);

const end = await post('/v1/builder/preview/end', { session_id: sessionId });
assertStep('preview end', end.status === 200 && end.body.ok === true && end.body.preview_only === true, end.body);

const dash = await fetch('https://sim.akalynth.com/');
assertStep('sim dashboard', dash.status === 200, { status: dash.status });

console.log('PASS — Studio Sim lane E2E complete');
console.log(JSON.stringify({ apiBase, sessionId, namespace, commit: health.body.commit }, null, 2));