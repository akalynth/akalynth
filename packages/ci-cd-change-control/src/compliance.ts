import type { ReplayResult } from "./types.js";

export interface ComplianceOpts {
  highRiskThreshold: number;           // e.g. 5
  emergencyIncidentDeadlineHours: number; // 24
  emergencyRetroDeadlineHours: number;    // 72
}

export interface ComplianceReport {
  ok: boolean;
  failures: Record<string, string[]>;
  summary: {
    total: number;
    ok: number;
    failed: number;
  };
}

function hours(ms: number) { return ms / (1000 * 60 * 60); }

export function evaluateCompliance(replay: ReplayResult, opts: ComplianceOpts): ComplianceReport {
  const failures: Record<string, string[]> = {};
  let total = 0;
  let okCount = 0;

  for (const [deployment_id, d] of Object.entries(replay.deployments)) {
    total += 1;
    const f: string[] = [];

    // ========================================================================
    // RULE-SET SWITCH: Emergency vs Normal Path
    // ========================================================================

    if (d.emergency) {
      // EMERGENCY RULE-SET: Break-glass doctrine
      f.push(...evaluateEmergencyPath(d, opts));
    } else {
      // NORMAL RULE-SET: Standard change control
      f.push(...evaluateNormalPath(d, opts));
    }

    if (f.length) failures[deployment_id] = f;
    else okCount += 1;
  }

  const failed = Object.keys(failures).length;
  return {
    ok: failed === 0,
    failures,
    summary: { total, ok: okCount, failed }
  };
}

// ============================================================================
// Normal Path Governance Rules
// ============================================================================

function evaluateNormalPath(d: any, opts: ComplianceOpts): string[] {
  const violations: string[] = [];

  // Required receipts for normal path
  if (!d.requester_id || !d.requested_at) {
    violations.push("missing deploy_requested");
  }

  if (!d.has_policy_eval) {
    violations.push("missing policy_eval");
  }

  // Production requires approval (unless auto-approved by policy)
  if (d.env === "prod" && d.status !== "denied" && !d.approver_id) {
    violations.push("missing deploy_approved for prod");
  }

  // Segregation of duties
  if (d.approver_id && d.requester_id && d.approver_id === d.requester_id) {
    violations.push("segregation violation: approver==requester");
  }

  // High risk requires assessment
  const risk = d.risk_score ?? 0;
  if (risk >= opts.highRiskThreshold && !d.has_risk_assessment) {
    violations.push(`risk_score>=${opts.highRiskThreshold} but missing risk_assessment_completed`);
  }

  // Must have completion receipt
  if (!["deployed", "failed", "rolled_back", "denied"].includes(d.status)) {
    violations.push("missing completion receipt (deploy_completed/deploy_failed/rollback_completed/deploy_denied)");
  }

  return violations;
}

// ============================================================================
// Emergency Path Governance Rules
// ============================================================================

function evaluateEmergencyPath(d: any, opts: ComplianceOpts): string[] {
  const violations: string[] = [];

  // Emergency path allows bypass of normal approvals
  // Focus only on post-facto requirements and break-glass doctrine

  // Must have emergency_deploy receipt (implicit - if d.emergency=true, we have it)

  // Must have deployment completion
  if (!["deployed", "failed", "rolled_back", "emergency"].includes(d.status)) {
    violations.push("emergency deployment incomplete (missing deploy_completed/deploy_failed)");
  }

  // Post-facto requirement: incident linking within 24h
  const emergencyTime = d.requested_at ?? Date.now(); // Use current time as fallback

  if (!d.incident_linked_at) {
    violations.push("emergency break-glass: missing incident_linked");
  } else if (hours(d.incident_linked_at - emergencyTime) > opts.emergencyIncidentDeadlineHours) {
    violations.push(`emergency break-glass: incident_linked late (${Math.round(hours(d.incident_linked_at - emergencyTime))}h > ${opts.emergencyIncidentDeadlineHours}h)`);
  }

  // Post-facto requirement: retro review within 72h
  if (!d.retro_review_completed_at) {
    violations.push("emergency break-glass: missing retro_review_completed");
  } else if (hours(d.retro_review_completed_at - emergencyTime) > opts.emergencyRetroDeadlineHours) {
    violations.push(`emergency break-glass: retro_review_completed late (${Math.round(hours(d.retro_review_completed_at - emergencyTime))}h > ${opts.emergencyRetroDeadlineHours}h)`);
  }

  return violations;
}