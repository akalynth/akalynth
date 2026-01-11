// Verify Work Contract Faucet v0
// Tests cooldown, tick spacing, completion, credit emission, replay equivalence

import {
  clearWorkContractsProjection,
  startContract,
  recordTick,
  completeContract,
  failContract,
  getActiveContract,
  isOnCooldown,
  applyReceiptToWorkContracts,
} from '../src/world/work_contracts.js';
import {
  clearTreasuryProjection,
  getGoldBalance,
  applyReceiptToTreasury,
} from '../src/world/treasury.js';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import { WORK_CONTRACT_SCHEDULE } from '../../../packages/shared/types.js';

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
function mockWriteReceipt(receipt: Omit<AuditReceipt, 'timestamp' | 'evidence_hash'>) {
  const fullReceipt: AuditReceipt = {
    timestamp: new Date().toISOString(),
    ...receipt,
  };
  receipts.push(fullReceipt);
  // Apply to projections (simulates what logger.ts does)
  applyReceiptToWorkContracts(fullReceipt);
  applyReceiptToTreasury(fullReceipt);
}

// Reset state before tests
function resetState() {
  clearWorkContractsProjection();
  clearTreasuryProjection();
  receipts.length = 0;
}

const schedule = WORK_CONTRACT_SCHEDULE['temple_sweep'];

// ============================================================================
// Tests
// ============================================================================

test('can start contract when not on cooldown', () => {
  resetState();
  const now = Date.now();

  const result = startContract('player-1', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result.ok, true, 'should succeed');
  if (result.ok) {
    assertEquals(result.payout_gold, schedule.payout, 'payout');
    assertEquals(typeof result.contract_id, 'string', 'contract_id should be string');
  }
});

test('cannot start contract while one is active', () => {
  resetState();
  const now = Date.now();

  // Start first contract
  const result1 = startContract('player-2', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result1.ok, true, 'first should succeed');

  // Try to start second
  const result2 = startContract('player-2', 'temple_sweep', now + 1000, mockWriteReceipt);
  assertEquals(result2.ok, false, 'second should fail');
  if (!result2.ok) {
    assertEquals(result2.error, 'already_active', 'error should be already_active');
  }
});

test('cannot start contract on cooldown', () => {
  resetState();
  const now = Date.now();

  // Start a contract
  const result1 = startContract('player-3', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result1.ok, true);
  if (!result1.ok) return;

  // Send valid ticks (6 ticks, 5 seconds apart)
  for (let i = 0; i < 6; i++) {
    recordTick('player-3', result1.contract_id, now + (i + 1) * 5000);
  }

  // Complete after min duration (35s > 30s)
  const completeResult = completeContract('player-3', result1.contract_id, now + 35000, mockWriteReceipt);
  assertEquals(completeResult.ok, true, 'complete should succeed');

  // Now try to start another immediately (should be on cooldown)
  const result2 = startContract('player-3', 'temple_sweep', now + 36000, mockWriteReceipt);
  assertEquals(result2.ok, false, 'should fail on cooldown');
  if (!result2.ok) {
    assertEquals(result2.error, 'on_cooldown', 'error should be on_cooldown');
  }
});

