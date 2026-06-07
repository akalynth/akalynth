// Absence Receipts (`absence_receipt.v1`) — types.
//
// An absence receipt is a CoordinationReceipt with action `absence_receipt`
// whose `inputs` are the AbsenceReceiptInputs below. It proves bounded
// non-observation: "no event matching predicate P appears in committed log
// interval [from_seq..to_seq] under a named authority snapshot." See
// docs/ABSENCE_RECEIPTS.md for the normative spec.

export const ABSENCE_SCHEMA_VERSION = 'absence_receipt.v1' as const;
export const ABSENCE_ACTION = 'absence_receipt' as const;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Declarative, pure predicate over a receipt's allowed surface.
 *
 * `field` is a dotted path rooted at `action`, `actor_id`, `result`, or
 * `inputs.<...>`. Operators are intentionally restricted (no regex, no
 * arithmetic, no external lookups) so a predicate is a pure, canonicalizable
 * function of the receipt alone.
 */
export type Predicate =
  | { op: 'eq'; field: string; value: JsonValue }
  | { op: 'in'; field: string; value: JsonValue[] }
  | { op: 'exists'; field: string }
  | { op: 'and'; clauses: Predicate[] }
  | { op: 'or'; clauses: Predicate[] }
  | { op: 'not'; clause: Predicate };

export type AbsenceResult = 'absent' | 'absence_unprovable' | 'absence_invalid';

export const ABSENCE_CODE = {
  OK: 'ABSENCE_OK',
  LOG_GAP: 'ABSENCE_LOG_GAP',
  AUTHORITY_TRANSITION: 'ABSENCE_AUTHORITY_TRANSITION',
  CAPTURE_GAP: 'ABSENCE_CAPTURE_GAP',
  PREDICATE_MISMATCH: 'ABSENCE_PREDICATE_MISMATCH',
  MATCH_FOUND: 'ABSENCE_MATCH_FOUND',
  CHAIN_INVALID: 'ABSENCE_CHAIN_INVALID',
  SCHEMA_INVALID: 'ABSENCE_SCHEMA_INVALID',
} as const;
export type AbsenceCode = (typeof ABSENCE_CODE)[keyof typeof ABSENCE_CODE];

export interface AbsenceBoundary {
  boundary_id: string;
  capture_contract: string;
  /** blake3 of the enumerated set of authorized event sources. */
  source_set_hash: string;
  /** receipt hash of a separate capture-completeness attestation, or null. */
  capture_completeness_ref: string | null;
}

export interface AbsenceInterval {
  /** Inclusive lower bound. BINDING axis. */
  from_seq: number;
  /** Inclusive upper bound. */
  to_seq: number;
  /** Advisory only (absence is monotone in seq, not time). */
  from_time?: string;
  to_time?: string;
}

export interface AbsencePredicateRef {
  predicate_id: string;
  /** Self-contained predicate body (MVP; pre-registration lookup is deferred). */
  definition: Predicate;
  /** blake3(canonicalize(definition)). */
  canonical_form_hash: string;
  description?: string;
}

export interface AbsenceCommittedLog {
  log_id: string;
  /** event_hash of the receipt at to_seq. */
  head_event_hash: string;
}

export interface AbsenceAuthorityContext {
  /** blake3 of the canonical actor->capabilities map replayed to to_seq. */
  authority_snapshot_hash: string;
  computed_at_seq: number;
}

export interface AbsenceProof {
  proof_type: 'bounded_reexecution.v1';
  /** Number of receipts in [from_seq..to_seq] matching the predicate (0 = absent). */
  matched_count: number;
  /** prev_hash of the receipt at from_seq (lower binding). */
  slice_first_prev_hash: string;
  /** event_hash of the receipt at to_seq (upper binding). */
  slice_last_event_hash: string;
}

export interface AbsenceTrustBoundary {
  claims: string[];
  non_claims: string[];
}

export interface AbsenceReceiptInputs {
  schema_version: typeof ABSENCE_SCHEMA_VERSION;
  boundary: AbsenceBoundary;
  interval: AbsenceInterval;
  predicate: AbsencePredicateRef;
  committed_log: AbsenceCommittedLog;
  authority_context: AbsenceAuthorityContext;
  proof: AbsenceProof;
  trust_boundary: AbsenceTrustBoundary;
}

export interface AbsenceFinding {
  code: AbsenceCode;
  severity: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

export interface AbsenceComputed {
  predicate_hash: string;
  authority_snapshot_hash: string;
  head_event_hash: string | null;
  slice_first_prev_hash: string | null;
  slice_last_event_hash: string | null;
}

export interface AbsenceOutcome {
  result: AbsenceResult;
  findings: AbsenceFinding[];
  matched_count: number;
  computed: AbsenceComputed;
}
