/**
 * AI Governance Witness Adapter
 *
 * Maps AI tool governance decisions to WLA primitives.
 * No new concepts — only bindings.
 *
 * @module ai-tool-governance/witness
 */

import type {
  WitnessEvent,
  EventStatus,
  EventSource,
  Explanation,
  ExplainDecision,
  RuleDefinition,
  ProofBundle,
  SnapshotEvidence,
} from '@akalynth/coordination-kernel';

import {
  buildProofBundle,
  createRuleRegistry,
  createExplanationBuilder,
  buildSnapshotEvidence,
} from '@akalynth/coordination-kernel';

import type {
  ToolExecutionRequest,
  ToolExecutionResult,
  RiskAssessment,
  ExecutionGate,
  ExecutionPattern,
  AIAgent,
  ApprovalRequest,
  EmergencyOverride,
  PostFactoReview,
} from '../types.js';

// ============================================================================
// AI Governance Event Kinds
// ============================================================================

export type AIEventKind =
  | 'tool_requested'      // Intent submitted
  | 'tool_approved'       // Approval granted
  | 'tool_denied'         // Approval denied
  | 'tool_executed'       // Tool ran successfully
  | 'tool_failed'         // Tool execution failed
  | 'emergency_override'  // Emergency override invoked
  | 'emergency_reviewed'  // Post-facto review completed
  | 'friction_consumed'   // Friction budget consumed
  | 'risk_assessed';      // Risk assessment completed

// ============================================================================
// AI Governance Rule IDs
// ============================================================================

export const AI_GOVERNANCE_RULES = {
  // Risk rules
  RISK_LOW_DIRECT: 'AI_GOV_RISK_LOW_DIRECT',
  RISK_MEDIUM_FRICTION: 'AI_GOV_RISK_MEDIUM_FRICTION',
  RISK_HIGH_SEGREGATION: 'AI_GOV_RISK_HIGH_SEGREGATION',
  RISK_CRITICAL_EMERGENCY: 'AI_GOV_RISK_CRITICAL_EMERGENCY',

  // Execution pattern rules
  PATTERN_DIRECT: 'AI_GOV_PATTERN_DIRECT',
  PATTERN_FRICTION: 'AI_GOV_PATTERN_FRICTION',
  PATTERN_SEGREGATION: 'AI_GOV_PATTERN_SEGREGATION',
  PATTERN_EMERGENCY: 'AI_GOV_PATTERN_EMERGENCY',

  // Approval rules
  APPROVAL_REQUIRED: 'AI_GOV_APPROVAL_REQUIRED',
  APPROVAL_GRANTED: 'AI_GOV_APPROVAL_GRANTED',
  APPROVAL_DENIED: 'AI_GOV_APPROVAL_DENIED',
  APPROVAL_EXPIRED: 'AI_GOV_APPROVAL_EXPIRED',

  // Capability rules
  CAPABILITY_SUFFICIENT: 'AI_GOV_CAPABILITY_SUFFICIENT',
  CAPABILITY_INSUFFICIENT: 'AI_GOV_CAPABILITY_INSUFFICIENT',

  // Emergency rules
  EMERGENCY_JUSTIFIED: 'AI_GOV_EMERGENCY_JUSTIFIED',
  EMERGENCY_UNJUSTIFIED: 'AI_GOV_EMERGENCY_UNJUSTIFIED',
  EMERGENCY_REVIEW_REQUIRED: 'AI_GOV_EMERGENCY_REVIEW_REQUIRED',

  // Friction rules
  FRICTION_AVAILABLE: 'AI_GOV_FRICTION_AVAILABLE',
  FRICTION_EXHAUSTED: 'AI_GOV_FRICTION_EXHAUSTED',
} as const;

// ============================================================================
// Rule Registry (pre-populated)
// ============================================================================

/**
 * Create a rule registry pre-populated with AI governance rules.
 */
