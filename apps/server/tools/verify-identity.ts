// Verify Identity Replay Equivalence
// Tests that identity is correctly rebuilt from receipts

import {
  clearIdentityProjection,
  getIdentity,
  applyReceiptToIdentity,
} from '../src/world/identity.js';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import {
  VOCATION_DECLARED_ACTION,
  SOVEREIGN_PREFIX_GRANTED_ACTION,
  SOVEREIGN_PREFIX_REVOKED_ACTION,
} from '../../../packages/shared/types.js';
import {
  computeEventHash,
  computeInputsHash,
  computeOutputsHash,
  GENESIS_MARKER,
} from '@akalynth/coordination-kernel';

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

function assertEquals<T>(actual: T, expected: T, msg?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

let lastEventHash: string | null = null;
let lastSequence = 0;

function buildReceipt(
  receipt: Omit<AuditReceipt, 'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'>,
  options: { timestamp?: string; useChain?: boolean } = {}
): AuditReceipt {
  const timestamp = options.timestamp ?? new Date().toISOString();
  const useChain = options.useChain ?? false;
  const prev_hash = useChain ? (lastEventHash ?? GENESIS_MARKER) : GENESIS_MARKER;
  const sequence = useChain ? lastSequence + 1 : 0;
  const inputs_hash = computeInputsHash(receipt.inputs);
  const outputs_hash = computeOutputsHash(receipt.result);
  const body = {
    ...receipt,
    sequence,
    timestamp,
    prev_hash,
    inputs_hash,
    outputs_hash,
  };
  const event_hash = computeEventHash(body);
  const fullReceipt: AuditReceipt = {
    ...body,
    event_hash,
    signature: 'test-signature',
  };

  if (useChain) {
    lastEventHash = event_hash;
    lastSequence = sequence;
  }

  return fullReceipt;
}

function resetState() {
  clearIdentityProjection();
  lastEventHash = null;
  lastSequence = 0;
}

// Reset state before tests
resetState();

test('empty identity returns defaults', () => {
  const identity = getIdentity('unknown-player');
  assertEquals(identity.vocation, null);
  assertEquals(identity.sovereign_prefix, false);
});

test('vocation_declared sets vocation', () => {
  resetState();
  const receipt = buildReceipt({
    actor_id: 'player-1',
    action: VOCATION_DECLARED_ACTION,
    inputs: { vocation: 'warden' },
    result: 'ok',
  });
  applyReceiptToIdentity(receipt);

  const identity = getIdentity('player-1');
  assertEquals(identity.vocation, 'warden');
  assertEquals(identity.sovereign_prefix, false);
});

test('sovereign_prefix_granted sets prefix', () => {
  resetState();
  // First set vocation
  applyReceiptToIdentity(buildReceipt({
    actor_id: 'player-2',
    action: VOCATION_DECLARED_ACTION,
    inputs: { vocation: 'hexer' },
    result: 'ok',
  }));
  // Then grant prefix
  applyReceiptToIdentity(buildReceipt({
    actor_id: 'player-2',
    action: SOVEREIGN_PREFIX_GRANTED_ACTION,
    inputs: { source: 'debug' },
    result: 'ok',
  }));

  const identity = getIdentity('player-2');
  assertEquals(identity.vocation, 'hexer');
  assertEquals(identity.sovereign_prefix, true);
});

test('sovereign_prefix_revoked clears prefix', () => {
  resetState();
  // Grant then revoke
  applyReceiptToIdentity(buildReceipt({
    actor_id: 'player-3',
    action: VOCATION_DECLARED_ACTION,
    inputs: { vocation: 'cantor' },
    result: 'ok',
  }));
  applyReceiptToIdentity(buildReceipt({
    actor_id: 'player-3',
    action: SOVEREIGN_PREFIX_GRANTED_ACTION,
    inputs: { source: 'debug' },
    result: 'ok',
  }));
  applyReceiptToIdentity(buildReceipt({
    actor_id: 'player-3',
    action: SOVEREIGN_PREFIX_REVOKED_ACTION,
    inputs: { source: 'debug' },
    result: 'ok',
  }));

  const identity = getIdentity('player-3');
  assertEquals(identity.vocation, 'cantor');
  assertEquals(identity.sovereign_prefix, false);
});

test('replay equivalence - multiple players, order-based', () => {
  resetState();

  // Simulate receipts in order (as would happen during replay)
  const receipts: AuditReceipt[] = [
    // Player A declares warden
    buildReceipt({ actor_id: 'a', action: VOCATION_DECLARED_ACTION, inputs: { vocation: 'warden' }, result: 'ok' }, { timestamp: '2024-01-01T00:00:00Z', useChain: true }),
    // Player B declares hexer
    buildReceipt({ actor_id: 'b', action: VOCATION_DECLARED_ACTION, inputs: { vocation: 'hexer' }, result: 'ok' }, { timestamp: '2024-01-01T00:01:00Z', useChain: true }),
    // Player A changes to cantor
    buildReceipt({ actor_id: 'a', action: VOCATION_DECLARED_ACTION, inputs: { vocation: 'cantor' }, result: 'ok' }, { timestamp: '2024-01-01T00:02:00Z', useChain: true }),
    // Player B gets prefix
    buildReceipt({ actor_id: 'b', action: SOVEREIGN_PREFIX_GRANTED_ACTION, inputs: { source: 'debug' }, result: 'ok' }, { timestamp: '2024-01-01T00:03:00Z', useChain: true }),
    // Player A gets prefix
    buildReceipt({ actor_id: 'a', action: SOVEREIGN_PREFIX_GRANTED_ACTION, inputs: { source: 'debug' }, result: 'ok' }, { timestamp: '2024-01-01T00:04:00Z', useChain: true }),
    // Player B revokes prefix
    buildReceipt({ actor_id: 'b', action: SOVEREIGN_PREFIX_REVOKED_ACTION, inputs: { source: 'debug' }, result: 'ok' }, { timestamp: '2024-01-01T00:05:00Z', useChain: true }),
  ];

  // Replay all receipts
  for (const r of receipts) {
    applyReceiptToIdentity(r);
  }

  // Verify final state
  const identityA = getIdentity('a');
  assertEquals(identityA.vocation, 'cantor', 'Player A vocation');
  assertEquals(identityA.sovereign_prefix, true, 'Player A prefix');

  const identityB = getIdentity('b');
  assertEquals(identityB.vocation, 'hexer', 'Player B vocation');
  assertEquals(identityB.sovereign_prefix, false, 'Player B prefix');
});

test('reducer ignores non-identity receipts', () => {
  resetState();

  applyReceiptToIdentity(buildReceipt({
    actor_id: 'player-x',
    action: 'move',
    inputs: { direction: 'north' },
    result: 'ok',
  }));

  const identity = getIdentity('player-x');
  assertEquals(identity.vocation, null);
  assertEquals(identity.sovereign_prefix, false);
});

test('reducer handles missing player_id gracefully', () => {
  resetState();

  // This should not throw
  applyReceiptToIdentity(buildReceipt({
    actor_id: '',
    action: VOCATION_DECLARED_ACTION,
    inputs: { vocation: 'reaver' },
    result: 'ok',
  }));

  // Empty string player should be ignored
  assertEquals(getIdentity('').vocation, null);
});

console.log('\n✓ All identity replay tests passed');
