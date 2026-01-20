// Verify Work Contract Faucet v0
// Tests cooldown, tick spacing, completion, credit emission, replay equivalence,
// and deterministic reconstruction from receipts (no wall-clock in reducers).

import {
  clearWorkContractsProjection,
  startContract,
  recordTick,
  completeContract,
  failContract,
  getActiveContract,
  isOnCooldown,
  getCooldownRemaining,
  applyReceiptToWorkContracts,
} from '../src/world/work_contracts.js';
import {
  clearTreasuryProjection,
  getGoldBalance,
  applyReceiptToTreasury,
} from '../src/world/treasury.js';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import {
  WORK_CONTRACT_STARTED_ACTION,
  WORK_CONTRACT_TICK_RECORDED_ACTION,
  WORK_CONTRACT_COMPLETED_ACTION,
  WORK_CONTRACT_FAILED_ACTION,
  WALLET_CREDIT_ACTION,
  WORK_CONTRACT_SCHEDULE,
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

function assert(condition: unknown, msg: string) {
  if (!condition) throw new Error(msg);
}

let lastEventHash: string | null = null;
let lastSequence = 0;
let logicalNowMs = 1_700_000_000_000;

function buildReceipt(
  receipt: Omit<
    AuditReceipt,
    'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'
  >
): AuditReceipt {
  const inputs_hash = computeInputsHash(receipt.inputs);
  const outputs_hash = computeOutputsHash(receipt.result);

  const preferredMs =
    typeof (receipt.inputs as Record<string, unknown>).tick_at_ms === 'number'
      ? ((receipt.inputs as Record<string, unknown>).tick_at_ms as number)
      : typeof (receipt.inputs as Record<string, unknown>).started_at_ms === 'number'
        ? ((receipt.inputs as Record<string, unknown>).started_at_ms as number)
        : logicalNowMs;

  const timestamp = new Date(preferredMs).toISOString();
  logicalNowMs = Math.max(logicalNowMs + 1, preferredMs + 1);

  const sequence = lastSequence + 1;
  const prev_hash = lastEventHash ?? GENESIS_MARKER;

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

  lastEventHash = event_hash;
  lastSequence = sequence;
  return fullReceipt;
}

// Collect receipts for verification (simulates what audit/logger.ts does).
const receipts: AuditReceipt[] = [];
function mockWriteReceipt(
  receipt: Omit<
    AuditReceipt,
    'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'
  >
) {
  const full = buildReceipt(receipt);
  receipts.push(full);
  applyReceiptToWorkContracts(full);
  applyReceiptToTreasury(full);
}

function resetState() {
  clearWorkContractsProjection();
  clearTreasuryProjection();
  receipts.length = 0;
  lastEventHash = null;
  lastSequence = 0;
  logicalNowMs = 1_700_000_000_000;
}

const schedule = WORK_CONTRACT_SCHEDULE.temple_sweep;

// ============================================================================
// Tests
// ============================================================================

test('can start contract when not on cooldown', () => {
  resetState();
  const now = 1_700_000_000_000;

  const result = startContract('player-1', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result.ok, true, 'should succeed');
  if (!result.ok) return;

  const start = receipts.find((r) => r.action === WORK_CONTRACT_STARTED_ACTION);
  assert(Boolean(start), 'start receipt must exist');
  assertEquals(start!.actor_id, 'player-1');
  assertEquals(start!.inputs.started_at_ms, now, 'started_at_ms must be receipted');
});

test('cannot start contract while one is active', () => {
  resetState();
  const now = 1_700_000_000_000;

  const result1 = startContract('player-2', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(result1.ok, true, 'first should succeed');

  const result2 = startContract('player-2', 'temple_sweep', now + 1000, mockWriteReceipt);
  assertEquals(result2.ok, false, 'second should fail');
  if (!result2.ok) assertEquals(result2.error, 'already_active');
});

test('bursty ticks are rejected (no tick receipt emitted)', () => {
  resetState();
  const now = 1_700_000_000_000;

  const start = startContract('player-3', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(start.ok, true);
  if (!start.ok) return;

  const okTick = recordTick('player-3', start.contract_id, now + 5000, mockWriteReceipt);
  assertEquals(okTick.ok, true);

  const receiptCountAfterOk = receipts.length;
  const burstTick = recordTick('player-3', start.contract_id, now + 5000 + 100, mockWriteReceipt);
  assertEquals(burstTick.ok, false);
  assertEquals(receipts.length, receiptCountAfterOk, 'no receipt should be emitted for rejected tick');
});

test('tick receipt includes tick_index and tick_at_ms', () => {
  resetState();
  const now = 1_700_000_000_000;

  const start = startContract('player-4', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(start.ok, true);
  if (!start.ok) return;

  const tick1 = recordTick('player-4', start.contract_id, now + 5000, mockWriteReceipt);
  assertEquals(tick1.ok, true);

  const tickReceipts = receipts.filter((r) => r.action === WORK_CONTRACT_TICK_RECORDED_ACTION);
  assertEquals(tickReceipts.length, 1);
  assertEquals(tickReceipts[0].inputs.tick_index, 1);
  assertEquals(tickReceipts[0].inputs.tick_at_ms, now + 5000);
});

test('cannot complete before min duration / required ticks', () => {
  resetState();
  const now = 1_700_000_000_000;

  const start = startContract('player-5', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(start.ok, true);
  if (!start.ok) return;

  // One valid tick only
  recordTick('player-5', start.contract_id, now + schedule.tick_min_interval_ms, mockWriteReceipt);

  const goldBefore = getGoldBalance('player-5');
  const receiptCountBefore = receipts.length;

  // Too early (< min_duration_ms)
  const completeEarly = completeContract('player-5', start.contract_id, now + schedule.min_duration_ms - 1, mockWriteReceipt);
  assertEquals(completeEarly.ok, false);

  assertEquals(receipts.length, receiptCountBefore, 'no receipts on failed completion');
  assertEquals(getGoldBalance('player-5'), goldBefore, 'no payout on failed completion');
});

test('completion emits WALLET_CREDIT_ACTION after all gates', () => {
  resetState();
  const now = 1_700_000_000_000;

  const start = startContract('player-6', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(start.ok, true);
  if (!start.ok) return;

  // Valid ticks (required_ticks) spaced within min/max windows
  for (let i = 0; i < schedule.required_ticks; i++) {
    recordTick('player-6', start.contract_id, now + (i + 1) * 5000, mockWriteReceipt);
  }

  const completeAt = now + schedule.min_duration_ms + 5000;
  const complete = completeContract('player-6', start.contract_id, completeAt, mockWriteReceipt);
  assertEquals(complete.ok, true);
  if (!complete.ok) return;

  const credit = receipts.find((r) => r.action === WALLET_CREDIT_ACTION && r.actor_id === 'player-6');
  assert(Boolean(credit), 'payout receipt must exist');
  assertEquals(getGoldBalance('player-6'), schedule.payout, 'gold balance should reflect payout');
});

test('cooldown is derived from cooldown_until and is replay-stable', () => {
  resetState();
  const now = 1_700_000_000_000;

  const start = startContract('player-7', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(start.ok, true);
  if (!start.ok) return;

  // Immediately after start: on cooldown.
  assertEquals(isOnCooldown('player-7', now + 1000), true);
  assert(getCooldownRemaining('player-7', now + 1000) > 0, 'cooldown remaining should be > 0');

  // Replay from receipts: should reconstruct same cooldown.
  const captured = receipts.slice();
  resetState();
  for (const r of captured) {
    applyReceiptToWorkContracts(r);
    applyReceiptToTreasury(r);
  }
  assertEquals(isOnCooldown('player-7', now + 1000), true, 'replay must preserve cooldown');
});

test('failContract emits failure receipt and clears active contract', () => {
  resetState();
  const now = 1_700_000_000_000;

  const start = startContract('player-8', 'temple_sweep', now, mockWriteReceipt);
  assertEquals(start.ok, true);
  if (!start.ok) return;

  const ok = failContract('player-8', 'disconnect', mockWriteReceipt);
  assertEquals(ok, true);

  const failure = receipts.find((r) => r.action === WORK_CONTRACT_FAILED_ACTION);
  assert(Boolean(failure), 'failure receipt must exist');
  assertEquals(getActiveContract('player-8'), null, 'active contract should be cleared');
});

test('reducers use receipted times (not receipt timestamp)', () => {
  resetState();

  // Craft a start receipt with conflicting receipt.timestamp vs inputs.started_at_ms
  const crafted = buildReceipt({
    actor_id: 'player-9',
    action: WORK_CONTRACT_STARTED_ACTION,
    inputs: {
      contract_type: 'temple_sweep',
      contract_id: 'wc_test',
      started_at_ms: 123,
      cooldown_until: '2024-01-01T00:10:00.000Z',
    },
    result: 'ok',
  });

  // Mutate the timestamp to a different value to ensure reducer prefers started_at_ms.
  const mutated: AuditReceipt = { ...crafted, timestamp: '2099-01-01T00:00:00.000Z' };
  applyReceiptToWorkContracts(mutated);

  const c = getActiveContract('player-9');
  assert(c !== null, 'contract should be active');
  assertEquals(c!.started_at_ms, 123, 'started_at_ms must come from inputs.started_at_ms');
});

console.log('\n✓ All work contract tests passed');
