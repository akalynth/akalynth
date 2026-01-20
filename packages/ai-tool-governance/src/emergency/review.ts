// Post-Facto Review System
// Constitutional review of emergency overrides with mandatory accountability

import {
  EmergencyOverride,
  PostFactoReview,
  AIAgent,
  AIGovernanceError
} from '../types.js';
import { AI_GOVERNANCE_CONSTANTS } from '../types.js';
import { CoordinationReceipt, CoordinationKernel } from '@akalynth/coordination-kernel';

export interface ReviewCriteria {
  necessity_assessment: 'necessary' | 'questionable' | 'unnecessary';
  alternatives_adequacy: 'adequate' | 'inadequate' | 'insufficient';
  proportionality: 'proportional' | 'excessive' | 'insufficient';
  procedural_compliance: 'compliant' | 'minor_issues' | 'major_violations';
  outcome_effectiveness: 'effective' | 'partially_effective' | 'ineffective';
}

export interface ReviewEvidence {
  emergency_context_verified: boolean;
  alternatives_actually_considered: string[];
  actual_impact_vs_predicted: string;
  timeline_analysis: string;
  compliance_issues_found: string[];
  recommendations: string[];
}

export interface ReviewDecision {
  outcome: 'justified' | 'unjustified' | 'contested';
  confidence_level: 'high' | 'medium' | 'low';
  criteria: ReviewCriteria;
  evidence: ReviewEvidence;
  follow_up_actions: string[];
  capability_impact: 'none' | 'warning' | 'restriction' | 'revocation';
}

/**
 * Constitutional Post-Facto Review Manager
 * Implements mandatory review of emergency overrides per constitutional requirements
 */
export class ConstitutionalPostFactoReview {
  private pending_reviews: Map<string, EmergencyOverride> = new Map();
  private completed_reviews: Map<string, PostFactoReview> = new Map();

  constructor(private kernel: CoordinationKernel) {}

  /**
   * Schedule mandatory post-facto review for emergency override
   * Constitutional Requirement: All emergency actions require review
   */
  async scheduleReview(override: EmergencyOverride): Promise<void> {
    // Verify override qualifies for review
    if (!override.review_required) {
      throw new AIGovernanceError(
        'Override does not require post-facto review',
        'EMERGENCY_DENIED',
        { override_id: override.id }
      );
    }

    // Add to pending reviews
    this.pending_reviews.set(override.id, override);

    // Calculate review deadline
    const override_time = new Date(override.timestamp).getTime();
    const review_deadline = new Date(override_time + AI_GOVERNANCE_CONSTANTS.EMERGENCY_REVIEW_DEADLINE_MS);

    // Emit scheduling receipt
    await this.emitReviewScheduledReceipt(override, review_deadline.toISOString());
  }

  /**
   * Conduct comprehensive post-facto review
   * Constitutional Principle: Independent review with segregation of authority
   */
  async conductReview(
    override_id: string,
    reviewer: AIAgent,
    decision: ReviewDecision,
    detailed_findings: string
  ): Promise<PostFactoReview> {
    const override = this.pending_reviews.get(override_id);
    if (!override) {
      throw new AIGovernanceError(
        `Emergency override ${override_id} not found for review`,
        'EMERGENCY_DENIED',
        { override_id }
      );
    }

    // Validate reviewer authorization and segregation
    await this.validateReviewerAuthorization(reviewer, override);

    // Validate review decision completeness
    this.validateReviewDecision(decision);

    // Create comprehensive review record
    const review = this.createPostFactoReview(override, reviewer, decision, detailed_findings);

    // Emit detailed review receipt
    await this.emitReviewCompletedReceipt(override, review);

    // Handle review outcome actions
    await this.handleReviewOutcome(override, review);

    // Store completed review
    this.completed_reviews.set(override_id, review);

    // Remove from pending reviews
    this.pending_reviews.delete(override_id);

    return review;
  }

