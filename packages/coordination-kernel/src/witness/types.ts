/**
 * Witness-Ledger Primitives
 *
 * Domain-agnostic types for systems that must explain themselves,
 * prove their history, and simulate alternatives without lying.
 *
 * The core insight: "A witness that can leave and still be trusted."
 */

// ============================================================================
// Chronicle Event (the ledger entry)
// ============================================================================

/**
 * A chronicle event is a ledger entry that records something that happened.
 *
 * Events are:
 * - Append-only (never mutated after creation)
 * - Status-tracked (PENDING → CONFIRMED/REJECTED)
 * - Source-tagged (who said it's true)
 */
export interface WitnessEvent<TDetails = Record<string, unknown>> {
  /** Unique event identifier */
  event_id: string;

  /** Correlation to the originating action (if any) */
  action_id: string | null;

  /** Event classification */
  kind: string;

  /** When this event occurred (epoch ms) */
  timestamp_ms: number;

  /** Current confirmation status */
  status: EventStatus;

  /** Who asserts this event is true */
  source: EventSource;

  /** Domain-specific event details */
  details: TDetails;
}

export type EventStatus =
  | 'pending'      // Claimed but not confirmed
  | 'confirmed'    // Receipted by authority
  | 'rejected'     // Denied by authority
  | 'superseded';  // Replaced by newer event

export type EventSource =
  | 'client_intent'    // Client claims something
  | 'server_receipt'   // Server confirms something
  | 'system_derived';  // System inferred from other events

// ============================================================================
// Snapshot (state attestation)
// ============================================================================

/**
 * A snapshot is a point-in-time state commitment.
 *
 * Snapshots:
 * - Prove what was true at sequence N
 * - Enable diffs (what changed between N and N+1)
 * - Are evidence, not law (receipts remain authoritative)
 */
export interface Snapshot {
  /** Monotonic sequence number */
  sequence: number;

  /** Hash of the state at this sequence */
  state_hash: string;

  /** When this snapshot was taken (epoch ms) */
  timestamp_ms: number;

  /** Optional domain-specific state data */
  state_data?: Record<string, unknown>;
}

/**
 * Evidence derived from snapshot comparison.
 */
export interface SnapshotEvidence {
  /** Previous snapshot sequence */
  prev_sequence: number | null;

  /** Current snapshot sequence */
  sequence: number | null;

  /** Previous state hash */
  prev_state_hash: string | null;

  /** Current state hash */
  state_hash: string | null;

  /** Human-readable transition description */
  state_transition: string | null;

  /** Sequence delta */
  sequence_delta: number | null;

  /** Domain-specific delta data */
  delta_data?: Record<string, unknown>;
}

// ============================================================================
// Explanation (justification with rule citations)
// ============================================================================

/**
 * An explanation is rule-grounded reasoning for why something happened.
 *
 * Explanations:
 * - Cite specific rules by ID
 * - Reference evidence (receipts, snapshots)
 * - Never fabricate — only report what rules determined
 */
export interface Explanation {
  /** Unique explanation identifier */
  explanation_id: string;

  /** What this explanation is about (event_id, action_id, etc.) */
  subject_id: string;

  /** The decision reached */
  decision: ExplainDecision;

  /** Rules that contributed to this decision */
  rule_ids: string[];

  /** Human-readable reason */
  reason: string;

  /** Additional structured details */
  details: Record<string, unknown>;

  /** References to evidence (receipt_ids, snapshot sequences, etc.) */
  evidence_refs: string[];

  /** Optional remediation guidance */
  remediation: string | null;

  /** When this explanation was generated */
  timestamp_ms: number;
}

export type ExplainDecision =
  | 'pending'     // Decision not yet made
  | 'confirmed'   // Affirmed by rules
  | 'rejected'    // Denied by rules
  | 'unknown';    // Rules cannot determine

/**
 * A rule definition for the explanation engine.
 */
export interface RuleDefinition {
  /** Unique rule identifier */
  rule_id: string;

  /** Human-readable rule name */
  name: string;

  /** Rule description */
  description: string;

  /** Rule category */
  category: string;

  /** Where to find more information */
  documentation_url?: string;
}

// ============================================================================
// Proof Bundle (portable evidence)
// ============================================================================

/**
 * A proof bundle is a portable, immutable, self-contained evidence packet.
 *
 * Properties:
 * - Immutable: Once created, never modified
 * - Self-contained: All evidence is inline
 * - Verifiable: Content hash enables tamper detection
 * - Versioned: Schema version for forward compatibility
 */
export interface ProofBundle<TEvent = WitnessEvent, TDetails = Record<string, unknown>> {
  /** Bundle schema version */
  version: number;

  /** Bundle metadata */
  metadata: BundleMetadata;

  /** All identifiers for correlation */
  identifiers: BundleIdentifiers;

  /** The event being proven */
  event: TEvent;

  /** Server receipt if confirmed */
  receipt: CoordinationReceiptRef | null;

  /** Why this happened */
  explanation: Explanation;

  /** State evidence */
  snapshot_evidence: SnapshotEvidence | null;

  /** Diff summary */
  snapshot_diff: DiffSummary | null;

