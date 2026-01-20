// Direct Execution Pattern - Constitutional Low-Risk AI Tool Execution
// For tools with minimal risk that can execute without approval

import {
  ToolExecutionRequest,
  ToolExecutionResult,
  ExecutionGate,
  AIAgent,
  AIGovernanceError
} from '../types.js';
import { CoordinationReceipt, CoordinationKernel } from '@akalynth/coordination-kernel';

export interface DirectExecutionConfig {
  max_risk_score: number;
  required_capabilities: string[];
  audit_required: boolean;
}

export const DEFAULT_DIRECT_CONFIG: DirectExecutionConfig = {
  max_risk_score: 2, // Only allow very low risk tools
  required_capabilities: [],
  audit_required: true
};

/**
 * Direct Execution Pattern for Low-Risk AI Tool Operations
 * Constitutional Principles: Evidence generation, capability checking
 */
export class DirectExecutionPattern {
  constructor(
    private kernel: CoordinationKernel,
    private config: DirectExecutionConfig = DEFAULT_DIRECT_CONFIG
  ) {}

  /**
   * Execute tool directly with constitutional safeguards
   * Constitutional Requirements: Evidence emission, capability validation
   */
  async execute(
    request: ToolExecutionRequest,
    gate: ExecutionGate,
    agent: AIAgent,
    tool_executor: (req: ToolExecutionRequest) => Promise<ToolExecutionResult>
  ): Promise<ToolExecutionResult> {
    const start_time = Date.now();

    try {
      // Validate this request qualifies for direct execution
      this.validateDirectExecutionEligibility(request, gate, agent);

      // Check agent capabilities (Constitutional Principle: Bounded authority)
      this.validateAgentCapabilities(agent);

      // Emit pre-execution receipt (Evidence Invariant)
      await this.emitPreExecutionReceipt(request, agent);

      // Execute the tool
      const result = await tool_executor(request);

      // Emit post-execution receipt (Evidence Invariant)
      await this.emitPostExecutionReceipt(request, agent, result, start_time);

      return result;

    } catch (error) {
      // Emit failure receipt (Evidence Invariant - all outcomes logged)
      await this.emitExecutionFailureReceipt(request, agent, error, start_time);
      throw error;
    }
  }

  /**
   * Validate that request qualifies for direct execution pattern
   * Constitutional Requirement: Risk-based execution gating
   */
  private validateDirectExecutionEligibility(
    request: ToolExecutionRequest,
    gate: ExecutionGate,
    agent: AIAgent
  ): void {
    // Check pattern match
    if (gate.pattern !== 'direct') {
      throw new AIGovernanceError(
        `Request requires ${gate.pattern} execution pattern, not direct`,
        'RISK_TOO_HIGH',
        { required_pattern: gate.pattern, attempted_pattern: 'direct' }
      );
    }

    // Check risk score within limits
    if (gate.risk_assessment.total_score > this.config.max_risk_score) {
      throw new AIGovernanceError(
        `Risk score ${gate.risk_assessment.total_score} exceeds direct execution limit ${this.config.max_risk_score}`,
        'RISK_TOO_HIGH',
        { score: gate.risk_assessment.total_score, limit: this.config.max_risk_score }
      );
    }

    // Check approval requirements
    if (gate.approval_required) {
      throw new AIGovernanceError(
        'Request requires approval, cannot use direct execution',
        'APPROVAL_REQUIRED',
        { gate }
      );
    }
  }

  /**
   * Validate agent has required capabilities
   * Constitutional Principle: Capability-based access control
   */
  private validateAgentCapabilities(agent: AIAgent): void {
    for (const required_capability of this.config.required_capabilities) {
      if (!agent.capabilities.includes(required_capability)) {
        throw new AIGovernanceError(
          `Agent lacks required capability: ${required_capability}`,
          'INSUFFICIENT_CAPABILITY',
          { agent_id: agent.id, required_capability }
        );
      }
    }
  }

  /**
   * Emit receipt before tool execution
   * Constitutional Requirement: Evidence generation for all actions
   */
  private async emitPreExecutionReceipt(
    request: ToolExecutionRequest,
    agent: AIAgent
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'direct_executor',
      'tool_execution_started',
      {
        tool_name: request.tool_name,
        agent_id: agent.id,
        execution_pattern: 'direct',
        parameters_count: Object.keys(request.parameters).length
      },
      'direct_execution_initiated'
    );
  }

  /**
   * Emit receipt after successful tool execution
   */
  private async emitPostExecutionReceipt(
    request: ToolExecutionRequest,
    agent: AIAgent,
    result: ToolExecutionResult,
    start_time: number
  ): Promise<CoordinationReceipt> {
    const execution_time = Date.now() - start_time;

    return await this.kernel.appendReceipt(
      'direct_executor',
      'tool_execution_completed',
      {
        tool_name: request.tool_name,
        agent_id: agent.id,
        execution_pattern: 'direct',
        success: result.success,
        total_execution_time_ms: execution_time,
        tool_execution_time_ms: result.execution_time_ms
      },
      result.success ? 'direct_execution_successful' : 'direct_execution_failed'
    );
  }

  /**
   * Emit receipt for execution failure
   */
  private async emitExecutionFailureReceipt(
    request: ToolExecutionRequest,
    agent: AIAgent,
    error: unknown,
    start_time: number
  ): Promise<CoordinationReceipt> {
    const execution_time = Date.now() - start_time;
    const error_message = error instanceof Error ? error.message : 'Unknown error';

    return await this.kernel.appendReceipt(
      'direct_executor',
      'tool_execution_failed',
      {
        tool_name: request.tool_name,
        agent_id: agent.id,
        execution_pattern: 'direct',
        error_message,
        execution_time_ms: execution_time
      },
      'direct_execution_error'
    );
  }

  /**
   * Check if a request qualifies for direct execution
   * Constitutional Principle: Deterministic pattern matching
   */
  static qualifiesForDirect(gate: ExecutionGate): boolean {
    return (
      gate.pattern === 'direct' &&
      !gate.approval_required &&
      gate.friction_cost <= 5 && // Low friction threshold
      !gate.emergency_override
    );
  }
}