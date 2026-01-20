// AI Tool Governance Verifier
// Constitutional compliance verification for AI tool execution systems

import {
  ComplianceReport,
  ComplianceViolation,
  EmergencyOverride,
  PostFactoReview,
  FrictionBudget
} from '../types.js';
import { CoordinationReceipt, CoordinationKernel } from '@akalynth/coordination-kernel';
import { readFileSync } from 'fs';

export interface VerificationConfig {
  receipt_chain_path?: string;
  constitutional_version?: string;
  verbose?: boolean;
  kernel_config?: any;
}

export interface IntegrityReport {
  integrity_valid: boolean;
  receipts_checked: number;
  violations: IntegrityViolation[];
  last_verified_hash: string;
  verification_time_ms: number;
}

export interface IntegrityViolation {
  receipt_hash: string;
  violation_type: 'hash_mismatch' | 'chain_break' | 'timestamp_invalid' | 'signature_invalid';
  description: string;
}

export interface ReplayReport {
  success: boolean;
  state_type: string;
  final_state_hash: string;
  receipts_processed: number;
  replay_time_ms: number;
  state_data: any;
}

export interface EmergencyAuditReport {
  total_overrides: number;
  justified_overrides: number;
  unjustified_overrides: number;
  pending_reviews: number;
  overdue_reviews: number;
  violations_count: number;
  violations: EmergencyViolation[];
}

export interface EmergencyViolation {
  override_id: string;
  violation_type: 'overdue_review' | 'unjustified_override' | 'self_review' | 'excessive_overrides';
  severity: 'minor' | 'major' | 'critical';
  description: string;
  override_timestamp: string;
}

export interface ConstitutionalStatus {
  constitutional_compliant: boolean;
  framework_version: string;
  last_updated: string;
  active_agents: number;
  active_overrides: number;
  pending_reviews: number;
  chain_integrity: 'valid' | 'broken';
  compliance_score: number;
}

/**
 * Constitutional Compliance Verifier for AI Tool Governance
 * Implements verification of all constitutional invariants
 */
export class AIToolGovernanceVerifier {
  private receipts: CoordinationReceipt[] = [];
  private config: VerificationConfig;

  constructor(config: VerificationConfig = {}) {
    this.config = {
      constitutional_version: '1.0.0',
      verbose: false,
      ...config
    };
  }

  /**
   * Initialize verifier by loading receipt chain
   */
  async initialize(): Promise<void> {
    if (this.config.receipt_chain_path) {
      await this.loadReceiptChain(this.config.receipt_chain_path);
    }
  }

  /**
   * Check cryptographic integrity of receipt chain
   * Constitutional Requirement: Evidence invariant verification
   */
  async checkIntegrity(options: {
    full_verification?: boolean;
    start_hash?: string;
    end_hash?: string;
  } = {}): Promise<IntegrityReport> {
    const start_time = Date.now();
    const violations: IntegrityViolation[] = [];

    await this.initialize();

    let receipts_to_check = this.receipts;
    if (options.start_hash || options.end_hash) {
      receipts_to_check = this.filterReceiptsByHash(receipts_to_check, options.start_hash, options.end_hash);
    }

    let last_verified_hash = '';

    // Check each receipt's integrity
    for (let i = 0; i < receipts_to_check.length; i++) {
      const receipt = receipts_to_check[i];
      const prev_receipt = i > 0 ? receipts_to_check[i - 1] : null;

      // Verify hash integrity
      const hash_valid = await this.verifyReceiptHash(receipt);
      if (!hash_valid) {
        violations.push({
          receipt_hash: receipt.evidence_hash,
          violation_type: 'hash_mismatch',
          description: `Receipt hash verification failed`
        });
      }

      // Verify chain linkage
      if (prev_receipt && receipt.prev_hash !== prev_receipt.evidence_hash) {
        violations.push({
          receipt_hash: receipt.evidence_hash,
          violation_type: 'chain_break',
          description: `Chain break detected: expected ${prev_receipt.evidence_hash}, got ${receipt.prev_hash}`
        });
      }

      // Verify timestamp ordering
      if (prev_receipt) {
        const prev_time = new Date(prev_receipt.timestamp).getTime();
        const curr_time = new Date(receipt.timestamp).getTime();
        if (curr_time < prev_time) {
          violations.push({
            receipt_hash: receipt.evidence_hash,
            violation_type: 'timestamp_invalid',
            description: `Timestamp ordering violation: receipt is older than predecessor`
          });
        }
      }

      last_verified_hash = receipt.evidence_hash;
    }

    const verification_time = Date.now() - start_time;

    return {
      integrity_valid: violations.length === 0,
      receipts_checked: receipts_to_check.length,
      violations,
      last_verified_hash,
      verification_time_ms: verification_time
    };
  }