test('bursty ticks are rejected', () => {
  resetState();
  const now = Date.now();

  const result = startContract('player-4', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // First tick after 5 seconds (valid)
  const tick1 = recordTick('player-4', result.contract_id, now + 5000);
  assertEquals(tick1.ok, true, 'first tick should succeed');

  // Second tick only 1 second later (too fast, should fail)
  const tick2 = recordTick('player-4', result.contract_id, now + 6000);
  assertEquals(tick2.ok, false, 'bursty tick should fail');
  if (!tick2.ok) {
    assertEquals(tick2.error, 'insufficient_presence', 'error should be insufficient_presence');
  }
});

test('valid tick spacing is accepted', () => {
  resetState();
  const now = Date.now();

  const result = startContract('player-5', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Send ticks with valid spacing (5 seconds apart, which is within 3-8s window)
  for (let i = 0; i < 6; i++) {
    const tickTime = now + (i + 1) * 5000;  // 5s, 10s, 15s, 20s, 25s, 30s
    const tick = recordTick('player-5', result.contract_id, tickTime);
    assertEquals(tick.ok, true, `tick ${i + 1} should succeed`);
  }
});

test('completion requires min duration', () => {
  resetState();
  const now = Date.now();

  const result = startContract('player-6', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Send enough ticks but too quickly (before min_duration_ms)
  for (let i = 0; i < 6; i++) {
    recordTick('player-6', result.contract_id, now + (i + 1) * 4000);  // 4s apart, but total only 24s
  }

  // Try to complete at 25s (before 30s min_duration)
  const completeResult = completeContract('player-6', result.contract_id, now + 25000, mockWriteReceipt);
  assertEquals(completeResult.ok, false, 'should fail before min duration');
  if (!completeResult.ok) {
    assertEquals(completeResult.error, 'insufficient_presence', 'error should be insufficient_presence');
  }
});

test('completion requires tick count', () => {
  resetState();
  const now = Date.now();

  const result = startContract('player-7', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Send only 3 ticks (not enough)
  for (let i = 0; i < 3; i++) {
    recordTick('player-7', result.contract_id, now + (i + 1) * 5000);
  }

  // Try to complete after min duration
  const completeResult = completeContract('player-7', result.contract_id, now + 35000, mockWriteReceipt);
  assertEquals(completeResult.ok, false, 'should fail without enough ticks');
  if (!completeResult.ok) {
    assertEquals(completeResult.error, 'insufficient_presence', 'error should be insufficient_presence');
  }
});

test('successful completion emits wallet_credit', () => {
  resetState();
  const now = Date.now();

  const result = startContract('player-8', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Send 6 ticks with valid spacing
  for (let i = 0; i < 6; i++) {
    recordTick('player-8', result.contract_id, now + (i + 1) * 5000);
  }

  // Complete after min duration
  const completeResult = completeContract('player-8', result.contract_id, now + 35000, mockWriteReceipt);
  assertEquals(completeResult.ok, true, 'should complete successfully');
  if (completeResult.ok) {
    assertEquals(completeResult.credited_gold, schedule.payout, 'credited_gold should match payout');
  }

  // Check wallet_credit receipt was emitted
  const creditReceipts = receipts.filter(r => r.action === 'wallet_credit' && r.player_id === 'player-8');
  assertEquals(creditReceipts.length, 1, 'should have one wallet_credit receipt');
  assertEquals(creditReceipts[0].inputs.reason, 'work_contract', 'reason should be work_contract');
  assertEquals(creditReceipts[0].inputs.amount, schedule.payout, 'amount should match payout');

  // Check balance updated
  const balance = getGoldBalance('player-8');
  assertEquals(balance, schedule.payout, 'balance should equal payout');
});

test('disconnect fails active contract', () => {
  resetState();
  const now = Date.now();

  const result = startContract('player-9', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Simulate disconnect
  const failed = failContract('player-9', 'disconnect', mockWriteReceipt);
  assertEquals(failed, true, 'should fail contract');

  // Check contract is cleared
  const active = getActiveContract('player-9');
  assertEquals(active, null, 'active contract should be null');

  // Check failure receipt
  const failReceipts = receipts.filter(r => r.action === 'work_contract_failed');
  assertEquals(failReceipts.length, 1, 'should have one failure receipt');
  assertEquals(failReceipts[0].inputs.reason, 'disconnect', 'reason should be disconnect');
});

test('replay equivalence - receipts reconstruct cooldown state', () => {
  resetState();
  const now = Date.now();

  // Start and complete a contract
  const result = startContract('player-10', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  for (let i = 0; i < 6; i++) {
    recordTick('player-10', result.contract_id, now + (i + 1) * 5000);
  }
  completeContract('player-10', result.contract_id, now + 35000, mockWriteReceipt);

  const balanceBeforeReplay = getGoldBalance('player-10');
  const onCooldownBefore = isOnCooldown('player-10', now + 40000);

  assertEquals(balanceBeforeReplay, schedule.payout, 'balance before replay');
  assertEquals(onCooldownBefore, true, 'should be on cooldown before replay');

  // Clear and replay all receipts
  clearWorkContractsProjection();
  clearTreasuryProjection();

  for (const r of receipts) {
    applyReceiptToWorkContracts(r);
    applyReceiptToTreasury(r);
  }

  const balanceAfterReplay = getGoldBalance('player-10');
  const onCooldownAfter = isOnCooldown('player-10', Date.now());

  assertEquals(balanceAfterReplay, schedule.payout, 'balance after replay');
  assertEquals(onCooldownAfter, true, 'should still be on cooldown after replay');
});

test('no credit emitted on failure', () => {
  resetState();
  const now = Date.now();

  const result = startContract('player-11', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Fail immediately
  failContract('player-11', 'disconnect', mockWriteReceipt);

  // Check no wallet_credit
  const creditReceipts = receipts.filter(r => r.action === 'wallet_credit' && r.player_id === 'player-11');
  assertEquals(creditReceipts.length, 0, 'should have no wallet_credit receipt');

  // Check balance is still 0
  const balance = getGoldBalance('player-11');
  assertEquals(balance, 0, 'balance should be 0');
});

test('invalid contract_id rejected', () => {
  resetState();
  const now = Date.now();

  const result = startContract('player-12', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Try to tick with wrong contract_id
  const tick = recordTick('player-12', 'wrong-contract-id', now + 5000);
  assertEquals(tick.ok, false, 'should fail with wrong contract_id');
  if (!tick.ok) {
    assertEquals(tick.error, 'invalid_contract', 'error should be invalid_contract');
  }
});

console.log('\n✓ All work contract tests passed');
