// Proof target: builder_draft_namespace_v1
// Authority: AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1 (PR-6 runtime scaffold)

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BuilderDraftManifest } from '../../../packages/shared/builderDraft.js';
import {
  buildPreviewNamespace,
  computeManifestChecksum,
  validateDraftManifest,
} from '../../../packages/shared/builderDraft.js';
import { BuilderDraftNamespaceStore } from '../src/builder/draftNamespace.js';
import {
  assertPreviewReceiptsNonAuthoritative,
  endPreviewSession,
  startPreviewSession,
} from '../src/builder/previewSession.js';

const PACKET_AUTHORITY = 'AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1';
const PROOF_TARGET = 'builder_draft_namespace_v1';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, '../../..');
const SAMPLE = path.join(
  REPO_ROOT,
  '../akalynth-codex/samples/rookguard-builder-draft-manifest.sample.json',
);
const PREVIEW_SAMPLE = path.join(
  REPO_ROOT,
  '../akalynth-codex/samples/rookguard-local-preview-session.sample.json',
);

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
const previewFixture = JSON.parse(readFileSync(PREVIEW_SAMPLE, 'utf8')) as {
  artifacts: { manifest_checksum: string };
};

test('shared manifest checksum matches codex sample', () => {
  assert(computeManifestChecksum(manifest) === previewFixture.artifacts.manifest_checksum, 'checksum');
});

test('draft namespace store loads rookguard preview draft', () => {
  const store = new BuilderDraftNamespaceStore();
  validateDraftManifest(manifest);
  const loaded = store.load(manifest);
  assert(loaded.manifest.object_id === 'AKALYNTH_BUILDER_DRAFT_ROOKGUARD_KIT_V1', 'object id');
  assert(store.has(manifest.preview_namespace), 'namespace registered');
});

test('preview session emits preview_only receipts', () => {
  const store = new BuilderDraftNamespaceStore();
  const active = startPreviewSession(
    store,
    manifest,
    'AKALYNTH_PREVIEW_ROOKGUARD_KIT_V1',
    'codex/samples/rookguard-builder-draft-manifest.sample.json',
  );
  const receipts = endPreviewSession(active);
  assert(receipts.length === 2, 'start + end receipts');
  assertPreviewReceiptsNonAuthoritative(receipts);
});

test('live namespace mutation is rejected', () => {
  const store = new BuilderDraftNamespaceStore();
  let blocked = false;
  try {
    store.rejectLiveNamespace('rookguard');
  } catch {
    blocked = true;
  }
  assert(blocked, 'live namespace blocked');
});

test('preview namespace builder helper', () => {
  assert(
    buildPreviewNamespace('rookguard', 'kit-v1') === 'preview:rookguard:kit-v1',
    'namespace format',
  );
});

console.log(`builder-draft-namespace-v1 OK (${PACKET_AUTHORITY} / ${PROOF_TARGET})`);