  /**
   * Escalate contested review to higher authority
   * Constitutional Principle: Contested decisions require escalation
   */
  async escalateContestedReview(
    review: PostFactoReview,
    escalation_authority: AIAgent,
    escalation_reason: string
  ): Promise<void> {
    if (review.review_outcome !== 'contested') {
      throw new AIGovernanceError(
        'Only contested reviews can be escalated',
        'EMERGENCY_DENIED',
        { review_outcome: review.review_outcome }
      );
    }

    // Validate escalation authority
    if (!escalation_authority.capabilities.includes('emergency_escalation')) {
      throw new AIGovernanceError(
        'Agent lacks escalation authority capability',
        'INSUFFICIENT_CAPABILITY',
        { agent_id: escalation_authority.id }
      );
    }

    // Emit escalation receipt
    await this.emitReviewEscalatedReceipt(review, escalation_authority, escalation_reason);
  }

  /**
   * Generate constitutional compliance report for reviews
   */
  async generateReviewComplianceReport(): Promise<ReviewComplianceReport> {
    const all_overrides = Array.from(this.pending_reviews.values())
      .concat(Array.from(this.completed_reviews.keys()).map(id => ({
        id,
        // Simplified - would need to reconstruct full override data
      }) as EmergencyOverride));

    const now = Date.now();
    const overdue_count = Array.from(this.pending_reviews.values()).filter(override => {
      const override_time = new Date(override.timestamp).getTime();
      const deadline = override_time + AI_GOVERNANCE_CONSTANTS.EMERGENCY_REVIEW_DEADLINE_MS;
      return now > deadline;
    }).length;

    const completed_reviews = Array.from(this.completed_reviews.values());
    const justified_count = completed_reviews.filter(r => r.review_outcome === 'justified').length;
    const unjustified_count = completed_reviews.filter(r => r.review_outcome === 'unjustified').length;
    const contested_count = completed_reviews.filter(r => r.review_outcome === 'contested').length;

    const compliance_score = this.calculateReviewComplianceScore(
      completed_reviews.length,
      overdue_count,
      unjustified_count
    );

    return {
      total_overrides_requiring_review: all_overrides.length,
      reviews_completed: completed_reviews.length,
      reviews_pending: this.pending_reviews.size,
      reviews_overdue: overdue_count,
      justified_overrides: justified_count,
      unjustified_overrides: unjustified_count,
      contested_overrides: contested_count,
      compliance_score,
      compliance_status: compliance_score >= 0.95 ? 'compliant' : 'violation',
      recommendations: this.generateComplianceRecommendations(overdue_count, unjustified_count)
    };
  }

  /**
   * Detect review process violations
   */
  async detectReviewViolations(): Promise<ReviewViolation[]> {
    const violations: ReviewViolation[] = [];
    const now = Date.now();

    // Check for overdue reviews
    for (const [id, override] of this.pending_reviews) {
      const override_time = new Date(override.timestamp).getTime();
      const deadline = override_time + AI_GOVERNANCE_CONSTANTS.EMERGENCY_REVIEW_DEADLINE_MS;

      if (now > deadline) {
        const days_overdue = Math.floor((now - deadline) / (24 * 60 * 60 * 1000));
        violations.push({
          type: 'overdue_review',
          severity: days_overdue > 7 ? 'critical' : 'major',
          override_id: id,
          description: `Post-facto review overdue by ${days_overdue} days`,
          detected_at: new Date().toISOString(),
          days_overdue
        });
      }
    }

    // Check for pattern of unjustified overrides
    const recent_reviews = Array.from(this.completed_reviews.values())
      .filter(r => {
        const review_time = new Date(r.timestamp).getTime();
        const last_30_days = now - (30 * 24 * 60 * 60 * 1000);
        return review_time > last_30_days;
      });

    const unjustified_recent = recent_reviews.filter(r => r.review_outcome === 'unjustified');
    if (unjustified_recent.length > 2) {
      violations.push({
        type: 'pattern_unjustified',
        severity: 'critical',
        override_id: 'multiple',
        description: `Pattern of unjustified overrides: ${unjustified_recent.length} in last 30 days`,
        detected_at: new Date().toISOString(),
        pattern_count: unjustified_recent.length
      });
    }

    return violations;
  }

