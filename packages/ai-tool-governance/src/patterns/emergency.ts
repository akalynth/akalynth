// Emergency Execution Pattern - Constitutional Critical Override System
// For critical situations requiring immediate action with post-facto accountability

import {
  ToolExecutionRequest,
  ToolExecutionResult,
  ExecutionGate,
  AIAgent,
  EmergencyOverride,
  PostFactoReview,
  AIGovernanceError
} from '../types.js';
import { AI_GOVERNANCE_CONSTANTS } from '../types.js';
import { CoordinationReceipt, CoordinationKernel } from '@akalynth/coordination-kernel';

export interface EmergencyExecutionConfig {
  max_concurrent_overrides: number;
  review_deadline_ms: number;
  required_emergency_capability: string;
  required_reviewer_capability: string;
  critical_risk_threshold: number;
}

export const DEFAULT_EMERGENCY_CONFIG: EmergencyExecutionConfig = {
  max_concurrent_overrides: 3,
  review_deadline_ms: AI_GOVERNANCE_CONSTANTS.EMERGENCY_REVIEW_DEADLINE_MS,
  required_emergency_capability: AI_GOVERNANCE_CONSTANTS.EMERGENCY_OVERRIDE_CAPABILITY,
  required_reviewer_capability: AI_GOVERNANCE_CONSTANTS.REVIEW_EMERGENCY_CAPABILITY,
  critical_risk_threshold: AI_GOVERNANCE_CONSTANTS.HIGH_RISK_THRESHOLD
};

/**
 * Emergency Execution Pattern for Critical Override Situations
 * Constitutional Principles: Legal exceptions with mandatory accountability
 */
export class EmergencyExecutionPattern {
  private active_overrides: Map<string, EmergencyOverride> = new Map();
  private pending_reviews: Map<string, EmergencyOverride> = new Map();

  constructor(
    private kernel: CoordinationKernel,
    private config: EmergencyExecutionConfig = DEFAULT_EMERGENCY_CONFIG
  ) {}

  /**
   * Execute emergency override with immediate action and mandatory review
   * Constitutional Principle: Emergency doctrine with post-facto accountability
   */
  async executeEmergencyOverride(
    request: ToolExecutionRequest,
    justification: string,
    overriding_agent: AIAgent,
    tool_executor: (req: ToolExecutionRequest) => Promise<ToolExecutionResult>
  ): Promise<{ result: ToolExecutionResult; override: EmergencyOverride }> {
    const start_time = Date.now();

    try {
      // Validate emergency authorization
      this.validateEmergencyAuthorization(overriding_agent);

      // Check concurrent override limits
      this.checkConcurrentLimits();

      // Create emergency override record
      const override = this.createEmergencyOverride(request, justification, overriding_agent);

      // Emit pre-execution receipt with enhanced audit (Evidence Invariant)
      await this.emitEmergencyOverrideStartReceipt(override);

      // Add to active overrides
      this.active_overrides.set(override.id, override);

      // Execute the tool immediately
      const result = await tool_executor(request);

      // Emit post-execution receipt
      await this.emitEmergencyOverrideCompleteReceipt(override, result, start_time);

      // Schedule mandatory post-facto review
      await this.schedulePostFactoReview(override);

      return { result, override };

    } catch (error) {
      // Emit failure receipt with emergency context
      await this.emitEmergencyOverrideFailureReceipt(request, overriding_agent, error, start_time);
      throw error;
    }
  }

  /**
   * Conduct mandatory post-facto review of emergency override
   * Constitutional Requirement: All emergencies must be reviewed
   */
  async conductPostFactoReview(
    override_id: string,
    reviewer: AIAgent,
    outcome: 'justified' | 'unjustified' | 'contested',
    findings: string,
    actions_taken: string[] = []
  ): Promise<PostFactoReview> {
    const override = this.pending_reviews.get(override_id) || this.active_overrides.get(override_id);
    if (!override) {
      throw new AIGovernanceError(
        `Emergency override ${override_id} not found for review`,
        'EMERGENCY_DENIED',
        { override_id }
      );
    }

    // Validate reviewer authorization
    this.validateReviewerAuthorization(reviewer, override);

    // Create review record
    const review: PostFactoReview = {
      override_id,
      reviewer_id: reviewer.id,
      review_outcome: outcome,
      findings,
      actions_taken,
      timestamp: this.normalizeTimestamp(override.timestamp, 'review')
    };

    // Emit receipt for review completion (Evidence Invariant)
    await this.emitPostFactoReviewReceipt(override, review);

    // Handle review outcomes
    await this.handleReviewOutcome(override, review);

    // Remove from pending reviews
    this.pending_reviews.delete(override_id);
    this.active_overrides.delete(override_id);

    return review;
  }

