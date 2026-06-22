// Proof target: builder_preview_runtime_v1
// Authority: AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1 (PR-9 preview registry + replay)

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BuilderDraftManifest } from '../../../packages/shared/builderDraft.js';
import { BuilderDraftNamespaceStore } from '../src/builder/draftNamespace.js';
import { buildPreviewOverlay } from '../src/builder/previewRegistry.js';
import { buildPreviewWorldFork } from '../src/builder/previewWorldFork.js';
import { appendPreviewReplayEvent, previewReplayRelPath } from '../src/builder/previewReplay.js';
import { endPreviewSession, startPreviewSession } from '../src/builder/previewSession.js';
import { validateDraftPlacements } from '../src/builder/validateDraftPlacements.js';

const PACKET_AUTHORITY = 'AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1';
const PROOF_TARGET = 'builder_preview_runtime_v1';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, '../../..');
const OPS_ROOT = path.resolve(REPO_ROOT, '../..');
const SAMPLE = path.join(REPO_ROOT, '../akalynth-codex/samples/rookguard-builder-draft-manifest.sample.json');

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

const manifest = JSON.parse(readFileSync(SAMPLE, 'utf8')) as BuilderDraftManifest;
process.env.AKALYNTH_OPS_ROOT = OPS_ROOT;

test('preview registry overlay counts rookguard draft deltas', () => {
  const overlay = buildPreviewOverlay(manifest);
  assert(overlay.rooms.length === 2, 'rooms');
  assert(overlay.objects.length === 6, 'objects');
  assert(overlay.npc_lines.length === 2, 'npc lines');
});

test('preview replay log appends under ops builder/previews', () => {
  const rel = previewReplayRelPath(manifest.preview_namespace);
  assert(rel === 'builder/previews/rookguard-kit-v1/replay.jsonl', 'rel path');
  appendPreviewReplayEvent(manifest.preview_namespace, { event: 'verify_probe', probe: PROOF_TARGET });
  const file = path.join(OPS_ROOT, rel);
  assert(existsSync(file), 'replay file exists');
  const tail = readFileSync(file, 'utf8').trim().split('\n').at(-1) ?? '';
  assert(tail.includes('verify_probe'), 'replay tail');
});

test('preview session wires replay ref and rookguard screenshots', () => {
  const store = new BuilderDraftNamespaceStore();
  const active = startPreviewSession(
    store,
    manifest,
    'AKALYNTH_PREVIEW_RUNTIME_TEST_V1',
    'codex/samples/rookguard-builder-draft-manifest.sample.json',
  );
  assert(active.session.artifacts.replay_log_ref.endsWith('replay.jsonl'), 'replay ref');
  assert(active.session.artifacts.screenshots.length === 3, 'screenshots');
  endPreviewSession(active);
});

test('rookguard draft placements validate against live map', () => {
  const result = validateDraftPlacements(manifest);
  assert(result.ok, `placements: ${JSON.stringify(result.violations)}`);
  assert(result.violations.length === 0, 'no violations');
});

test('preview world fork projects manifest objects and npc lines', () => {
  const fork = buildPreviewWorldFork(manifest);
  assert(fork.preview_only === true, 'preview_only');
  assert(fork.map_name === 'Rookguard', 'map_name');
  assert(fork.rooms.length === 2, 'rooms');
  assert(fork.objects.length === 6, 'objects');
  assert(fork.npc_lines.length === 2, 'npc lines');
  assert(fork.placement_validation.ok, 'placement_validation');
});

console.log(`builder-preview-runtime-v1 OK (${PACKET_AUTHORITY} / ${PROOF_TARGET})`);