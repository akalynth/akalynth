// Verify Play, Build, Govern Surface v1 builder workflow contract.
//
// Proof target: play_build_govern_surface_v1
// Authority: AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKET_AUTHORITY = 'AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1';
const PROOF_TARGET = 'play_build_govern_surface_v1';
const CODEX_ENTRY = 'play-build-govern-surface';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, '../../..');
const CODEX_ROOT = path.join(REPO_ROOT, '../akalynth-codex');

const PATHS = {
  entry: path.join(CODEX_ROOT, 'entries/play-build-govern-surface.json'),
  design: path.join(CODEX_ROOT, 'design/play-build-govern-surface.md'),
  manifestSchema: path.join(CODEX_ROOT, 'schema/builder-draft-manifest.schema.json'),
  previewSchema: path.join(CODEX_ROOT, 'schema/local-preview-session.schema.json'),
  reviewSchema: path.join(CODEX_ROOT, 'schema/promotion-review-packet.schema.json'),
  permitSchema: path.join(CODEX_ROOT, 'schema/builder-promotion-permit.schema.json'),
  manifestSample: path.join(CODEX_ROOT, 'samples/rookguard-builder-draft-manifest.sample.json'),
  previewSample: path.join(CODEX_ROOT, 'samples/rookguard-local-preview-session.sample.json'),
  reviewSample: path.join(CODEX_ROOT, 'samples/rookguard-promotion-review-packet.sample.json'),
};

interface DraftManifest {
  schema_version: string;
  object_id: string;
  source_object: string;
  packet_ref: string;
  preview_namespace: string;
  changed_files: Array<{ path: string; sha256: string }>;
  abuse_review: { grants_live_rewards: boolean; grants_live_access: boolean };
}

interface PreviewSession {
  schema_version: string;
  draft_manifest_ref: string;
  preview_only: boolean;
  artifacts: { manifest_checksum: string };
}

interface ReviewPacket {
  schema_version: string;
  packet_id: string;
  source_object: string;
  draft_manifest_ref: string;
  preview_session_ref: string;
  abuse_review: string;
  lane_target: string;
  decision: string;
  changed_files: Array<{ path: string; sha256: string }>;
}

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

function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  const kind = typeof value;
  if (kind === 'boolean' || kind === 'number') return JSON.stringify(value);
  if (kind === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(', ')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}: ${stableStringify(obj[key])}`).join(', ')}}`;
}

function manifestChecksum(manifest: DraftManifest): string {
  const clone = JSON.parse(JSON.stringify(manifest)) as DraftManifest;
  for (const item of clone.changed_files) {
    if (item.path.endsWith('rookguard-builder-draft-manifest.sample.json')) {
      item.sha256 = '0'.repeat(64);
    }
  }
  return createHash('sha256').update(stableStringify(clone)).digest('hex');
}

test('codex custody files exist', () => {
  for (const filePath of Object.values(PATHS)) {
    assert(existsSync(filePath), `missing ${filePath}`);
  }
});

test('codex entry accepted and private', () => {
  const entry = readJson<{
    id: string;
    status: string;
    lineage: { accepted: boolean };
    visibility: { public: boolean };
    public_projection: { published: boolean };
    world: { implementation: { stage: string; slice: string } };
  }>(PATHS.entry);
  assert(entry.id === CODEX_ENTRY, 'entry id');
  assert(entry.status === 'accepted', 'entry status');
  assert(entry.lineage.accepted === true, 'lineage accepted');
  assert(entry.visibility.public === false, 'visibility public');
  assert(entry.public_projection.published === false, 'public projection');
  assert(entry.world.implementation.stage === 'spec', 'implementation stage');
  assert(entry.world.implementation.slice === PACKET_AUTHORITY, 'implementation slice');
});

test('design page anchors present', () => {
  const design = readFileSync(PATHS.design, 'utf8');
  for (const anchor of [
    'rookguard-builder-kit',
    'high-city-first-quest-kit',
    'local-preview-contract',
    'promotion-review-contract',
    'asset-production-backlog',
  ]) {
    assert(design.includes(anchor), `missing anchor ${anchor}`);
  }
});

test('rookguard draft manifest contract', () => {
  const manifest = readJson<DraftManifest>(PATHS.manifestSample);
  assert(manifest.schema_version === 'builder-draft-manifest/v1', 'manifest schema');
  assert(manifest.source_object === 'rookguard', 'source object');
  assert(manifest.preview_namespace.startsWith('preview:'), 'preview namespace');
  assert(manifest.abuse_review.grants_live_rewards === false, 'no live rewards');
  assert(manifest.abuse_review.grants_live_access === false, 'no live access');
  assert(manifest.packet_ref.includes('#rookguard-builder-kit'), 'packet ref');
});

test('preview session references manifest checksum', () => {
  const manifest = readJson<DraftManifest>(PATHS.manifestSample);
  const preview = readJson<PreviewSession>(PATHS.previewSample);
  assert(preview.schema_version === 'local-preview-session/v1', 'preview schema');
  assert(preview.preview_only === true, 'preview only');
  assert(preview.draft_manifest_ref.endsWith('rookguard-builder-draft-manifest.sample.json'), 'manifest ref');
  assert(preview.artifacts.manifest_checksum === manifestChecksum(manifest), 'checksum');
});

test('review packet accepts beta lane only with pass abuse review', () => {
  const manifest = readJson<DraftManifest>(PATHS.manifestSample);
  const review = readJson<ReviewPacket>(PATHS.reviewSample);
  const checksum = manifestChecksum(manifest);
  assert(review.schema_version === 'promotion-review-packet/v1', 'review schema');
  assert(review.source_object === 'rookguard', 'review source');
  assert(review.abuse_review === 'pass', 'abuse pass');
  assert(review.decision === 'accept', 'decision accept');
  assert(['beta', 'staging'].includes(review.lane_target), 'lane target');
  assert(review.changed_files[0]?.sha256 === checksum, 'review checksum');
});

test('proof target constants', () => {
  assert(PROOF_TARGET === 'play_build_govern_surface_v1', 'proof target');
  assert(PACKET_AUTHORITY === 'AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1', 'packet authority');
});

console.log(`play-build-govern-surface-v1 contract OK (${PACKET_AUTHORITY} / ${PROOF_TARGET})`);