// Emergency Override System
// Constitutional emergency powers with mandatory accountability

import {
  EmergencyOverride,
  ToolExecutionRequest,
  ToolExecutionResult,
  AIAgent,
  AIGovernanceError
} from '../types.js';
import { AI_GOVERNANCE_CONSTANTS } from '../types.js';
import { CoordinationReceipt, CoordinationKernel } from '@akalynth/coordination-kernel';

export interface EmergencyContext {
  threat_level: 'high' | 'critical';
  urgency: 'immediate' | 'urgent';
  impact_scope: 'limited' | 'widespread' | 'systemic';
  business_continuity_risk: boolean;
  regulatory_deadline: boolean;
}

export interface EmergencyJustification {
  context: EmergencyContext;
  specific_threat: string;
  alternatives_considered: string[];
  risk_if_delayed: string;
  authorization_basis: string;
}

/**
 * Constitutional Emergency Override Manager
 * Implements emergency doctrine with strict accountability requirements
 */
export class ConstitutionalEmergencyOverride {
  private active_overrides: Map<string, EmergencyOverride> = new Map();

  constructor(private kernel: CoordinationKernel) {}

  /**
   * Validate emergency justification meets constitutional standards
   * Constitutional Requirement: Emergency powers must be legally justified
   */
  async validateEmergencyJustification(
    justification: EmergencyJustification,
    agent: AIAgent
  ): Promise<boolean> {
    // Check agent authorization for emergency powers
    if (!agent.emergency_authorized) {
      throw new AIGovernanceError(
        'Agent not authorized for emergency overrides',
        'EMERGENCY_DENIED',
        { agent_id: agent.id }
      );
    }

    // Check for emergency capability
    if (!agent.capabilities.includes(AI_GOVERNANCE_CONSTANTS.EMERGENCY_OVERRIDE_CAPABILITY)) {
      throw new AIGovernanceError(
        `Agent lacks emergency override capability`,
        'INSUFFICIENT_CAPABILITY',
        { agent_id: agent.id, required_capability: AI_GOVERNANCE_CONSTANTS.EMERGENCY_OVERRIDE_CAPABILITY }
      );
    }

    // Validate justification completeness
    this.validateJustificationFields(justification);

    // Assess justification strength
    const justification_score = this.assessJustificationStrength(justification);
    if (justification_score < 0.7) {
      throw new AIGovernanceError(
        'Emergency justification insufficient for override',
        'EMERGENCY_DENIED',
        { justification_score, minimum_required: 0.7 }
      );
    }

    // Emit validation receipt
    await this.emitJustificationValidatedReceipt(justification, agent, justification_score);

    return true;
  }

  /**
   * Initiate emergency override with enhanced audit trail
   * Constitutional Principle: Emergency doctrine requires accountability
   */
  async initiateEmergencyOverride(
    request: ToolExecutionRequest,
    justification: EmergencyJustification,
    agent: AIAgent
  ): Promise<EmergencyOverride> {
    // Validate justification
    await this.validateEmergencyJustification(justification, agent);

    // Check concurrent override limits
    await this.checkConcurrentLimits(agent);

    // Create override record with enhanced context
    const override = this.createEmergencyOverride(request, justification, agent);

    // Register active override
    this.active_overrides.set(override.id, override);

    // Emit detailed override initiation receipt
    await this.emitOverrideInitiationReceipt(override, justification);

    // Schedule automatic review reminder
    await this.scheduleReviewReminder(override);

    return override;
  }

  /**
   * Complete emergency override with execution results
   * Constitutional Requirement: All outcomes must be recorded
   */
  async completeEmergencyOverride(
    override_id: string,
    execution_result: ToolExecutionResult,
    actual_impact: string
  ): Promise<void> {
    const override = this.active_overrides.get(override_id);
    if (!override) {
      throw new AIGovernanceError(
        `Emergency override ${override_id} not found`,
        'EMERGENCY_DENIED',
        { override_id }
      );
    }

    // Emit completion receipt with actual results
    await this.emitOverrideCompletionReceipt(override, execution_result, actual_impact);

    // Update override status (keep in map for review)
    // Don't remove until review is complete
  }

