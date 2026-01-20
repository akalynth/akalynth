// Constitutional Risk Calculator for AI Tool Execution
// Implements deterministic risk scoring per constitutional requirements

import { RiskFactor, RiskAssessment, ToolExecutionRequest, ToolDefinition } from '../types.js';
import { AI_GOVERNANCE_CONSTANTS } from '../types.js';

export interface RiskCalculatorConfig {
  base_risk_weights: Record<string, number>;
  contextual_multipliers: Record<string, number>;
  risk_thresholds: {
    low: number;
    medium: number;
    high: number;
  };
}

export const DEFAULT_RISK_CONFIG: RiskCalculatorConfig = {
  base_risk_weights: {
    'external_system_modification': 3,
    'data_access_modification': 2,
    'user_communication': 1,
    'file_system_access': 2,
    'network_access': 2,
    'privileged_execution': 3,
    'irreversible_action': 3,
  },
  contextual_multipliers: {
    'rollback_available': -1,
    'human_oversight_active': -1,
    'read_only_operation': -0.5,
    'sandboxed_execution': -0.5,
    'audit_trail_complete': -0.5,
  },
  risk_thresholds: {
    low: AI_GOVERNANCE_CONSTANTS.LOW_RISK_THRESHOLD,
    medium: AI_GOVERNANCE_CONSTANTS.MEDIUM_RISK_THRESHOLD,
    high: AI_GOVERNANCE_CONSTANTS.HIGH_RISK_THRESHOLD,
  }
};

export class ConstitutionalRiskCalculator {
  constructor(private config: RiskCalculatorConfig = DEFAULT_RISK_CONFIG) {}

  /**
   * Calculate risk assessment for an AI tool execution request
   * Constitutional Requirement: Deterministic, evidence-based assessment
   */
  async calculateRisk(
    request: ToolExecutionRequest,
    tool_definition: ToolDefinition
  ): Promise<RiskAssessment> {
    const factors = this.identifyRiskFactors(request, tool_definition);
    const total_score = this.computeTotalScore(factors);
    const risk_level = this.determineRiskLevel(total_score);
    const friction_cost = this.calculateFrictionCost(total_score, risk_level);

    return {
      total_score,
      risk_level,
      factors,
      friction_cost,
      approval_required: this.requiresApproval(risk_level),
      segregation_required: this.requiresSegregation(risk_level)
    };
  }

  /**
   * Identify risk factors based on tool definition and execution context
   */
  private identifyRiskFactors(
    request: ToolExecutionRequest,
    tool_definition: ToolDefinition
  ): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Base tool risk factors
    factors.push(...tool_definition.risk_factors);

    // Contextual risk factors based on execution parameters
    if (tool_definition.external_system_access) {
      factors.push({
        factor: 'external_system_modification',
        weight: this.config.base_risk_weights.external_system_modification || 3,
        description: 'Tool can modify external systems'
      });
    }

    if (tool_definition.data_modification) {
      factors.push({
        factor: 'data_access_modification',
        weight: this.config.base_risk_weights.data_access_modification || 2,
        description: 'Tool can access or modify data'
      });
    }

    if (tool_definition.user_communication) {
      factors.push({
        factor: 'user_communication',
        weight: this.config.base_risk_weights.user_communication || 1,
        description: 'Tool can communicate with users'
      });
    }

    // Risk reduction factors
    if (tool_definition.rollback_available) {
      factors.push({
        factor: 'rollback_available',
        weight: this.config.contextual_multipliers.rollback_available || -1,
        description: 'Tool actions can be rolled back'
      });
    }

    // Parameter-based risk assessment
    this.assessParameterRisks(request, factors);

    return factors;
  }

  /**
   * Assess risks based on specific parameters in the request
   */
  private assessParameterRisks(request: ToolExecutionRequest, factors: RiskFactor[]): void {
    const params = request.parameters;

    // Check for potentially dangerous parameters
    if (this.hasFileSystemAccess(params)) {
      factors.push({
        factor: 'file_system_access',
        weight: this.config.base_risk_weights.file_system_access || 2,
        description: 'Request involves file system access'
      });
    }

    if (this.hasNetworkAccess(params)) {
      factors.push({
        factor: 'network_access',
        weight: this.config.base_risk_weights.network_access || 2,
        description: 'Request involves network operations'
      });
    }

    if (this.hasPrivilegedExecution(params)) {
      factors.push({
        factor: 'privileged_execution',
        weight: this.config.base_risk_weights.privileged_execution || 3,
        description: 'Request requires privileged execution'
      });
    }

    // Check for risk mitigation factors
    if (this.hasAuditTrail(request)) {
      factors.push({
        factor: 'audit_trail_complete',
        weight: this.config.contextual_multipliers.audit_trail_complete || -0.5,
        description: 'Complete audit trail available'
      });
    }
  }

  /**
   * Compute total risk score from all factors
   * Constitutional Requirement: Deterministic calculation
   */
  private computeTotalScore(factors: RiskFactor[]): number {
    return factors.reduce((total, factor) => total + factor.weight, 0);
  }

  /**
   * Determine risk level based on total score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score < this.config.risk_thresholds.low) return 'low';
    if (score < this.config.risk_thresholds.medium) return 'medium';
    if (score < this.config.risk_thresholds.high) return 'high';
    return 'critical';
  }

  /**
   * Calculate friction cost based on risk score and level
   */
  private calculateFrictionCost(score: number, level: 'low' | 'medium' | 'high' | 'critical'): number {
    const baseCost = Math.max(0, score);
    const multiplier = {
      'low': 1,
      'medium': 2,
      'high': 4,
      'critical': 8
    }[level];

    return Math.ceil(baseCost * multiplier);
  }

  /**
   * Determine if approval is required based on risk level
   */
  private requiresApproval(level: 'low' | 'medium' | 'high' | 'critical'): boolean {
    return level === 'high' || level === 'critical';
  }

  /**
   * Determine if segregation is required based on risk level
   */
  private requiresSegregation(level: 'low' | 'medium' | 'high' | 'critical'): boolean {
    return level === 'critical';
  }

  // Parameter analysis helpers
  private hasFileSystemAccess(params: Record<string, unknown>): boolean {
    const fileParams = ['file_path', 'directory', 'filename', 'path'];
    return fileParams.some(param => param in params);
  }

  private hasNetworkAccess(params: Record<string, unknown>): boolean {
    const networkParams = ['url', 'host', 'endpoint', 'api_url'];
    return networkParams.some(param => param in params);
  }

  private hasPrivilegedExecution(params: Record<string, unknown>): boolean {
    const privilegedParams = ['sudo', 'admin', 'root', 'privileged'];
    return privilegedParams.some(param => param in params) ||
           (typeof params.command === 'string' &&
            (params.command.includes('sudo') || params.command.includes('su ')));
  }

  private hasAuditTrail(request: ToolExecutionRequest): boolean {
    return !!request.context?.audit_enabled || !!request.context?.trace_id;
  }
}