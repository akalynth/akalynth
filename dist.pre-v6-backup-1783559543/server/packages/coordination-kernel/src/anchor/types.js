/**
 * Anchor Types
 *
 * Schema for tamper-evident time-binding of proof bundles.
 */
// ============================================================================
// Constants
// ============================================================================
/**
 * Default anchor policy.
 */
export const DEFAULT_ANCHOR_POLICY = {
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