  /**
   * Get emergency override statistics for constitutional monitoring
   */
  async getOverrideStatistics(agent_id?: string): Promise<EmergencyStatistics> {
    let overrides_to_check = Array.from(this.active_overrides.values());

    if (agent_id) {
      overrides_to_check = overrides_to_check.filter(o => o.overridden_by === agent_id);
    }

    const chainNowMs = this.getChainNowMs(overrides_to_check);
    const last_24h = chainNowMs - (24 * 60 * 60 * 1000);
    const last_7d = chainNowMs - (7 * 24 * 60 * 60 * 1000);

    const overrides_24h = overrides_to_check.filter(o =>
      this.parseTimestamp(o.timestamp, 'override') > last_24h
    );

    const overrides_7d = overrides_to_check.filter(o =>
      this.parseTimestamp(o.timestamp, 'override') > last_7d
    );

    const pending_reviews = overrides_to_check.filter(o => o.review_required);

    const overdue_reviews = pending_reviews.filter(o => {
      const override_time = this.parseTimestamp(o.timestamp, 'override');
      const deadline = override_time + AI_GOVERNANCE_CONSTANTS.EMERGENCY_REVIEW_DEADLINE_MS;
      return chainNowMs > deadline;
    });

    return {
      total_active: overrides_to_check.length,
      last_24_hours: overrides_24h.length,
      last_7_days: overrides_7d.length,
      pending_reviews: pending_reviews.length,
      overdue_reviews: overdue_reviews.length,
      compliance_status: overdue_reviews.length > 0 ? 'violation' : 'compliant',
      next_review_deadline: this.getNextReviewDeadline(pending_reviews)
    };
  }

  /**
   * Check for constitutional violations in emergency usage
   */
  async detectEmergencyViolations(agent_id?: string): Promise<EmergencyViolation[]> {
    const violations: EmergencyViolation[] = [];

    let overrides_to_check = Array.from(this.active_overrides.values());

    if (agent_id) {
      overrides_to_check = overrides_to_check.filter(o => o.overridden_by === agent_id);
    }

    const chainNowMs = this.getChainNowMs(overrides_to_check);

    // Check for overdue reviews
    for (const override of overrides_to_check) {
      if (override.review_required) {
        const override_time = this.parseTimestamp(override.timestamp, 'override');
        const deadline = override_time + AI_GOVERNANCE_CONSTANTS.EMERGENCY_REVIEW_DEADLINE_MS;

        if (chainNowMs > deadline) {
          violations.push({
            type: 'overdue_review',
            severity: 'major',
            override_id: override.id,
            description: 'Emergency override review is overdue',
            detected_at: new Date(chainNowMs).toISOString(),
            days_overdue: Math.floor((chainNowMs - deadline) / (24 * 60 * 60 * 1000))
          });
        }
      }
    }

    // Check for excessive emergency usage
    const last_24h = chainNowMs - (24 * 60 * 60 * 1000);
    const recent_overrides = overrides_to_check.filter(o =>
      this.parseTimestamp(o.timestamp, 'override') > last_24h
    );

    if (recent_overrides.length > 5) { // Constitutional limit
      violations.push({
        type: 'excessive_usage',
        severity: 'critical',
        override_id: 'multiple',
        description: `Excessive emergency usage: ${recent_overrides.length} overrides in 24h`,
        detected_at: new Date(chainNowMs).toISOString(),
        usage_count: recent_overrides.length
      });
    }

    return violations;
  }

  // Private helper methods

  private validateJustificationFields(justification: EmergencyJustification): void {
    const required_fields = [
      'specific_threat',
      'alternatives_considered',
      'risk_if_delayed',
      'authorization_basis'
    ];

    for (const field of required_fields) {
      if (!justification[field as keyof EmergencyJustification] ||
          (justification[field as keyof EmergencyJustification] as string).length < 10) {
        throw new AIGovernanceError(
          `Emergency justification field '${field}' is missing or insufficient`,
          'EMERGENCY_DENIED',
          { missing_field: field }
        );
      }
    }

    if (justification.alternatives_considered.length < 2) {
      throw new AIGovernanceError(
        'Emergency justification must consider at least 2 alternatives',
        'EMERGENCY_DENIED',
        { alternatives_count: justification.alternatives_considered.length }
      );
    }
  }

  private assessJustificationStrength(justification: EmergencyJustification): number {
    let score = 0;

    // Context assessment
    if (justification.context.threat_level === 'critical') score += 0.3;
    else if (justification.context.threat_level === 'high') score += 0.2;

    if (justification.context.urgency === 'immediate') score += 0.2;
    else if (justification.context.urgency === 'urgent') score += 0.1;

    if (justification.context.business_continuity_risk) score += 0.2;
    if (justification.context.regulatory_deadline) score += 0.15;

    // Justification completeness
    if (justification.specific_threat.length > 50) score += 0.1;
    if (justification.alternatives_considered.length >= 3) score += 0.1;
    if (justification.risk_if_delayed.length > 30) score += 0.05;

    return Math.min(score, 1.0);
  }

