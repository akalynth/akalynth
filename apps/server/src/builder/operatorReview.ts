// Operator review evidence scaffold (PR-11) — permit fingerprint, no lane publish.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface BuilderPromotionPermit {
  schema_version: 'builder-promotion-permit/v1';
  permit_id: string;
  review_packet_id: string;
  source_object: string;
  lane_target: 'beta' | 'staging';
  issued_utc: string;
  reviewer: string;
  draft_manifest_checksum: string;
  execution_status: 'permit_issued' | 'publish_skipped' | 'publish_performed';
  non_mutation_boundary: {
    deployment: 'not_performed' | 'performed';
    lane_publish: 'not_performed' | 'skipped' | 'performed';
    runtime_state: 'unchanged' | 'mutated';
  };
  non_claims: string[];
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

export function computePermitFingerprint(permit: BuilderPromotionPermit): string {
  return createHash('sha256').update(stableStringify(permit)).digest('hex');
}

export function storeOperatorReviewEvidence(
  opsRoot: string,
  reviewPacketId: string,
  permitPath: string,
  reviewPath?: string,
): { evidenceDir: string; fingerprint: string } {
  const permit = JSON.parse(readFileSync(permitPath, 'utf8')) as BuilderPromotionPermit;
  const fingerprint = computePermitFingerprint(permit);
  const evidenceDir = join(opsRoot, 'evidence/builder-reviews', reviewPacketId);
  mkdirSync(evidenceDir, { recursive: true });
  copyFileSync(permitPath, join(evidenceDir, 'permit.json'));
  if (reviewPath && existsSync(reviewPath)) {
    copyFileSync(reviewPath, join(evidenceDir, 'review-packet.json'));
  }
  writeFileSync(
    join(evidenceDir, 'receipt.json'),
    `${JSON.stringify(
      {
        artifact: 'AKALYNTH_BUILDER_OPERATOR_REVIEW_V1',
        review_packet_id: reviewPacketId,
        permit_fingerprint: fingerprint,
        stored_utc: new Date().toISOString(),
        lane_publish: 'not_performed',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return { evidenceDir, fingerprint };
}