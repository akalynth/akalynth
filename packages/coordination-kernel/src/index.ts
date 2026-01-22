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

// Version info
export const COORDINATION_KERNEL_VERSION = '0.2.0';

// Implementation status marker
export const KERNEL_STATUS = 'demo_ready' as const;
