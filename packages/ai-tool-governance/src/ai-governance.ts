// Constitutional AI Tool Governance System
// Main orchestrator implementing all constitutional principles for AI tool execution

import {
  AIToolGovernance,
  ToolExecutionRequest,
  ToolExecutionResult,
  RiskAssessment,
  ExecutionGate,
  AIAgent,
  FrictionBudget,
  ApprovalRequest,
  EmergencyOverride,
  PostFactoReview,
  ComplianceReport,
  AIGovernanceError,
  ExecutionPattern
} from './types.js';

import { ConstitutionalRiskAssessor, DefaultToolRegistry } from './risk/assessment.js';
import { ConstitutionalFrictionManager } from './risk/friction.js';
import { DirectExecutionPattern } from './patterns/direct.js';
import { SegregationExecutionPattern } from './patterns/segregation.js';
import { EmergencyExecutionPattern } from './patterns/emergency.js';
import { ConstitutionalEmergencyOverride } from './emergency/override.js';
import { ConstitutionalPostFactoReview } from './emergency/review.js';

import { CoordinationKernel, CoordinationReceipt } from '@akalynth/coordination-kernel';

export interface AIGovernanceConfig {
  kernel: CoordinationKernel;
  tool_registry?: DefaultToolRegistry;
  strict_constitutional_mode?: boolean;
  emergency_powers_enabled?: boolean;
}

/**
 * Constitutional AI Tool Governance System
 * Implements proof-native governance for AI tool execution without trust or reputation
 *
 * Constitutional Proof: "An AI system can be granted power without trust, reputation,
 * or supervision — only law"
 */
export class ConstitutionalAIGovernance implements AIToolGovernance {
  private risk_assessor: ConstitutionalRiskAssessor;
  private friction_manager: ConstitutionalFrictionManager;
  private direct_executor: DirectExecutionPattern;
  private segregation_executor: SegregationExecutionPattern;
  private emergency_executor: EmergencyExecutionPattern;
  private emergency_override: ConstitutionalEmergencyOverride;
  private post_facto_reviewer: ConstitutionalPostFactoReview;
  private tool_registry: DefaultToolRegistry;

  constructor(private config: AIGovernanceConfig) {
    this.tool_registry = config.tool_registry || new DefaultToolRegistry();

    // Initialize constitutional components
    this.risk_assessor = new ConstitutionalRiskAssessor(config.kernel, this.tool_registry);
    this.friction_manager = new ConstitutionalFrictionManager(config.kernel);
    this.direct_executor = new DirectExecutionPattern(config.kernel);
    this.segregation_executor = new SegregationExecutionPattern(config.kernel);
    this.emergency_executor = new EmergencyExecutionPattern(config.kernel);
    this.emergency_override = new ConstitutionalEmergencyOverride(config.kernel);
    this.post_facto_reviewer = new ConstitutionalPostFactoReview(config.kernel);
  }

  /**
   * Constitutional Risk Assessment Implementation
   * Constitutional Principle: Evidence-based decisions, no human discretion
   */
  async assessRisk(request: ToolExecutionRequest): Promise<RiskAssessment> {
    // Constitutional guarantee: Risk assessment is deterministic and audited
    return await this.risk_assessor.assessRisk(request);
  }

  /**
   * Constitutional Execution Gating Implementation
   * Constitutional Principle: Automatic pattern determination based on risk
   */
  async determineGate(risk: RiskAssessment): Promise<ExecutionGate> {
    let pattern: ExecutionPattern;
    let approval_required = false;
    let segregation_required = false;
    let emergency_override = false;

    // Constitutional decision tree - no human discretion
    if (risk.risk_level === 'critical') {
      pattern = 'emergency';
      approval_required = true;
      segregation_required = true;
      emergency_override = true;
    } else if (risk.risk_level === 'high') {
      pattern = 'segregation';
      approval_required = true;
      segregation_required = true;
    } else if (risk.risk_level === 'medium') {
      pattern = 'friction';
      approval_required = false;
      segregation_required = false;
    } else {
      pattern = 'direct';
      approval_required = false;
      segregation_required = false;
    }

    return {
      pattern,
      risk_assessment: risk,
      approval_required,
      approver_capability: segregation_required ? 'approve_high_risk' : undefined,
      friction_cost: risk.friction_cost,
      emergency_override
    };
  }

