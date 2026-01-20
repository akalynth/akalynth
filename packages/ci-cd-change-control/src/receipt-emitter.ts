import { createReceiptLogger } from "coordination-kernel";
import type { CICDReceiptInputs, CICDAction } from "./types.js";
import { createPolicyEngine, createSegregationEngine, type PolicyEngine, type SegregationEngine, type RiskFactors } from "./policy-engine.js";

export interface EmitterOpts {
  receiptDir: string;
}

export class CICDReceiptEmitter {
  private audit: ReturnType<typeof createReceiptLogger>;
  private policyEngine: PolicyEngine;
  private segregationEngine: SegregationEngine;

  constructor(opts: EmitterOpts) {
    this.audit = createReceiptLogger({ receiptDir: opts.receiptDir });
    this.policyEngine = createPolicyEngine();
    this.segregationEngine = createSegregationEngine();
  }

  private actor(): string {
    return process.env.GITHUB_ACTOR || process.env.USER || "system";
  }

  private async emit(
    actor_id: string,
    action: CICDAction,
    inputs: CICDReceiptInputs & Record<string, unknown>,
    result: string = "ok"
  ) {
    return this.audit.appendReceipt(actor_id, action, inputs, result);
  }

  async emitBuildStarted(inputs: CICDReceiptInputs & { build_number?: string }) {
    return this.emit(this.actor(), "build_started", inputs, "ok");
  }

  async emitTestsPassed(inputs: CICDReceiptInputs & { test_results?: unknown }) {
    return this.emit(this.actor(), "tests_passed", inputs, "ok");
  }

  async emitDeployRequested(inputs: CICDReceiptInputs & { requested_by: string }) {
    return this.emit(inputs.requested_by, "deploy_requested", inputs, "ok");
  }

  async emitPolicyEval(inputs: CICDReceiptInputs & {
    risk_score: number;
    friction_cost: number;
    required_capabilities: string[];
    approval_ttl: string;
    risk_factors?: string[];
  }) {
    return this.emit("system", "policy_eval", inputs, "ok");
  }

  async emitRiskAssessmentCompleted(inputs: CICDReceiptInputs & { assessor_id: string; notes?: string }) {
    return this.emit(inputs.assessor_id, "risk_assessment_completed", inputs, "ok");
  }

  async emitDeployApproved(inputs: CICDReceiptInputs & { approver_id: string }) {
    return this.emit(inputs.approver_id, "deploy_approved", inputs, "ok");
  }

  async emitDeployDenied(inputs: CICDReceiptInputs & { approver_id: string; reason: string }) {
    return this.emit(inputs.approver_id, "deploy_denied", inputs, "denied");
  }

  async emitDeployStarted(inputs: CICDReceiptInputs) {
    return this.emit(this.actor(), "deploy_started", inputs, "ok");
  }

  async emitDeployCompleted(inputs: CICDReceiptInputs & { deployed_at?: number }) {
    return this.emit(this.actor(), "deploy_completed", inputs, "ok");
  }

  async emitDeployFailed(inputs: CICDReceiptInputs & { error: string }) {
    return this.emit(this.actor(), "deploy_failed", inputs, "failed");
  }

  async emitRollbackTriggered(inputs: CICDReceiptInputs & { reason: string }) {
    return this.emit(this.actor(), "rollback_triggered", inputs, "ok");
  }

  async emitRollbackCompleted(inputs: CICDReceiptInputs) {
    return this.emit(this.actor(), "rollback_completed", inputs, "ok");
  }

  async emitEmergencyDeploy(inputs: CICDReceiptInputs & { requester_id: string; reason: string }) {
    return this.emit(inputs.requester_id, "emergency_deploy", inputs, "ok");
  }

  async emitIncidentLinked(inputs: CICDReceiptInputs & { actor_id: string; incident_id: string }) {
    return this.emit(inputs.actor_id, "incident_linked", inputs, "ok");
  }

  async emitRetroReviewCompleted(inputs: CICDReceiptInputs & { actor_id: string; incident_id: string }) {
    return this.emit(inputs.actor_id, "retro_review_completed", inputs, "ok");
  }

  // ============================================================================
  // Automated Policy Integration
  // ============================================================================