  // Private helper methods

  private async validateReviewerAuthorization(reviewer: AIAgent, override: EmergencyOverride): Promise<void> {
    // Constitutional Segregation Check
    if (reviewer.id === override.overridden_by) {
      throw new AIGovernanceError(
        'Constitutional segregation violation: Agent cannot review their own emergency override',
        'EMERGENCY_DENIED',
        { reviewer: reviewer.id, overrider: override.overridden_by }
      );
    }

    // Check review capability
    if (!reviewer.capabilities.includes(AI_GOVERNANCE_CONSTANTS.REVIEW_EMERGENCY_CAPABILITY)) {
      throw new AIGovernanceError(
        `Reviewer lacks emergency review capability: ${AI_GOVERNANCE_CONSTANTS.REVIEW_EMERGENCY_CAPABILITY}`,
        'INSUFFICIENT_CAPABILITY',
        { reviewer_id: reviewer.id, required_capability: AI_GOVERNANCE_CONSTANTS.REVIEW_EMERGENCY_CAPABILITY }
      );
    }

    // Emit segregation compliance receipt
    await this.emitSegregationComplianceReceipt(reviewer, override);
  }

  private validateReviewDecision(decision: ReviewDecision): void {
    // Check completeness of review criteria
    const criteria_fields = Object.keys(decision.criteria);
    if (criteria_fields.length < 5) {
      throw new AIGovernanceError(
        'Incomplete review criteria assessment',
        'EMERGENCY_DENIED',
        { provided_criteria: criteria_fields.length, required: 5 }
      );
    }

    // Check evidence completeness
    if (!decision.evidence.emergency_context_verified ||
        decision.evidence.alternatives_actually_considered.length === 0 ||
        !decision.evidence.actual_impact_vs_predicted) {
      throw new AIGovernanceError(
        'Insufficient review evidence provided',
        'EMERGENCY_DENIED',
        { evidence: decision.evidence }
      );
    }

    // Check follow-up actions for unjustified overrides
    if (decision.outcome === 'unjustified' && decision.follow_up_actions.length === 0) {
      throw new AIGovernanceError(
        'Unjustified overrides must include follow-up actions',
        'EMERGENCY_DENIED',
        { outcome: decision.outcome }
      );
    }
  }

  private createPostFactoReview(
    override: EmergencyOverride,
    reviewer: AIAgent,
    decision: ReviewDecision,
    detailed_findings: string
  ): PostFactoReview {
    return {
      override_id: override.id,
      reviewer_id: reviewer.id,
      review_outcome: decision.outcome,
      findings: detailed_findings,
      actions_taken: decision.follow_up_actions,
      timestamp: new Date().toISOString()
    };
  }

  private async handleReviewOutcome(override: EmergencyOverride, review: PostFactoReview): Promise<void> {
    switch (review.review_outcome) {
      case 'unjustified':
        await this.handleUnjustifiedOverride(override, review);
        break;
      case 'contested':
        await this.handleContestedReview(override, review);
        break;
      case 'justified':
        await this.handleJustifiedOverride(override, review);
        break;
    }
  }

  private async handleUnjustifiedOverride(override: EmergencyOverride, review: PostFactoReview): Promise<void> {
    // Emit constitutional violation receipt
    await this.kernel.appendReceipt(
      'post_facto_reviewer',
      'constitutional_violation_unjustified_emergency',
      {
        override_id: override.id,
        overridden_by: override.overridden_by,
        reviewer_id: review.reviewer_id,
        violation_severity: 'major'
      },
      'emergency_override_unjustified'
    );

    // Note: In production, this might trigger capability review or restrictions
  }

