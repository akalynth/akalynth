// Akalynth Work Contract Faucet v0
// In-memory projection — source of truth is receipts
// No DB schema; rebuilt purely from receipt replay on startup

import { randomUUID } from 'node:crypto';
import type { AuditReceipt, WorkContractType, WorkContractFailReason } from '../../../../packages/shared/types.js';
import {
  WORK_CONTRACT_STARTED_ACTION,
  WORK_CONTRACT_COMPLETED_ACTION,
  WORK_CONTRACT_FAILED_ACTION,
  WORK_CONTRACT_SCHEDULE,
  WORK_CONTRACT_TYPES,
  WALLET_CREDIT_ACTION,
} from '../../../../packages/shared/types.js';

// ============================================================================
// Types
// ============================================================================

export interface ActiveContract {
  contract_id: string;
  contract_type: WorkContractType;
  player_id: string;
  started_at_ms: number;
  ticks: number[];  // Server-side timestamps of received ticks
}

type WriteReceiptFn = (receipt: Omit<AuditReceipt, 'timestamp' | 'evidence_hash'>) => void;

export type StartContractResult =
  | { ok: true; contract_id: string; payout_gold: number; cooldown_seconds: number; min_duration_ms: number }
  | { ok: false; error: 'on_cooldown' | 'already_active' };

export type TickResult =
  | { ok: true; ticks_observed: number; ticks_required: number; remaining_ms: number; ready_to_complete: boolean }
  | { ok: false; error: 'invalid_contract' | 'insufficient_presence' };

export type CompleteResult =
  | { ok: true; credited_gold: number }
  | { ok: false; error: 'invalid_contract' | 'insufficient_presence' };

// ============================================================================
// In-Memory Projection (receipt-derived)
// ============================================================================

// Active contracts (ephemeral, cleared on completion/failure)
const activeContractByPlayer = new Map<string, ActiveContract>();

// Cooldown tracking: when player can next start a contract
const cooldownByPlayer = new Map<string, number>();

/**
 * Get active contract for a player (null if none).
 */
export function getActiveContract(playerId: string): ActiveContract | null {
  return activeContractByPlayer.get(playerId) ?? null;
}

/**
 * Check if player is on cooldown.
 */
export function isOnCooldown(playerId: string, nowMs: number): boolean {
  const nextEligible = cooldownByPlayer.get(playerId) ?? 0;
  return nowMs < nextEligible;
}

/**
 * Get cooldown remaining in ms (0 if not on cooldown).
 */
export function getCooldownRemaining(playerId: string, nowMs: number): number {
  const nextEligible = cooldownByPlayer.get(playerId) ?? 0;
  return Math.max(0, nextEligible - nowMs);
}

/**
 * Clear all work contract state (for testing / fresh replay).
 */
export function clearWorkContractsProjection(): void {
  activeContractByPlayer.clear();
  cooldownByPlayer.clear();
}

// ============================================================================
// Contract Lifecycle Functions
// ============================================================================

/**
 * Start a new work contract.
 * Validates cooldown and active contract state before emitting receipt.
 */
export function startContract(
  playerId: string,
  contractType: WorkContractType,
  nowMs: number,
  writeReceipt: WriteReceiptFn
): StartContractResult {
  // Check if already has active contract
  if (activeContractByPlayer.has(playerId)) {
    return { ok: false, error: 'already_active' };
  }

  // Check cooldown
  if (isOnCooldown(playerId, nowMs)) {
    return { ok: false, error: 'on_cooldown' };
  }

  // Validate contract type
  if (!WORK_CONTRACT_TYPES.includes(contractType)) {
    return { ok: false, error: 'on_cooldown' };  // Treat as rejected
  }

  const schedule = WORK_CONTRACT_SCHEDULE[contractType];
  const contractId = `wc_${randomUUID()}`;

  // Emit receipt (reducer will update state)
  writeReceipt({
    player_id: playerId,
    action: WORK_CONTRACT_STARTED_ACTION,
    inputs: {
      contract_type: contractType,
      contract_id: contractId,
      cooldown_until: new Date(nowMs + schedule.cooldown_ms).toISOString(),
    },
    result: 'ok',
  });

  return {
    ok: true,
    contract_id: contractId,
    payout_gold: schedule.payout,
    cooldown_seconds: Math.floor(schedule.cooldown_ms / 1000),
    min_duration_ms: schedule.min_duration_ms,
  };
}

/**
 * Record a work tick (presence proof).
 * Does NOT emit a receipt — ticks are ephemeral.
 * Returns tick count and whether contract is ready to complete.
 */