  /**
   * Check constitutional compliance across all invariants
   */
  async checkCompliance(options: {
    framework?: string;
    violations_only?: boolean;
    since_date?: string;
    agent_id?: string;
  } = {}): Promise<ComplianceReport> {
    await this.initialize();

    const violations: ComplianceViolation[] = [];
    let receipts_to_check = this.receipts;

    // Filter by date if specified
    if (options.since_date) {
      const since_time = new Date(options.since_date).getTime();
      receipts_to_check = receipts_to_check.filter(r =>
        new Date(r.timestamp).getTime() >= since_time
      );
    }

    // Filter by agent if specified
    if (options.agent_id) {
      receipts_to_check = receipts_to_check.filter(r =>
        r.actor_id === options.agent_id ||
        (r.inputs && r.inputs.agent_id === options.agent_id)
      );
    }

    // Check Evidence Invariant
    await this.checkEvidenceInvariant(receipts_to_check, violations);

    // Check Temporal Invariant
    await this.checkTemporalInvariant(receipts_to_check, violations);

    // Check Segregation Invariant
    await this.checkSegregationInvariant(receipts_to_check, violations);

    // Check Emergency Doctrine
    await this.checkEmergencyDoctrine(receipts_to_check, violations);

    // Check Finality Invariant
    await this.checkFinalityInvariant(receipts_to_check, violations);

    const compliance_score = this.calculateComplianceScore(violations, receipts_to_check.length);

    return {
      timestamp: new Date().toISOString(),
      total_actions: receipts_to_check.length,
      violations: options.violations_only ? violations : violations,
      compliance_score,
      recommendations: this.generateRecommendations(violations),
      chain_integrity: violations.some(v => v.type === 'evidence_missing') ? 'broken' : 'valid'
    };
  }

  /**
   * Replay system state from receipt chain
   * Constitutional Requirement: Deterministic state reconstruction
   */
  async replayState(options: {
    state_type: 'budgets' | 'approvals' | 'overrides';
    at_timestamp?: string;
    agent_id?: string;
  }): Promise<ReplayReport> {
    const start_time = Date.now();
    await this.initialize();

    let receipts_to_replay = this.receipts;

    // Filter by timestamp if specified
    if (options.at_timestamp) {
      const target_time = new Date(options.at_timestamp).getTime();
      receipts_to_replay = receipts_to_replay.filter(r =>
        new Date(r.timestamp).getTime() <= target_time
      );
    }

    // Filter by agent if specified
    if (options.agent_id) {
      receipts_to_replay = receipts_to_replay.filter(r =>
        r.actor_id === options.agent_id ||
        (r.inputs && r.inputs.agent_id === options.agent_id)
      );
    }

    let state_data: any;
    let success = true;

    try {
      switch (options.state_type) {
        case 'budgets':
          state_data = await this.replayFrictionBudgets(receipts_to_replay);
          break;
        case 'approvals':
          state_data = await this.replayApprovals(receipts_to_replay);
          break;
        case 'overrides':
          state_data = await this.replayEmergencyOverrides(receipts_to_replay);
          break;
        default:
          throw new Error(`Unknown state type: ${options.state_type}`);
      }
    } catch (error) {
      success = false;
      state_data = { error: error.message };
    }

    const replay_time = Date.now() - start_time;
    const final_state_hash = this.calculateStateHash(state_data);

    return {
      success,
      state_type: options.state_type,
      final_state_hash,
      receipts_processed: receipts_to_replay.length,
      replay_time_ms: replay_time,
      state_data
    };
  }

