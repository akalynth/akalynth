/**
 * Anchor Module
 *
 * Tamper-evident time-binding for proof bundles.
 *
 * @example
 * ```typescript
 * import {
 *   AnchorClient,
 *   verifyAnchoredBundle,
 *   verifyAnchoredBundleOffline,
 * } from '@akalynth/coordination-kernel/anchor';
 *
 * // Create client with default backends
 * const client = new AnchorClient();
 *
 * // Anchor a proof bundle
 * const result = await client.anchor(bundle.integrity.content_hash);
 *
 * // Verify later
 * const verification = await verifyAnchoredBundle(bundle, result.anchor!, client);
 * ```
 *
 * @module anchor
 */

// Types
export type {
  AnchorRecord,
  AnchorBackend,
  AnchorProof,
  AnchorStatus,
  AnchorBatch,
  AnchorRequest,
  AnchorResponse,
  AnchorVerificationRequest,
  AnchorVerificationResult,
  AnchorPolicy,
  AnchorRequirement,
  BatchingPolicy,
} from './types.js';

export {
  DEFAULT_ANCHOR_POLICY,
  ANCHOR_VERSION,
} from './types.js';

// Client
export type { AnchorBackendProvider } from './client.js';

export {
  AnchorClient,
  MemoryAnchorBackend,
  VaultMeshAnchorBackend,
  computeMerkleRoot,
  computeMerklePath,
  verifyMerklePath,
} from './client.js';

// Verification
export type { AnchoredBundleVerificationResult } from './verify.js';

export {
  verifyAnchoredBundle,
  verifyBatchAnchoredBundle,
  verifyAnchoredBundleOffline,
} from './verify.js';