export function createAIGovernanceRuleRegistry() {
  const registry = createRuleRegistry();

  // Risk rules
  registry.register({
    rule_id: AI_GOVERNANCE_RULES.RISK_LOW_DIRECT,
    name: 'Low Risk Direct Execution',
    description: 'Risk score below threshold allows direct execution without approval',
    category: 'risk',
  });

  registry.register({
    rule_id: AI_GOVERNANCE_RULES.RISK_MEDIUM_FRICTION,
    name: 'Medium Risk Friction Gate',
    description: 'Medium risk requires friction budget consumption',
    category: 'risk',
  });

  registry.register({
    rule_id: AI_GOVERNANCE_RULES.RISK_HIGH_SEGREGATION,
    name: 'High Risk Segregation Gate',
    description: 'High risk requires independent approval (segregation)',
    category: 'risk',
  });

  registry.register({
    rule_id: AI_GOVERNANCE_RULES.RISK_CRITICAL_EMERGENCY,
    name: 'Critical Risk Emergency Only',
    description: 'Critical risk requires emergency override with post-facto review',
    category: 'risk',
  });

  // Pattern rules
  registry.register({
    rule_id: AI_GOVERNANCE_RULES.PATTERN_DIRECT,
    name: 'Direct Execution Pattern',
    description: 'Low risk action proceeds without gates',
    category: 'pattern',
  });

  registry.register({
    rule_id: AI_GOVERNANCE_RULES.PATTERN_FRICTION,
    name: 'Friction Pattern',
    description: 'Medium risk action consumes friction budget',
    category: 'pattern',
  });

  registry.register({
    rule_id: AI_GOVERNANCE_RULES.PATTERN_SEGREGATION,
    name: 'Segregation Pattern',
    description: 'High risk action requires independent approval',
    category: 'pattern',
  });

  registry.register({
    rule_id: AI_GOVERNANCE_RULES.PATTERN_EMERGENCY,
    name: 'Emergency Pattern',
    description: 'Critical action allowed only via emergency override',
    category: 'pattern',
  });

  // Approval rules
  registry.register({
    rule_id: AI_GOVERNANCE_RULES.APPROVAL_REQUIRED,
    name: 'Approval Required',
    description: 'Action requires explicit approval from authorized actor',
    category: 'approval',
  });

  registry.register({
    rule_id: AI_GOVERNANCE_RULES.APPROVAL_GRANTED,
    name: 'Approval Granted',
    description: 'Authorized actor approved the action',
    category: 'approval',
  });

  registry.register({
    rule_id: AI_GOVERNANCE_RULES.APPROVAL_DENIED,
    name: 'Approval Denied',
    description: 'Authorized actor denied the action',
    category: 'approval',
  });

  // Emergency rules
  registry.register({
    rule_id: AI_GOVERNANCE_RULES.EMERGENCY_JUSTIFIED,
    name: 'Emergency Justified',
    description: 'Post-facto review found emergency override justified',
    category: 'emergency',
  });

  registry.register({
    rule_id: AI_GOVERNANCE_RULES.EMERGENCY_UNJUSTIFIED,
    name: 'Emergency Unjustified',
    description: 'Post-facto review found emergency override unjustified',
    category: 'emergency',
  });

  registry.register({
    rule_id: AI_GOVERNANCE_RULES.EMERGENCY_REVIEW_REQUIRED,
    name: 'Emergency Review Required',
    description: 'Emergency override requires post-facto review within deadline',
    category: 'emergency',
  });

  return registry;
}

// ============================================================================
// Event Adapter
// ============================================================================

/**
 * Map a tool execution request to a WitnessEvent.
 */
export function requestToEvent(
  request: ToolExecutionRequest,
  status: EventStatus = 'pending'
): WitnessEvent {
  return {
    event_id: `ai_evt_${request.tool_name}_${Date.now()}`,
    action_id: `ai_act_${request.requested_by}_${Date.now()}`,
    kind: 'tool_requested',
    timestamp_ms: new Date(request.timestamp).getTime(),
    status,
    source: status === 'pending' ? 'client_intent' : 'server_receipt',
    details: {
      tool_name: request.tool_name,
      parameters: request.parameters,
      requested_by: request.requested_by,
      context: request.context,
    },
  };
}

/**
 * Map a tool execution result to a WitnessEvent.
 */
export function resultToEvent(
  request: ToolExecutionRequest,
  result: ToolExecutionResult,
  receipt_id?: string
): WitnessEvent {
  const kind: AIEventKind = result.success ? 'tool_executed' : 'tool_failed';
  const status: EventStatus = result.success ? 'confirmed' : 'rejected';

  return {
    event_id: `ai_evt_${kind}_${Date.now()}`,
    action_id: `ai_act_${request.requested_by}_${Date.now()}`,
    kind,
    timestamp_ms: Date.now(),
    status,
    source: 'server_receipt',
    details: {
      tool_name: request.tool_name,
      success: result.success,
      execution_time_ms: result.execution_time_ms,
      error: result.error,
      receipt_hash: result.receipt_hash,
      receipt_id,
    },
  };
}

/**
 * Map a risk assessment to a WitnessEvent.
 */
