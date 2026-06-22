// Proof target: builder_operator_review_v1
// Authority: AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1 (PR-11 operator review evidence)

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computePermitFingerprint,
  storeOperatorReviewEvidence,
  type BuilderPromotionPermit,
} from '../src/builder/operatorReview.js';

const PACKET_AUTHORITY = 'AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1';
const PROOF_TARGET = 'builder_operator_review_v1';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const OPS_ROOT = path.resolve(TOOL_DIR, '../../../../..');
const PERMIT = path.join(OPS_ROOT, 'builder/permits/rookguard-kit-v1.json');
const REVIEW = path.join(
  OPS_ROOT,
  'repos/akalynth-codex/samples/rookguard-promotion-review-packet.sample.json',
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

test('rookguard permit sample exists for review lane', () => {
  assert(existsSync(PERMIT), 'permit file');
  const permit = JSON.parse(readFileSync(PERMIT, 'utf8')) as BuilderPromotionPermit;
  assert(
    permit.execution_status === 'publish_skipped' || permit.execution_status === 'publish_performed',
    'permit execution status',
  );
  assert(permit.lane_target === 'beta', 'beta lane');
});

test('operator review evidence store writes fingerprint receipt', () => {
  const permit = JSON.parse(readFileSync(PERMIT, 'utf8')) as BuilderPromotionPermit;
  const fp = computePermitFingerprint(permit);
  assert(fp.length === 64, 'fingerprint');
  const { evidenceDir, fingerprint } = storeOperatorReviewEvidence(
    OPS_ROOT,
    permit.review_packet_id,
    PERMIT,
    REVIEW,
  );
  assert(existsSync(path.join(evidenceDir, 'permit.json')), 'stored permit');
  assert(existsSync(path.join(evidenceDir, 'review-packet.json')), 'stored review');
  const receipt = JSON.parse(readFileSync(path.join(evidenceDir, 'receipt.json'), 'utf8')) as {
    permit_fingerprint: string;
  };
  assert(receipt.permit_fingerprint === fingerprint, 'receipt fingerprint');
});

console.log(`builder-operator-review-v1 OK (${PACKET_AUTHORITY} / ${PROOF_TARGET})`);