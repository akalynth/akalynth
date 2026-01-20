export type Env = "prod" | "staging" | "dev";

export type CICDAction =
  // Build & Test
  | "build_started" | "build_completed" | "build_failed"
  | "tests_started" | "tests_passed" | "tests_failed"
  | "artifact_signed" | "artifact_uploaded"
  // Approval / Policy
  | "deploy_requested"
  | "policy_eval"
  | "risk_assessment_completed"
  | "deploy_approved" | "deploy_denied"
  | "resolution_opened"
  // Deploy
  | "deploy_started" | "deploy_completed" | "deploy_failed"
  | "rollback_triggered" | "rollback_completed"
  // Emergency path
  | "emergency_deploy"
  | "incident_linked"
  | "retro_review_completed";

export interface CICDReceiptInputs {
  deployment_id: string;       // stable join key
  artifact_digest: string;     // sha256:<...> ideally
  env: Env;
  commit_sha: string;
  pipeline_run_id: string;
  service?: string;
  team?: string;

  // policy_eval outputs
  risk_score?: number;
  friction_cost?: number;
  required_capabilities?: string[];

  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown;
  required_witnesses?: string[];
  approval_ttl?: string;
  risk_factors?: string[];

  // emergency linkage
  incident_id?: string;
}

export type DeploymentStatus =
  | "requested"
  | "approved"
  | "denied"
  | "deployed"
  | "failed"
  | "rolled_back"
  | "emergency";

export interface DeploymentFacts {
  deployment_id: string;
  env: Env;
  service?: string;
  team?: string;

  commit_sha: string;
  pipeline_run_id: string;
  artifact_digest: string;

  requester_id?: string;
  approver_id?: string;

  requested_at?: number;
  approved_at?: number;
  completed_at?: number;

  risk_score?: number;
  friction_cost?: number;

  has_policy_eval?: boolean;
  has_risk_assessment?: boolean;

  emergency?: boolean;
  incident_linked_at?: number;
  retro_review_first_at?: number;
  retro_review_any_independent?: boolean;
  // Deterministic segregation check (replay-derived). Recorded for the first review.
  retro_review_reviewer_id?: string;

  status: DeploymentStatus;
  errors: string[];
}

export interface ReplayResult {
  deployments: Record<string, DeploymentFacts>;
  counts: Record<DeploymentStatus | "unknown", number>;
}
