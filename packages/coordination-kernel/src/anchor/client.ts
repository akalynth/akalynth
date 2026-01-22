/**
 * Anchor Client
 *
 * Pluggable interface for anchor backends.
 */

import { createHash, randomUUID } from 'crypto';

import type {
  AnchorRecord,
  AnchorRequest,
  AnchorResponse,
  AnchorBackend,
  AnchorProof,
  AnchorStatus,
  AnchorBatch,
  AnchorPolicy,
  AnchorVerificationRequest,
  AnchorVerificationResult,
} from './types.js';

import { DEFAULT_ANCHOR_POLICY } from './types.js';

// ============================================================================
// Anchor Backend Interface
// ============================================================================

/**
 * Interface for anchor backend implementations.
 */
export interface AnchorBackendProvider {
  /** Backend identifier */
  readonly backend: AnchorBackend;

  /** Anchor a single content hash */
  anchor(request: AnchorRequest): Promise<AnchorResponse>;

  /** Anchor a batch (merkle root) */
  anchorBatch(merkle_root: string, item_count: number): Promise<AnchorResponse>;

  /** Verify an anchor */
  verify(request: AnchorVerificationRequest): Promise<AnchorVerificationResult>;

  /** Check if backend is available */
  isAvailable(): Promise<boolean>;
}

// ============================================================================
// Memory Backend (Testing)
// ============================================================================

/**
 * In-memory anchor backend for testing.
 *
 * NOT for production use.
 */
export class MemoryAnchorBackend implements AnchorBackendProvider {
  readonly backend: AnchorBackend = 'memory';
  private anchors = new Map<string, AnchorRecord>();

  async anchor(request: AnchorRequest): Promise<AnchorResponse> {
    const now = Date.now();
    const anchor_id = `mem_${randomUUID()}`;

    const anchor: AnchorRecord = {
      anchor_id,
      content_hash: request.content_hash,
      algorithm: request.algorithm,
      anchored_at_ms: now,
      backend: 'memory',
      proof: {
        type: 'memory',
        data: JSON.stringify({ anchored_at: now }),
      },
      status: 'confirmed',
    };

    this.anchors.set(request.content_hash, anchor);

    return { success: true, anchor };
  }

  async anchorBatch(merkle_root: string, item_count: number): Promise<AnchorResponse> {
    return this.anchor({
      content_hash: merkle_root,
      algorithm: 'SHA-256',
      metadata: { item_count },
    });
  }