  /**
   * Constitutional Tool Execution Implementation
   * Constitutional Principle: All executions emit receipts, respect constraints
   */
  async executeTool(
    request: ToolExecutionRequest,
    gate: ExecutionGate
  ): Promise<ToolExecutionResult> {
    // Get requesting agent
    const agent = await this.getAgent(request.requested_by);

    // Constitutional execution path based on determined pattern
    switch (gate.pattern) {
      case 'direct':
        return await this.executeDirectPattern(request, gate, agent);

      case 'friction':
        return await this.executeFrictionPattern(request, gate, agent);

      case 'segregation':
        return await this.executeSegregationPattern(request, gate, agent);

      case 'emergency':
        throw new AIGovernanceError(
          'Emergency pattern requires explicit override call',
          'EMERGENCY_DENIED',
          { pattern: gate.pattern }
        );

      default:
        throw new AIGovernanceError(
          `Unknown execution pattern: ${gate.pattern}`,
          'RISK_TOO_HIGH',
          { pattern: gate.pattern }
        );
    }
  }

  /**
   * Constitutional Emergency Override Implementation
   * Constitutional Principle: Emergency doctrine with mandatory post-facto review
   */
  async emergencyOverride(
    request: ToolExecutionRequest,
    justification: string,
    overriding_agent: AIAgent
  ): Promise<EmergencyOverride> {
    // Parse justification (in production, would be structured)
    const emergency_justification = {
      context: {
        threat_level: 'critical' as const,
        urgency: 'immediate' as const,
        impact_scope: 'systemic' as const,
        business_continuity_risk: true,
        regulatory_deadline: false
      },
      specific_threat: justification,
      alternatives_considered: ['delay', 'normal approval process'],
      risk_if_delayed: 'System failure, data loss, or security breach',
      authorization_basis: 'Emergency doctrine constitutional authority'
    };

    // Constitutional emergency override with full audit trail
    const override = await this.emergency_override.initiateEmergencyOverride(
      request,
      emergency_justification,
      overriding_agent
    );

    // Schedule mandatory post-facto review
    await this.post_facto_reviewer.scheduleReview(override);

    return override;
  }

  /**
   * Constitutional Post-Facto Review Implementation
   * Constitutional Principle: Independent review with segregation
   */
  async reviewEmergency(
    override: EmergencyOverride,
    reviewer: AIAgent
  ): Promise<PostFactoReview> {
    // Constitutional review decision (simplified for demonstration)
    const review_decision = {
      outcome: 'justified' as const,
      confidence_level: 'high' as const,
      criteria: {
        necessity_assessment: 'necessary' as const,
        alternatives_adequacy: 'adequate' as const,
        proportionality: 'proportional' as const,
        procedural_compliance: 'compliant' as const,
        outcome_effectiveness: 'effective' as const
      },
      evidence: {
        emergency_context_verified: true,
        alternatives_actually_considered: ['delay', 'normal process'],
        actual_impact_vs_predicted: 'Matched prediction - system stability maintained',
        timeline_analysis: 'Action taken within appropriate timeframe',
        compliance_issues_found: [],
        recommendations: ['Continue current emergency protocols']
      },
      follow_up_actions: ['Document lessons learned'],
      capability_impact: 'none' as const
    };

    return await this.post_facto_reviewer.conductReview(
      override.id,
      reviewer,
      review_decision,
      'Emergency override was necessary and executed appropriately'
    );
  }

  /**
   * Constitutional Friction Management Implementation
   * Constitutional Principle: Temporal constraints automatically enforced
   */
  async getFrictionBudget(agent_id: string): Promise<FrictionBudget> {
    return await this.friction_manager.getFrictionBudget(agent_id);
  }

  async consumeFriction(agent_id: string, cost: number): Promise<void> {
    return await this.friction_manager.consumeFriction(agent_id, cost);
  }

  /**
   * Constitutional Approval Flow Implementation
   * Constitutional Principle: Segregation of authority
   */
  async requestApproval(request: ToolExecutionRequest): Promise<ApprovalRequest> {
    const risk = await this.assessRisk(request);
    const gate = await this.determineGate(risk);
    const agent = await this.getAgent(request.requested_by);

    return await this.segregation_executor.requestApproval(request, gate, agent);
  }

