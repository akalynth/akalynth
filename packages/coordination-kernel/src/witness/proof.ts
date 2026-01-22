/**
 * Proof Bundle Primitives
 *
 * Portable, immutable, self-contained evidence packets.
 */

import { createHash } from 'crypto';

import type {
  ProofBundle,
  BundleMetadata,
  BundleIdentifiers,
  BundleIntegrity,
  DiffSummary,
  WitnessEvent,
  Explanation,
  SnapshotEvidence,
  CoordinationReceiptRef,
} from './types.js';

// ============================================================================
// Proof Bundle Builder
// ============================================================================

/** Current bundle schema version */
export const BUNDLE_VERSION = 1;

/**
 * Options for building a proof bundle.
 */
export interface ProofBundleOptions<TEvent = WitnessEvent> {
  /** The event being proven (required) */
  event: TEvent;

  /** The explanation (required) */
  explanation: Explanation;

  /** Server receipt if confirmed */
  receipt?: CoordinationReceiptRef;

  /** Snapshot evidence */
  snapshot_evidence?: SnapshotEvidence;

  /** Diff summary */
  snapshot_diff?: DiffSummary;

  /** Actor this relates to (required) */
  actor_id: string;

  /** Session ID */
  session_id?: string;

  /** Human label */
  label?: string;

  /** Bundle type classification */
  bundle_type: string;

  /** Receipt chain hash at creation time */
  receipt_chain_hash?: string;

  /** Creation timestamp (defaults to now) */
  created_at_ms?: number;
}

/**
 * Build a proof bundle.
 *
 * Pure function — deterministic for same inputs at same timestamp.
 */
export function buildProofBundle<TEvent extends WitnessEvent>(
  options: ProofBundleOptions<TEvent>
): ProofBundle<TEvent> {
  const created_at_ms = options.created_at_ms ?? Date.now();
  const event_id = options.event.event_id;

  // Build metadata
  const metadata: BundleMetadata = {
    bundle_type: options.bundle_type,
    created_by: options.actor_id,
    created_at_ms,
    label: options.label ?? null,
  };

  // Build identifiers
  const identifiers: BundleIdentifiers = {
    bundle_id: generateBundleId(
      options.receipt?.receipt_id ?? event_id,
      created_at_ms
    ),
    event_id,
    action_id: options.event.action_id,
    receipt_id: options.receipt?.receipt_id ?? null,
    actor_id: options.actor_id,
    session_id: options.session_id ?? null,
    sequence: options.snapshot_evidence?.sequence ?? null,
  };

  // Build preliminary bundle for hash computation
  const preliminaryBundle: ProofBundle<TEvent> = {
    version: BUNDLE_VERSION,
    metadata,
    identifiers,
    event: options.event,
    receipt: options.receipt ?? null,
    explanation: options.explanation,
    snapshot_evidence: options.snapshot_evidence ?? null,
    snapshot_diff: options.snapshot_diff ?? null,
    integrity: {
      content_hash: 'pending',
      algorithm: 'SHA-256',
      receipt_chain_hash: options.receipt_chain_hash ?? null,
      signature: null,
      merkle_root: null,
    },
  };

  // Compute content hash
  const content_hash = computeBundleHash(preliminaryBundle);

  // Return final bundle with real integrity
  return {
    ...preliminaryBundle,
    integrity: {
      content_hash,
      algorithm: 'SHA-256',
      receipt_chain_hash: options.receipt_chain_hash ?? null,
      signature: null,
      merkle_root: null,
    },
  };
}

/**
 * Generate a deterministic bundle ID.
 */
export function generateBundleId(seed: string, timestamp_ms: number): string {
  const input = `${seed}:${timestamp_ms}`;
  const hash = createHash('sha256').update(input).digest('hex');
  return `bundle_${hash.slice(0, 16)}`;
}

/**
 * Compute SHA-256 hash of bundle content.
 *
 * Uses canonical representation (sorted keys, no whitespace).
 */
