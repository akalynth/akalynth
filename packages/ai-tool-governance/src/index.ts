// AI Tool Governance - Constitutional Adapter
// Applies proof-native constitutional principles to AI tool execution

export * from './types.js';

// Risk Assessment System
export * from './risk/assessment.js';
export * from './risk/calculator.js';
export * from './risk/friction.js';

// Governance Patterns
export * from './governance/gates.js';
export * from './governance/approval.js';
export * from './governance/execution.js';

// Emergency System
export * from './emergency/override.js';
export * from './emergency/review.js';

// Execution Patterns
export * from './patterns/direct.js';
export * from './patterns/segregation.js';
export * from './patterns/emergency.js';

// Main governance interface
export * from './ai-governance.js';

// Version and compliance info
export const AI_GOVERNANCE_VERSION = '1.0.0';
export const CONSTITUTIONAL_COMPLIANT = true;
export const GOVERNANCE_TYPE = 'ai_tool_execution';

// Constitutional status marker
export const AI_GOVERNANCE_STATUS = 'constitutional_compliant' as const;