export function recordTick(
  playerId: string,
  contractId: string,
  nowMs: number
): TickResult {
  const contract = activeContractByPlayer.get(playerId);
  if (!contract || contract.contract_id !== contractId) {
    return { ok: false, error: 'invalid_contract' };
  }

  const schedule = WORK_CONTRACT_SCHEDULE[contract.contract_type];
  const lastTickTime = contract.ticks.length > 0 ? contract.ticks[contract.ticks.length - 1] : contract.started_at_ms;
  const timeSinceLastTick = nowMs - lastTickTime;

  // Burst detection: reject if tick comes too fast
  if (timeSinceLastTick < schedule.tick_min_interval_ms) {
    return { ok: false, error: 'insufficient_presence' };
  }

  // Record tick (server timestamp, client timestamp ignored)
  contract.ticks.push(nowMs);

  const elapsed = nowMs - contract.started_at_ms;
  const remaining = Math.max(0, schedule.min_duration_ms - elapsed);

  // Check if ready to complete
  const hasEnoughTicks = contract.ticks.length >= schedule.required_ticks;
  const hasEnoughTime = elapsed >= schedule.min_duration_ms;
  const readyToComplete = hasEnoughTicks && hasEnoughTime;

  return {
    ok: true,
    ticks_observed: contract.ticks.length,
    ticks_required: schedule.required_ticks,
    remaining_ms: remaining,
    ready_to_complete: readyToComplete,
  };
}

/**
 * Complete a work contract.
 * Validates presence gates and emits completion + credit receipts.
 */
export function completeContract(
  playerId: string,
  contractId: string,
  nowMs: number,
  writeReceipt: WriteReceiptFn
): CompleteResult {
  const contract = activeContractByPlayer.get(playerId);
  if (!contract || contract.contract_id !== contractId) {
    return { ok: false, error: 'invalid_contract' };
  }

  const schedule = WORK_CONTRACT_SCHEDULE[contract.contract_type];

  // Validate presence gates
  const elapsed = nowMs - contract.started_at_ms;
  if (elapsed < schedule.min_duration_ms) {
    return { ok: false, error: 'insufficient_presence' };
  }

  if (contract.ticks.length < schedule.required_ticks) {
    return { ok: false, error: 'insufficient_presence' };
  }

  // Validate tick spacing (all ticks must be within acceptable window)
  for (let i = 1; i < contract.ticks.length; i++) {
    const interval = contract.ticks[i] - contract.ticks[i - 1];
    if (interval < schedule.tick_min_interval_ms || interval > schedule.tick_max_interval_ms) {
      return { ok: false, error: 'insufficient_presence' };
    }
  }

  // Also check first tick spacing from start
  if (contract.ticks.length > 0) {
    const firstInterval = contract.ticks[0] - contract.started_at_ms;
    if (firstInterval < schedule.tick_min_interval_ms) {
      return { ok: false, error: 'insufficient_presence' };
    }
  }

  // Emit completion receipt
  writeReceipt({
    player_id: playerId,
    action: WORK_CONTRACT_COMPLETED_ACTION,
    inputs: {
      contract_type: contract.contract_type,
      contract_id: contractId,
      ticks_observed: contract.ticks.length,
    },
    result: 'ok',
  });

  // Emit credit receipt (payout)
  writeReceipt({
    player_id: playerId,
    action: WALLET_CREDIT_ACTION,
    inputs: {
      amount: schedule.payout,
      reason: 'work_contract',
      contract_id: contractId,
      contract_type: contract.contract_type,
    },
    result: 'ok',
  });

  return { ok: true, credited_gold: schedule.payout };
}

/**
 * Fail an active contract.
 * Called on disconnect or other failure conditions.
 */
export function failContract(
  playerId: string,
  reason: WorkContractFailReason,
  writeReceipt: WriteReceiptFn
): boolean {
  const contract = activeContractByPlayer.get(playerId);
  if (!contract) {
    return false;
  }

  // Emit failure receipt
  writeReceipt({
    player_id: playerId,
    action: WORK_CONTRACT_FAILED_ACTION,
    inputs: {
      contract_type: contract.contract_type,
      contract_id: contract.contract_id,
      reason,
    },
    result: 'ok',
  });

  return true;
}

// ============================================================================
// Receipt Reducer (Deterministic)
// ============================================================================

/**
 * Receipt reducer — call during replay loop and on new receipt write.
 * Idempotent: replay order determines truth (no timestamp reliance).
 */
export function applyReceiptToWorkContracts(receipt: AuditReceipt): void {
  const playerId = receipt.player_id;
  if (!playerId) return;

  switch (receipt.action) {
    case WORK_CONTRACT_STARTED_ACTION: {
      const contractType = receipt.inputs?.contract_type as WorkContractType | undefined;
      const contractId = receipt.inputs?.contract_id as string | undefined;

      if (!contractType || !contractId) break;
      if (!WORK_CONTRACT_TYPES.includes(contractType)) break;

      const schedule = WORK_CONTRACT_SCHEDULE[contractType];

      // Set active contract
      activeContractByPlayer.set(playerId, {
        contract_id: contractId,
        contract_type: contractType,
        player_id: playerId,
        started_at_ms: Date.now(),  // Note: On replay, this is "now" not original time
        ticks: [],
      });

      // Set cooldown (even if contract fails, cooldown applies)
      cooldownByPlayer.set(playerId, Date.now() + schedule.cooldown_ms);
      break;
    }

    case WORK_CONTRACT_COMPLETED_ACTION:
    case WORK_CONTRACT_FAILED_ACTION: {
      // Clear active contract
      activeContractByPlayer.delete(playerId);
      break;
    }

    default:
      break;
  }
}