export function riskAssessmentToEvent(
  request: ToolExecutionRequest,
  assessment: RiskAssessment
): WitnessEvent {
  return {
    event_id: `ai_evt_risk_${Date.now()}`,
    action_id: `ai_act_${request.requested_by}_${Date.now()}`,
    kind: 'risk_assessed',
    timestamp_ms: Date.now(),
    status: 'confirmed',
    source: 'system_derived',
    details: {
      tool_name: request.tool_name,
      total_score: assessment.total_score,
      risk_level: assessment.risk_level,
      factors: assessment.factors,
      friction_cost: assessment.friction_cost,
      approval_required: assessment.approval_required,
      segregation_required: assessment.segregation_required,
    },
  };
}

/**
 * Map an emergency override to a WitnessEvent.
 */
export function emergencyOverrideToEvent(
  override: EmergencyOverride
): WitnessEvent {
  return {
    event_id: `ai_evt_emergency_${override.id}`,
    action_id: null,
    kind: 'emergency_override',
    timestamp_ms: new Date(override.timestamp).getTime(),
    status: 'confirmed',
    source: 'server_receipt',
    details: {
      override_id: override.id,
      tool_name: override.tool_request.tool_name,
      justification: override.justification,
      overridden_by: override.overridden_by,
      override_capability: override.override_capability,
      review_required: override.review_required,
    },
  };
}

/**
 * Map a post-facto review to a WitnessEvent.
 */
export function reviewToEvent(review: PostFactoReview): WitnessEvent {
  return {
    event_id: `ai_evt_review_${review.override_id}`,
    action_id: null,
    kind: 'emergency_reviewed',
    timestamp_ms: new Date(review.timestamp).getTime(),
    status: 'confirmed',
    source: 'server_receipt',
    details: {
      override_id: review.override_id,
      reviewer_id: review.reviewer_id,
      review_outcome: review.review_outcome,
      findings: review.findings,
      actions_taken: review.actions_taken,
    },
  };
}

// ============================================================================
// Explanation Adapter
// ============================================================================

/**
 * Build an explanation for an AI governance decision.
 */
export function buildGovernanceExplanation(
  event: WitnessEvent,
  gate: ExecutionGate,
  assessment: RiskAssessment,
  receipt_id?: string
): Explanation {
  const builder = createExplanationBuilder();

  // Determine rule IDs based on pattern and risk
  const rule_ids = determineRuleIds(gate, assessment);

  // Build reason
  const reason = buildReason(gate, assessment);

  // Build evidence refs
  const evidence_refs: string[] = [];
  if (receipt_id) {
    evidence_refs.push(`receipt:${receipt_id}`);
  }
  evidence_refs.push(`risk_score:${assessment.total_score}`);
  evidence_refs.push(`pattern:${gate.pattern}`);

  const decision: ExplainDecision = gate.approval_required
    ? 'pending'
    : 'confirmed';

  return {
    explanation_id: `ai_exp_${event.event_id}_${Date.now()}`,
    subject_id: event.event_id,
    decision,
    rule_ids,
    reason,
    details: {
      risk_level: assessment.risk_level,
      risk_score: assessment.total_score,
      pattern: gate.pattern,
      friction_cost: gate.friction_cost,
      approval_required: gate.approval_required,
      emergency_override: gate.emergency_override,
    },
    evidence_refs,
    remediation: gate.approval_required
      ? `Approval required from actor with capability: ${gate.approver_capability}`
      : null,
    timestamp_ms: Date.now(),
  };
}

/**
 * Determine which rules apply based on gate and assessment.
 */
function determineRuleIds(
  gate: ExecutionGate,
  assessment: RiskAssessment
): string[] {
  const rules: string[] = [];

  // Risk level rule
  switch (assessment.risk_level) {
    case 'low':
      rules.push(AI_GOVERNANCE_RULES.RISK_LOW_DIRECT);
      break;
    case 'medium':
      rules.push(AI_GOVERNANCE_RULES.RISK_MEDIUM_FRICTION);
      break;
    case 'high':
      rules.push(AI_GOVERNANCE_RULES.RISK_HIGH_SEGREGATION);
      break;
    case 'critical':
      rules.push(AI_GOVERNANCE_RULES.RISK_CRITICAL_EMERGENCY);
      break;
  }

  // Pattern rule
  switch (gate.pattern) {
    case 'direct':
      rules.push(AI_GOVERNANCE_RULES.PATTERN_DIRECT);
      break;
    case 'friction':
      rules.push(AI_GOVERNANCE_RULES.PATTERN_FRICTION);
      break;
    case 'segregation':
      rules.push(AI_GOVERNANCE_RULES.PATTERN_SEGREGATION);
      break;
    case 'emergency':
      rules.push(AI_GOVERNANCE_RULES.PATTERN_EMERGENCY);
      break;
  }

  // Approval rule
  if (gate.approval_required) {
    rules.push(AI_GOVERNANCE_RULES.APPROVAL_REQUIRED);
  }

  // Emergency rules
  if (gate.emergency_override) {
    rules.push(AI_GOVERNANCE_RULES.EMERGENCY_REVIEW_REQUIRED);
  }

  return rules.sort(); // Deterministic order
}

