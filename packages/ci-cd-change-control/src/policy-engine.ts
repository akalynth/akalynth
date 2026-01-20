/**
 * Policy Engine with Risk Scoring and Friction Calculation
 *
 * Mechanically evaluates deployment requests and calculates:
 * - Risk scores (0-10 scale)
 * - Friction costs (economic incentive alignment)
 * - Required capabilities for approval
 * - Approval TTL based on risk level
 */

import type { CICDReceiptInputs, Env } from './types.js';

// ============================================================================
// Risk Scoring Types & Constants
// ============================================================================

export interface RiskFactors {
  database_migration?: boolean;
  infrastructure_change?: boolean;
  off_hours_deployment?: boolean;
  rollback_available?: boolean;
  automated_tests_passing?: boolean;
  production_data_involved?: boolean;
  schema_change?: boolean;
  breaking_api_changes?: boolean;
  external_dependencies?: boolean;
  first_deployment?: boolean;
}

export interface PolicyEvalResult {
  allowed: boolean;
  risk_score: number;
  friction_cost: number;
  required_capabilities: string[];
  approval_required: boolean;
  approval_ttl_minutes: number;
  risk_factors: string[];
  denial_reason?: string;
}

export interface FrictionBudget {
  service: string;
  team: string;
  balance: number;
  monthly_allocation: number;
  last_reset: string;
}

// Risk scoring constants
const RISK_POINTS = {
  // Additive risk factors
  database_migration: 3,
  infrastructure_change: 2,
  off_hours_deployment: 1,
  production_data_involved: 2,
  schema_change: 2,
  breaking_api_changes: 3,
  external_dependencies: 1,
  first_deployment: 2,

  // Risk reduction factors (negative)
  rollback_available: -1,
  automated_tests_passing: -1,
} as const;

const FRICTION_BASE_COST = {
  0: 0,   // No cost for risk-free changes
  1: 10,
  2: 20,
  3: 50,
  4: 100,
  5: 200,  // Higher friction for risky changes
  6: 400,
  7: 800,
  8: 1600,
  9: 3200,
  10: 6400, // Extremely high cost for maximum risk
} as const;

const ENV_MULTIPLIERS = {
  dev: 0.1,
  staging: 0.5,
  prod: 1.0,
} as const;

// ============================================================================
// Risk Scoring Engine
// ============================================================================

export class PolicyEngine {
  private frictionBudgets = new Map<string, FrictionBudget>();

  /**
   * Evaluate deployment request and generate policy decision
   */
  async evaluateDeployment(inputs: CICDReceiptInputs & {
    risk_factors?: RiskFactors;
    change_description?: string;
    rollback_plan?: string;
  }): Promise<PolicyEvalResult> {
    // 1. Calculate risk score
    const riskScore = this.calculateRiskScore(inputs.risk_factors || {}, inputs.env);

    // 2. Check for hard prohibitions
    const prohibition = this.checkProhibitions(inputs, riskScore);
    if (prohibition) {
      return {
        allowed: false,
        risk_score: riskScore,
        friction_cost: 0,
        required_capabilities: [],
        approval_required: false,
        approval_ttl_minutes: 0,
        risk_factors: this.extractRiskFactorNames(inputs.risk_factors || {}),
        denial_reason: prohibition,
      };
    }

    // 3. Calculate friction cost
    const frictionCost = this.calculateFrictionCost(riskScore, inputs.env);

    // 4. Check friction budget availability
    const budgetKey = this.getBudgetKey(inputs.service || 'default', inputs.team || 'default');
    const hasBudget = await this.checkFrictionBudget(budgetKey, frictionCost);

    if (!hasBudget) {
      return {
        allowed: false,
        risk_score: riskScore,
        friction_cost: frictionCost,
        required_capabilities: [],
        approval_required: false,
        approval_ttl_minutes: 0,
        risk_factors: this.extractRiskFactorNames(inputs.risk_factors || {}),
        denial_reason: 'insufficient_friction_budget',
      };
    }

    // 5. Determine approval requirements
    const approvalRequired = this.requiresApproval(riskScore, inputs.env);
    const requiredCapabilities = this.getRequiredCapabilities(inputs, riskScore);
    const approvalTtl = this.getApprovalTtl(riskScore);

    return {
      allowed: true,
      risk_score: riskScore,
      friction_cost: frictionCost,
      required_capabilities: requiredCapabilities,
      approval_required: approvalRequired,
      approval_ttl_minutes: approvalTtl,
      risk_factors: this.extractRiskFactorNames(inputs.risk_factors || {}),
    };
  }