  /**
   * Process deployment request with automated policy evaluation
   */
  async processDeploymentRequest(inputs: CICDReceiptInputs & {
    requested_by: string;
    risk_factors?: RiskFactors;
    change_description?: string;
    rollback_plan?: string;
  }) {
    // 1. Emit deploy_requested receipt
    const requestReceipt = await this.emitDeployRequested({
      ...inputs,
      requested_by: inputs.requested_by,
    });

    // 2. Evaluate policy automatically
    const policyResult = await this.policyEngine.evaluateDeployment(inputs);

    // 3. Emit policy_eval receipt
    const policyReceipt = await this.emitPolicyEval({
      ...inputs,
      risk_score: policyResult.risk_score,
      friction_cost: policyResult.friction_cost,
      required_capabilities: policyResult.required_capabilities,
      approval_ttl: `${policyResult.approval_ttl_minutes}m`,
      risk_factors: policyResult.risk_factors,
    });

    // 4. If denied, emit denial receipt
    if (!policyResult.allowed) {
      const denialReceipt = await this.emitDeployDenied({
        ...inputs,
        approver_id: "system",
        reason: policyResult.denial_reason || "policy_violation",
      });

      return {
        status: "denied" as const,
        request_receipt: requestReceipt,
        policy_receipt: policyReceipt,
        denial_receipt: denialReceipt,
        policy_result: policyResult,
      };
    }

    // 5. If no approval required, auto-approve
    if (!policyResult.approval_required) {
      const approvalReceipt = await this.emitDeployApproved({
        ...inputs,
        approver_id: "system",
      });

      return {
        status: "auto_approved" as const,
        request_receipt: requestReceipt,
        policy_receipt: policyReceipt,
        approval_receipt: approvalReceipt,
        policy_result: policyResult,
      };
    }

    // 6. Return pending approval status
    return {
      status: "pending_approval" as const,
      request_receipt: requestReceipt,
      policy_receipt: policyReceipt,
      policy_result: policyResult,
    };
  }

  /**
   * Process manual approval with segregation checking
   */
  async processApproval(inputs: CICDReceiptInputs & {
    approver_id: string;
    deployment_roles?: Record<string, string>; // For segregation checking
  }) {
    // Check segregation rules if deployment roles provided
    if (inputs.deployment_roles) {
      const segregationCheck = this.segregationEngine.canPerformCapability(
        inputs.approver_id,
        "approve_prod_deploy", // TODO: Make this dynamic based on required capabilities
        inputs.deployment_roles
      );

      if (!segregationCheck.allowed) {
        return this.emitDeployDenied({
          ...inputs,
          approver_id: inputs.approver_id,
          reason: segregationCheck.violation || "segregation_violation",
        });
      }
    }

    return this.emitDeployApproved(inputs);
  }

  /**
   * Process emergency deployment with automatic post-facto requirements
   */
  async processEmergencyDeploy(inputs: CICDReceiptInputs & {
    requester_id: string;
    reason: string;
    incident_id?: string;
    risk_factors?: RiskFactors;
  }) {
    // 1. Emit emergency deploy receipt
    const emergencyReceipt = await this.emitEmergencyDeploy(inputs);

    // 2. Emit policy_eval with override_required=true (preserves mechanical risk memo)
    const policyResult = await this.policyEngine.evaluateDeployment({
      ...inputs,
      risk_factors: inputs.risk_factors,
    });

    const policyReceipt = await this.emitPolicyEval({
      ...inputs,
      risk_score: Math.max(policyResult.risk_score, 8), // Emergency = high risk
      friction_cost: policyResult.friction_cost,
      required_capabilities: policyResult.required_capabilities,
      approval_ttl: "0m", // No TTL for emergency
      risk_factors: [...policyResult.risk_factors, "emergency_override"],
      override_required: true,
      allowed: false, // Policy would deny, but emergency override used
    });

    // 3. If incident_id provided, link it immediately
    if (inputs.incident_id) {
      const incidentReceipt = await this.emitIncidentLinked({
        ...inputs,
        actor_id: inputs.requester_id,
        incident_id: inputs.incident_id,
      });

      return {
        status: "emergency_deployed" as const,
        emergency_receipt: emergencyReceipt,
        policy_receipt: policyReceipt,
        incident_receipt: incidentReceipt,
        post_facto_required: ["retro_review_completed"],
      };
    }

    return {
      status: "emergency_deployed" as const,
      emergency_receipt: emergencyReceipt,
      policy_receipt: policyReceipt,
      post_facto_required: ["incident_linked", "retro_review_completed"],
    };
  }

  /**
   * Get policy engine for external use
   */
  getPolicyEngine(): PolicyEngine {
    return this.policyEngine;
  }

  /**
   * Get segregation engine for external use
   */
  getSegregationEngine(): SegregationEngine {
    return this.segregationEngine;
  }

  close() {
    this.audit.close();
  }
}