// Friction Constraints - Economic-style Resource Management
// Domain-agnostic resource allocation without budget committees

import type { Actor, AuditWriter, FrictionConstraint, FrictionBalance } from '../types.js';

// ============================================================================
// Friction Actions
// ============================================================================

export const FRICTION_DEBIT_ACTION = 'friction_debit' as const;
export const FRICTION_CREDIT_ACTION = 'friction_credit' as const;
export const FRICTION_CONSTRAINT_APPLIED_ACTION = 'friction_constraint_applied' as const;

// ============================================================================
// In-Memory Friction State
// ============================================================================

const frictionBalances = new Map<string, number>();
const frictionConstraints = new Map<string, FrictionConstraint>();

// ============================================================================
// Balance Management
// ============================================================================

/**
 * Get friction balance for an actor (returns 0 if not set)
 */
export function getFrictionBalance(actor_id: string): number {
  return frictionBalances.get(actor_id) ?? 0;
}

/**
 * Set friction balance for an actor
 */
function setFrictionBalance(actor_id: string, balance: number): void {
  frictionBalances.set(actor_id, Math.max(0, balance)); // Never go negative
}

/**
 * Check if actor can afford a friction cost
 */
export function canAfford(actor_id: string, cost: number): boolean {
  return getFrictionBalance(actor_id) >= cost;
}

// ============================================================================
// Constraint Management
// ============================================================================

/**
 * Register a friction constraint for an action
 */
export function registerFrictionConstraint(constraint: FrictionConstraint): void {
  frictionConstraints.set(constraint.action, constraint);
}

/**
 * Get friction cost for an action
 */
export function getFrictionCost(action: string, inputs: Record<string, unknown> = {}): number {
  const constraint = frictionConstraints.get(action);
  if (!constraint) return 0;

  if (constraint.formula) {
    return constraint.formula(inputs);
  }

  return constraint.cost;
}

/**
 * Pre-register common constraint patterns
 */
export function registerCommonConstraints(): void {
  // Linear escalation for penalties
  registerFrictionConstraint({
    action: 'late_filing',
    cost: 0, // Base cost in formula
    formula: (inputs) => {
      const hoursLate = (inputs.hours_late as number) || 0;
      return Math.pow(2, hoursLate) * 100; // Exponential penalty
    }
  });

  // Fixed costs for common actions
  registerFrictionConstraint({
    action: 'dispute_filing',
    cost: 200
  });

  registerFrictionConstraint({
    action: 'audit_query',
    cost: 10
  });

  registerFrictionConstraint({
    action: 'risk_assessment',
    cost: 50
  });
}

// ============================================================================
// Transaction Operations
// ============================================================================

/**
 * Credit friction units to an actor
 */
export async function creditFriction(
  actor_id: string,
  amount: number,
  reason: string,
  audit: AuditWriter,
  credited_by: string = 'system'
): Promise<void> {
  if (amount <= 0) throw new Error('Credit amount must be positive');

  const currentBalance = getFrictionBalance(actor_id);
  const newBalance = currentBalance + amount;
  setFrictionBalance(actor_id, newBalance);

  await audit.write({
    actor_id,
    action: FRICTION_CREDIT_ACTION,
    inputs: {
      amount,
      reason,
      credited_by,
      balance_before: currentBalance,
      balance_after: newBalance
    },
    result: 'ok',
  });
}

/**
 * Debit friction units from an actor
 */
export async function debitFriction(
  actor_id: string,
  amount: number,
  reason: string,
  audit: AuditWriter,
  debited_by: string = 'system'
): Promise<{ success: boolean; reason?: string }> {
  if (amount <= 0) throw new Error('Debit amount must be positive');

  const currentBalance = getFrictionBalance(actor_id);

  if (currentBalance < amount) {
    await audit.write({
      actor_id,
      action: FRICTION_DEBIT_ACTION,
      inputs: {
        amount,
        reason,
        debited_by,
        balance_before: currentBalance,
        insufficient_balance: true
      },
      result: 'blocked',
    });

    return { success: false, reason: 'insufficient_friction' };
  }

  const newBalance = currentBalance - amount;
  setFrictionBalance(actor_id, newBalance);

  await audit.write({
    actor_id,
    action: FRICTION_DEBIT_ACTION,
    inputs: {
      amount,
      reason,
      debited_by,
      balance_before: currentBalance,
      balance_after: newBalance
    },
    result: 'ok',
  });

  return { success: true };
}

/**
 * Apply friction constraint for an action
 * This is the main enforcement mechanism
 */
export async function applyFrictionConstraint(
  actor: Actor,
  action: string,
  inputs: Record<string, unknown>,
  audit: AuditWriter
): Promise<{ allowed: boolean; cost: number; reason?: string }> {
  const cost = getFrictionCost(action, inputs);

  if (cost === 0) {
    // No constraint for this action
    return { allowed: true, cost: 0 };
  }

  if (!canAfford(actor.id, cost)) {
    await audit.write({
      actor_id: actor.id,
      action: FRICTION_CONSTRAINT_APPLIED_ACTION,
      inputs: {
        attempted_action: action,
        required_friction: cost,
        current_balance: getFrictionBalance(actor.id),
        ...inputs
      },
      result: 'blocked',
    });

    return {
      allowed: false,
      cost,
      reason: `Insufficient friction: need ${cost}, have ${getFrictionBalance(actor.id)}`
    };
  }

  // Debit the friction cost
  const debitResult = await debitFriction(
    actor.id,
    cost,
    `friction_cost:${action}`,
    audit
  );

  if (!debitResult.success) {
    return { allowed: false, cost, reason: debitResult.reason };
  }

  await audit.write({
    actor_id: actor.id,
    action: FRICTION_CONSTRAINT_APPLIED_ACTION,
    inputs: {
      attempted_action: action,
      friction_cost: cost,
      remaining_balance: getFrictionBalance(actor.id),
      ...inputs
    },
    result: 'ok',
  });

  return { allowed: true, cost };
}

// ============================================================================
// State Management for Receipt Replay
// ============================================================================

/**
 * Apply receipt to friction state (for replay/reconstruction)
 */
export function applyFrictionReceipt(receipt: any): void {
  switch (receipt.action) {
    case FRICTION_CREDIT_ACTION: {
      const { balance_after } = receipt.inputs;
      if (typeof balance_after === 'number') {
        setFrictionBalance(receipt.actor_id, balance_after);
      }
      break;
    }

    case FRICTION_DEBIT_ACTION: {
      const { balance_after, insufficient_balance } = receipt.inputs;
      if (!insufficient_balance && typeof balance_after === 'number') {
        setFrictionBalance(receipt.actor_id, balance_after);
      }
      break;
    }
  }
}

/**
 * Clear all friction state (for testing/replay)
 */
export function clearFrictionState(): void {
  frictionBalances.clear();
}