export function computeBundleHash<TEvent>(
  bundle: ProofBundle<TEvent>
): string {
  // Build deterministic string representation
  const canonical = buildCanonicalContent(bundle);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Build canonical content string for hashing.
 *
 * Sorted keys, deterministic output.
 */
function buildCanonicalContent<TEvent>(
  bundle: ProofBundle<TEvent>
): string {
  const parts: string[] = [];

  // Metadata (sorted keys)
  parts.push(`metadata:`);
  parts.push(`bundle_type=${bundle.metadata.bundle_type},`);
  parts.push(`created_at_ms=${bundle.metadata.created_at_ms},`);
  parts.push(`created_by=${bundle.metadata.created_by},`);
  parts.push(`label=${bundle.metadata.label};`);

  // Identifiers (sorted keys)
  parts.push(`identifiers:`);
  parts.push(`action_id=${bundle.identifiers.action_id},`);
  parts.push(`actor_id=${bundle.identifiers.actor_id},`);
  parts.push(`bundle_id=${bundle.identifiers.bundle_id},`);
  parts.push(`event_id=${bundle.identifiers.event_id},`);
  parts.push(`receipt_id=${bundle.identifiers.receipt_id},`);
  parts.push(`sequence=${bundle.identifiers.sequence},`);
  parts.push(`session_id=${bundle.identifiers.session_id};`);

  // Event
  const event = bundle.event as WitnessEvent;
  parts.push(`event:`);
  parts.push(`event_id=${event.event_id},`);
  parts.push(`kind=${event.kind},`);
  parts.push(`status=${event.status},`);
  parts.push(`source=${event.source},`);
  parts.push(`timestamp_ms=${event.timestamp_ms};`);

  // Receipt (if present)
  if (bundle.receipt) {
    parts.push(`receipt:`);
    parts.push(`receipt_id=${bundle.receipt.receipt_id},`);
    parts.push(`type=${bundle.receipt.type},`);
    parts.push(`timestamp_ms=${bundle.receipt.timestamp_ms};`);
  }

  // Explanation
  parts.push(`explanation:`);
  parts.push(`decision=${bundle.explanation.decision},`);
  parts.push(`explanation_id=${bundle.explanation.explanation_id},`);
  parts.push(`reason=${bundle.explanation.reason},`);
  parts.push(`rule_ids=${bundle.explanation.rule_ids.sort().join(',')};`);

  // Snapshot evidence (if present)
  if (bundle.snapshot_evidence) {
    parts.push(`snapshot_evidence:`);
    parts.push(`prev_sequence=${bundle.snapshot_evidence.prev_sequence},`);
    parts.push(`sequence=${bundle.snapshot_evidence.sequence},`);
    parts.push(`state_transition=${bundle.snapshot_evidence.state_transition};`);
  }

  return parts.join('');
}

// ============================================================================
// Proof Bundle Verification
// ============================================================================

/**
 * Verify a proof bundle's integrity.
 */
export function verifyBundleIntegrity<TEvent extends WitnessEvent>(
  bundle: ProofBundle<TEvent>
): { valid: boolean; error?: string } {
  // Recompute hash with a copy that has 'pending' as the hash
  const bundleCopy: ProofBundle<TEvent> = {
    ...bundle,
    integrity: {
      ...bundle.integrity,
      content_hash: 'pending',
    },
  };

  const computed_hash = computeBundleHash(bundleCopy);

  if (computed_hash !== bundle.integrity.content_hash) {
    return {
      valid: false,
      error: `Content hash mismatch: expected ${bundle.integrity.content_hash}, got ${computed_hash}`,
    };
  }

  return { valid: true };
}

// ============================================================================
// Proof Bundle Export
// ============================================================================

/**
 * Export bundle to canonical JSON string.
 *
 * Sorted keys, no extra whitespace, deterministic.
 */
export function bundleToCanonicalJson<TEvent>(
  bundle: ProofBundle<TEvent>
): string {
  return JSON.stringify(bundle, Object.keys(bundle).sort(), 0);
}

/**
 * Export bundle to pretty JSON string.
 */
export function bundleToPrettyJson<TEvent>(
  bundle: ProofBundle<TEvent>
): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Export bundle to plain text format.
 */
export function bundleToText<TEvent extends WitnessEvent>(
  bundle: ProofBundle<TEvent>
): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`  PROOF BUNDLE: ${bundle.metadata.bundle_type}`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  lines.push(`Bundle ID:    ${bundle.identifiers.bundle_id}`);
  lines.push(`Event ID:     ${bundle.identifiers.event_id}`);
  lines.push(`Actor:        ${bundle.identifiers.actor_id}`);
  lines.push(`Created:      ${new Date(bundle.metadata.created_at_ms).toISOString()}`);
  lines.push(`Version:      ${bundle.version}`);
  lines.push('');

  lines.push('─── EVENT ───────────────────────────────────────────────────────');
  lines.push(`Kind:         ${bundle.event.kind}`);
  lines.push(`Status:       ${bundle.event.status}`);
  lines.push(`Source:       ${bundle.event.source}`);
  lines.push(`Timestamp:    ${new Date(bundle.event.timestamp_ms).toISOString()}`);
  lines.push('');

  if (bundle.receipt) {
    lines.push('─── RECEIPT ─────────────────────────────────────────────────────');
    lines.push(`Receipt ID:   ${bundle.receipt.receipt_id}`);
    lines.push(`Type:         ${bundle.receipt.type}`);
    lines.push('');
  }

  lines.push('─── EXPLANATION ─────────────────────────────────────────────────');
  lines.push(`Decision:     ${bundle.explanation.decision}`);
  lines.push(`Reason:       ${bundle.explanation.reason}`);
  lines.push(`Rules:        ${bundle.explanation.rule_ids.join(', ')}`);
  if (bundle.explanation.remediation) {
    lines.push(`Remediation:  ${bundle.explanation.remediation}`);
  }
  lines.push('');

  if (bundle.snapshot_evidence) {
    lines.push('─── STATE EVIDENCE ──────────────────────────────────────────────');
    if (bundle.snapshot_evidence.state_transition) {
      lines.push(`Transition:   ${bundle.snapshot_evidence.state_transition}`);
    }
    lines.push('');
  }

  lines.push('─── INTEGRITY ───────────────────────────────────────────────────');
  lines.push(`Hash:         ${bundle.integrity.content_hash.slice(0, 16)}...`);
  lines.push(`Algorithm:    ${bundle.integrity.algorithm}`);
  if (bundle.integrity.receipt_chain_hash) {
    lines.push(`Chain Hash:   ${bundle.integrity.receipt_chain_hash.slice(0, 16)}...`);
  }
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
