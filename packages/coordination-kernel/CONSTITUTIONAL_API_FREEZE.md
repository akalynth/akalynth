# CONSTITUTIONAL API FREEZE (DRAFT — NON-BINDING)

> **Status:** Draft (non-binding for v1).  
> **Change control:** Not active; future design intent only.

**Document Type**: Future design intent (not law)
**Effective Date**: Not effective (v1)
**Version**: DRAFT
**Amendment Authority**: N/A (not in force)

## OUT OF SCOPE FOR v1

This document describes intended primitives and guarantees that are **not yet enforced** in code or CI. It must not be treated as v1 law.

---

## CONSTITUTIONAL STATUS

The coordination-kernel package is intended to constitute the **CONSTITUTIONAL INFRASTRUCTURE** of the proof-native governance system. The interfaces defined in this document are *proposed to be frozen*: this is a non-binding draft for v1 (see Status above), and the freeze/amendment process described here is not yet in force.

**Legal Principle**: These 4 primitives form the mathematical foundation of post-bureaucratic coordination. Changes to these primitives constitute constitutional amendments, not software updates.

---

## CONSTITUTIONAL API (4 PRIMITIVES ONLY)

### Primitive 1: Evidence Generation (`appendReceipt`)

```typescript
appendReceipt(
  actor_id: string,
  action: string,
  inputs: Record<string, unknown>,
  result: string
): Promise<CoordinationReceipt>
```

**Constitutional Guarantee**: Every system action produces immutable, content-addressed evidence.

**Implementation Requirements**:
- MUST generate cryptographic hash of receipt contents
- MUST create tamper-evident chain linkage to previous receipt
- MUST include precise timestamp (ISO 8601)
- MUST write to persistent storage with fsync guarantee
- MUST be atomic (success = receipt written + hash computed + chain linked)

**Constitutional Violation**: Any state transition without receipt emission

### Primitive 2: Tamper Detection (`verifyChain`)

```typescript
verifyChain(receipts: CoordinationReceipt[]): Promise<ReceiptChain>
```

**Constitutional Guarantee**: Chain integrity is mathematically verifiable.

**Implementation Requirements**:
- MUST verify cryptographic hash of each receipt
- MUST verify chain linkage (prev_hash correctness)
- MUST detect any tampering, corruption, or missing receipts
- MUST return integrity status: 'valid' | 'broken'
- MUST be deterministic (same input = same result)

**Constitutional Violation**: Accepting tampered evidence as valid

### Primitive 3: Deterministic Reconstruction (`replay`)

```typescript
replay<T>(
  receipts: CoordinationReceipt[],
  reducer: (state: T, receipt: CoordinationReceipt) => T,
  initialState: T
): Promise<T>
```

**Constitutional Guarantee**: System state is deterministically reconstructable from receipts.

**Implementation Requirements**:
- MUST apply receipts in chronological order
- MUST be deterministic (same receipts + reducer = same state)
- MUST support arbitrary state types via generics
- MUST validate receipt chain before replay
- MUST handle reducer errors gracefully

**Constitutional Violation**: Non-deterministic state reconstruction

### Primitive 4: Bounded Authority (`capability`)

```typescript
capability: {
  check(actor: Actor, required_capability: string): boolean;
  grant(actor: Actor, capability: string, granted_by: string): Promise<void>;
  revoke(actor: Actor, capability: string, revoked_by: string): Promise<void>;
}
```

**Constitutional Guarantee**: Authority is explicit, bounded, and auditable.

**Implementation Requirements**:
- MUST enforce capability requirements before action execution
- MUST emit receipts for all grant/revoke operations
- MUST support temporal expiration of capabilities
- MUST prevent self-authorization (segregation invariant)
- MUST maintain capability audit trail

**Constitutional Violation**: Unbounded or unaudited authority

---

## CONSTITUTIONAL TYPES (IMMUTABLE)

### Core Receipt Structure

```typescript
interface CoordinationReceipt {
  sequence: number;        // Monotonic per chain
  timestamp: string;       // ISO 8601, monotonic ordering
  prev_hash: string;       // Chain linkage (genesis = "genesis")
  event_hash: string;      // Content hash for tamper detection
  signature: string;       // Ed25519 signature of `${prev_hash}|${event_hash}`
  actor_id: string;        // Cryptographic identity
  action: string;          // Human-readable action identifier
  inputs: Record<string, unknown>;  // Action parameters
  result: string;          // Execution outcome
  inputs_hash: string;     // Hash of canonical inputs
  outputs_hash: string;    // Hash of canonical outputs (result)
}
```