  /** Integrity verification data */
  integrity: BundleIntegrity;
}

export interface BundleMetadata {
  /** Bundle type classification */
  bundle_type: string;

  /** Who created this bundle */
  created_by: string;

  /** When this bundle was created (epoch ms) */
  created_at_ms: number;

  /** Optional human label */
  label: string | null;
}

export interface BundleIdentifiers {
  /** Unique bundle ID */
  bundle_id: string;

  /** Event ID being proven */
  event_id: string;

  /** Correlated action ID */
  action_id: string | null;

  /** Receipt ID if confirmed */
  receipt_id: string | null;

  /** Actor this relates to */
  actor_id: string;

  /** Session ID if available */
  session_id: string | null;

  /** Snapshot sequence if available */
  sequence: number | null;
}

export interface BundleIntegrity {
  /** SHA-256 hash of canonical bundle content */
  content_hash: string;

  /** Hash algorithm used */
  algorithm: string;

  /** Receipt chain hash at bundle creation */
  receipt_chain_hash: string | null;

  /** External signature */
  signature: string | null;

  /** Merkle root if part of a tree */
  merkle_root: string | null;
}

/** Reference to a coordination receipt (to avoid circular dependency) */
export interface CoordinationReceiptRef {
  receipt_id: string;
  action_id: string | null;
  type: string;
  timestamp_ms: number;
  payload_hash: string;
}

export interface DiffSummary {
  added_count: number;
  removed_count: number;
  modified_count: number;
  total_changes: number;
  has_changes: boolean;
}

// ============================================================================
// Fork (simulation without lying)
// ============================================================================

/**
 * A fork is an explicitly non-authoritative branch for counterfactual exploration.
 *
 * Invariants (enforced in code):
 * 1. Simulated events NEVER have 'confirmed' status
 * 2. Simulated events ALWAYS have 'client_intent' source
 * 3. Simulated event IDs ALWAYS start with 'sim_'
 * 4. Simulated explanations ALWAYS contain '[SIMULATED]' marker
 * 5. Inherited entries precede simulated (no interleaving)
 */
export interface Fork<TEvent = WitnessEvent> {
  /** Fork metadata */
  metadata: ForkMetadata;

  /** Where this fork branches from */
  branch_point: ForkPoint;

  /** Fork entries (inherited + simulated) */
  entries: ForkEntry<TEvent>[];
}

export interface ForkMetadata {
  /** Unique fork ID (always starts with 'fork_') */
  fork_id: string;

  /** Human-readable label */
  label: string;

  /** Who created this fork */
  created_by: string;

  /** When this fork was created (epoch ms) */
  created_at_ms: number;

  /** Why this fork exists */
  purpose: ForkPurpose;

  /** Optional description */
  description: string | null;
}

export type ForkPurpose =
  | 'what_if'   // Counterfactual exploration
  | 'debug'     // Developer debugging
  | 'training'  // Learning scenarios
  | 'demo';     // Demonstration

export interface ForkPoint {
  /** Sequence at branch point */
  sequence: number;

  /** Event ID at branch point */
  event_id: string | null;

  /** State hash at branch point */
  state_hash: string | null;

  /** When fork was created */
  created_at_ms: number;
}

export interface ForkEntry<TEvent = WitnessEvent> {
  /** Sequence in fork */
  sequence: number;

  /** Event at this entry */
  event: TEvent | null;

  /** Explanation at this entry */
  explanation: Explanation | null;

  /** Snapshot at this entry */
  snapshot: Snapshot | null;

  /** Origin of this entry */
  origin: ForkEntryOrigin;
}

export type ForkEntryOrigin =
  | 'inherited'  // From authoritative timeline
  | 'simulated'; // Created in fork

// ============================================================================
// Fork Isolation Validation
// ============================================================================

/**
 * Isolation violation error.
 */
export class ForkIsolationViolation extends Error {
  constructor(
    message: string,
    public violation_type: IsolationViolationType,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ForkIsolationViolation';
  }
}

export type IsolationViolationType =
  | 'confirmed_simulation'    // Simulated event with confirmed status
  | 'server_source'           // Simulated event with server_receipt source
  | 'invalid_event_id'        // Simulated event without sim_ prefix
  | 'missing_marker'          // Simulated explanation without [SIMULATED]
  | 'interleaved_entries'     // Inherited entry after simulated
  | 'invalid_fork_id';        // Fork ID doesn't match format

// ============================================================================
// Timeline Entry (aligned data)
// ============================================================================

/**
 * A timeline entry aligns all artifacts at a single point in time.
 */
export interface TimelineEntry<TEvent = WitnessEvent> {
  /** Monotonic sequence */
  sequence: number;

  /** Event at this point */
  event: TEvent | null;

  /** Receipt if confirmed */
  receipt: CoordinationReceiptRef | null;

  /** Previous snapshot */
  prev_snapshot: Snapshot | null;

  /** Current snapshot */
  snapshot: Snapshot | null;

  /** Snapshot evidence */
  snapshot_evidence: SnapshotEvidence | null;

  /** Explanation */
  explanation: Explanation | null;
}
