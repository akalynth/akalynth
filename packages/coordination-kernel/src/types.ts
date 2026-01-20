// Coordination Kernel Types
// Domain-agnostic interfaces for post-bureaucratic coordination

// ============================================================================
// Core Receipt System
// ============================================================================

export interface CoordinationReceipt {
  timestamp: string;
  actor_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
  prev_hash: string | null;     // genesis = null, chain integrity
  evidence_hash: string;        // hash(stableStringify(without evidence_hash))
}

export interface ReceiptChain {
  receipts: CoordinationReceipt[];
  integrity: 'valid' | 'broken';
  last_hash: string | null;
}

// ============================================================================
// Universal Actor System
// ============================================================================

export interface Actor {
  id: string;
  capabilities: string[];
}

export interface CapabilityGrant {
  actor_id: string;
  capability: string;
  granted_by: string;
  source: 'rule' | 'constraint' | 'temporal';
}

// ============================================================================
// Bounded Resolution System
// ============================================================================

export interface ResolutionRequest {
  id: string;
  target_id: string;
  participants: string[];
  created_at: number;
  expires_at: number;
  responses: Map<string, 'confirm' | 'deny' | 'uncertain'>;
  resolved: boolean;
}

export interface ResolutionOutcome {
  result: 'confirmed' | 'denied' | 'contested' | 'expired' | 'insufficient';
  participant_count: number;
  response_count: number;
  resolution_time: number;
}

// ============================================================================
// Friction Constraint System
// ============================================================================

export interface FrictionConstraint {
  action: string;
  cost: number;
  formula?: (inputs: Record<string, unknown>) => number;
}

export interface FrictionBalance {
  actor_id: string;
  units: number;
  last_updated: number;
}

// ============================================================================
// Core Kernel API (4 Primitives Only)
// ============================================================================

export interface CoordinationKernel {
  // 1. Receipt Append (write + fsync + evidence_hash)
  appendReceipt(
    actor_id: string,
    action: string,
    inputs: Record<string, unknown>,
    result: string
  ): Promise<CoordinationReceipt>;

  // 2. Chain Verification (integrity, ordering, hash correctness)
  verifyChain(receipts: CoordinationReceipt[]): Promise<ReceiptChain>;

  // 3. State Replay (pure reducer replay)
  replay<T>(
    receipts: CoordinationReceipt[],
    reducer: (state: T, receipt: CoordinationReceipt) => T,
    initialState: T
  ): Promise<T>;

  // 4. Capability System (check/grant/revoke with receipt emission)
  capability: {
    check(actor: Actor, required_capability: string): boolean;
    grant(actor: Actor, capability: string, granted_by: string): Promise<void>;
    revoke(actor: Actor, capability: string, revoked_by: string): Promise<void>;
  };
}

// ============================================================================
// Audit Writer Interface (minimal for circular dependency avoidance)
// ============================================================================

export interface AuditWriter {
  write(receipt: Omit<CoordinationReceipt, 'timestamp' | 'prev_hash' | 'evidence_hash'>): Promise<CoordinationReceipt>;
}

// ============================================================================
// Error Types
// ============================================================================

export class CoordinationError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_RECEIPT' | 'CHAIN_BROKEN' | 'CAPABILITY_DENIED' | 'CONSTRAINT_VIOLATED',
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CoordinationError';
  }
}

// ============================================================================
// Litmus Test Constant
// ============================================================================

export const LITMUS_TEST = {
  question: "Who decides?",
  answer: "The receipts, the constraints, and the clock."
} as const;