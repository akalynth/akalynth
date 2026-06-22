// Builder draft + local preview contracts (Play, Build, Govern Surface v1).
// Codex authority: AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1
// Preview namespaces are non-authoritative; live lanes must never read them as truth.

import { createHash } from 'node:crypto';

export const BUILDER_DRAFT_MANIFEST_SCHEMA_VERSION = 'builder-draft-manifest/v1';
export const LOCAL_PREVIEW_SESSION_SCHEMA_VERSION = 'local-preview-session/v1';
export const PROMOTION_REVIEW_PACKET_SCHEMA_VERSION = 'promotion-review-packet/v1';
export const BUILDER_PROMOTION_PERMIT_SCHEMA_VERSION = 'builder-promotion-permit/v1';

export const PREVIEW_NAMESPACE_PREFIX = 'preview:';

export type BuilderDraftStatus = 'draft' | 'submitted' | 'in_review' | 'accepted' | 'rejected' | 'revise';
export type PreviewReceiptLane = 'preview_only' | 'live';
export type PromotionLaneTarget = 'beta' | 'staging';
export type PromotionDecision = 'accept' | 'reject' | 'revise';

export interface BuilderChangedFile {
  path: string;
  sha256: string;
}

export interface BuilderAbuseReview {
  grants_live_rewards: false;
  grants_live_access: false;
  notes?: string;
}

export interface BuilderDraftManifest {
  schema_version: typeof BUILDER_DRAFT_MANIFEST_SCHEMA_VERSION;
  object_id: string;
  source_object: string;
  packet_ref: string;
  created_utc: string;
  status: BuilderDraftStatus;
  preview_namespace: string;
  changed_files: BuilderChangedFile[];
  abuse_review: BuilderAbuseReview;
  non_claims: string[];
  map_deltas?: Array<{ room_id: string; cells?: Array<[number, number]>; note?: string }>;
  objects?: Array<{ id: string; kind: string; text?: string; placement?: [number, number] }>;
  npc_lines?: Array<{ npc_id: string; line_id: string; text: string }>;
  quest_steps?: Array<{ step_id: string; summary: string; locked_until?: string }>;
}

export interface LocalPreviewSession {
  schema_version: typeof LOCAL_PREVIEW_SESSION_SCHEMA_VERSION;
  session_id: string;
  draft_manifest_ref: string;
  started_utc: string;
  ended_utc: string;
  preview_only: true;
  artifacts: {
    manifest_checksum: string;
    replay_log_ref: string;
    screenshots: string[];
    abuse_review_note?: string;
  };
  receipt_expectations: Array<{ receipt_type: string; lane: PreviewReceiptLane; note?: string }>;
  non_claims: string[];
}

export interface PreviewReceiptRecord {
  receipt_type: string;
  lane: PreviewReceiptLane;
  emitted_utc: string;
  namespace: string;
  session_id: string;
}

/** Non-authoritative world_state fork projected from a loaded preview manifest. */
export interface BuilderPreviewWorldForkObject {
  id: string;
  kind: string;
  text?: string;
  placement: [number, number];
}

export interface BuilderPreviewWorldForkRoom {
  room_id: string;
  cells: Array<[number, number]>;
  note?: string;
}

export interface BuilderPreviewWorldForkNpcLine {
  npc_id: string;
  line_id: string;
  text: string;
}

export interface BuilderPreviewPlacementViolation {
  ref: string;
  x: number;
  y: number;
  reason: 'out_of_bounds' | 'not_walkable' | 'unknown_source_map';
}

export interface BuilderPreviewWorldFork {
  preview_only: true;
  namespace: string;
  source_object: string;
  object_id: string;
  map_name: string;
  rooms: BuilderPreviewWorldForkRoom[];
  objects: BuilderPreviewWorldForkObject[];
  npc_lines: BuilderPreviewWorldForkNpcLine[];
  placement_validation: {
    ok: boolean;
    violations: BuilderPreviewPlacementViolation[];
  };
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

/** Canonical checksum aligned with akalynth-ops builder-promotion-gate.sh */
export function computeManifestChecksum(manifest: BuilderDraftManifest): string {
  const clone = structuredClone(manifest) as BuilderDraftManifest;
  for (const item of clone.changed_files) {
    if (item.path.endsWith('rookguard-builder-draft-manifest.sample.json')) {
      item.sha256 = '0'.repeat(64);
    }
  }
  return createHash('sha256').update(stableStringify(clone)).digest('hex');
}

export function assertPreviewNamespace(namespace: string): void {
  if (!namespace.startsWith(PREVIEW_NAMESPACE_PREFIX)) {
    throw new Error(`builder draft namespace must start with ${PREVIEW_NAMESPACE_PREFIX}`);
  }
}

export function validateDraftManifest(manifest: BuilderDraftManifest): void {
  if (manifest.schema_version !== BUILDER_DRAFT_MANIFEST_SCHEMA_VERSION) {
    throw new Error('invalid builder draft manifest schema');
  }
  assertPreviewNamespace(manifest.preview_namespace);
  if (manifest.abuse_review.grants_live_rewards !== false) {
    throw new Error('builder draft must not grant live rewards');
  }
  if (manifest.abuse_review.grants_live_access !== false) {
    throw new Error('builder draft must not grant live access');
  }
}

export function validatePreviewSession(
  session: LocalPreviewSession,
  manifest: BuilderDraftManifest,
): void {
  if (session.schema_version !== LOCAL_PREVIEW_SESSION_SCHEMA_VERSION) {
    throw new Error('invalid local preview session schema');
  }
  if (session.preview_only !== true) {
    throw new Error('preview session must be preview_only');
  }
  const checksum = computeManifestChecksum(manifest);
  if (session.artifacts.manifest_checksum !== checksum) {
    throw new Error('preview session manifest checksum mismatch');
  }
}

export function buildPreviewNamespace(sourceObject: string, draftSlug: string): string {
  return `${PREVIEW_NAMESPACE_PREFIX}${sourceObject}:${draftSlug}`;
}