**Constitutional Requirement**: All fields MUST be present. Additional fields MAY be added but core fields are immutable.

### Chain Integrity Status

```typescript
interface ReceiptChain {
  receipts: CoordinationReceipt[];
  integrity: 'valid' | 'broken';
  last_hash: string | null;
}
```

**Constitutional Requirement**: Integrity determination MUST be cryptographically based, never heuristic.

---

## VERSION BINDING

**Package Version at Freeze**: `@akalynth/coordination-kernel@0.1.0`
**Git Tag**: `v1.0-proof-native-change-control`
**Constitutional Hash**: [To be computed]

**Backward Compatibility Guarantee**: All versions implementing this constitutional API are interoperable for core operations.

**Forward Compatibility Requirement**: Extensions MUST NOT modify core primitive signatures.

---

## CONSTITUTIONAL COMPLIANCE VERIFICATION

Any system claiming constitutional compliance MUST:

1. **Interface Compliance**: Implement all 4 primitives exactly as specified
2. **Cryptographic Integrity**: Pass hash verification for all receipts
3. **Chain Validation**: Detect tampering with 100% accuracy
4. **Deterministic Replay**: Produce identical results from identical inputs
5. **Capability Enforcement**: Block unauthorized actions before execution

**Verification Command** (proposed; `constitutional-verify` is not yet implemented):
```bash
constitutional-verify --api-compliance @akalynth/coordination-kernel@0.1.0
```

---

## AMENDMENT PROCESS

Changes to this constitutional API require:

1. **Supermajority Consensus**: >66.7% of constitutional nodes
2. **Impact Analysis**: Cryptographic proof of backward compatibility OR explicit breaking change declaration
3. **Public Review**: 30-day challenge period with technical rebuttal requirement
4. **Testnet Validation**: Successful demonstration on isolated constitutional framework
5. **Migration Path**: Clear upgrade path for all existing implementations

**Emergency Amendment**: NOT PERMITTED. Constitutional stability is paramount.

---

## IMPLEMENTATION CONSTRAINTS

### Mandatory Features
- Cryptographic hash generation (BLAKE3, as implemented in `src/receipt/hasher.ts`)
- Persistent storage with durability guarantees
- Atomic operations for receipt generation
- Deterministic ordering and replay
- Capability-based access control

### Prohibited Features
- Human approval gates in core primitives
- Non-deterministic behavior
- Capability inheritance without explicit grants
- Receipt modification after generation
- Chain rewriting or "reorganization"

### Implementation Independence
- Programming language: ANY
- Storage backend: ANY (with durability guarantees)
- Cryptographic library: ANY (with constitutional hash compatibility)
- Network protocol: ANY
- Operating system: ANY

---

## CONSTITUTIONAL ENFORCEMENT

**Enforcement Mechanism**: Cryptographic proof rejection
**Appeal Process**: NONE (finality invariant)
**Override Authority**: NONE (human discretion prohibited)
**Exception Process**: Constitutional amendment only

**Warning**: Systems violating constitutional API requirements will be automatically ejected from proof-native networks. Re-admission requires full compliance demonstration.

---

## LITMUS TEST APPLICATION

**Question**: "Who decides if a receipt is valid?"
**Constitutional Answer**: "The cryptographic hash and chain verification, never human judgment."

**Question**: "Who decides if an action is authorized?"
**Constitutional Answer**: "The capability check against current grants, never discretionary approval."

**Question**: "Who decides the outcome of replay?"
**Constitutional Answer**: "The deterministic reducer applied to valid receipts, never interpretation."

**Question**: "Who decides when capabilities expire?"
**Constitutional Answer**: "The clock and the constraints, never human convenience."

---

**CONSTITUTIONAL AUTHORITY** (proposed): This document describes intended immutable law for proof-native coordination.
**NOT YET EFFECTIVE** — draft / future design intent for v1 (see Status at top).
**INTENDED ENFORCEMENT**: No human discretion, once in force.

---

**Governance Philosophy**: Post-bureaucratic. Post-discretionary. Post-trust. Proof-native.

**Implementation Status**: Draft / proposed freeze — not enforced in v1. Once ratified, changes would require the amendment process.