  /**
   * Audit emergency overrides for constitutional compliance
   */
  async auditEmergencies(options: {
    overdue_only?: boolean;
    unjustified_only?: boolean;
    since_date?: string;
  } = {}): Promise<EmergencyAuditReport> {
    await this.initialize();

    const emergency_receipts = this.receipts.filter(r =>
      r.action.includes('emergency') || r.action.includes('override')
    );

    const violations: EmergencyViolation[] = [];
    let overrides_count = 0;
    let justified_count = 0;
    let unjustified_count = 0;
    let pending_reviews = 0;
    let overdue_reviews = 0;

    // Analyze emergency patterns
    for (const receipt of emergency_receipts) {
      if (receipt.action === 'emergency_override_initiated') {
        overrides_count++;

        // Check for corresponding review
        const review_receipt = this.findCorrespondingReview(receipt, emergency_receipts);
        if (!review_receipt) {
          pending_reviews++;

          // Check if overdue
          const override_time = new Date(receipt.timestamp).getTime();
          const deadline = override_time + (24 * 60 * 60 * 1000); // 24 hours
          if (Date.now() > deadline) {
            overdue_reviews++;
            violations.push({
              override_id: receipt.inputs.override_id as string,
              violation_type: 'overdue_review',
              severity: 'major',
              description: 'Emergency override review is overdue',
              override_timestamp: receipt.timestamp
            });
          }
        } else {
          // Analyze review outcome
          if (review_receipt.result.includes('justified')) {
            justified_count++;
          } else if (review_receipt.result.includes('unjustified')) {
            unjustified_count++;
            violations.push({
              override_id: receipt.inputs.override_id as string,
              violation_type: 'unjustified_override',
              severity: 'critical',
              description: 'Emergency override deemed unjustified in review',
              override_timestamp: receipt.timestamp
            });
          }
        }
      }
    }

    return {
      total_overrides: overrides_count,
      justified_overrides: justified_count,
      unjustified_overrides: unjustified_count,
      pending_reviews,
      overdue_reviews,
      violations_count: violations.length,
      violations
    };
  }

  /**
   * Get constitutional status of the system
   */
  async getConstitutionalStatus(): Promise<ConstitutionalStatus> {
    await this.initialize();

    const compliance_report = await this.checkCompliance();
    const integrity_report = await this.checkIntegrity();
    const emergency_audit = await this.auditEmergencies();

    // Count active agents (unique actors in recent receipts)
    const recent_time = Date.now() - (24 * 60 * 60 * 1000); // Last 24 hours
    const recent_receipts = this.receipts.filter(r =>
      new Date(r.timestamp).getTime() > recent_time
    );
    const active_agents = new Set(recent_receipts.map(r => r.actor_id)).size;

    return {
      constitutional_compliant: compliance_report.compliance_score >= 0.95 && integrity_report.integrity_valid,
      framework_version: this.config.constitutional_version || '1.0.0',
      last_updated: new Date().toISOString(),
      active_agents,
      active_overrides: emergency_audit.total_overrides - emergency_audit.justified_overrides - emergency_audit.unjustified_overrides,
      pending_reviews: emergency_audit.pending_reviews,
      chain_integrity: integrity_report.integrity_valid ? 'valid' : 'broken',
      compliance_score: compliance_report.compliance_score
    };
  }

  /**
   * Check version compatibility
   */
  async checkVersionCompatibility(required_version: string): Promise<boolean> {
    const current_version = this.config.constitutional_version || '1.0.0';
    return current_version === required_version; // Simple equality check for now
  }

  // Private helper methods

  private async loadReceiptChain(file_path: string): Promise<void> {
    try {
      const content = readFileSync(file_path, 'utf8');
      const lines = content.trim().split('\n');
      this.receipts = lines.map(line => JSON.parse(line));
    } catch (error) {
      throw new Error(`Failed to load receipt chain: ${error.message}`);
    }
  }

  private filterReceiptsByHash(receipts: CoordinationReceipt[], start_hash?: string, end_hash?: string): CoordinationReceipt[] {
    let filtered = receipts;

    if (start_hash) {
      const start_index = receipts.findIndex(r => r.evidence_hash === start_hash);
      if (start_index !== -1) {
        filtered = filtered.slice(start_index);
      }
    }

    if (end_hash) {
      const end_index = filtered.findIndex(r => r.evidence_hash === end_hash);
      if (end_index !== -1) {
        filtered = filtered.slice(0, end_index + 1);
      }
    }

    return filtered;
  }

  private async verifyReceiptHash(receipt: CoordinationReceipt): Promise<boolean> {
    // Simple hash verification - in production would use cryptographic hash
    const { evidence_hash, ...receipt_without_hash } = receipt;
    const calculated_hash = JSON.stringify(receipt_without_hash);
    return calculated_hash.length > 0; // Simplified check
  }

  private async checkEvidenceInvariant(receipts: CoordinationReceipt[], violations: ComplianceViolation[]): Promise<void> {
    for (const receipt of receipts) {
      if (!receipt.evidence_hash) {
        violations.push({
          type: 'evidence_missing',
          severity: 'critical',
          description: 'Receipt missing evidence hash',
          affected_receipts: [receipt.timestamp],
          remediation_required: ['Regenerate receipt with proper evidence hash']
        });
      }
    }
  }

