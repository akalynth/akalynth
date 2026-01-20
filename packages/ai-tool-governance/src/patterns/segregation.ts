// Segregation Execution Pattern - Constitutional High-Risk AI Tool Execution
// For tools requiring independent approval (segregation of authority)

import {
  ToolExecutionRequest,
  ToolExecutionResult,
  ExecutionGate,
  AIAgent,
  ApprovalRequest,
  AIGovernanceError
} from '../types.js';
import { AI_GOVERNANCE_CONSTANTS } from '../types.js';
import { CoordinationReceipt, CoordinationKernel, Actor } from '@akalynth/coordination-kernel';

export interface SegregationExecutionConfig {
  min_risk_score: number;
  required_approver_capability: string;
  approval_timeout_ms: number;
  max_pending_approvals: number;
}

export const DEFAULT_SEGREGATION_CONFIG: SegregationExecutionConfig = {
  min_risk_score: 5, // High risk actions only
  required_approver_capability: AI_GOVERNANCE_CONSTANTS.APPROVE_HIGH_RISK_CAPABILITY,
  approval_timeout_ms: AI_GOVERNANCE_CONSTANTS.APPROVAL_TIMEOUT_MS,
  max_pending_approvals: 10
};

/**
 * Segregation Execution Pattern for High-Risk AI Tool Operations
 * Constitutional Principles: Segregation invariant, independent approval required
 */
export class SegregationExecutionPattern {
  private pending_approvals: Map<string, ApprovalRequest> = new Map();

  constructor(
    private kernel: CoordinationKernel,
    private config: SegregationExecutionConfig = DEFAULT_SEGREGATION_CONFIG
  ) {}

  /**
   * Request approval for segregated execution
   * Constitutional Requirement: Independent authority for high-risk actions
   */
  async requestApproval(
    request: ToolExecutionRequest,
    gate: ExecutionGate,
    agent: AIAgent
  ): Promise<ApprovalRequest> {
    // Validate this request requires segregation
    this.validateSegregationRequired(request, gate, agent);

    // Check pending approval limits
    if (this.pending_approvals.size >= this.config.max_pending_approvals) {
      throw new AIGovernanceError(
        'Too many pending approvals, request rejected',
        'APPROVAL_REQUIRED',
        { pending_count: this.pending_approvals.size, limit: this.config.max_pending_approvals }
      );
    }

    // Create approval request
    const approval_request: ApprovalRequest = {
      id: this.generateApprovalId(),
      tool_request: request,
      risk_assessment: gate.risk_assessment,
      required_capability: this.config.required_approver_capability,
      expires_at: new Date(Date.now() + this.config.approval_timeout_ms).toISOString(),
      status: 'pending'
    };

    // Store pending approval
    this.pending_approvals.set(approval_request.id, approval_request);

    // Emit receipt for approval request (Evidence Invariant)
    await this.emitApprovalRequestReceipt(approval_request, agent);

    return approval_request;
  }

  /**
   * Approve a pending request
   * Constitutional Requirement: Segregation - approver cannot be requester
   */
  async approveRequest(
    approval_id: string,
    approver: AIAgent
  ): Promise<ApprovalRequest> {
    const approval = this.pending_approvals.get(approval_id);
    if (!approval) {
      throw new AIGovernanceError(
        `Approval request ${approval_id} not found`,
        'APPROVAL_REQUIRED',
        { approval_id }
      );
    }

    // Validate approval is still valid
    this.validateApprovalStillValid(approval);

    // Constitutional Segregation Check - approver cannot be requester
    if (approver.id === approval.tool_request.requested_by) {
      await this.emitSegregationViolationReceipt(approval_id, approver.id);
      throw new AIGovernanceError(
        'Segregation violation: Agent cannot approve their own request',
        'APPROVAL_REQUIRED',
        { requester: approval.tool_request.requested_by, approver: approver.id }
      );
    }

    // Check approver capabilities
    if (!this.hasApprovalCapability(approver)) {
      throw new AIGovernanceError(
        `Approver lacks required capability: ${this.config.required_approver_capability}`,
        'INSUFFICIENT_CAPABILITY',
        { approver_id: approver.id, required_capability: this.config.required_approver_capability }
      );
    }

    // Update approval status
    approval.status = 'approved';
    approval.approved_by = approver.id;

    // Emit receipt for approval (Evidence Invariant)
    await this.emitApprovalGrantedReceipt(approval, approver);

    return approval;
  }