  async verify(request: AnchorVerificationRequest): Promise<AnchorVerificationResult> {
    const stored = this.anchors.get(request.content_hash);

    if (!stored) {
      return {
        valid: false,
        hash_matches: false,
        proof_valid: false,
        error: 'Anchor not found',
      };
    }

    const hash_matches = stored.content_hash === request.content_hash;
    const proof_valid = stored.anchor_id === request.anchor.anchor_id;

    return {
      valid: hash_matches && proof_valid,
      hash_matches,
      proof_valid,
      verified_timestamp_ms: stored.anchored_at_ms,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  // Testing helpers
  clear(): void {
    this.anchors.clear();
  }

  getAnchor(content_hash: string): AnchorRecord | undefined {
    return this.anchors.get(content_hash);
  }
}

// ============================================================================
// VaultMesh Backend (Placeholder)
// ============================================================================

/**
 * VaultMesh anchor backend.
 *
 * Placeholder - actual implementation depends on VaultMesh API.
 */
export class VaultMeshAnchorBackend implements AnchorBackendProvider {
  readonly backend: AnchorBackend = 'vaultmesh';

  constructor(
    private endpoint: string = 'https://anchor.vaultmesh.io',
    private apiKey?: string
  ) {}

  async anchor(request: AnchorRequest): Promise<AnchorResponse> {
    // Placeholder - would call VaultMesh API
    const now = Date.now();
    const anchor_id = `vm_${createHash('sha256').update(`${request.content_hash}:${now}`).digest('hex').slice(0, 16)}`;

    const anchor: AnchorRecord = {
      anchor_id,
      content_hash: request.content_hash,
      algorithm: request.algorithm,
      anchored_at_ms: now,
      backend: 'vaultmesh',
      proof: {
        type: 'vaultmesh_v1',
        data: '', // Would contain actual proof
        verification_url: `${this.endpoint}/verify/${anchor_id}`,
      },
      status: 'pending', // Would be confirmed after API call
    };

    return {
      success: true,
      anchor,
      warnings: ['VaultMesh backend is placeholder - not actually anchored'],
    };
  }

  async anchorBatch(merkle_root: string, item_count: number): Promise<AnchorResponse> {
    return this.anchor({
      content_hash: merkle_root,
      algorithm: 'SHA-256',
      metadata: { item_count, batched: true },
    });
  }

  async verify(request: AnchorVerificationRequest): Promise<AnchorVerificationResult> {
    // Placeholder - would call VaultMesh API
    return {
      valid: request.content_hash === request.anchor.content_hash,
      hash_matches: request.content_hash === request.anchor.content_hash,
      proof_valid: true,
      details: { note: 'VaultMesh backend is placeholder' },
    };
  }

  async isAvailable(): Promise<boolean> {
    // Placeholder - would check API availability
    return true;
  }
}

// ============================================================================
// Anchor Client
// ============================================================================

/**
 * Anchor client with pluggable backends.
 */
export class AnchorClient {
  private backends = new Map<AnchorBackend, AnchorBackendProvider>();
  private pendingBatch: Array<{ content_hash: string; algorithm: string }> = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private policy: AnchorPolicy = DEFAULT_ANCHOR_POLICY,
    defaultBackends: boolean = true
  ) {
    if (defaultBackends) {
      this.registerBackend(new MemoryAnchorBackend());
      this.registerBackend(new VaultMeshAnchorBackend());
    }
  }

  /**
   * Register an anchor backend.
   */
  registerBackend(provider: AnchorBackendProvider): void {
    this.backends.set(provider.backend, provider);
  }

  /**
   * Get a registered backend.
   */
  getBackend(backend: AnchorBackend): AnchorBackendProvider | undefined {
    return this.backends.get(backend);
  }

  /**
   * Anchor a content hash.
   */
  async anchor(
    content_hash: string,
    algorithm: string = 'SHA-256',
    options: Partial<AnchorRequest> = {}
  ): Promise<AnchorResponse> {
    const backend = options.preferred_backend ?? this.policy.default_backend;
    const provider = this.backends.get(backend);

    if (!provider) {
      return {
        success: false,
        error: `Backend not available: ${backend}`,
      };
    }

    const available = await provider.isAvailable();
    if (!available) {
      return {
        success: false,
        error: `Backend unavailable: ${backend}`,
      };
    }

    const request: AnchorRequest = {
      content_hash,
      algorithm,
      ...options,
    };

    return provider.anchor(request);
  }

  /**
   * Add to batch (for batched anchoring).
   */
  addToBatch(content_hash: string, algorithm: string = 'SHA-256'): void {
    if (!this.policy.batching.enabled) {
      throw new Error('Batching not enabled');
    }

    this.pendingBatch.push({ content_hash, algorithm });

    // Flush if batch is full
    if (this.pendingBatch.length >= this.policy.batching.max_batch_size) {
      this.flushBatch();
      return;
    }

    // Set timeout for flush if not already set
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flushBatch();
      }, this.policy.batching.max_wait_ms);
    }
  }

  /**
   * Flush pending batch.
   */
  async flushBatch(): Promise<AnchorResponse | null> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.pendingBatch.length === 0) {
      return null;
    }

    const items = [...this.pendingBatch];
    this.pendingBatch = [];

    // Compute merkle root
    const merkle_root = computeMerkleRoot(items.map(i => i.content_hash));

    const backend = this.policy.default_backend;
    const provider = this.backends.get(backend);

    if (!provider) {
      return {
        success: false,
        error: `Backend not available for batch: ${backend}`,
      };
    }

    return provider.anchorBatch(merkle_root, items.length);
  }

  /**
   * Verify an anchored bundle.
   */
  async verify(request: AnchorVerificationRequest): Promise<AnchorVerificationResult> {
    const provider = this.backends.get(request.anchor.backend);

    if (!provider) {
      return {
        valid: false,
        hash_matches: request.content_hash === request.anchor.content_hash,
        proof_valid: false,
        error: `Backend not available: ${request.anchor.backend}`,
      };
    }

    return provider.verify(request);
  }

  /**
   * Check if anchoring is required for a bundle type.
   */
  isAnchoringRequired(bundle_type: string, risk_level?: string): boolean {
    for (const req of this.policy.required_for) {
      if (matchPattern(bundle_type, req.bundle_type_pattern)) {
        if (req.requirement === 'must') {
          if (req.min_risk_level) {
            const levels = ['low', 'medium', 'high', 'critical'];
            const reqIndex = levels.indexOf(req.min_risk_level);
            const actualIndex = risk_level ? levels.indexOf(risk_level) : -1;
            if (actualIndex >= reqIndex) {
              return true;
            }
          } else {
            return true;
          }
        }
      }
    }
    return false;
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Compute Merkle root from a list of hashes.
 */
export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    throw new Error('Cannot compute merkle root of empty list');
  }

  if (hashes.length === 1) {
    return hashes[0];
  }

  // Sort for determinism
  const sorted = [...hashes].sort();

  // Build tree
  let level = sorted;
  while (level.length > 1) {
    const nextLevel: string[] = [];

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left; // Duplicate last if odd
      const combined = createHash('sha256')
        .update(left + right)
        .digest('hex');
      nextLevel.push(combined);
    }

    level = nextLevel;
  }

  return level[0];
}

/**
 * Compute Merkle path for a hash in a tree.
 */
export function computeMerklePath(
  target_hash: string,
  all_hashes: string[]
): string[] | null {
  const sorted = [...all_hashes].sort();
  const index = sorted.indexOf(target_hash);

  if (index === -1) {
    return null;
  }

  const path: string[] = [];
  let level = sorted;
  let targetIndex = index;

  while (level.length > 1) {
    const siblingIndex = targetIndex % 2 === 0 ? targetIndex + 1 : targetIndex - 1;
    const sibling = level[siblingIndex] ?? level[targetIndex];

    path.push(sibling);

    // Build next level
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      const combined = createHash('sha256')
        .update(left + right)
        .digest('hex');
      nextLevel.push(combined);
    }

    level = nextLevel;
    targetIndex = Math.floor(targetIndex / 2);
  }

  return path;
}

/**
 * Verify a Merkle path.
 */
export function verifyMerklePath(
  target_hash: string,
  merkle_root: string,
  path: string[]
): boolean {
  let current = target_hash;

  for (const sibling of path) {
    // Combine in sorted order for determinism
    const [left, right] = [current, sibling].sort();
    current = createHash('sha256')
      .update(left + right)
      .digest('hex');
  }

  return current === merkle_root;
}

/**
 * Match a pattern with wildcards.
 */
function matchPattern(value: string, pattern: string): boolean {
  if (pattern === '*') {
    return true;
  }

  const regex = new RegExp(
    '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  );

  return regex.test(value);
}
