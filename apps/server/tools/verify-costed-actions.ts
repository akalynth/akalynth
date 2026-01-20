// Verify Costed Actions v0 (Gold Pressure)
// Tests that costed actions properly debit Gold before execution

import {
  clearTreasuryProjection,
  getGoldBalance,
  applyReceiptToTreasury,
  debitForAction,
} from '../src/world/treasury.js';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import {
  computeEventHash,
  computeInputsHash,
  computeOutputsHash,
  GENESIS_MARKER,
} from '@akalynth/coordination-kernel';
import {
  WALLET_CREDIT_ACTION,
  ACTION_GOLD_COST,
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

// Collect receipts for verification
const receipts: AuditReceipt[] = [];
let lastEventHash: string | null = null;
let lastSequence = 0;

function buildReceipt(
  receipt: Omit<AuditReceipt, 'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'>,
  useChain: boolean
): AuditReceipt {
  const timestamp = new Date().toISOString();
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

function mockWriteReceipt(
  receipt: Omit<AuditReceipt, 'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'>
) {
  const fullReceipt = buildReceipt(receipt, true);
  receipts.push(fullReceipt);
  // Apply to treasury (simulates what logger.ts does)
  applyReceiptToTreasury(fullReceipt);
}

function resetReceipts() {
  receipts.length = 0;
  lastEventHash = null;
  lastSequence = 0;
}

// Reset state before tests
clearTreasuryProjection();
resetReceipts();

test('inspect_player is in cost schedule', () => {
  const cost = ACTION_GOLD_COST['inspect_player'];
  assertEquals(cost !== undefined, true, 'inspect_player should be in schedule');
  assertEquals(cost, 1, 'inspect_player cost should be 1');
});

test('debitForAction rejects when balance is 0', () => {
  clearTreasuryProjection();
  resetReceipts();

  const result = debitForAction('player-1', 'inspect_player', mockWriteReceipt);
  assertEquals(result.ok, false, 'should fail');
  if (!result.ok) {
    assertEquals(result.error, 'insufficient_gold', 'error should be insufficient_gold');
  }
  assertEquals(receipts.length, 0, 'no receipt should be written');
});

test('debitForAction succeeds when balance >= cost', () => {
  clearTreasuryProjection();
  resetReceipts();

  // Credit 10 Gold
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-2',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 10, reason: 'debug_grant' },
    result: 'ok',
  }, false));

  assertEquals(getGoldBalance('player-2'), 10, 'initial balance');

  const result = debitForAction('player-2', 'inspect_player', mockWriteReceipt);
  assertEquals(result.ok, true, 'should succeed');
  if (result.ok) {
    assertEquals(result.cost, 1, 'cost should be 1');
  }
  assertEquals(getGoldBalance('player-2'), 9, 'balance after debit');
  assertEquals(receipts.length, 1, 'one receipt should be written');
  assertEquals(receipts[0].action, 'wallet_debit', 'receipt action');
  assertEquals(receipts[0].inputs.reason, 'action_cost:inspect_player', 'receipt reason');
});

test('debitForAction rejects unknown action', () => {
  clearTreasuryProjection();
  resetReceipts();

  // Credit some Gold
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-3',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 100, reason: 'debug_grant' },
    result: 'ok',
  }, false));

  const result = debitForAction('player-3', 'unknown_action', mockWriteReceipt);
  assertEquals(result.ok, false, 'should fail');
  if (!result.ok) {
    assertEquals(result.error, 'unknown_action', 'error should be unknown_action');
  }
  assertEquals(receipts.length, 0, 'no receipt for unknown action');
  assertEquals(getGoldBalance('player-3'), 100, 'balance unchanged');
});

test('multiple debits drain balance correctly', () => {
  clearTreasuryProjection();
  resetReceipts();

  // Credit 5 Gold
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-4',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 5, reason: 'debug_grant' },
    result: 'ok',
  }, false));

  // Perform 5 inspect_player actions (each costs 1)
  for (let i = 0; i < 5; i++) {
    const result = debitForAction('player-4', 'inspect_player', mockWriteReceipt);
    assertEquals(result.ok, true, `debit ${i + 1} should succeed`);
  }

  assertEquals(getGoldBalance('player-4'), 0, 'balance should be 0');

  // 6th should fail
  const result = debitForAction('player-4', 'inspect_player', mockWriteReceipt);
  assertEquals(result.ok, false, '6th debit should fail');
  if (!result.ok) {
    assertEquals(result.error, 'insufficient_gold', 'error should be insufficient_gold');
  }
});

test('replay equivalence - receipts reconstruct same balance', () => {
  clearTreasuryProjection();
  resetReceipts();

  // Simulate sequence: credit 10, spend 3 on inspects
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'replay-test',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 10, reason: 'debug_grant' },
    result: 'ok',
  }, false));

  debitForAction('replay-test', 'inspect_player', mockWriteReceipt);
  debitForAction('replay-test', 'inspect_player', mockWriteReceipt);
  debitForAction('replay-test', 'inspect_player', mockWriteReceipt);

  const balanceBeforeReplay = getGoldBalance('replay-test');
  assertEquals(balanceBeforeReplay, 7, 'balance before replay');

  // Clear and replay all receipts
  const allReceipts = [
    buildReceipt({
      actor_id: 'replay-test',
      action: WALLET_CREDIT_ACTION,
      inputs: { amount: 10, reason: 'debug_grant' },
      result: 'ok',
    }, false),
    ...receipts.filter(r => r.actor_id === 'replay-test'),
  ];

  clearTreasuryProjection();
  for (const r of allReceipts) {
    applyReceiptToTreasury(r);
  }

  const balanceAfterReplay = getGoldBalance('replay-test');
  assertEquals(balanceAfterReplay, 7, 'balance after replay should match');
});

test('debit does not leak balance (only ok/error returned)', () => {
  clearTreasuryProjection();
  receipts.length = 0;

  // Credit 100 Gold
  applyReceiptToTreasury(buildReceipt({
    actor_id: 'player-leak-test',
    action: WALLET_CREDIT_ACTION,
    inputs: { amount: 100, reason: 'debug_grant' },
    result: 'ok',
  }, false));

  const result = debitForAction('player-leak-test', 'inspect_player', mockWriteReceipt);

  // Result should NOT contain balance information
  assertEquals(result.ok, true);
  assertEquals('balance' in result, false, 'result should not leak balance');
  assertEquals('gold' in result, false, 'result should not leak gold');
});

console.log('\n✓ All costed actions tests passed');
