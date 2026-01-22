/**
 * AI Governance Witness Module
 *
 * WLA binding for AI tool governance decisions.
 * Enables explainable, auditable, provable AI decision-making.
 *
 * @example
 * ```typescript
 * import {
 *   requestToEvent,
 *   buildGovernanceExplanation,
 *   buildExecutionProofBundle,
 *   createAIGovernanceRuleRegistry,
 * } from '@akalynth/ai-tool-governance/witness';
 *
 * // Create rule registry
 * const registry = createAIGovernanceRuleRegistry();
 *
 * // Map request to event
 * const event = requestToEvent(request);
 *
 * // Build explanation with rule citations
 * const explanation = buildGovernanceExplanation(event, gate, assessment);
 *
 * // Export as proof bundle
 * const bundle = buildExecutionProofBundle(request, result, gate, assessment, agent);
 * ```
 *
 * @module ai-tool-governance/witness
 */

// Event kinds
export type { AIEventKind } from './adapter.js';

// Rule constants
export { AI_GOVERNANCE_RULES } from './adapter.js';

// Registry factory
export { createAIGovernanceRuleRegistry } from './adapter.js';

// Event adapters
export {
  requestToEvent,
  resultToEvent,
  riskAssessmentToEvent,
  emergencyOverrideToEvent,
  reviewToEvent,
} from './adapter.js';

// Explanation adapter
export { buildGovernanceExplanation } from './adapter.js';

// Proof bundle adapters
export {
  buildGovernanceProofBundle,
  buildExecutionProofBundle,
  buildEmergencyProofBundle,
} from './adapter.js';