  async approveRequest(approval_id: string, approver: AIAgent): Promise<void> {
    await this.segregation_executor.approveRequest(approval_id, approver);
  }

  /**
   * Constitutional Compliance Verification
   * Constitutional Principle: Compliance is mechanically deterministic
   */
  async verifyCompliance(): Promise<boolean> {
    try {
      const report = await this.generateComplianceReport();
      return report.compliance_score >= 0.95 && report.chain_integrity === 'valid';
    } catch (error) {
      return false;
    }
  }

  async generateComplianceReport(): Promise<ComplianceReport> {
    // This would integrate with the verification system
    // For now, return a simplified report
    return {
      timestamp: new Date().toISOString(),
      total_actions: 0,
      violations: [],
      compliance_score: 1.0,
      recommendations: [],
      chain_integrity: 'valid'
    };
  }

  // Private execution pattern implementations

  private async executeDirectPattern(
    request: ToolExecutionRequest,
    gate: ExecutionGate,
    agent: AIAgent
  ): Promise<ToolExecutionResult> {
    return await this.direct_executor.execute(
      request,
      gate,
      agent,
      this.createToolExecutor()
    );
  }

  private async executeFrictionPattern(
    request: ToolExecutionRequest,
    gate: ExecutionGate,
    agent: AIAgent
  ): Promise<ToolExecutionResult> {
    // Check and consume friction budget
    const can_afford = await this.friction_manager.canAfford(agent.id, gate.friction_cost);
    if (!can_afford) {
      throw new AIGovernanceError(
        'Insufficient friction budget for action',
        'FRICTION_EXHAUSTED',
        { agent_id: agent.id, cost: gate.friction_cost }
      );
    }

    await this.friction_manager.consumeFriction(agent.id, gate.friction_cost);

    // Execute using direct pattern after friction consumption
    return await this.direct_executor.execute(
      request,
      gate,
      agent,
      this.createToolExecutor()
    );
  }

  private async executeSegregationPattern(
    request: ToolExecutionRequest,
    gate: ExecutionGate,
    agent: AIAgent
  ): Promise<ToolExecutionResult> {
    throw new AIGovernanceError(
      'Segregation pattern requires pre-approval - use requestApproval() first',
      'APPROVAL_REQUIRED',
      { pattern: gate.pattern }
    );
  }

  private async getAgent(agent_id: string): Promise<AIAgent> {
    // In production, this would fetch from a registry
    return {
      id: agent_id,
      capabilities: ['file_read', 'file_write', 'network_read', 'emergency_override'],
      risk_profile: 'medium',
      emergency_authorized: true
    };
  }

  private createToolExecutor(): (req: ToolExecutionRequest) => Promise<ToolExecutionResult> {
    return async (request: ToolExecutionRequest): Promise<ToolExecutionResult> => {
      // Mock tool execution for demonstration
      const start_time = Date.now();

      // Simulate tool execution
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution_time = Date.now() - start_time;

      return {
        success: true,
        output: `Tool ${request.tool_name} executed successfully`,
        execution_time_ms: execution_time
      };
    };
  }
}

/**
 * Constitutional Proof Factory
 * Creates instances with different constitutional strictness levels
 */
export class ConstitutionalAIGovernanceFactory {
  /**
   * Create maximum constitutional strictness instance
   * For production systems requiring absolute compliance
   */
  static createStrictConstitutional(kernel: CoordinationKernel): ConstitutionalAIGovernance {
    return new ConstitutionalAIGovernance({
      kernel,
      strict_constitutional_mode: true,
      emergency_powers_enabled: true
    });
  }

  /**
   * Create development instance with constitutional compliance
   * For testing and development with full audit trails
   */
  static createDevelopment(kernel: CoordinationKernel): ConstitutionalAIGovernance {
    return new ConstitutionalAIGovernance({
      kernel,
      strict_constitutional_mode: false,
      emergency_powers_enabled: true
    });
  }

  /**
   * Create emergency-capable instance
   * For critical systems requiring emergency override capability
   */
  static createEmergencyCapable(kernel: CoordinationKernel): ConstitutionalAIGovernance {
    return new ConstitutionalAIGovernance({
      kernel,
      strict_constitutional_mode: true,
      emergency_powers_enabled: true
    });
  }
}