/**
 * WLA Conformance Suite
 *
 * Executable validator for RFC WLA-001 Witness-Ledger Architecture.
 *
 * Usage:
 * ```typescript
 * const result = validateWitnessLite(implementation);
 * if (!result.conforms) {
 *   console.error(result.violations);
 * }
 * ```
 */

// ============================================================================
// Conformance Result Types
// ============================================================================

/**
 * Conformance level per RFC WLA-001 Section 5.
 */
export type ConformanceLevel = 'lite' | 'standard' | 'full';

/**
 * Result of a conformance check.
 */
export interface ConformanceResult {
  /** Whether the implementation conforms */
  conforms: boolean;

  /** Conformance level being checked */
  level: ConformanceLevel;

  /** Number of checks passed */
  passed: number;

  /** Number of checks failed */
  failed: number;

  /** Total checks run */
  total: number;

  /** Individual check results */
  checks: CheckResult[];

  /** Violations (failed checks) */
  violations: Violation[];

  /** Warnings (non-blocking issues) */
  warnings: string[];

  /** Timestamp of check */
  timestamp_ms: number;
}

/**
 * Result of a single conformance check.
 */
export interface CheckResult {
  /** Check identifier */
  check_id: string;

  /** Human-readable description */
  description: string;

  /** Whether check passed */
  passed: boolean;

  /** RFC section reference */
  rfc_section: string;

  /** Requirement level (MUST, SHOULD, etc.) */
  requirement: 'MUST' | 'SHOULD' | 'MAY';

  /** Error message if failed */
  error?: string;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * A conformance violation.
 */
export interface Violation {
  /** Check that failed */
  check_id: string;

  /** RFC section reference */
  rfc_section: string;

  /** Requirement level */
  requirement: 'MUST' | 'SHOULD';

  /** What went wrong */
  message: string;

  /** How to fix it */
  remediation?: string;
}

// ============================================================================
// Implementation Interface (what we validate)
// ============================================================================

/**
 * Interface that implementations must provide for validation.
 */
export interface WitnessImplementation {
  /** Get conformance level claimed by implementation */
  getClaimedLevel(): ConformanceLevel;

  /** Create a witness event */
  createEvent(params: CreateEventParams): WitnessEventData;

  /** Create an explanation */
  createExplanation(params: CreateExplanationParams): ExplanationData;

  /** Export to JSON */
  exportJson(data: unknown): string;

  // Standard level additions
  /** Create a snapshot (Witness-Standard+) */
  createSnapshot?(params: CreateSnapshotParams): SnapshotData;

  /** Create a proof bundle (Witness-Standard+) */
  createProofBundle?(params: CreateProofBundleParams): ProofBundleData;

  /** Verify bundle integrity (Witness-Standard+) */
  verifyBundleIntegrity?(bundle: ProofBundleData): IntegrityResult;

  // Full level additions
  /** Create a fork (Witness-Full) */
  createFork?(params: CreateForkParams): ForkData;

  /** Append simulated entry to fork (Witness-Full) */
  appendSimulated?(fork: ForkData, entry: ForkEntryData): ForkData;

  /** Validate fork isolation (Witness-Full) */
  validateFork?(fork: ForkData): ValidationResult;
}

// Parameter and data types
export interface CreateEventParams {
  event_id: string;
  action_id?: string;
  kind: string;
  timestamp_ms: number;
  status: string;
  source: string;
  details?: Record<string, unknown>;
}

export interface WitnessEventData {
  event_id: string;
  action_id: string | null;
  kind: string;
  timestamp_ms: number;
  status: string;
  source: string;
  details: Record<string, unknown>;
}

export interface CreateExplanationParams {
  explanation_id: string;
  subject_id: string;
  decision: string;
  rule_ids: string[];
  reason: string;
  evidence_refs: string[];
}

export interface ExplanationData {
  explanation_id: string;
  subject_id: string;
  decision: string;
  rule_ids: string[];
  reason: string;
  details: Record<string, unknown>;
  evidence_refs: string[];
  remediation: string | null;
  timestamp_ms: number;
}

export interface CreateSnapshotParams {
  sequence: number;
  state_hash: string;
  timestamp_ms: number;
}

export interface SnapshotData {
  sequence: number;
  state_hash: string;
  timestamp_ms: number;
  state_data?: Record<string, unknown>;
}

export interface CreateProofBundleParams {
  event: WitnessEventData;
  explanation: ExplanationData;
  actor_id: string;
  bundle_type: string;
}

export interface ProofBundleData {
  version: number;
  metadata: {
    bundle_type: string;
    created_by: string;
    created_at_ms: number;
    label: string | null;
  };
  identifiers: {
    bundle_id: string;
    event_id: string;
    action_id: string | null;
    receipt_id: string | null;
    actor_id: string;
    session_id: string | null;
    sequence: number | null;
  };
  event: WitnessEventData;
  receipt: unknown | null;
  explanation: ExplanationData;
  snapshot_evidence: unknown | null;
  snapshot_diff: unknown | null;
  integrity: {
    content_hash: string;
    algorithm: string;
    receipt_chain_hash: string | null;
    signature: string | null;
    merkle_root: string | null;
  };
}

export interface IntegrityResult {
  valid: boolean;
  error?: string;
}

export interface CreateForkParams {
  branch_sequence: number;
  label: string;
  created_by: string;
}

export interface ForkData {
  metadata: {
    fork_id: string;
    label: string;
    created_by: string;
    created_at_ms: number;
    purpose: string;
    description: string | null;
  };
  branch_point: {
    sequence: number;
    event_id: string | null;
    state_hash: string | null;
    created_at_ms: number;
  };
  entries: ForkEntryData[];
}

export interface ForkEntryData {
  sequence: number;
  event: WitnessEventData | null;
  explanation: ExplanationData | null;
  snapshot: SnapshotData | null;
  origin: 'inherited' | 'simulated';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
