// Constitutional Risk Assessment System
// Evidence-based risk evaluation for AI tool execution

import { RiskAssessment, ToolExecutionRequest, ToolDefinition, ToolRegistry } from '../types.js';
import { ConstitutionalRiskCalculator } from './calculator.js';
import { CoordinationReceipt, CoordinationKernel } from '@akalynth/coordination-kernel';

export class ConstitutionalRiskAssessor {
  private calculator: ConstitutionalRiskCalculator;

  constructor(
    private kernel: CoordinationKernel,
    private toolRegistry: ToolRegistry,
    calculator?: ConstitutionalRiskCalculator
  ) {
    this.calculator = calculator || new ConstitutionalRiskCalculator();
  }

  /**
   * Perform constitutional risk assessment for AI tool execution
   * Constitutional Guarantee: All risk assessments emit receipts for audit
   */
  async assessRisk(request: ToolExecutionRequest): Promise<RiskAssessment> {
    const start_time = Date.now();

    try {
      // Get tool definition from registry
      const tool_definition = this.toolRegistry.getTool(request.tool_name);
      if (!tool_definition) {
        throw new Error(`Unknown tool: ${request.tool_name}`);
      }

      // Calculate risk using constitutional calculator
      const assessment = await this.calculator.calculateRisk(request, tool_definition);

      // Emit receipt for risk assessment (Evidence Invariant)
      await this.emitRiskAssessmentReceipt(request, assessment, start_time);

      return assessment;

    } catch (error) {
      // Emit receipt for failed assessment
      await this.emitFailedAssessmentReceipt(request, error, start_time);
      throw error;
    }
  }

  /**
   * Validate risk assessment consistency
   * Constitutional Requirement: Deterministic risk evaluation
   */
  async validateAssessment(
    request: ToolExecutionRequest,
    expected_assessment: RiskAssessment
  ): Promise<boolean> {
    const actual_assessment = await this.assessRisk(request);

    return (
      actual_assessment.total_score === expected_assessment.total_score &&
      actual_assessment.risk_level === expected_assessment.risk_level &&
      actual_assessment.friction_cost === expected_assessment.friction_cost
    );
  }

  /**
   * Get assessment history for an AI agent
   * Constitutional Principle: Complete audit trail
   */
  async getAssessmentHistory(agent_id: string, limit: number = 100): Promise<CoordinationReceipt[]> {
    // This would integrate with the kernel's receipt chain to retrieve
    // historical risk assessments for audit purposes
    // Implementation depends on kernel's query capabilities
    return [];
  }

  /**
   * Emit receipt for successful risk assessment
   * Constitutional Requirement: Evidence generation for all state transitions
   */
  private async emitRiskAssessmentReceipt(
    request: ToolExecutionRequest,
    assessment: RiskAssessment,
    start_time: number
  ): Promise<CoordinationReceipt> {
    const execution_time = Date.now() - start_time;

    return await this.kernel.appendReceipt(
      'risk_assessor',
      'risk_assessment_completed',
      {
        tool_name: request.tool_name,
        requested_by: request.requested_by,
        parameters_hash: this.hashParameters(request.parameters),
        execution_time_ms: execution_time
      },
      JSON.stringify({
        total_score: assessment.total_score,
        risk_level: assessment.risk_level,
        friction_cost: assessment.friction_cost,
        approval_required: assessment.approval_required,
        segregation_required: assessment.segregation_required,
        factor_count: assessment.factors.length
      })
    );
  }

  /**
   * Emit receipt for failed risk assessment
   */
  private async emitFailedAssessmentReceipt(
    request: ToolExecutionRequest,
    error: unknown,
    start_time: number
  ): Promise<CoordinationReceipt> {
    const execution_time = Date.now() - start_time;
    const error_message = error instanceof Error ? error.message : 'Unknown error';

    return await this.kernel.appendReceipt(
      'risk_assessor',
      'risk_assessment_failed',
      {
        tool_name: request.tool_name,
        requested_by: request.requested_by,
        error_message,
        execution_time_ms: execution_time
      },
      'assessment_failed'
    );
  }

  /**
   * Hash parameters for consistent receipt generation
   * Constitutional Requirement: Deterministic evidence
   */
  private hashParameters(parameters: Record<string, unknown>): string {
    // Simple hash for consistent parameter representation
    // In production, would use cryptographic hash
    return JSON.stringify(parameters, Object.keys(parameters).sort());
  }
}

/**
 * Default Tool Registry Implementation
 * Provides constitutional tool definitions for risk assessment
 */
export class DefaultToolRegistry implements ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.initializeDefaultTools();
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getBaseRiskScore(tool_name: string): number {
    const tool = this.tools.get(tool_name);
    return tool?.base_risk_score || 0;
  }

  private initializeDefaultTools(): void {
    // File system tools
    this.register({
      name: 'read_file',
      description: 'Read contents of a file',
      base_risk_score: 1,
      risk_factors: [
        { factor: 'data_access', weight: 1, description: 'Accesses file data' }
      ],
      required_capabilities: ['file_read'],
      emergency_eligible: false,
      external_system_access: false,
      data_modification: false,
      user_communication: false,
      rollback_available: true
    });

    this.register({
      name: 'write_file',
      description: 'Write contents to a file',
      base_risk_score: 3,
      risk_factors: [
        { factor: 'data_modification', weight: 2, description: 'Modifies file data' },
        { factor: 'persistence', weight: 1, description: 'Creates persistent changes' }
      ],
      required_capabilities: ['file_write'],
      emergency_eligible: true,
      external_system_access: false,
      data_modification: true,
      user_communication: false,
      rollback_available: false
    });

    // Network tools
    this.register({
      name: 'web_fetch',
      description: 'Fetch content from a URL',
      base_risk_score: 2,
      risk_factors: [
        { factor: 'network_access', weight: 2, description: 'Makes network requests' }
      ],
      required_capabilities: ['network_read'],
      emergency_eligible: false,
      external_system_access: true,
      data_modification: false,
      user_communication: false,
      rollback_available: true
    });

    // Communication tools
    this.register({
      name: 'send_email',
      description: 'Send email message',
      base_risk_score: 4,
      risk_factors: [
        { factor: 'user_communication', weight: 2, description: 'Communicates with users' },
        { factor: 'external_delivery', weight: 2, description: 'Delivers to external systems' }
      ],
      required_capabilities: ['email_send'],
      emergency_eligible: true,
      external_system_access: true,
      data_modification: false,
      user_communication: true,
      rollback_available: false
    });

    // System tools
    this.register({
      name: 'execute_command',
      description: 'Execute system command',
      base_risk_score: 5,
      risk_factors: [
        { factor: 'system_execution', weight: 3, description: 'Executes system commands' },
        { factor: 'privilege_escalation', weight: 2, description: 'Potential privilege escalation' }
      ],
      required_capabilities: ['system_execute'],
      emergency_eligible: true,
      external_system_access: true,
      data_modification: true,
      user_communication: false,
      rollback_available: false
    });
  }
}