  /**
   * Execute tool after receiving approval
   * Constitutional Requirement: Execution only after segregated approval
   */
  async executeWithApproval(
    approval_id: string,
    tool_executor: (req: ToolExecutionRequest) => Promise<ToolExecutionResult>
  ): Promise<ToolExecutionResult> {
    const approval = this.pending_approvals.get(approval_id);
    if (!approval) {
      throw new AIGovernanceError(
        `Approval ${approval_id} not found`,
        'APPROVAL_REQUIRED',
        { approval_id }
      );
    }

    if (approval.status !== 'approved') {
      throw new AIGovernanceError(
        `Approval ${approval_id} not granted (status: ${approval.status})`,
        'APPROVAL_REQUIRED',
        { approval_id, status: approval.status }
      );
    }

    const start_time = Date.now();

    try {
      // Emit pre-execution receipt
      await this.emitSegregatedExecutionStartReceipt(approval);

      // Execute the tool
      const result = await tool_executor(approval.tool_request);

      // Emit post-execution receipt
      await this.emitSegregatedExecutionCompleteReceipt(approval, result, start_time);

      // Remove from pending approvals
      this.pending_approvals.delete(approval_id);

      return result;

    } catch (error) {
      // Emit failure receipt
      await this.emitSegregatedExecutionFailureReceipt(approval, error, start_time);
      throw error;
    }
  }

  /**
   * Deny a pending approval request
   */
  async denyRequest(approval_id: string, denier: AIAgent, reason: string): Promise<void> {
    const approval = this.pending_approvals.get(approval_id);
    if (!approval) {
      throw new AIGovernanceError(
        `Approval request ${approval_id} not found`,
        'APPROVAL_REQUIRED',
        { approval_id }
      );
    }

    // Check denier capabilities
    if (!this.hasApprovalCapability(denier)) {
      throw new AIGovernanceError(
        `Denier lacks required capability: ${this.config.required_approver_capability}`,
        'INSUFFICIENT_CAPABILITY',
        { denier_id: denier.id, required_capability: this.config.required_approver_capability }
      );
    }

    // Update approval status
    approval.status = 'denied';

    // Emit receipt for denial
    await this.emitApprovalDeniedReceipt(approval, denier, reason);

    // Remove from pending approvals
    this.pending_approvals.delete(approval_id);
  }

  /**
   * Clean up expired approval requests
   * Constitutional Principle: Temporal constraints are enforced
   */
  async cleanupExpiredApprovals(): Promise<void> {
    const now = Date.now();
    const expired_ids: string[] = [];

    for (const [id, approval] of this.pending_approvals) {
      const expires_at = new Date(approval.expires_at).getTime();
      if (now > expires_at) {
        approval.status = 'expired';
        expired_ids.push(id);

        // Emit expiry receipt
        await this.emitApprovalExpiredReceipt(approval);
      }
    }

    // Remove expired approvals
    for (const id of expired_ids) {
      this.pending_approvals.delete(id);
    }
  }

  // Validation methods

  private validateSegregationRequired(
    request: ToolExecutionRequest,
    gate: ExecutionGate,
    agent: AIAgent
  ): void {
    if (gate.pattern !== 'segregation') {
      throw new AIGovernanceError(
        `Request does not require segregation pattern (pattern: ${gate.pattern})`,
        'RISK_TOO_HIGH',
        { actual_pattern: gate.pattern, expected_pattern: 'segregation' }
      );
    }

    if (!gate.approval_required) {
      throw new AIGovernanceError(
        'Request does not require approval despite segregation pattern',
        'APPROVAL_REQUIRED',
        { gate }
      );
    }

    if (gate.risk_assessment.total_score < this.config.min_risk_score) {
      throw new AIGovernanceError(
        `Risk score ${gate.risk_assessment.total_score} too low for segregation pattern`,
        'RISK_TOO_HIGH',
        { score: gate.risk_assessment.total_score, minimum: this.config.min_risk_score }
      );
    }
  }

