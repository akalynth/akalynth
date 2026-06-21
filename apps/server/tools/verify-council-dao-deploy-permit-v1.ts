// Verify council DAO deploy permit v1 contract.
//
// Proof target: council_lane_deploy_permit_v1
// Parent: council_treasury_reputation_v2 (AKALYNTH_COUNCIL_DAO_V2)

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKET_AUTHORITY = 'AKALYNTH_COUNCIL_DAO_DEPLOY_PERMIT_V1';
const PROOF_TARGET = 'council_lane_deploy_permit_v1';
const PARENT_PROOF_TARGET = 'council_treasury_reputation_v2';
const HUMAN_ACK_SCHEMA = 'council-human-ack/v1';
const DEPLOY_ACTION_CLASSES = ['lane:beta:deploy', 'lane:staging:deploy'] as const;

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, '../../..');
const CODEX_ROOT = path.join(REPO_ROOT, '../akalynth-codex');

const SAMPLE_PATHS = {
  betaDeploy: path.join(CODEX_ROOT, 'samples/council-proposal-deploy-beta.sample.json'),
  stagingDeploy: path.join(CODEX_ROOT, 'samples/council-proposal-deploy-staging.sample.json'),
};

interface DeployProposal {
  schema_version: string;
  action_class: string;
  packet_authority: { object_id: string };
  action_params: {
    lane: string;
    dry_run?: boolean;
    execution_ack_required?: boolean;
  };
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

test('beta deploy sample references deploy permit authority', () => {
  const proposal = readJson<DeployProposal>(SAMPLE_PATHS.betaDeploy);
  assert(proposal.schema_version === 'council-proposal/v1', 'proposal schema');
  assert(proposal.packet_authority.object_id === PACKET_AUTHORITY, 'packet authority');
  assert(proposal.action_class === 'lane:beta:deploy', 'beta deploy class');
  assert(proposal.action_params.execution_ack_required === true, 'ack required');
  assert(proposal.action_params.lane === 'beta', 'lane beta');
});

test('staging deploy sample is dry-run fixture with ack required', () => {
  const proposal = readJson<DeployProposal>(SAMPLE_PATHS.stagingDeploy);
  assert(proposal.action_class === 'lane:staging:deploy', 'staging deploy class');
  assert(proposal.action_params.dry_run === true, 'dry_run fixture');
  assert(proposal.action_params.execution_ack_required === true, 'ack required');
});

test('deploy action class set', () => {
  assert(DEPLOY_ACTION_CLASSES.includes('lane:beta:deploy'), 'beta deploy');
  assert(DEPLOY_ACTION_CLASSES.includes('lane:staging:deploy'), 'staging deploy');
});

test('proof target constants', () => {
  assert(PROOF_TARGET === 'council_lane_deploy_permit_v1', 'proof target');
  assert(PARENT_PROOF_TARGET === 'council_treasury_reputation_v2', 'parent proof');
  assert(HUMAN_ACK_SCHEMA === 'council-human-ack/v1', 'human ack schema');
});

console.log(`council-dao-deploy-permit-v1 contract OK (${PACKET_AUTHORITY} / ${PROOF_TARGET})`);