  private async handleContestedReview(override: EmergencyOverride, review: PostFactoReview): Promise<void> {
    await this.kernel.appendReceipt(
      'post_facto_reviewer',
      'emergency_review_contested',
      {
        override_id: override.id,
        overridden_by: override.overridden_by,
        reviewer_id: review.reviewer_id,
        escalation_required: true
      },
      'emergency_review_requires_escalation'
    );
  }

  private async handleJustifiedOverride(override: EmergencyOverride, review: PostFactoReview): Promise<void> {
    await this.kernel.appendReceipt(
      'post_facto_reviewer',
      'emergency_override_justified',
      {
        override_id: override.id,
        overridden_by: override.overridden_by,
        reviewer_id: review.reviewer_id
      },
      'emergency_override_validated'
    );
  }

  private calculateReviewComplianceScore(
    total_reviews: number,
    overdue_count: number,
    unjustified_count: number
  ): number {
    if (total_reviews === 0) return 1.0;

    const overdue_penalty = (overdue_count / total_reviews) * 0.5;
    const unjustified_penalty = (unjustified_count / total_reviews) * 0.3;

    return Math.max(0, 1.0 - overdue_penalty - unjustified_penalty);
  }

  private generateComplianceRecommendations(overdue_count: number, unjustified_count: number): string[] {
    const recommendations: string[] = [];

    if (overdue_count > 0) {
      recommendations.push('Complete all overdue emergency reviews immediately');
      recommendations.push('Implement automated review deadline tracking');
    }

    if (unjustified_count > 2) {
      recommendations.push('Review emergency override training for agents');
      recommendations.push('Consider stricter emergency authorization criteria');
    }

    return recommendations;
  }

  // Receipt emission methods

  private async emitReviewScheduledReceipt(
    override: EmergencyOverride,
    deadline: string
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'post_facto_reviewer',
      'emergency_review_scheduled',
      {
        override_id: override.id,
        overridden_by: override.overridden_by,
        review_deadline: deadline
      },
      'post_facto_review_required'
    );
  }

  private async emitReviewCompletedReceipt(
    override: EmergencyOverride,
    review: PostFactoReview
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'post_facto_reviewer',
      'emergency_review_completed',
      {
        override_id: override.id,
        overridden_by: override.overridden_by,
        reviewer_id: review.reviewer_id,
        review_outcome: review.review_outcome,
        actions_count: review.actions_taken.length
      },
      `post_facto_review_${review.review_outcome}`
    );
  }

  private async emitSegregationComplianceReceipt(
    reviewer: AIAgent,
    override: EmergencyOverride
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'post_facto_reviewer',
      'segregation_compliance_verified',
      {
        reviewer_id: reviewer.id,
        overridden_by: override.overridden_by,
        override_id: override.id,
        segregation_verified: true
      },
      'constitutional_segregation_compliant'
    );
  }

  private async emitReviewEscalatedReceipt(
    review: PostFactoReview,
    escalation_authority: AIAgent,
    reason: string
  ): Promise<CoordinationReceipt> {
    return await this.kernel.appendReceipt(
      'post_facto_reviewer',
      'emergency_review_escalated',
      {
        override_id: review.override_id,
        original_reviewer: review.reviewer_id,
        escalation_authority: escalation_authority.id,
        escalation_reason: reason
      },
      'constitutional_review_escalation'
    );
  }
}

// Type definitions for review compliance

export interface ReviewComplianceReport {
  total_overrides_requiring_review: number;
  reviews_completed: number;
  reviews_pending: number;
  reviews_overdue: number;
  justified_overrides: number;
  unjustified_overrides: number;
  contested_overrides: number;
  compliance_score: number;
  compliance_status: 'compliant' | 'violation';
  recommendations: string[];
}

export interface ReviewViolation {
  type: 'overdue_review' | 'pattern_unjustified' | 'segregation_violation';
  severity: 'minor' | 'major' | 'critical';
  override_id: string;
  description: string;
  detected_at: string;
  days_overdue?: number;
  pattern_count?: number;
}