  /**
   * Check for overdue emergency reviews
   * Constitutional Principle: Temporal constraints on accountability
   */
  async checkOverdueReviews(): Promise<EmergencyOverride[]> {
    const chainNowMs = this.getChainNowMs();
    const overdue: EmergencyOverride[] = [];

    for (const [id, override] of this.pending_reviews) {
      const override_time = this.parseTimestamp(override.timestamp, 'override');
      const deadline = override_time + this.config.review_deadline_ms;

      if (chainNowMs > deadline) {
        overdue.push(override);
        // Emit receipt for overdue review
        const days_overdue = Math.floor((chainNowMs - deadline) / (24 * 60 * 60 * 1000));
        await this.emitOverdueReviewReceipt(override, days_overdue);
      }
    }

    return overdue;
  }

  /**
   * Get emergency override statistics for compliance monitoring
   */
  async getEmergencyStatistics(): Promise<EmergencyStatistics> {
    const active_count = this.active_overrides.size;
    const pending_review_count = this.pending_reviews.size;
    const overdue_reviews = await this.checkOverdueReviews();

    return {
      active_overrides: active_count,
      pending_reviews: pending_review_count,
      overdue_reviews: overdue_reviews.length,
      compliance_status: overdue_reviews.length > 0 ? 'violation' : 'compliant',
      next_review_deadline: this.getNextReviewDeadline()
    };
  }

  // Validation methods

  private validateEmergencyAuthorization(agent: AIAgent): void {
    if (!agent.emergency_authorized) {
      throw new AIGovernanceError(
        'Agent not authorized for emergency overrides',
        'EMERGENCY_DENIED',
        { agent_id: agent.id }
      );
    }

    if (!agent.capabilities.includes(this.config.required_emergency_capability)) {
      throw new AIGovernanceError(
        `Agent lacks emergency override capability: ${this.config.required_emergency_capability}`,
        'INSUFFICIENT_CAPABILITY',
        { agent_id: agent.id, required_capability: this.config.required_emergency_capability }
      );
    }
  }

  private validateReviewerAuthorization(reviewer: AIAgent, override: EmergencyOverride): void {
    // Constitutional Segregation Check - reviewer cannot be override agent
    if (reviewer.id === override.overridden_by) {
      throw new AIGovernanceError(
        'Segregation violation: Agent cannot review their own emergency override',
        'EMERGENCY_DENIED',
        { overrider: override.overridden_by, reviewer: reviewer.id }
      );
    }

    if (!reviewer.capabilities.includes(this.config.required_reviewer_capability)) {
      throw new AIGovernanceError(
        `Reviewer lacks review capability: ${this.config.required_reviewer_capability}`,
        'INSUFFICIENT_CAPABILITY',
        { reviewer_id: reviewer.id, required_capability: this.config.required_reviewer_capability }
      );
    }
  }

  private checkConcurrentLimits(): void {
    if (this.active_overrides.size >= this.config.max_concurrent_overrides) {
      throw new AIGovernanceError(
        'Too many concurrent emergency overrides',
        'EMERGENCY_DENIED',
        { active: this.active_overrides.size, limit: this.config.max_concurrent_overrides }
      );
    }
  }

  private createEmergencyOverride(
    request: ToolExecutionRequest,
    justification: string,
    agent: AIAgent
  ): EmergencyOverride {
    return {
      id: this.generateOverrideId(),
      tool_request: request,
      justification,
      overridden_by: agent.id,
      override_capability: this.config.required_emergency_capability,
      timestamp: this.normalizeTimestamp(request.timestamp, 'override_request'),
      review_required: true
    };
  }

  private async schedulePostFactoReview(override: EmergencyOverride): Promise<void> {
    // Move to pending reviews for mandatory review
    this.pending_reviews.set(override.id, override);

    // Emit receipt for review scheduling
    await this.emitReviewScheduledReceipt(override);
  }

  private async handleReviewOutcome(override: EmergencyOverride, review: PostFactoReview): Promise<void> {
    switch (review.review_outcome) {
      case 'unjustified':
        // Handle unjustified override - potential capability revocation
        await this.emitUnjustifiedOverrideReceipt(override, review);
        break;
      case 'contested':
        // Handle contested outcome - may require escalation
        await this.emitContestedOverrideReceipt(override, review);
        break;
      case 'justified':
        // Handle justified outcome - normal completion
        await this.emitJustifiedOverrideReceipt(override, review);
        break;
    }
  }

  private getNextReviewDeadline(): string | null {
    let earliest_deadline: number | null = null;

    for (const override of this.pending_reviews.values()) {
      const override_time = this.parseTimestamp(override.timestamp, 'override');
      const deadline = override_time + this.config.review_deadline_ms;

      if (earliest_deadline === null || deadline < earliest_deadline) {
        earliest_deadline = deadline;
      }
    }

    return earliest_deadline ? new Date(earliest_deadline).toISOString() : null;
  }

