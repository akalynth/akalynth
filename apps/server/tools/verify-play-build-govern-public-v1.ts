// Verify public projection publish for Play, Build, Govern Surface v1.
//
// Proof target: play_build_govern_public_v1

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROOF_TARGET = 'play_build_govern_public_v1';
const CODEX_ENTRY = 'play-build-govern-surface';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, '../../..');
const CODEX_ROOT = path.join(REPO_ROOT, '../akalynth-codex');
const OPS_ROOT = path.join(REPO_ROOT, '../..');

const PATHS = {
  entry: path.join(CODEX_ROOT, 'entries/play-build-govern-surface.json'),
  publicGraph: path.join(CODEX_ROOT, 'out/codex-public.graph.json'),
  laneReceipt: path.join(OPS_ROOT, 'evidence/play-build-govern-surface-v1/lane-publish-beta.json'),
};

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err}`);
    process.exit(1);
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

test('lane publish receipt exists and passed', () => {
  assert(existsSync(PATHS.laneReceipt), `missing ${PATHS.laneReceipt}`);
  const receipt = readJson<{ status: string; builder_preview_route_probe: number }>(PATHS.laneReceipt);
  assert(receipt.status === 'pass', 'lane publish status');
  assert([200, 400].includes(receipt.builder_preview_route_probe), 'builder route probe');
});

test('codex entry public projection published', () => {
  const entry = readJson<{
    id: string;
    visibility: { public: boolean };
    public_projection: { published: boolean; reviewed_by?: string; title: string };
    world: { implementation: { stage: string } };
  }>(PATHS.entry);
  assert(entry.id === CODEX_ENTRY, 'entry id');
  assert(entry.visibility.public === true, 'visibility public');
  assert(entry.public_projection.published === true, 'public projection published');
  assert(Boolean(entry.public_projection.reviewed_by), 'reviewed_by');
  assert(entry.public_projection.title.length > 0, 'public title');
  assert(['beta', 'shipped'].includes(entry.world.implementation.stage), 'implementation stage');
});

test('public graph includes projection only (leak gate)', () => {
  assert(existsSync(PATHS.publicGraph), `missing ${PATHS.publicGraph}`);
  const graph = readJson<Array<{ id: string }>>(PATHS.publicGraph);
  const node = graph.find((n) => n.id === CODEX_ENTRY);
  assert(node, 'public graph node');
  const blob = JSON.stringify(graph);
  for (const forbidden of ('world', 'packets', 'evidence', 'lineage', 'visibility')) {
    assert(!blob.includes(`"${forbidden}"`), `public leak: ${forbidden}`);
  }
});

test('proof target constants', () => {
  assert(PROOF_TARGET === 'play_build_govern_public_v1', 'proof target');
});

console.log(`play-build-govern-public-v1 OK (${PROOF_TARGET})`);