// Coordination Kernel - Post-Bureaucratic Coordination Primitives
//
// "Who decides?" → "The receipts, the constraints, and the clock."

export * from './types.js';

// Receipt system (Days 3-5: COMPLETE)
export * from './receipt/index.js';

// Capability system (Days 6-7: COMPLETE)
export * from './capability/index.js';

// Bounded resolution system (Days 8-9: COMPLETE)
export * from './resolution/index.js';

// Version info
export const COORDINATION_KERNEL_VERSION = '0.1.0';

// Implementation status marker
export const KERNEL_STATUS = 'demo_ready' as const;