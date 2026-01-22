/**
 * Anchor Types
 *
 * Schema for tamper-evident time-binding of proof bundles.
 */

// ============================================================================
// Anchor Record
// ============================================================================

/**
 * An anchor record binds a proof bundle to a point in time.
 *
 * Once anchored, the bundle's content_hash is committed to an external
 * system that provides temporal proof (when it existed).
 */
export interface AnchorRecord {
  /** Unique anchor identifier */
  anchor_id: string;

  /** The content_hash being anchored */
  content_hash: string;

  /** Hash algorithm used for content_hash */
  algorithm: string;

  /** When the anchor was created (epoch ms) */
  anchored_at_ms: number;

  /** Anchor backend that processed this */
  backend: AnchorBackend;

  /** Backend-specific anchor proof */
  proof: AnchorProof;

  /** Status of the anchor */
  status: AnchorStatus;

  /** Optional: batch this anchor belongs to */
  batch_id?: string;

  /** Optional: position in merkle tree if batched */
  merkle_path?: string[];
}

/**
 * Anchor backend identifier.
 */
export type AnchorBackend =
  | 'vaultmesh'    // VaultMesh internal anchoring
  | 'rfc3161'      // RFC-3161 timestamp authority
  | 'ethereum'     // Ethereum blockchain
  | 'bitcoin'      // Bitcoin blockchain (OpenTimestamps)
  | 'memory'       // In-memory (testing only)
  | string;        // Custom backend

/**
 * Backend-specific anchor proof.
 */
export interface AnchorProof {
  /** Proof type (varies by backend) */
  type: string;

  /** Raw proof data (backend-specific) */
  data: string;

  /** Verification URL (if applicable) */
  verification_url?: string;

  /** Timestamp from the anchor authority */
  authority_timestamp?: string;

  /** Signature from anchor authority */
  authority_signature?: string;
}

/**
 * Anchor status.
 */
export type AnchorStatus =
  | 'pending'     // Anchor submitted, not yet confirmed
  | 'confirmed'   // Anchor confirmed by backend
  | 'failed'      // Anchor failed
  | 'expired';    // Anchor proof expired (if applicable)

// ============================================================================
// Anchor Batch
// ============================================================================

/**
 * A batch of anchors combined into a single Merkle tree.
 *
 * Batching reduces costs for backends that charge per anchor.
 */
export interface AnchorBatch {
  /** Batch identifier */
  batch_id: string;

  /** Merkle root of all content_hashes in batch */
  merkle_root: string;

  /** Number of items in batch */
  item_count: number;

  /** When batch was created (epoch ms) */
  created_at_ms: number;

  /** When batch was anchored (epoch ms) */
  anchored_at_ms?: number;

  /** Backend used for anchoring */
  backend: AnchorBackend;

  /** Anchor proof for the merkle root */
  proof?: AnchorProof;

  /** Status of the batch */
  status: AnchorStatus;
}

// ============================================================================
// Anchor Request/Response
// ============================================================================

/**
 * Request to anchor a content hash.
 */
export interface AnchorRequest {
  /** The content_hash to anchor */
  content_hash: string;

  /** Hash algorithm used */
  algorithm: string;

  /** Preferred backend (optional) */
  preferred_backend?: AnchorBackend;

  /** Whether to wait for confirmation */
  wait_for_confirmation?: boolean;

  /** Timeout for confirmation (ms) */
  confirmation_timeout_ms?: number;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Response from anchoring.
 */
export interface AnchorResponse {
  /** Whether anchoring succeeded */
  success: boolean;

  /** Anchor record if successful */
  anchor?: AnchorRecord;

  /** Error message if failed */
  error?: string;

  /** Warning messages */
  warnings?: string[];
}

// ============================================================================
// Verification Types
// ============================================================================

/**
 * Request to verify an anchored bundle.
 */
export interface AnchorVerificationRequest {
  /** Content hash to verify */
  content_hash: string;

  /** Anchor record to verify against */
  anchor: AnchorRecord;

  /** Whether to verify with external backend */
  verify_external?: boolean;
}

/**
 * Result of anchor verification.
 */
export interface AnchorVerificationResult {
  /** Whether verification passed */
  valid: boolean;

  /** Hash matches anchor */
  hash_matches: boolean;

  /** Anchor proof is valid */
  proof_valid: boolean;

  /** External verification succeeded (if requested) */
  external_verified?: boolean;

  /** Timestamp from anchor (if verified) */
  verified_timestamp_ms?: number;

  /** Error message if verification failed */
  error?: string;

  /** Verification details */
  details?: Record<string, unknown>;
}

// ============================================================================
// Anchor Policy
// ============================================================================

/**
 * Policy for when to anchor.
 */
export interface AnchorPolicy {
  /** Policy name */
  name: string;

  /** When anchoring is required */
  required_for: AnchorRequirement[];

  /** Default backend */
  default_backend: AnchorBackend;

  /** Batching settings */
  batching: BatchingPolicy;
}

/**
 * When anchoring is required.
 */
export interface AnchorRequirement {
  /** Bundle type pattern (e.g., "ai_*", "emergency_*") */
  bundle_type_pattern: string;

  /** Minimum risk level (if applicable) */
  min_risk_level?: 'low' | 'medium' | 'high' | 'critical';

  /** Whether anchoring is MUST or SHOULD */
  requirement: 'must' | 'should';
}

/**
 * Batching policy.
 */
export interface BatchingPolicy {
  /** Whether batching is enabled */
  enabled: boolean;

  /** Maximum batch size */
  max_batch_size: number;

  /** Maximum wait time before flushing batch (ms) */
  max_wait_ms: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default anchor policy.
 */
export const DEFAULT_ANCHOR_POLICY: AnchorPolicy = {
  name: 'default',
  required_for: [
    {
      bundle_type_pattern: 'ai_emergency_*',
      requirement: 'must',
    },
    {
      bundle_type_pattern: 'ai_tool_*',
      min_risk_level: 'high',
      requirement: 'must',
    },
    {
      bundle_type_pattern: '*',
      requirement: 'should',
    },
  ],
  default_backend: 'vaultmesh',
  batching: {
    enabled: true,
    max_batch_size: 100,
    max_wait_ms: 60000, // 1 minute
  },
};

/**
 * Anchor module version.
 */
export const ANCHOR_VERSION = '1.0.0';
