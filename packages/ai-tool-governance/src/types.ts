// AI Tool Governance Types
// Constitutional governance adapter for AI tool execution

import { CoordinationReceipt, Actor } from '@akalynth/coordination-kernel';

// ============================================================================
// Constitutional AI Actor System
// ============================================================================

export interface AIAgent extends Actor {
  id: string;
  capabilities: string[];
  model_id?: string;
  risk_profile: 'low' | 'medium' | 'high' | 'critical';
  emergency_authorized: boolean;
}

export interface ToolExecutionRequest {
  tool_name: string;
  parameters: Record<string, unknown>;
  requested_by: string;  // AI agent ID
  context?: Record<string, unknown>;
  timestamp: string;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  execution_time_ms: number;
  receipt_hash?: string;
}

// ============================================================================
// Constitutional Risk Assessment System
// ============================================================================

export interface RiskFactor {
  factor: string;
  weight: number;
  description: string;
}

export interface RiskAssessment {
  total_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  friction_cost: number;
  approval_required: boolean;
  segregation_required: boolean;
}

export interface FrictionBudget {
  agent_id: string;
  total_units: number;
  consumed_units: number;
  available_units: number;
  last_reset: string;
  reset_interval_ms: number;
}

// ============================================================================
// Constitutional Execution Patterns
// ============================================================================

export type ExecutionPattern =
  | 'direct'           // Low risk, no approval needed
  | 'friction'         // Medium risk, consumes friction budget
  | 'segregation'      // High risk, requires independent approval
  | 'emergency';       // Critical risk, override with post-facto review

export interface ExecutionGate {
  pattern: ExecutionPattern;
  risk_assessment: RiskAssessment;
  approval_required: boolean;
  approver_capability?: string;
  friction_cost: number;
  emergency_override: boolean;
}

export interface ApprovalRequest {
  id: string;
  tool_request: ToolExecutionRequest;
  risk_assessment: RiskAssessment;
  required_capability: string;
  expires_at: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  approved_by?: string;
}

// ============================================================================
// Constitutional Emergency System
// ============================================================================

export interface EmergencyOverride {
  id: string;
  tool_request: ToolExecutionRequest;
  justification: string;
  overridden_by: string;
  override_capability: string;
  timestamp: string;
  review_required: boolean;
}

export interface PostFactoReview {
  override_id: string;
  reviewer_id: string;
  review_outcome: 'justified' | 'unjustified' | 'contested';
  findings: string;
  actions_taken: string[];
  timestamp: string;
}

// ============================================================================
// Constitutional AI Governance Interface
// ============================================================================

export interface AIToolGovernance {
  // Risk Assessment (Constitutional Principle: Evidence-based decisions)
  assessRisk(request: ToolExecutionRequest): Promise<RiskAssessment>;

  // Execution Gating (Constitutional Principle: Segregation of authority)
  determineGate(risk: RiskAssessment): Promise<ExecutionGate>;

  // Tool Execution (Constitutional Principle: All actions emit receipts)
  executeTool(
    request: ToolExecutionRequest,
    gate: ExecutionGate
  ): Promise<ToolExecutionResult>;

  // Emergency Override (Constitutional Principle: Legal exceptions with accountability)
  emergencyOverride(
    request: ToolExecutionRequest,
    justification: string,
    overriding_agent: AIAgent
  ): Promise<EmergencyOverride>;

  // Post-facto Review (Constitutional Principle: Emergency accountability)
  reviewEmergency(
    override: EmergencyOverride,
    reviewer: AIAgent
  ): Promise<PostFactoReview>;

  // Friction Management (Constitutional Principle: Temporal constraints)
  getFrictionBudget(agent_id: string): Promise<FrictionBudget>;
  consumeFriction(agent_id: string, cost: number): Promise<void>;

  // Approval Flow (Constitutional Principle: Segregation invariant)
  requestApproval(request: ToolExecutionRequest): Promise<ApprovalRequest>;
  approveRequest(approval_id: string, approver: AIAgent): Promise<void>;

  // Constitutional Compliance
  verifyCompliance(): Promise<boolean>;
  generateComplianceReport(): Promise<ComplianceReport>;
}

// ============================================================================
// Compliance and Audit Types
// ============================================================================

export interface ComplianceViolation {
  type: 'evidence_missing' | 'temporal_expired' | 'segregation_violated' | 'emergency_abused' | 'chain_broken';
  severity: 'minor' | 'major' | 'critical';
  description: string;
  affected_receipts: string[];
  remediation_required: string[];
}

export interface ComplianceReport {
  timestamp: string;
  total_actions: number;
  violations: ComplianceViolation[];
  compliance_score: number;
  recommendations: string[];
  chain_integrity: 'valid' | 'broken';
}

// ============================================================================
// Tool Registry System
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  base_risk_score: number;
  risk_factors: RiskFactor[];
  required_capabilities: string[];
  emergency_eligible: boolean;
  external_system_access: boolean;
  data_modification: boolean;
  user_communication: boolean;
  rollback_available: boolean;
}

export interface ToolRegistry {
  register(tool: ToolDefinition): void;
  getTool(name: string): ToolDefinition | undefined;
  listTools(): ToolDefinition[];
  getBaseRiskScore(tool_name: string): number;
}

// ============================================================================
// Constitutional Error Types
// ============================================================================

export class AIGovernanceError extends Error {
  constructor(
    message: string,
    public code: 'INSUFFICIENT_CAPABILITY' | 'RISK_TOO_HIGH' | 'FRICTION_EXHAUSTED' | 'APPROVAL_REQUIRED' | 'EMERGENCY_DENIED',
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AIGovernanceError';
  }
}

// ============================================================================
// Constitutional Constants
// ============================================================================

export const AI_GOVERNANCE_CONSTANTS = {
  // Risk thresholds
  LOW_RISK_THRESHOLD: 2,
  MEDIUM_RISK_THRESHOLD: 5,
  HIGH_RISK_THRESHOLD: 8,

  // Friction budgets
  DEFAULT_FRICTION_BUDGET: 100,
  FRICTION_RESET_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours

  // Timeouts
  APPROVAL_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  EMERGENCY_REVIEW_DEADLINE_MS: 24 * 60 * 60 * 1000, // 24 hours

  // Capabilities
  EMERGENCY_OVERRIDE_CAPABILITY: 'emergency_override',
  APPROVE_HIGH_RISK_CAPABILITY: 'approve_high_risk',
  REVIEW_EMERGENCY_CAPABILITY: 'review_emergency',

  // Constitutional compliance
  CONSTITUTIONAL_VERSION: '1.0.0'
} as const;

// ============================================================================
// Constitutional Litmus Test Application
// ============================================================================

export const AI_GOVERNANCE_LITMUS = {
  question: "Who decides if an AI tool execution is authorized?",
  answer: "The risk assessment, the constraints, and the capabilities - never human discretion."
} as const;
