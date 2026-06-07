// Coordination Kernel - Post-Bureaucratic Coordination Primitives
//
// "Who decides?" → "The receipts, the constraints, and the clock."

export type {
  CoordinationReceipt,
  ReceiptChain,
  Actor,
  CapabilityGrant,
  CoordinationKernel,
  AuditWriter,
} from './types.js';
export { CoordinationError, LITMUS_TEST } from './types.js';

// Receipt system (Days 3-5: COMPLETE)
export * from './receipt/index.js';

// Capability system (Days 6-7: COMPLETE)
export * from './capability/index.js';

// Identity system (v0.1: Character Identity)
export * from './identity/index.js';

// Witness-Ledger Architecture primitives
// "A witness that can leave and still be trusted."
export * from './witness/index.js';

// WLA Conformance Suite (RFC WLA-001)
// "Standards become real when you run the tests."
export * from './conformance/index.js';

// Anchor system (tamper-evident time-binding)
// "Witnesses that can leave and be verified years later."
export * from './anchor/index.js';

// Absence Receipts (absence_receipt.v1) — bounded non-observation proofs.
// "A signed receipt for what did not happen inside a committed boundary."
export * from './absence/index.js';

// Version info
export const COORDINATION_KERNEL_VERSION = '0.4.0';

// Implementation status marker
export const KERNEL_STATUS = 'demo_ready' as const;
