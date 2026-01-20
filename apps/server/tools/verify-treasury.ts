// Verify Treasury Kernel v0 (Gold)
// Tests that treasury is correctly rebuilt from receipts

import {
  clearTreasuryProjection,
  getGoldBalance,
  canAfford,
  applyReceiptToTreasury,
} from '../src/world/treasury.js';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import {
  WALLET_CREDIT_ACTION,
  WALLET_DEBIT_ACTION,
  MAX_GOLD_AMOUNT,
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
  clearTreasuryProjection();
  lastEventHash = null;
  lastSequence = 0;
}

// Reset state before tests
resetState();

test('empty balance returns 0', () => {
  const balance = getGoldBalance('unknown-player');
  assertEquals(balance, 0);
});

test('wallet_credit adds to balance', () => {
  resetState();
  const receipt = buildReceipt({
    actor_id: 'player-1',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 100, reason: 'debug_grant' },
    result: 'ok',
  });
  applyReceiptToTreasury(receipt);

  const balance = getGoldBalance('player-1');
  assertEquals(balance, 100);
});

test('wallet_debit subtracts from balance', () => {
  resetState();

  // First credit
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-2',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 100, reason: 'debug_grant' },
    result: 'ok',
  }));

  // Then debit
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-2',
    action: WALLET_DEBIT_ACTION,
    inputs: { amount: 30, reason: 'temple_tithe' },
    result: 'ok',
  }));

  const balance = getGoldBalance('player-2');
  assertEquals(balance, 70);
});

test('canAfford returns true when sufficient', () => {
  resetState();

  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-3',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 100, reason: 'debug_grant' },
    result: 'ok',
  }));

  assertEquals(canAfford('player-3', 50), true);
  assertEquals(canAfford('player-3', 100), true);
  assertEquals(canAfford('player-3', 101), false);
});

test('canAfford rejects invalid amounts', () => {
  resetState();

  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-4',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 100, reason: 'debug_grant' },
    result: 'ok',
  }));

  assertEquals(canAfford('player-4', 0), false, 'zero');
  assertEquals(canAfford('player-4', -10), false, 'negative');
  assertEquals(canAfford('player-4', 1.5), false, 'float');
  assertEquals(canAfford('player-4', MAX_GOLD_AMOUNT + 1), false, 'over max');
});

test('balance never goes negative - invalid debit skipped', () => {
  resetState();

  // Credit 50
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-5',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 50, reason: 'debug_grant' },
    result: 'ok',
  }));

  // Try to debit 100 (should be skipped with warning)
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-5',
    action: WALLET_DEBIT_ACTION,
    inputs: { amount: 100, reason: 'temple_tithe' },
    result: 'ok',
  }));

  // Balance should still be 50 (invalid debit skipped)
  const balance = getGoldBalance('player-5');
  assertEquals(balance, 50);
});

test('replay equivalence - multiple players, credit/debit sequence', () => {
  resetState();

  // Simulate receipts in order (as would happen during replay)
  const receipts: AuditReceipt[] = [
    // Player A gets 100
    buildReceipt({ actor_id: 'a', action: WALLET_CREDIT_ACTION, inputs: { amount: 100, reason: 'debug_grant' }, result: 'ok' }, { timestamp: '2024-01-01T00:00:00Z', useChain: true }),
    // Player B gets 50
    buildReceipt({ actor_id: 'b', action: WALLET_CREDIT_ACTION, inputs: { amount: 50, reason: 'work_contract' }, result: 'ok' }, { timestamp: '2024-01-01T00:01:00Z', useChain: true }),
    // Player A spends 30
    buildReceipt({ actor_id: 'a', action: WALLET_DEBIT_ACTION, inputs: { amount: 30, reason: 'temple_tithe' }, result: 'ok' }, { timestamp: '2024-01-01T00:02:00Z', useChain: true }),
    // Player B gets another 25
    buildReceipt({ actor_id: 'b', action: WALLET_CREDIT_ACTION, inputs: { amount: 25, reason: 'work_contract' }, result: 'ok' }, { timestamp: '2024-01-01T00:03:00Z', useChain: true }),
    // Player A spends 20
    buildReceipt({ actor_id: 'a', action: WALLET_DEBIT_ACTION, inputs: { amount: 20, reason: 'temple_tithe' }, result: 'ok' }, { timestamp: '2024-01-01T00:04:00Z', useChain: true }),
    // Player B spends 40
    buildReceipt({ actor_id: 'b', action: WALLET_DEBIT_ACTION, inputs: { amount: 40, reason: 'temple_tithe' }, result: 'ok' }, { timestamp: '2024-01-01T00:05:00Z', useChain: true }),
  ];

  // Replay all receipts
  for (const r of receipts) {
    applyReceiptToTreasury(r);
  }

  // Verify final state
  // Player A: 100 - 30 - 20 = 50
  const balanceA = getGoldBalance('a');
  assertEquals(balanceA, 50, 'Player A balance');

  // Player B: 50 + 25 - 40 = 35
  const balanceB = getGoldBalance('b');
  assertEquals(balanceB, 35, 'Player B balance');
});

test('reducer ignores non-treasury receipts', () => {
  resetState();

  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-x',
    action: 'move',
    inputs: { direction: 'north' },
    result: 'ok',
  }));

  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-x',
    action: 'vocation_declared',
    inputs: { vocation: 'warden' },
    result: 'ok',
  }));

  const balance = getGoldBalance('player-x');
  assertEquals(balance, 0);
});

test('reducer handles missing player_id gracefully', () => {
  resetState();

  // This should not throw
  applyReceiptToTreasury(buildReceipt({
    actor_id: '',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 100, reason: 'debug_grant' },
    result: 'ok',
  }));

  // Empty string player should be ignored
  assertEquals(getGoldBalance(''), 0);
});

test('reducer validates amount bounds', () => {
  resetState();

  // Invalid: zero
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-bounds',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 0, reason: 'debug_grant' },
    result: 'ok',
  }));
  assertEquals(getGoldBalance('player-bounds'), 0, 'zero amount ignored');

  // Invalid: negative
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-bounds',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: -50, reason: 'debug_grant' },
    result: 'ok',
  }));
  assertEquals(getGoldBalance('player-bounds'), 0, 'negative amount ignored');

  // Invalid: float
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-bounds',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 10.5, reason: 'debug_grant' },
    result: 'ok',
  }));
  assertEquals(getGoldBalance('player-bounds'), 0, 'float amount ignored');

  // Invalid: over max
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-bounds',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: MAX_GOLD_AMOUNT + 1, reason: 'debug_grant' },
    result: 'ok',
  }));
  assertEquals(getGoldBalance('player-bounds'), 0, 'over-max amount ignored');

  // Valid: exactly max
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-bounds',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: MAX_GOLD_AMOUNT, reason: 'debug_grant' },
    result: 'ok',
  }));
  assertEquals(getGoldBalance('player-bounds'), MAX_GOLD_AMOUNT, 'max amount accepted');
});

console.log('\n✓ All treasury kernel tests passed');
