/**
 * Anchor Client
 *
 * Pluggable interface for anchor backends.
 */
import { createHash, randomUUID } from 'crypto';
import { DEFAULT_ANCHOR_POLICY } from './types.js';
// ============================================================================
// Memory Backend (Testing)
// ============================================================================
/**
 * In-memory anchor backend for testing.
 *
 * NOT for production use.
 */
export class MemoryAnchorBackend {
    backend = 'memory';
    anchors = new Map();
    async anchor(request) {
        const now = Date.now();
        const anchor_id = `mem_${randomUUID()}`;
        const anchor = {
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
    async anchorBatch(merkle_root, item_count) {
        return this.anchor({
            content_hash: merkle_root,
            algorithm: 'SHA-256',
            metadata: { item_count },
        });
    }
    async verify(request) {
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
    async isAvailable() {
        return true;
    }
    // Testing helpers
    clear() {
        this.anchors.clear();
    }
    getAnchor(content_hash) {
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
export class VaultMeshAnchorBackend {
    endpoint;
    apiKey;
    backend = 'vaultmesh';
    constructor(endpoint = 'https://anchor.vaultmesh.io', apiKey) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
    }
    async anchor(request) {
        // Placeholder - would call VaultMesh API
        const now = Date.now();
        const anchor_id = `vm_${createHash('sha256').update(`${request.content_hash}:${now}`).digest('hex').slice(0, 16)}`;
        const anchor = {
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
    async anchorBatch(merkle_root, item_count) {
        return this.anchor({
            content_hash: merkle_root,
            algorithm: 'SHA-256',
            metadata: { item_count, batched: true },
        });
    }
    async verify(request) {
        // Placeholder - would call VaultMesh API
        return {
            valid: request.content_hash === request.anchor.content_hash,
            hash_matches: request.content_hash === request.anchor.content_hash,
            proof_valid: true,
            details: { note: 'VaultMesh backend is placeholder' },
        };
    }
    async isAvailable() {
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
    policy;
    backends = new Map();
    pendingBatch = [];
    batchTimeout = null;
    constructor(policy = DEFAULT_ANCHOR_POLICY, defaultBackends = true) {
        this.policy = policy;
        if (defaultBackends) {
            this.registerBackend(new MemoryAnchorBackend());
            this.registerBackend(new VaultMeshAnchorBackend());
        }
    }
    /**
     * Register an anchor backend.
     */
    registerBackend(provider) {
        this.backends.set(provider.backend, provider);
    }
    /**
     * Get a registered backend.
     */
    getBackend(backend) {
        return this.backends.get(backend);
    }
    /**
     * Anchor a content hash.
     */
    async anchor(content_hash, algorithm = 'SHA-256', options = {}) {
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
        const request = {
            content_hash,
            algorithm,
            ...options,
        };
        return provider.anchor(request);
    }
    /**
     * Add to batch (for batched anchoring).
     */
    addToBatch(content_hash, algorithm = 'SHA-256') {
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
    async flushBatch() {
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
    async verify(request) {
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
    isAnchoringRequired(bundle_type, risk_level) {
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
                    }
                    else {
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
export function computeMerkleRoot(hashes) {
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
        const nextLevel = [];
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
export function computeMerklePath(target_hash, all_hashes) {
    const sorted = [...all_hashes].sort();
    const index = sorted.indexOf(target_hash);
    if (index === -1) {
        return null;
    }
    const path = [];
    let level = sorted;
    let targetIndex = index;
    while (level.length > 1) {
        const siblingIndex = targetIndex % 2 === 0 ? targetIndex + 1 : targetIndex - 1;
        const sibling = level[siblingIndex] ?? level[targetIndex];
        path.push(sibling);
        // Build next level
        const nextLevel = [];
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
export function verifyMerklePath(target_hash, merkle_root, path) {
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
function matchPattern(value, pattern) {
    if (pattern === '*') {
        return true;
    }
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return regex.test(value);
}
