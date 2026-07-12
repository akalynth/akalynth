/**
 * Explanation Engine Primitives
 *
 * Rule-grounded reasoning that reports, doesn't interpret.
 */
/**
 * Create a new rule registry.
 */
export function createRuleRegistry() {
    const rules = new Map();
    const byCategory = new Map();
    return {
        register(rule) {
            rules.set(rule.rule_id, rule);
            if (!byCategory.has(rule.category)) {
                byCategory.set(rule.category, new Set());
            }
            byCategory.get(rule.category).add(rule.rule_id);
        },
        get(rule_id) {
            return rules.get(rule_id);
        },
        getByCategory(category) {
            const ids = byCategory.get(category);
            if (!ids)
                return [];
            return Array.from(ids).map(id => rules.get(id));
        },
        all() {
            return Array.from(rules.values());
        },
        has(rule_id) {
            return rules.has(rule_id);
        },
    };
}
/**
 * Create an explanation builder.
 */
export function createExplanationBuilder() {
    let sequence = 0;
    const generateId = (subject_id) => {
        sequence++;
        return `exp_${subject_id}_${Date.now()}_${sequence}`;
    };
    const buildEvidenceRefs = (ctx) => {
        const refs = [];
        if (ctx.receipt) {
            refs.push(`receipt:${ctx.receipt.receipt_id}`);
        }
        if (ctx.snapshot) {
            refs.push(`snapshot:${ctx.snapshot.sequence}`);
        }
        if (ctx.prev_snapshot && ctx.snapshot) {
            refs.push(`diff:${ctx.prev_snapshot.sequence}→${ctx.snapshot.sequence}`);
        }
        return refs;
    };
    return {
        build(ctx, rule_ids, reason, decision = 'confirmed') {
            const subject_id = ctx.event.event_id || ctx.actor_id;
            return {
                explanation_id: generateId(subject_id),
                subject_id,
                decision,
                rule_ids: [...rule_ids].sort(), // Deterministic order
                reason,
                details: { ...ctx.context_data },
                evidence_refs: buildEvidenceRefs(ctx),
                remediation: null,
                timestamp_ms: Date.now(),
            };
        },
        buildSimulated(ctx, rule_ids, reason) {
            const subject_id = ctx.event.event_id || ctx.actor_id;
            return {
                explanation_id: generateId(subject_id),
                subject_id,
                decision: 'pending', // Simulated is never confirmed
                rule_ids: [...rule_ids].sort(),
                reason: `[SIMULATED] ${reason}`, // Required marker
                details: {
                    ...ctx.context_data,
                    simulated: true,
                },
                evidence_refs: buildEvidenceRefs(ctx),
                remediation: null,
                timestamp_ms: Date.now(),
            };
        },
    };
}
// ============================================================================
// Snapshot Evidence Builder
// ============================================================================
/**
 * Build snapshot evidence from two snapshots.
 *
 * Pure function — deterministic output.
 */
export function buildSnapshotEvidence(prev, curr) {
    const transition = prev && curr
        ? `${prev.sequence} → ${curr.sequence}`
        : curr
            ? `∅ → ${curr.sequence}`
            : prev
                ? `${prev.sequence} → ∅`
                : null;
    return {
        prev_sequence: prev?.sequence ?? null,
        sequence: curr?.sequence ?? null,
        prev_state_hash: prev?.state_hash ?? null,
        state_hash: curr?.state_hash ?? null,
        state_transition: transition,
        sequence_delta: prev && curr ? curr.sequence - prev.sequence : null,
    };
}
