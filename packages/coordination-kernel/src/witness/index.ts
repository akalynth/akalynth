/**
 * Witness-Ledger Architecture Primitives
 *
 * Domain-agnostic infrastructure for systems that must:
 * - Explain themselves (explanation engine)
 * - Prove their history (proof bundles)
 * - Simulate alternatives without lying (forks)
 *
 * Core principle: "A witness that can leave and still be trusted."
 *
 * @module witness
 */

// ============================================================================
// Core Types
// ============================================================================

export type {
  // Chronicle Event (ledger entry)
  WitnessEvent,
  EventStatus,
  EventSource,

  // Snapshot (state attestation)
  Snapshot,
  SnapshotEvidence,

  // Explanation (rule-grounded reasoning)
  Explanation,
  ExplainDecision,
  RuleDefinition,

  // Proof Bundle (portable evidence)
  ProofBundle,
  BundleMetadata,
  BundleIdentifiers,
  BundleIntegrity,
  CoordinationReceiptRef,
  DiffSummary,

  // Fork (simulation without lying)
  Fork,
  ForkMetadata,
  ForkPoint,
  ForkEntry,
  ForkPurpose,
  ForkEntryOrigin,
  IsolationViolationType,

  // Timeline Entry (aligned data)
  TimelineEntry,
} from './types.js';

export { ForkIsolationViolation } from './types.js';

// ============================================================================
// Explanation Engine
// ============================================================================

export type {
  ExplainContext,
  RuleRegistry,
  ExplanationBuilder,
} from './explanation.js';

export {
  createRuleRegistry,
  createExplanationBuilder,
  buildSnapshotEvidence,
} from './explanation.js';

// ============================================================================
// Fork System
// ============================================================================

export {
  // Validation
  validateForkEntry,
  validateFork,
  isSimulatedEventId,
  isValidForkId,

  // Builder
  createFork,

  // Operations (immutable)
  appendSimulatedEntry,
  resetForkToBase,
  trimForkToSequence,

  // Queries
  hasDiverged,
  getInheritedEntries,
  getSimulatedEntries,
  getEntryAtSequence,
  getLastEntry,
} from './fork.js';

// ============================================================================
// Proof Bundle System
// ============================================================================

export type { ProofBundleOptions } from './proof.js';

export {
  BUNDLE_VERSION,
  buildProofBundle,
  generateBundleId,
  computeBundleHash,
  verifyBundleIntegrity,
  bundleToCanonicalJson,
  bundleToPrettyJson,
  bundleToText,
} from './proof.js';

// ============================================================================
// Witness Architecture Constants
// ============================================================================

/**
 * The litmus test for witness-ledger architecture.
 */
export const WITNESS_LITMUS = {
  question: 'Can this witness leave and still be trusted?',
  answer: 'Yes — proof bundles are self-contained, verifiable, and portable.',
} as const;

/**
 * The five isolation invariants (enforced in code).
 */
export const FORK_ISOLATION_INVARIANTS = [
  'Simulated events NEVER have confirmed status',
  'Simulated events ALWAYS have client_intent source',
  'Simulated event IDs ALWAYS start with sim_ or fork_',
  'Simulated explanations ALWAYS contain [SIMULATED] marker',
  'Inherited entries precede simulated (no interleaving)',
] as const;