  /**
   * Calculate risk score based on deployment characteristics
   */
  private calculateRiskScore(riskFactors: RiskFactors, env: Env): number {
    let score = 0;

    // Add risk points for each present factor
    for (const [factor, present] of Object.entries(riskFactors)) {
      if (present && factor in RISK_POINTS) {
        score += RISK_POINTS[factor as keyof typeof RISK_POINTS];
      }
    }

    // Environment multiplier
    score = Math.round(score * ENV_MULTIPLIERS[env]);

    // Clamp to 0-10 range
    return Math.max(0, Math.min(10, score));
  }

  /**
   * Check for hard prohibitions that deny deployment regardless of approvals
   */
  private checkProhibitions(inputs: CICDReceiptInputs & { risk_factors?: RiskFactors }, riskScore: number): string | null {
    const factors = inputs.risk_factors || {};

    // Prohibit extremely risky deployments to production
    if (inputs.env === 'prod' && riskScore >= 9) {
      return 'risk_score_too_high_for_production';
    }

    // Prohibit breaking changes without rollback plan
    if (factors.breaking_api_changes && !factors.rollback_available) {
      return 'breaking_changes_require_rollback_plan';
    }

    // Prohibit production data changes off-hours without emergency justification
    if (inputs.env === 'prod' && factors.production_data_involved && factors.off_hours_deployment) {
      return 'production_data_changes_prohibited_off_hours';
    }

    return null;
  }

  /**
   * Calculate friction cost based on risk score and environment
   */
  private calculateFrictionCost(riskScore: number, env: Env): number {
    const baseCost = FRICTION_BASE_COST[Math.min(riskScore, 10) as keyof typeof FRICTION_BASE_COST];
    const envMultiplier = ENV_MULTIPLIERS[env];
    return Math.round(baseCost * envMultiplier);
  }

  /**
   * Check if deployment requires human approval
   */
  private requiresApproval(riskScore: number, env: Env): boolean {
    // Production deployments with risk >= 3 require approval
    if (env === 'prod' && riskScore >= 3) {
      return true;
    }

    // Any environment with risk >= 6 requires approval
    if (riskScore >= 6) {
      return true;
    }

    return false;
  }

  /**
   * Get required capabilities for approval
   */
  private getRequiredCapabilities(inputs: CICDReceiptInputs & { risk_factors?: RiskFactors }, riskScore: number): string[] {
    const capabilities: string[] = [];
    const service = inputs.service || 'default';

    // Base deployment approval capability
    if (inputs.env === 'prod') {
      capabilities.push(`approve_prod_deploy:service=${service}`);
    }

    // High-risk deployments require specialized capabilities
    if (riskScore >= 6) {
      capabilities.push(`approve_high_risk_deploy:service=${service}`);
    }

    // Database changes require DB admin capability
    if (inputs.risk_factors?.database_migration || inputs.risk_factors?.schema_change) {
      capabilities.push(`approve_db_migration:service=${service}`);
    }

    // Infrastructure changes require infra capability
    if (inputs.risk_factors?.infrastructure_change) {
      capabilities.push(`approve_infrastructure:service=${service}`);
    }

    return capabilities;
  }