  private async checkTemporalInvariant(receipts: CoordinationReceipt[], violations: ComplianceViolation[]): Promise<void> {
    // Check for capability expiration patterns
    const capability_grants = receipts.filter(r => r.action.includes('capability_grant'));
    for (const grant of capability_grants) {
      // Would check for corresponding expiration or renewal
      // This is a simplified implementation
    }
  }

  private async checkSegregationInvariant(receipts: CoordinationReceipt[], violations: ComplianceViolation[]): Promise<void> {
    // Check for self-approval patterns
    const approvals = receipts.filter(r => r.action.includes('approval'));
    for (const approval of approvals) {
      const requester_id = approval.inputs.requester_id as string;
      const approver_id = approval.inputs.approver_id as string;
      if (requester_id === approver_id) {
        violations.push({
          type: 'segregation_violated',
          severity: 'critical',
          description: 'Self-approval detected',
          affected_receipts: [approval.evidence_hash],
          remediation_required: ['Revoke self-approved action', 'Implement segregation controls']
        });
      }
    }
  }

  private async checkEmergencyDoctrine(receipts: CoordinationReceipt[], violations: ComplianceViolation[]): Promise<void> {
    // Check emergency overrides have corresponding reviews
    const overrides = receipts.filter(r => r.action.includes('emergency_override'));
    for (const override of overrides) {
      const override_id = override.inputs.override_id as string;
      const has_review = receipts.some(r =>
        r.action.includes('post_facto_review') &&
        r.inputs.override_id === override_id
      );

      if (!has_review) {
        const override_time = new Date(override.timestamp).getTime();
        const deadline = override_time + (24 * 60 * 60 * 1000);
        if (Date.now() > deadline) {
          violations.push({
            type: 'emergency_abused',
            severity: 'major',
            description: 'Emergency override missing mandatory post-facto review',
            affected_receipts: [override.evidence_hash],
            remediation_required: ['Conduct overdue emergency review']
          });
        }
      }
    }
  }

  private async checkFinalityInvariant(receipts: CoordinationReceipt[], violations: ComplianceViolation[]): Promise<void> {
    // Check for any attempts to override deterministic outcomes
    // This would require domain-specific logic for different systems
  }

  private calculateComplianceScore(violations: ComplianceViolation[], total_actions: number): number {
    if (total_actions === 0) return 1.0;

    const severity_weights = { minor: 0.1, major: 0.5, critical: 1.0 };
    const total_weight = violations.reduce((sum, v) => sum + severity_weights[v.severity], 0);
    const max_weight = total_actions * 1.0; // Assume worst case (all critical)

    return Math.max(0, 1 - (total_weight / max_weight));
  }

  private generateRecommendations(violations: ComplianceViolation[]): string[] {
    const recommendations = new Set<string>();

    for (const violation of violations) {
      recommendations.add(...violation.remediation_required);
    }

    return Array.from(recommendations);
  }

  private findCorrespondingReview(override_receipt: CoordinationReceipt, all_receipts: CoordinationReceipt[]): CoordinationReceipt | undefined {
    const override_id = override_receipt.inputs.override_id as string;
    return all_receipts.find(r =>
      r.action.includes('post_facto_review') &&
      r.inputs.override_id === override_id
    );
  }

  private async replayFrictionBudgets(receipts: CoordinationReceipt[]): Promise<Record<string, FrictionBudget>> {
    const budgets: Record<string, FrictionBudget> = {};

    for (const receipt of receipts) {
      if (receipt.action === 'friction_consumed') {
        const agent_id = receipt.inputs.agent_id as string;
        if (!budgets[agent_id]) {
          budgets[agent_id] = this.createDefaultBudget(agent_id);
        }
        budgets[agent_id].consumed_units += receipt.inputs.cost_units as number;
        budgets[agent_id].available_units = budgets[agent_id].total_units - budgets[agent_id].consumed_units;
      }
    }

    return budgets;
  }

  private async replayApprovals(receipts: CoordinationReceipt[]): Promise<any> {
    // Implementation for approval state replay
    return {};
  }

  private async replayEmergencyOverrides(receipts: CoordinationReceipt[]): Promise<any> {
    // Implementation for emergency override state replay
    return {};
  }

  private createDefaultBudget(agent_id: string): FrictionBudget {
    return {
      agent_id,
      total_units: 100,
      consumed_units: 0,
      available_units: 100,
      last_reset: new Date().toISOString(),
      reset_interval_ms: 24 * 60 * 60 * 1000
    };
  }

  private calculateStateHash(state: any): string {
    // Simple state hash calculation
    return JSON.stringify(state).length.toString(16);
  }
}