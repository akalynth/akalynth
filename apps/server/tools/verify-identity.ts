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

// Reset state before tests
clearIdentityProjection();

test('empty identity returns defaults', () => {
  const identity = getIdentity('unknown-player');
  assertEquals(identity.vocation, null);
  assertEquals(identity.sovereign_prefix, false);
});

test('vocation_declared sets vocation', () => {
  clearIdentityProjection();
  const receipt: AuditReceipt = {
    timestamp: new Date().toISOString(),
    player_id: 'player-1',
    action: VOCATION_DECLARED_ACTION,
    inputs: { vocation: 'warden' },
    result: 'ok',
  };
  applyReceiptToIdentity(receipt);

  const identity = getIdentity('player-1');
  assertEquals(identity.vocation, 'warden');
  assertEquals(identity.sovereign_prefix, false);
});

test('sovereign_prefix_granted sets prefix', () => {
  clearIdentityProjection();
  // First set vocation
  applyReceiptToIdentity({
    timestamp: new Date().toISOString(),
    player_id: 'player-2',
    action: VOCATION_DECLARED_ACTION,
    inputs: { vocation: 'hexer' },
    result: 'ok',
  });
  // Then grant prefix
  applyReceiptToIdentity({
    timestamp: new Date().toISOString(),
    player_id: 'player-2',
    action: SOVEREIGN_PREFIX_GRANTED_ACTION,
    inputs: { source: 'debug' },
    result: 'ok',
  });

  const identity = getIdentity('player-2');
  assertEquals(identity.vocation, 'hexer');
  assertEquals(identity.sovereign_prefix, true);
});

test('sovereign_prefix_revoked clears prefix', () => {
  clearIdentityProjection();
  // Grant then revoke
  applyReceiptToIdentity({
    timestamp: new Date().toISOString(),
    player_id: 'player-3',
    action: VOCATION_DECLARED_ACTION,
    inputs: { vocation: 'cantor' },
    result: 'ok',
  });
  applyReceiptToIdentity({
    timestamp: new Date().toISOString(),
    player_id: 'player-3',
    action: SOVEREIGN_PREFIX_GRANTED_ACTION,
    inputs: { source: 'debug' },
    result: 'ok',
  });
  applyReceiptToIdentity({
    timestamp: new Date().toISOString(),
    player_id: 'player-3',
    action: SOVEREIGN_PREFIX_REVOKED_ACTION,
    inputs: { source: 'debug' },
    result: 'ok',
  });

  const identity = getIdentity('player-3');
  assertEquals(identity.vocation, 'cantor');
  assertEquals(identity.sovereign_prefix, false);
});

test('replay equivalence - multiple players, order-based', () => {
  clearIdentityProjection();

  // Simulate receipts in order (as would happen during replay)
  const receipts: AuditReceipt[] = [
    // Player A declares warden
    { timestamp: '2024-01-01T00:00:00Z', player_id: 'a', action: VOCATION_DECLARED_ACTION, inputs: { vocation: 'warden' }, result: 'ok' },
    // Player B declares hexer
    { timestamp: '2024-01-01T00:01:00Z', player_id: 'b', action: VOCATION_DECLARED_ACTION, inputs: { vocation: 'hexer' }, result: 'ok' },
    // Player A changes to cantor
    { timestamp: '2024-01-01T00:02:00Z', player_id: 'a', action: VOCATION_DECLARED_ACTION, inputs: { vocation: 'cantor' }, result: 'ok' },
    // Player B gets prefix
    { timestamp: '2024-01-01T00:03:00Z', player_id: 'b', action: SOVEREIGN_PREFIX_GRANTED_ACTION, inputs: { source: 'debug' }, result: 'ok' },
    // Player A gets prefix
    { timestamp: '2024-01-01T00:04:00Z', player_id: 'a', action: SOVEREIGN_PREFIX_GRANTED_ACTION, inputs: { source: 'debug' }, result: 'ok' },
    // Player B revokes prefix
    { timestamp: '2024-01-01T00:05:00Z', player_id: 'b', action: SOVEREIGN_PREFIX_REVOKED_ACTION, inputs: { source: 'debug' }, result: 'ok' },
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
  clearIdentityProjection();

  applyReceiptToIdentity({
    timestamp: new Date().toISOString(),
    player_id: 'player-x',
    action: 'move',
    inputs: { direction: 'north' },
    result: 'ok',
  });

  const identity = getIdentity('player-x');
  assertEquals(identity.vocation, null);
  assertEquals(identity.sovereign_prefix, false);
});

test('reducer handles missing player_id gracefully', () => {
  clearIdentityProjection();

  // This should not throw
  applyReceiptToIdentity({
    timestamp: new Date().toISOString(),
    player_id: '',
    action: VOCATION_DECLARED_ACTION,
    inputs: { vocation: 'reaver' },
    result: 'ok',
  });

  // Empty string player should be ignored
  assertEquals(getIdentity('').vocation, null);
});

console.log('\n✓ All identity replay tests passed');