  private validateApprovalStillValid(approval: ApprovalRequest): void {
    const now = Date.now();
    const expires_at = new Date(approval.expires_at).getTime();

    if (now > expires_at) {
      throw new AIGovernanceError(
        'Approval request has expired',
        'APPROVAL_REQUIRED',
        { approval_id: approval.id, expired_at: approval.expires_at }
      );
    }

    if (approval.status !== 'pending') {
      throw new AIGovernanceError(
        `Approval already processed (status: ${approval.status})`,
        'APPROVAL_REQUIRED',
        { approval_id: approval.id, status: approval.status }
      );
    }
  }

  private hasApprovalCapability(agent: AIAgent): boolean {
    return agent.capabilities.includes(this.config.required_approver_capability);
  }

  private generateApprovalId(): string {
    return `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Receipt emission methods (Evidence Invariant compliance)

  private async emitApprovalRequestReceipt(
    approval: ApprovalRequest,
    requester: AIAgent
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'segregation_executor',
      'approval_requested',
      {
        approval_id: approval.id,
        tool_name: approval.tool_request.tool_name,
        requester_id: requester.id,
        risk_score: approval.risk_assessment.total_score,
        expires_at: approval.expires_at
      },
      'segregation_approval_requested'
    );
  }

  private async emitApprovalGrantedReceipt(
    approval: ApprovalRequest,
    approver: AIAgent
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'segregation_executor',
      'approval_granted',
      {
        approval_id: approval.id,
        tool_name: approval.tool_request.tool_name,
        requester_id: approval.tool_request.requested_by,
        approver_id: approver.id
      },
      'segregation_approval_granted'
    );
  }

  private async emitApprovalDeniedReceipt(
    approval: ApprovalRequest,
    denier: AIAgent,
    reason: string
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'segregation_executor',
      'approval_denied',
      {
        approval_id: approval.id,
        tool_name: approval.tool_request.tool_name,
        requester_id: approval.tool_request.requested_by,
        denier_id: denier.id,
        reason
      },
      'segregation_approval_denied'
    );
  }

  private async emitApprovalExpiredReceipt(
    approval: ApprovalRequest
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'segregation_executor',
      'approval_expired',
      {
        approval_id: approval.id,
        tool_name: approval.tool_request.tool_name,
        requester_id: approval.tool_request.requested_by,
        expires_at: approval.expires_at
      },
      'segregation_approval_expired'
    );
  }

  private async emitSegregationViolationReceipt(
    approval_id: string,
    violator_id: string
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'segregation_executor',
      'segregation_violation_detected',
      {
        approval_id,
        violator_id,
        violation_type: 'self_approval_attempt'
      },
      'constitutional_violation_segregation'
    );
  }

  private async emitSegregatedExecutionStartReceipt(
    approval: ApprovalRequest
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'segregation_executor',
      'segregated_execution_started',
      {
        approval_id: approval.id,
        tool_name: approval.tool_request.tool_name,
        requester_id: approval.tool_request.requested_by,
        approver_id: approval.approved_by
      },
      'segregated_execution_initiated'
    );
  }

  private async emitSegregatedExecutionCompleteReceipt(
    approval: ApprovalRequest,
    result: ToolExecutionResult,
    start_time: number
  ): Promise<CoordinationReceipt> {
    const execution_time = Date.now() - start_time;

    return await this.kernel.appendReceipt(
      'segregation_executor',
      'segregated_execution_completed',
      {
        approval_id: approval.id,
        tool_name: approval.tool_request.tool_name,
        requester_id: approval.tool_request.requested_by,
        approver_id: approval.approved_by,
        success: result.success,
        execution_time_ms: execution_time
      },
      result.success ? 'segregated_execution_successful' : 'segregated_execution_failed'
    );
  }

  private async emitSegregatedExecutionFailureReceipt(
    approval: ApprovalRequest,
    error: unknown,
    start_time: number
  ): Promise<CoordinationReceipt> {
    const execution_time = Date.now() - start_time;
    const error_message = error instanceof Error ? error.message : 'Unknown error';

    return await this.kernel.appendReceipt(
      'segregation_executor',
      'segregated_execution_failed',
      {
        approval_id: approval.id,
        tool_name: approval.tool_request.tool_name,
        requester_id: approval.tool_request.requested_by,
        approver_id: approval.approved_by,
        error_message,
        execution_time_ms: execution_time
      },
      'segregated_execution_error'
    );
  }
}