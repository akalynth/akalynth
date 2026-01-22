/**
 * Explanation Engine Primitives
 *
 * Rule-grounded reasoning that reports, doesn't interpret.
 */

import type {
  Explanation,
  ExplainDecision,
  RuleDefinition,
  WitnessEvent,
  SnapshotEvidence,
  CoordinationReceiptRef,
} from './types.js';

// ============================================================================
// Explain Context
// ============================================================================

/**
 * Context provided to the explanation engine for generating explanations.
 */
export interface ExplainContext<TEvent = WitnessEvent> {
  /** The event being explained */
  event: TEvent;

  /** Receipt if confirmed */
  receipt: CoordinationReceiptRef | null;

  /** Previous snapshot */
  prev_snapshot: { sequence: number; state_hash: string } | null;

  /** Current snapshot */
  snapshot: { sequence: number; state_hash: string } | null;

  /** Actor ID */
  actor_id: string;

  /** Additional context data */
  context_data: Record<string, unknown>;
}

// ============================================================================
// Rule Registry
// ============================================================================

/**
 * Registry for rule definitions.
 *
 * Rules are registered with their definitions, and the registry
 * provides lookup for explanations.
 */
export interface RuleRegistry {
  /** Register a rule definition */
  register(rule: RuleDefinition): void;

  /** Get a rule by ID */
  get(rule_id: string): RuleDefinition | undefined;

  /** Get all rules in a category */
  getByCategory(category: string): RuleDefinition[];

  /** Get all registered rules */
  all(): RuleDefinition[];

  /** Check if a rule exists */
  has(rule_id: string): boolean;
}

/**
 * Create a new rule registry.
 */
export function createRuleRegistry(): RuleRegistry {
  const rules = new Map<string, RuleDefinition>();
  const byCategory = new Map<string, Set<string>>();

  return {
    register(rule: RuleDefinition): void {
      rules.set(rule.rule_id, rule);

      if (!byCategory.has(rule.category)) {
        byCategory.set(rule.category, new Set());
      }
      byCategory.get(rule.category)!.add(rule.rule_id);
    },

    get(rule_id: string): RuleDefinition | undefined {
      return rules.get(rule_id);
    },

    getByCategory(category: string): RuleDefinition[] {
      const ids = byCategory.get(category);
      if (!ids) return [];
      return Array.from(ids).map(id => rules.get(id)!);
    },

    all(): RuleDefinition[] {
      return Array.from(rules.values());
    },

    has(rule_id: string): boolean {
      return rules.has(rule_id);
    },
  };
}

// ============================================================================
// Explanation Builder
// ============================================================================

/**
 * Builder for creating explanations.
 *
 * Pure function — no side effects.
 */
export interface ExplanationBuilder {
  /** Build an explanation from context */
  build<TEvent extends { event_id?: string } = WitnessEvent>(
    ctx: ExplainContext<TEvent>,
    rule_ids: string[],
    reason: string,
    decision?: ExplainDecision
  ): Explanation;

  /** Build an explanation for a simulated event */
  buildSimulated<TEvent extends { event_id?: string } = WitnessEvent>(
    ctx: ExplainContext<TEvent>,
    rule_ids: string[],
    reason: string
  ): Explanation;
}

/**
 * Create an explanation builder.
 */
export function createExplanationBuilder(): ExplanationBuilder {
  let sequence = 0;

  const generateId = (subject_id: string): string => {
    sequence++;
    return `exp_${subject_id}_${Date.now()}_${sequence}`;
  };

  const buildEvidenceRefs = <TEvent extends { event_id?: string }>(
    ctx: ExplainContext<TEvent>
  ): string[] => {
    const refs: string[] = [];

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
    build<TEvent extends { event_id?: string }>(
      ctx: ExplainContext<TEvent>,
      rule_ids: string[],
      reason: string,
      decision: ExplainDecision = 'confirmed'
    ): Explanation {
      const subject_id = (ctx.event as any).event_id || ctx.actor_id;

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

    buildSimulated<TEvent extends { event_id?: string }>(
      ctx: ExplainContext<TEvent>,
      rule_ids: string[],
      reason: string
    ): Explanation {
      const subject_id = (ctx.event as any).event_id || ctx.actor_id;

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
export function buildSnapshotEvidence(
  prev: { sequence: number; state_hash: string } | null,
  curr: { sequence: number; state_hash: string } | null
): SnapshotEvidence {
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
