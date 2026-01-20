// Constitutional Friction Budget System
// Implements temporal constraints on AI tool execution

import { FrictionBudget, AIGovernanceError } from '../types.js';
import { AI_GOVERNANCE_CONSTANTS } from '../types.js';
import { CoordinationReceipt, CoordinationKernel } from '@akalynth/coordination-kernel';

export class ConstitutionalFrictionManager {
  private budgets: Map<string, FrictionBudget> = new Map();

  constructor(private kernel: CoordinationKernel) {}

  /**
   * Get friction budget for an AI agent
   * Constitutional Principle: Temporal constraints are enforced
   */
  async getFrictionBudget(agent_id: string): Promise<FrictionBudget> {
    let budget = this.budgets.get(agent_id);

    if (!budget) {
      budget = this.createDefaultBudget(agent_id);
      this.budgets.set(agent_id, budget);
    }

    // Check if budget needs reset (temporal invariant)
    if (this.shouldResetBudget(budget)) {
      budget = await this.resetBudget(agent_id, budget);
    }

    return budget;
  }

  /**
   * Consume friction units for an action
   * Constitutional Requirement: Actions must respect constraints
   */
  async consumeFriction(agent_id: string, cost: number): Promise<void> {
    const budget = await this.getFrictionBudget(agent_id);

    // Check if sufficient friction units available
    if (budget.available_units < cost) {
      await this.emitInsufficientFrictionReceipt(agent_id, cost, budget.available_units);
      throw new AIGovernanceError(
        `Insufficient friction budget. Required: ${cost}, Available: ${budget.available_units}`,
        'FRICTION_EXHAUSTED',
        { agent_id, required: cost, available: budget.available_units }
      );
    }

    // Consume friction units
    budget.consumed_units += cost;
    budget.available_units -= cost;

    // Emit receipt for friction consumption (Evidence Invariant)
    await this.emitFrictionConsumedReceipt(agent_id, cost, budget);

    this.budgets.set(agent_id, budget);
  }

  /**
   * Add friction units to an agent's budget
   * Constitutional Principle: Budget adjustments are audited
   */
  async addFriction(agent_id: string, units: number, reason: string): Promise<void> {
    const budget = await this.getFrictionBudget(agent_id);

    budget.total_units += units;
    budget.available_units += units;

    // Emit receipt for friction addition
    await this.emitFrictionAddedReceipt(agent_id, units, reason, budget);

    this.budgets.set(agent_id, budget);
  }

  /**
   * Check if an action can be performed within friction budget
   * Constitutional Principle: Constraints are checked before execution
   */
  async canAfford(agent_id: string, cost: number): Promise<boolean> {
    const budget = await this.getFrictionBudget(agent_id);
    return budget.available_units >= cost;
  }

  /**
   * Reset friction budget to default values
   * Constitutional Principle: Temporal reset based on predetermined schedule
   */
  private async resetBudget(agent_id: string, current_budget: FrictionBudget): Promise<FrictionBudget> {
    const new_budget: FrictionBudget = {
      agent_id,
      total_units: AI_GOVERNANCE_CONSTANTS.DEFAULT_FRICTION_BUDGET,
      consumed_units: 0,
      available_units: AI_GOVERNANCE_CONSTANTS.DEFAULT_FRICTION_BUDGET,
      last_reset: new Date().toISOString(),
      reset_interval_ms: AI_GOVERNANCE_CONSTANTS.FRICTION_RESET_INTERVAL_MS
    };

    // Emit receipt for budget reset
    await this.emitBudgetResetReceipt(agent_id, current_budget, new_budget);

    this.budgets.set(agent_id, new_budget);
    return new_budget;
  }

  /**
   * Create default friction budget for new agent
   */
  private createDefaultBudget(agent_id: string): FrictionBudget {
    return {
      agent_id,
      total_units: AI_GOVERNANCE_CONSTANTS.DEFAULT_FRICTION_BUDGET,
      consumed_units: 0,
      available_units: AI_GOVERNANCE_CONSTANTS.DEFAULT_FRICTION_BUDGET,
      last_reset: new Date().toISOString(),
      reset_interval_ms: AI_GOVERNANCE_CONSTANTS.FRICTION_RESET_INTERVAL_MS
    };
  }

  /**
   * Check if budget should be reset based on time elapsed
   * Constitutional Principle: Automatic temporal enforcement
   */
  private shouldResetBudget(budget: FrictionBudget): boolean {
    const last_reset = new Date(budget.last_reset).getTime();
    const now = Date.now();
    const elapsed = now - last_reset;

    return elapsed >= budget.reset_interval_ms;
  }

  // Receipt emission methods (Evidence Invariant compliance)

  private async emitFrictionConsumedReceipt(
    agent_id: string,
    cost: number,
    budget: FrictionBudget
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'friction_manager',
      'friction_consumed',
      {
        agent_id,
        cost_units: cost,
        remaining_units: budget.available_units
      },
      'friction_units_consumed'
    );
  }

  private async emitFrictionAddedReceipt(
    agent_id: string,
    units: number,
    reason: string,
    budget: FrictionBudget
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'friction_manager',
      'friction_added',
      {
        agent_id,
        added_units: units,
        reason,
        new_total: budget.total_units
      },
      'friction_units_added'
    );
  }

  private async emitBudgetResetReceipt(
    agent_id: string,
    old_budget: FrictionBudget,
    new_budget: FrictionBudget
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'friction_manager',
      'budget_reset',
      {
        agent_id,
        old_available: old_budget.available_units,
        old_consumed: old_budget.consumed_units,
        reset_reason: 'time_interval_elapsed'
      },
      JSON.stringify({
        new_total: new_budget.total_units,
        new_available: new_budget.available_units,
        reset_timestamp: new_budget.last_reset
      })
    );
  }

  private async emitInsufficientFrictionReceipt(
    agent_id: string,
    required: number,
    available: number
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'friction_manager',
      'friction_insufficient',
      {
        agent_id,
        required_units: required,
        available_units: available,
        deficit: required - available
      },
      'action_blocked_insufficient_friction'
    );
  }

  /**
   * Generate compliance report for friction budget usage
   * Constitutional Requirement: Audit trail accessibility
   */
  async generateUsageReport(agent_id: string, days: number = 7): Promise<FrictionUsageReport> {
    const budget = await this.getFrictionBudget(agent_id);

    // In a full implementation, this would query the receipt chain
    // for historical friction consumption patterns

    return {
      agent_id,
      report_period_days: days,
      current_budget: budget,
      total_consumed_period: 0, // Would be calculated from receipts
      average_daily_consumption: 0,
      peak_consumption_day: 0,
      budget_exhaustion_events: 0,
      compliance_status: 'compliant'
    };
  }
}

/**
 * Friction usage report for constitutional compliance
 */
export interface FrictionUsageReport {
  agent_id: string;
  report_period_days: number;
  current_budget: FrictionBudget;
  total_consumed_period: number;
  average_daily_consumption: number;
  peak_consumption_day: number;
  budget_exhaustion_events: number;
  compliance_status: 'compliant' | 'warning' | 'violation';
}