  private parseTimestamp(timestamp: string, context: string): number {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) {
      throw new AIGovernanceError(
        `Invalid timestamp for ${context}`,
        'EMERGENCY_DENIED',
        { timestamp }
      );
    }
    return parsed;
  }

  private normalizeTimestamp(timestamp: string, context: string): string {
    const parsed = this.parseTimestamp(timestamp, context);
    return new Date(parsed).toISOString();
  }

  private getChainNowMs(): number {
    let latest: number | null = null;

    for (const override of this.active_overrides.values()) {
      const ts = this.parseTimestamp(override.timestamp, 'override');
      if (latest === null || ts > latest) {
        latest = ts;
      }
    }

    for (const override of this.pending_reviews.values()) {
      const ts = this.parseTimestamp(override.timestamp, 'override');
      if (latest === null || ts > latest) {
        latest = ts;
      }
    }

    return latest ?? 0;
  }

  private generateOverrideId(): string {
    return `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Receipt emission methods (Evidence Invariant compliance)

  private async emitEmergencyOverrideStartReceipt(
    override: EmergencyOverride
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'emergency_executor',
      'emergency_override_initiated',
      {
        override_id: override.id,
        tool_name: override.tool_request.tool_name,
        overridden_by: override.overridden_by,
        justification_length: override.justification.length
      },
      'emergency_execution_started'
    );
  }

  private async emitEmergencyOverrideCompleteReceipt(
    override: EmergencyOverride,
    result: ToolExecutionResult,
    start_time: number
  ): Promise<CoordinationReceipt> {
    const execution_time = Date.now() - start_time;

    return await this.kernel.appendReceipt(
      'emergency_executor',
      'emergency_override_completed',
      {
        override_id: override.id,
        tool_name: override.tool_request.tool_name,
        overridden_by: override.overridden_by,
        success: result.success,
        execution_time_ms: execution_time,
        review_required: override.review_required
      },
      result.success ? 'emergency_execution_successful' : 'emergency_execution_failed'
    );
  }

  private async emitEmergencyOverrideFailureReceipt(
    request: ToolExecutionRequest,
    agent: AIAgent,
    error: unknown,
    start_time: number
  ): Promise<CoordinationReceipt> {
    const execution_time = Date.now() - start_time;
    const error_message = error instanceof Error ? error.message : 'Unknown error';

    return await this.kernel.appendReceipt(
      'emergency_executor',
      'emergency_override_failed',
      {
        tool_name: request.tool_name,
        overridden_by: agent.id,
        error_message,
        execution_time_ms: execution_time
      },
      'emergency_execution_error'
    );
  }

  private async emitReviewScheduledReceipt(
    override: EmergencyOverride
  ): Promise<CoordinationReceipt> {
    const override_time = this.parseTimestamp(override.timestamp, 'override');
    const review_deadline = new Date(override_time + this.config.review_deadline_ms).toISOString();

    return await this.kernel.appendReceipt(
      'emergency_executor',
      'post_facto_review_scheduled',
      {
        override_id: override.id,
        overridden_by: override.overridden_by,
        review_deadline
      },
      'emergency_review_required'
    );
  }

  private async emitPostFactoReviewReceipt(
    override: EmergencyOverride,
    review: PostFactoReview
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'emergency_executor',
      'post_facto_review_completed',
      {
        override_id: override.id,
        reviewer_id: review.reviewer_id,
        overridden_by: override.overridden_by,
        review_outcome: review.review_outcome,
        actions_taken_count: review.actions_taken.length
      },
      `emergency_review_${review.review_outcome}`
    );
  }

  private async emitOverdueReviewReceipt(
    override: EmergencyOverride,
    days_overdue: number
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'emergency_executor',
      'post_facto_review_overdue',
      {
        override_id: override.id,
        overridden_by: override.overridden_by,
        override_timestamp: override.timestamp,
        days_overdue
      },
      'constitutional_violation_overdue_review'
    );
  }

  private async emitUnjustifiedOverrideReceipt(
    override: EmergencyOverride,
    review: PostFactoReview
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'emergency_executor',
      'emergency_override_unjustified',
      {
        override_id: override.id,
        overridden_by: override.overridden_by,
        reviewer_id: review.reviewer_id,
        findings: review.findings
      },
      'constitutional_violation_unjustified_emergency'
    );
  }

  private async emitContestedOverrideReceipt(
    override: EmergencyOverride,
    review: PostFactoReview
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'emergency_executor',
      'emergency_override_contested',
      {
        override_id: override.id,
        overridden_by: override.overridden_by,
        reviewer_id: review.reviewer_id,
        escalation_required: true
      },
      'emergency_review_contested'
    );
  }

  private async emitJustifiedOverrideReceipt(
    override: EmergencyOverride,
    review: PostFactoReview
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'emergency_executor',
      'emergency_override_justified',
      {
        override_id: override.id,
        overridden_by: override.overridden_by,
        reviewer_id: review.reviewer_id
      },
      'emergency_review_justified'
    );
  }
}

export interface EmergencyStatistics {
  active_overrides: number;
  pending_reviews: number;
  overdue_reviews: number;
  compliance_status: 'compliant' | 'violation';
  next_review_deadline: string | null;
}
