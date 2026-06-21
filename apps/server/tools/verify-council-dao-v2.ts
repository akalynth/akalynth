// Verify council DAO v2 treasury + reputation contract.
//
// Proof target: council_treasury_reputation_v2
// Parent: council_lane_check_permit_v1 (AKALYNTH_COUNCIL_DAO_V1)

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKET_AUTHORITY = 'AKALYNTH_COUNCIL_DAO_V2';
const PROOF_TARGET = 'council_treasury_reputation_v2';
const PARENT_PROOF_TARGET = 'council_lane_check_permit_v1';

const MEMBER_SCHEMA_VERSION = 'council-member-reputation/v1';
const LEDGER_SCHEMA_VERSION = 'council-treasury-ledger-entry/v1';
const CURRENCY_UNIT = 'ops_credit';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, '../../..');
const CODEX_ROOT = path.join(REPO_ROOT, '../akalynth-codex');

const SAMPLE_PATHS = {
  member: path.join(CODEX_ROOT, 'samples/council-member-reputation.sample.json'),
  ledger: path.join(CODEX_ROOT, 'samples/council-treasury-ledger-entry.sample.json'),
  proposal: path.join(CODEX_ROOT, 'samples/council-proposal-v2-weighted.sample.json'),
};

interface MemberReputation {
  schema_version: string;
  member_id: string;
  reputation_score: number;
  status: string;
}

interface LedgerEntry {
  schema_version: string;
  object_id: string;
  entry_type: string;
  amount: number;
  currency_unit: string;
  related_permit_id?: string;
  related_proposal_id?: string;
}

interface ProposalQuorum {
  min_approvals?: number;
  min_participation?: number;
  min_weighted_approvals?: number;
}

interface Proposal {
  schema_version: string;
  object_id: string;
  packet_authority: { object_id: string };
  quorum?: ProposalQuorum;
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

test('member reputation sample matches v2 schema version', () => {
  const member = readJson<MemberReputation>(SAMPLE_PATHS.member);
  assert(member.schema_version === MEMBER_SCHEMA_VERSION, `expected ${MEMBER_SCHEMA_VERSION}`);
  assert(member.member_id.length > 0, 'member_id required');
  assert(member.reputation_score > 0, 'reputation_score must be positive');
  assert(member.status === 'active', 'fixture member must be active');
});

test('treasury ledger sample uses ops_credit only', () => {
  const entry = readJson<LedgerEntry>(SAMPLE_PATHS.ledger);
  assert(entry.schema_version === LEDGER_SCHEMA_VERSION, `expected ${LEDGER_SCHEMA_VERSION}`);
  assert(entry.currency_unit === CURRENCY_UNIT, `expected ${CURRENCY_UNIT}`);
  assert(entry.entry_type === 'permit_execution', 'fixture entry_type');
  assert(entry.amount < 0, 'permit_execution should debit');
  assert(entry.related_permit_id?.startsWith('AKALYNTH_COUNCIL_PERMIT_'), 'permit ref');
  assert(entry.related_proposal_id?.startsWith('AKALYNTH_COUNCIL_PROPOSAL_'), 'proposal ref');
});

test('v2 weighted proposal references v2 packet authority', () => {
  const proposal = readJson<Proposal>(SAMPLE_PATHS.proposal);
  assert(proposal.schema_version === 'council-proposal/v1', 'proposal stays v1 schema');
  assert(proposal.packet_authority.object_id === PACKET_AUTHORITY, 'v2 packet authority');
  assert(
    (proposal.quorum?.min_weighted_approvals ?? 0) > 0,
    'min_weighted_approvals required for v2 proof',
  );
});

test('proof target constants', () => {
  assert(PROOF_TARGET === 'council_treasury_reputation_v2', 'proof target id');
  assert(PARENT_PROOF_TARGET === 'council_lane_check_permit_v1', 'parent proof');
});

console.log(`council-dao-v2 contract OK (${PACKET_AUTHORITY} / ${PROOF_TARGET})`);