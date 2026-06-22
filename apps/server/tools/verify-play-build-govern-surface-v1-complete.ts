// Verify full Play, Build, Govern Surface v1 loop closure (PR-7..14).
//
// Proof target: play_build_govern_surface_v1_complete

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKET_AUTHORITY = 'AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1';
const PROOF_TARGET = 'play_build_govern_surface_v1_complete';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, '../../..');
const OPS_ROOT = path.join(REPO_ROOT, '../..');

const PATHS = {
  engineeringReceipt: path.join(
    REPO_ROOT,
    'docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_PLAY_BUILD_GOVERN_SURFACE_V1/receipt.json'
  ),
  closure: path.join(OPS_ROOT, 'evidence/play-build-govern-surface-v1/closure.json'),
  laneReceipt: path.join(OPS_ROOT, 'evidence/play-build-govern-surface-v1/lane-publish-beta.json'),
  loopComplete: path.join(OPS_ROOT, 'evidence/play-build-govern-surface-v1/loop-complete.json'),
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

test('lane publish and loop evidence present', () => {
  for (const filePath of [PATHS.laneReceipt, PATHS.loopComplete, PATHS.closure]) {
    assert(existsSync(filePath), `missing ${filePath}`);
  }
  const lane = readJson<{ status: string; runtime_mutated: boolean }>(PATHS.laneReceipt);
  assert(lane.status === 'pass', 'lane publish pass');
  assert(lane.runtime_mutated === true, 'lane publish mutated runtime tree');
  const loop = readJson<{ loop_status: string; completed_prs: string[] }>(PATHS.loopComplete);
  assert(loop.loop_status === 'complete', 'loop status');
  assert(loop.completed_prs.includes('PR-14'), 'PR-14 in completed list');
});

test('engineering-loop receipt v2 records closure', () => {
  const receipt = readJson<{
    object_id: string;
    status: string;
    validation: { green_commit: string; commands: Array<{ command: string; status: string }> };
    non_mutation_boundary: { lane_publish: string; public_projection_published: boolean };
  }>(PATHS.engineeringReceipt);
  assert(receipt.object_id === 'AKALYNTH_ENGINEERING_LOOP_PLAY_BUILD_GOVERN_SURFACE_V1', 'receipt id');
  assert(receipt.status === 'closed', 'receipt closed');
  assert(receipt.non_mutation_boundary.lane_publish === 'performed', 'lane publish performed');
  assert(receipt.non_mutation_boundary.public_projection_published === true, 'public projection');
  const completeCmd = receipt.validation.commands.find((c) =>
    c.command.includes('verify-play-build-govern-surface-v1-complete')
  );
  assert(completeCmd?.status === 'passed', 'complete verifier command');
});

test('closure v2 records publish state', () => {
  const closure = readJson<{
    object_id: string;
    status: string;
    non_mutation_boundary: {
      deployment: string;
      lane_publish: string;
      public_site_publish: string;
    };
    operator_acceptance: { public_projection_published: boolean };
  }>(PATHS.closure);
  assert(closure.object_id === PACKET_AUTHORITY, 'closure object');
  assert(closure.status === 'closed', 'closure status');
  assert(closure.non_mutation_boundary.deployment === 'performed', 'deployment');
  assert(closure.non_mutation_boundary.lane_publish === 'performed', 'lane publish');
  assert(closure.operator_acceptance.public_projection_published === true, 'public projection');
});

test('proof target constants', () => {
  assert(PROOF_TARGET === 'play_build_govern_surface_v1_complete', 'proof target');
  assert(PACKET_AUTHORITY === 'AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1', 'packet authority');
});

console.log(`play-build-govern-surface-v1-complete OK (${PACKET_AUTHORITY} / ${PROOF_TARGET})`);