/**
 * Build human-readable reason.
 */
function buildReason(gate: ExecutionGate, assessment: RiskAssessment): string {
  const parts: string[] = [];

  parts.push(`Risk assessment: ${assessment.risk_level} (score: ${assessment.total_score})`);

  switch (gate.pattern) {
    case 'direct':
      parts.push('Low risk allows direct execution');
      break;
    case 'friction':
      parts.push(`Medium risk requires ${gate.friction_cost} friction units`);
      break;
    case 'segregation':
      parts.push(`High risk requires approval from ${gate.approver_capability}`);
      break;
    case 'emergency':
      parts.push('Critical risk — emergency override required with post-facto review');
      break;
  }

  return parts.join('. ');
}

// ============================================================================
// Proof Bundle Adapter
// ============================================================================

/**
 * Build a proof bundle for an AI governance decision.
 */
export function buildGovernanceProofBundle(
  event: WitnessEvent,
  explanation: Explanation,
  agent: AIAgent,
  receipt_chain_hash?: string
): ProofBundle {
  return buildProofBundle({
    event,
    explanation,
    actor_id: agent.id,
    bundle_type: `ai_governance_${event.kind}`,
    receipt_chain_hash,
  });
}

/**
 * Build a proof bundle for a complete AI tool execution flow.
 */
export function buildExecutionProofBundle(
  request: ToolExecutionRequest,
  result: ToolExecutionResult,
  gate: ExecutionGate,
  assessment: RiskAssessment,
  agent: AIAgent,
  receipt_id?: string,
  receipt_chain_hash?: string
): ProofBundle {
  // Create the result event
  const event = resultToEvent(request, result, receipt_id);

  // Build explanation
  const explanation = buildGovernanceExplanation(event, gate, assessment, receipt_id);

  // Update explanation decision based on result
  const finalExplanation: Explanation = {
    ...explanation,
    decision: result.success ? 'confirmed' : 'rejected',
    reason: result.success
      ? `${explanation.reason}. Execution succeeded.`
      : `${explanation.reason}. Execution failed: ${result.error}`,
  };

  return buildProofBundle({
    event,
    explanation: finalExplanation,
    actor_id: agent.id,
    bundle_type: result.success ? 'ai_tool_success' : 'ai_tool_failure',
    receipt_chain_hash,
    label: `${request.tool_name} by ${agent.id}`,
  });
}

/**
 * Build a proof bundle for an emergency override and its review.
 */
export function buildEmergencyProofBundle(
  override: EmergencyOverride,
  review: PostFactoReview | null,
  agent: AIAgent,
  receipt_chain_hash?: string
): ProofBundle {
  const event = emergencyOverrideToEvent(override);

  const rule_ids = [
    AI_GOVERNANCE_RULES.PATTERN_EMERGENCY,
    AI_GOVERNANCE_RULES.EMERGENCY_REVIEW_REQUIRED,
  ];

  if (review) {
    rule_ids.push(
      review.review_outcome === 'justified'
        ? AI_GOVERNANCE_RULES.EMERGENCY_JUSTIFIED
        : AI_GOVERNANCE_RULES.EMERGENCY_UNJUSTIFIED
    );
  }

  const decision: ExplainDecision = review
    ? (review.review_outcome === 'justified' ? 'confirmed' : 'rejected')
    : 'pending';

  const explanation: Explanation = {
    explanation_id: `ai_exp_emergency_${override.id}`,
    subject_id: event.event_id,
    decision,
    rule_ids,
    reason: review
      ? `Emergency override ${review.review_outcome}: ${review.findings}`
      : `Emergency override pending review. Justification: ${override.justification}`,
    details: {
      override_id: override.id,
      justification: override.justification,
      review_outcome: review?.review_outcome,
      findings: review?.findings,
    },
    evidence_refs: review ? [`review:${review.override_id}`] : [],
    remediation: review?.review_outcome === 'unjustified'
      ? `Actions taken: ${review.actions_taken.join(', ')}`
      : null,
    timestamp_ms: Date.now(),
  };

  return buildProofBundle({
    event,
    explanation,
    actor_id: agent.id,
    bundle_type: 'ai_emergency_override',
    receipt_chain_hash,
    label: `Emergency: ${override.tool_request.tool_name}`,
  });
}