  private async checkConcurrentLimits(agent: AIAgent): Promise<void> {
    const agent_overrides = Array.from(this.active_overrides.values())
      .filter(o => o.overridden_by === agent.id);

    if (agent_overrides.length >= 3) { // Constitutional limit
      throw new AIGovernanceError(
        'Agent has too many concurrent emergency overrides',
        'EMERGENCY_DENIED',
        { agent_id: agent.id, current_overrides: agent_overrides.length, limit: 3 }
      );
    }
  }

  private createEmergencyOverride(
    request: ToolExecutionRequest,
    justification: EmergencyJustification,
    agent: AIAgent
  ): EmergencyOverride {
    return {
      id: this.generateOverrideId(),
      tool_request: request,
      justification: JSON.stringify(justification),
      overridden_by: agent.id,
      override_capability: AI_GOVERNANCE_CONSTANTS.EMERGENCY_OVERRIDE_CAPABILITY,
      timestamp: this.normalizeTimestamp(request.timestamp, 'override_request'),
      review_required: true
    };
  }

  private async scheduleReviewReminder(override: EmergencyOverride): Promise<void> {
    const override_time = this.parseTimestamp(override.timestamp, 'override');
    const review_deadline = new Date(override_time + AI_GOVERNANCE_CONSTANTS.EMERGENCY_REVIEW_DEADLINE_MS);

    await this.kernel.appendReceipt(
      'emergency_override_manager',
      'review_reminder_scheduled',
      {
        override_id: override.id,
        review_deadline: review_deadline.toISOString(),
        overridden_by: override.overridden_by
      },
      'emergency_review_required'
    );
  }

  private getNextReviewDeadline(pending_reviews: EmergencyOverride[]): string | null {
    if (pending_reviews.length === 0) return null;

    const deadlines = pending_reviews.map(override => {
      const override_time = this.parseTimestamp(override.timestamp, 'override');
      return override_time + AI_GOVERNANCE_CONSTANTS.EMERGENCY_REVIEW_DEADLINE_MS;
    });

    const next_deadline = Math.min(...deadlines);
    return new Date(next_deadline).toISOString();
  }

  private generateOverrideId(): string {
    return `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  private getChainNowMs(overrides: EmergencyOverride[]): number {
    let latest: number | null = null;
    for (const override of overrides) {
      const ts = this.parseTimestamp(override.timestamp, 'override');
      if (latest === null || ts > latest) {
        latest = ts;
      }
    }
    return latest ?? 0;
  }

  // Receipt emission methods

  private async emitJustificationValidatedReceipt(
    justification: EmergencyJustification,
    agent: AIAgent,
    score: number
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'emergency_override_manager',
      'justification_validated',
      {
        agent_id: agent.id,
        threat_level: justification.context.threat_level,
        urgency: justification.context.urgency,
        justification_score: score,
        alternatives_count: justification.alternatives_considered.length
      },
      'emergency_justification_approved'
    );
  }

  private async emitOverrideInitiationReceipt(
    override: EmergencyOverride,
    justification: EmergencyJustification
  ): Promise<CoordinationReceipt> {
    const override_time = this.parseTimestamp(override.timestamp, 'override');
    const review_deadline = new Date(override_time + AI_GOVERNANCE_CONSTANTS.EMERGENCY_REVIEW_DEADLINE_MS).toISOString();

    return await this.kernel.appendReceipt(
      'emergency_override_manager',
      'emergency_override_initiated',
      {
        override_id: override.id,
        tool_name: override.tool_request.tool_name,
        overridden_by: override.overridden_by,
        threat_level: justification.context.threat_level,
        impact_scope: justification.context.impact_scope,
        review_deadline
      },
      'constitutional_emergency_override_started'
    );
  }

  private async emitOverrideCompletionReceipt(
    override: EmergencyOverride,
    result: ToolExecutionResult,
    actual_impact: string
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'emergency_override_manager',
      'emergency_override_completed',
      {
        override_id: override.id,
        tool_name: override.tool_request.tool_name,
        overridden_by: override.overridden_by,
        success: result.success,
        actual_impact,
        execution_time_ms: result.execution_time_ms
      },
      result.success ? 'constitutional_emergency_override_successful' : 'constitutional_emergency_override_failed'
    );
  }
}

// Type definitions for emergency monitoring

export interface EmergencyStatistics {
  total_active: number;
  last_24_hours: number;
  last_7_days: number;
  pending_reviews: number;
  overdue_reviews: number;
  compliance_status: 'compliant' | 'violation';
  next_review_deadline: string | null;
}

export interface EmergencyViolation {
  type: 'overdue_review' | 'excessive_usage' | 'unjustified_override';
  severity: 'minor' | 'major' | 'critical';
  override_id: string;
  description: string;
  detected_at: string;
  days_overdue?: number;
  usage_count?: number;
}
