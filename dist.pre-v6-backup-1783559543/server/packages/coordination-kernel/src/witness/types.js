/**
 * Witness-Ledger Primitives
 *
 * Domain-agnostic types for systems that must explain themselves,
 * prove their history, and simulate alternatives without lying.
 *
 * The core insight: "A witness that can leave and still be trusted."
 */
// ============================================================================
// Fork Isolation Validation
// ============================================================================
/**
 * Isolation violation error.
 */
export class ForkIsolationViolation extends Error {
    violation_type;
    context;
    constructor(message, violation_type, context) {
        super(message);
        this.violation_type = violation_type;
        this.context = context;
        this.name = 'ForkIsolationViolation';
    }
}
