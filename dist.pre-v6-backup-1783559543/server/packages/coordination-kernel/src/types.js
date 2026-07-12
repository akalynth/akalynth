// Coordination Kernel Types
// Domain-agnostic interfaces for post-bureaucratic coordination
// ============================================================================
// Error Types
// ============================================================================
export class CoordinationError extends Error {
    code;
    context;
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'CoordinationError';
    }
}
// ============================================================================
// Litmus Test Constant
// ============================================================================
export const LITMUS_TEST = {
    question: "Who decides?",
    answer: "The receipts, the constraints, and the clock."
};