  /**
   * Get approval TTL in minutes based on risk level
   */
  private getApprovalTtl(riskScore: number): number {
    if (riskScore >= 8) return 30;   // High risk: 30 minutes
    if (riskScore >= 5) return 60;   // Medium-high risk: 1 hour
    if (riskScore >= 3) return 120;  // Medium risk: 2 hours
    return 240; // Low risk: 4 hours
  }

  /**
   * Extract risk factor names from risk factors object
   */
  private extractRiskFactorNames(riskFactors: RiskFactors): string[] {
    return Object.entries(riskFactors)
      .filter(([_, present]) => present)
      .map(([factor, _]) => factor);
  }

  /**
   * Generate budget key for service/team combination
   */
  private getBudgetKey(service: string, team: string): string {
    return `${team}:${service}`;
  }

  /**
   * Check if friction budget is available for cost
   */
  async checkFrictionBudget(budgetKey: string, cost: number): Promise<boolean> {
    const budget = this.frictionBudgets.get(budgetKey);

    if (!budget) {
      // Initialize default budget if none exists
      this.frictionBudgets.set(budgetKey, {
        service: budgetKey.split(':')[1],
        team: budgetKey.split(':')[0],
        balance: 10000, // Default monthly allocation
        monthly_allocation: 10000,
        last_reset: new Date().toISOString(),
      });
      return cost <= 10000;
    }

    return budget.balance >= cost;
  }

  /**
   * Debit friction cost from budget
   */
  async debitFriction(budgetKey: string, cost: number): Promise<void> {
    const budget = this.frictionBudgets.get(budgetKey);
    if (budget && budget.balance >= cost) {
      budget.balance -= cost;
      this.frictionBudgets.set(budgetKey, budget);
    }
  }

  /**
   * Get current friction budget status
   */
  async getFrictionBudget(budgetKey: string): Promise<FrictionBudget | null> {
    return this.frictionBudgets.get(budgetKey) || null;
  }

  /**
   * Reset monthly friction budgets (called by scheduler)
   */
  async resetMonthlyBudgets(): Promise<void> {
    const now = new Date().toISOString();

    for (const [key, budget] of this.frictionBudgets.entries()) {
      budget.balance = budget.monthly_allocation;
      budget.last_reset = now;
      this.frictionBudgets.set(key, budget);
    }
  }
}

// ============================================================================
// Segregation Rules Engine
// ============================================================================

export interface SegregationRule {
  capability: string;
  forbidden_roles: string[];
  description: string;
}

export class SegregationEngine {
  private rules: SegregationRule[] = [
    {
      capability: 'approve_prod_deploy',
      forbidden_roles: ['deploy_requester', 'build_creator'],
      description: 'Approvers cannot approve their own deployment requests',
    },
    {
      capability: 'approve_high_risk_deploy',
      forbidden_roles: ['risk_assessor_same_team'],
      description: 'High-risk approvers must be from different team than risk assessor',
    },
    {
      capability: 'emergency_deploy',
      forbidden_roles: ['regular_deploy_requester'],
      description: 'Emergency deployers cannot use regular deploy path for same change',
    },
  ];

  /**
   * Check if actor can perform capability given their roles in this deployment
   */
  canPerformCapability(
    actorId: string,
    capability: string,
    deploymentRoles: Record<string, string> // role -> actorId mapping
  ): { allowed: boolean; violation?: string } {
    const rule = this.rules.find(r => capability.includes(r.capability));

    if (!rule) {
      return { allowed: true }; // No segregation rule applies
    }

    // Check if actor has any forbidden role
    for (const forbiddenRole of rule.forbidden_roles) {
      const roleActorId = deploymentRoles[forbiddenRole];
      if (roleActorId === actorId) {
        return {
          allowed: false,
          violation: `${actorId} cannot ${capability}: ${rule.description}`,
        };
      }
    }

    return { allowed: true };
  }
}

// ============================================================================
// Export Factory Functions
// ============================================================================

export function createPolicyEngine(): PolicyEngine {
  return new PolicyEngine();
}

export function createSegregationEngine(): SegregationEngine {
  return new SegregationEngine();
}