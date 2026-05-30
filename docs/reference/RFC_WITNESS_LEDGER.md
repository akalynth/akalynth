# RFC: Witness-Ledger Architecture

```
RFC:            WLA-001
Title:          Witness-Ledger Architecture
Status:         Draft
Category:       Standards Track
Created:        2026-01-22
Authors:        VaultSovereign
```

## Abstract

This document specifies the **Witness-Ledger Architecture** (WLA), a design pattern for systems that must explain their decisions, prove their history, and simulate alternatives without corrupting truth.

The core principle: **A witness that can leave the system and still be trusted.**

## Status of This Memo

This is a draft specification. It is intended for implementation feedback and refinement before advancement to Proposed Standard.

## Table of Contents

1. Introduction
2. Terminology
3. Architecture Overview
4. Artifact Specifications
5. Conformance Levels
6. Invariants
7. Security Considerations
8. IANA Considerations
9. References

---

## 1. Introduction

### 1.1 Problem Statement

Modern systems face increasing demands to:
- Explain why decisions were made
- Prove what happened to external parties
- Support "what-if" analysis without data corruption
- Survive audits with verifiable evidence

Traditional logging is insufficient: logs can be altered, lack cryptographic binding, and cannot stand alone as evidence.

### 1.2 Solution

The Witness-Ledger Architecture provides:
- **Receipted actions**: Every mutation is acknowledged by authority
- **Rule-grounded explanations**: Decisions cite specific rules
- **Portable proof**: Evidence packets that verify independently
- **Disciplined simulation**: Counterfactuals that cannot corrupt truth

### 1.3 Goals

1. **Explainability**: Any decision can be traced to rules
2. **Portability**: Proofs work outside the system
3. **Integrity**: Tampering is detectable
4. **Imagination**: Simulation without lying

### 1.4 Non-Goals

This specification does not define:
- Specific rule languages
- UI/UX requirements
- Network protocols
- Storage formats

---

## 2. Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

### 2.1 Definitions

**Actor**: An entity that can perform actions (human, AI, system).

**Intent**: A request for action, prior to authorization.

**Receipt**: Authoritative acknowledgment of an action's outcome.

**Witness Event**: A ledger entry recording something that happened.

**Snapshot**: A point-in-time state commitment.

**Explanation**: Rule-grounded reasoning for a decision.

**Proof Bundle**: A portable, self-contained evidence packet.

**Fork**: An explicitly non-authoritative branch for simulation.

**Chronicle**: The append-only ledger of witness events.

**Authority**: The entity empowered to issue receipts.

---

## 3. Architecture Overview

### 3.1 The Artifact Chain

```text
Intent → Receipt → Witness Event → Snapshot → Explanation → Proof Bundle
                                                               ↓
                                              Fork (optional, non-authoritative)
```

Each artifact builds on the previous:

| Stage | Input | Output | Question Answered |
|-------|-------|--------|-------------------|
| Intent | Actor request | Pending claim | What do they want? |
| Receipt | Intent | Authorized outcome | What did authority decide? |
| Witness Event | Receipt | Ledger entry | What is now true? |
| Snapshot | Events | State commitment | What is the state? |
| Explanation | Event + Rules | Reasoning | Why did this happen? |
| Proof Bundle | All above | Portable evidence | Can I prove it? |
| Fork | Timeline | Simulation branch | What if? |

### 3.2 Authority Model

```text
                    ┌─────────────────┐
                    │    Authority    │
                    │  (issues receipts) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
         ┌────────┐    ┌────────┐    ┌────────┐
         │ Actor  │    │ Actor  │    │ Actor  │
         │   A    │    │   B    │    │   C    │
         └────────┘    └────────┘    └────────┘
              │              │              │
              └──────────────┴──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    Chronicle    │
                    │  (witness events) │
                    └─────────────────┘
```

- Actors submit intents
- Authority issues receipts
- Chronicle records events
- All actors can read the chronicle

---

## 4. Artifact Specifications

### 4.1 Witness Event

A witness event records something that happened.

```
WitnessEvent {
  event_id:      string (REQUIRED, unique)
  action_id:     string (OPTIONAL, correlation)
  kind:          string (REQUIRED, classification)
  timestamp_ms:  integer (REQUIRED, epoch milliseconds)
  status:        EventStatus (REQUIRED)
  source:        EventSource (REQUIRED)
  details:       object (OPTIONAL, domain-specific)
}

EventStatus = "pending" | "confirmed" | "rejected" | "superseded"

EventSource = "client_intent" | "server_receipt" | "system_derived"
```

**Requirements:**
- `event_id` MUST be unique within the chronicle
- `timestamp_ms` MUST be epoch milliseconds UTC
- `status` MUST be one of the defined values
- `source` MUST accurately reflect who asserted the event

### 4.2 Snapshot

A snapshot commits to state at a point in time.

```
Snapshot {
  sequence:      integer (REQUIRED, monotonic)
  state_hash:    string (REQUIRED, cryptographic hash)
  timestamp_ms:  integer (REQUIRED)
  state_data:    object (OPTIONAL)
}
```

**Requirements:**
- `sequence` MUST be monotonically increasing
- `state_hash` MUST be a cryptographic hash (SHA-256 RECOMMENDED)
- Implementations SHOULD support snapshot diffing

### 4.3 Explanation

An explanation provides rule-grounded reasoning.

```
Explanation {
  explanation_id: string (REQUIRED, unique)
  subject_id:     string (REQUIRED, what this explains)
  decision:       ExplainDecision (REQUIRED)
  rule_ids:       array<string> (REQUIRED, non-empty)
  reason:         string (REQUIRED, human-readable)
  details:        object (OPTIONAL)
  evidence_refs:  array<string> (REQUIRED)
  remediation:    string (OPTIONAL)
  timestamp_ms:   integer (REQUIRED)
}

ExplainDecision = "pending" | "confirmed" | "rejected" | "unknown"
```

**Requirements:**
- `rule_ids` MUST contain at least one rule identifier
- `reason` MUST be human-readable
- `evidence_refs` MUST reference existing artifacts
- Explanations MUST NOT fabricate evidence

### 4.4 Proof Bundle

A proof bundle is portable, self-contained evidence.

```
ProofBundle {
  version:           integer (REQUIRED, schema version)
  metadata:          BundleMetadata (REQUIRED)
  identifiers:       BundleIdentifiers (REQUIRED)
  event:             WitnessEvent (REQUIRED)
  receipt:           ReceiptRef (OPTIONAL)
  explanation:       Explanation (REQUIRED)
  snapshot_evidence: SnapshotEvidence (OPTIONAL)
  snapshot_diff:     DiffSummary (OPTIONAL)
  integrity:         BundleIntegrity (REQUIRED)
}

BundleIntegrity {
  content_hash:       string (REQUIRED, SHA-256)
  algorithm:          string (REQUIRED, "SHA-256")
  receipt_chain_hash: string (OPTIONAL)
  signature:          string (OPTIONAL)
  merkle_root:        string (OPTIONAL)
}
```

**Requirements:**
- `content_hash` MUST be computed from canonical representation
- Same inputs MUST produce same `content_hash` (determinism)
- Implementations MUST support JSON export
- Implementations SHOULD support text export

### 4.5 Fork

A fork is an explicitly non-authoritative branch.

```
Fork {
  metadata:     ForkMetadata (REQUIRED)
  branch_point: ForkPoint (REQUIRED)
  entries:      array<ForkEntry> (REQUIRED)
}

ForkEntry {
  sequence:    integer (REQUIRED)
  event:       WitnessEvent (OPTIONAL)
  explanation: Explanation (OPTIONAL)
  snapshot:    Snapshot (OPTIONAL)
  origin:      ForkEntryOrigin (REQUIRED)
}

ForkEntryOrigin = "inherited" | "simulated"
```

**Requirements:**
- See Section 6 (Fork Isolation Invariants)

---

## 5. Conformance Levels

### 5.1 Witness-Lite

Minimum viable implementation for basic auditability.

**REQUIRED:**
- Witness Events with status tracking
- Explanations with rule citations
- JSON export capability

**NOT REQUIRED:**
- Snapshots
- Proof Bundles
- Forks

**Use cases:** Simple audit trails, basic explainability.

### 5.2 Witness-Standard

Full witness capability without simulation.

**REQUIRED:**
- All Witness-Lite requirements
- Snapshots with state hashing
- Proof Bundles with integrity verification
- Canonical JSON export (deterministic)

**NOT REQUIRED:**
- Forks

**Use cases:** Compliance systems, dispute resolution.

### 5.3 Witness-Full

Complete implementation including simulation.

**REQUIRED:**
- All Witness-Standard requirements
- Forks with isolation enforcement
- Fork validation (Section 6 invariants)

**Use cases:** What-if analysis, training systems, debugging.

### 5.4 Conformance Declaration

Implementations MUST declare their conformance level:

```json
{
  "witness_conformance": "full",
  "version": "1.0",
  "extensions": []
}
```

---

## 6. Invariants

### 6.1 Receipt-First Persistence

> Nothing is true until receipted.

- Events with `source: "client_intent"` MUST have `status: "pending"`
- Only authority MAY set `status: "confirmed"`
- The chronicle MUST NOT contain unattributed confirmations

### 6.2 Explanation Without Inference

> Report, don't interpret.

- Explanations MUST cite rules that actually fired
- Explanations MUST reference evidence that exists
- Explanations MUST NOT fabricate reasons

### 6.3 Deterministic Hashing

> Same inputs MUST produce same hash.

- `content_hash` computation MUST be deterministic
- Canonical representations MUST use sorted keys
- Implementations MUST NOT include non-deterministic data in hashes

### 6.4 Fork Isolation Invariants (CRITICAL)

These five invariants MUST be enforced for Witness-Full conformance:

```
1. Simulated events MUST NOT have status "confirmed"
2. Simulated events MUST have source "client_intent"
3. Simulated event IDs MUST start with "sim_" or "fork_"
4. Simulated explanations MUST contain "[SIMULATED]" marker
5. Inherited entries MUST precede simulated entries (no interleaving)
```

**Enforcement:**
- Implementations MUST validate these invariants on fork creation
- Implementations MUST validate on entry append
- Violations MUST raise errors (not warnings)

### 6.5 Proof Bundle Immutability

> Once created, never modified.

- Proof Bundles MUST be immutable after creation
- Modifications MUST produce new bundles with new hashes
- Implementations MUST NOT provide mutation APIs

---

## 7. Security Considerations

### 7.1 Authority Trust

The security model assumes:
- Authority is trusted to issue valid receipts
- The chronicle is append-only and tamper-evident
- Actors cannot forge receipts

If authority is compromised, the system's guarantees do not hold.

### 7.2 Hash Collision

Implementations SHOULD use SHA-256 or stronger.
MD5 and SHA-1 MUST NOT be used.

### 7.3 Fork Contamination

The fork isolation invariants (Section 6.4) exist to prevent:
- Simulated data appearing authoritative
- False proofs from forked timelines
- Confusion between real and imagined history

Implementations MUST enforce these invariants.

### 7.4 Replay Attacks

Proof Bundles include timestamps and chain hashes.
Verifiers SHOULD check:
- Bundle timestamp is reasonable
- Chain hash matches known state (if available)

---

## 8. IANA Considerations

This document has no IANA actions.

Future versions may register:
- Media types for proof bundle formats
- URI schemes for artifact references

---

## 9. References

### 9.1 Normative References

- RFC 2119: Key words for use in RFCs
- RFC 8259: The JavaScript Object Notation (JSON) Data Interchange Format

### 9.2 Informative References

- `docs/reference/WITNESS_LEDGER_ARCHITECTURE.md` (architectural narrative)
- `docs/PROOF_BUNDLES.md` (proof format reference)
- `docs/SIMULATE_WITHOUT_LYING.md` (fork & simulation discipline)

---

## Appendix A: Example Artifacts

### A.1 Witness Event

```json
{
  "event_id": "evt_death_12345",
  "action_id": "act_move_789",
  "kind": "player_death",
  "timestamp_ms": 1706000000000,
  "status": "confirmed",
  "source": "server_receipt",
  "details": {
    "killer": "Goblin",
    "zone": "Azura"
  }
}
```

### A.2 Explanation

```json
{
  "explanation_id": "exp_evt_death_12345_1706000000000",
  "subject_id": "evt_death_12345",
  "decision": "confirmed",
  "rule_ids": ["DEATH_DROP_POLICY", "PROTECTED_SLOT_POLICY"],
  "reason": "Death by Goblin triggered equipment drop per DEATH_DROP_POLICY",
  "details": {},
  "evidence_refs": ["receipt:rcpt_12345", "snapshot:100"],
  "remediation": null,
  "timestamp_ms": 1706000000000
}
```

### A.3 Simulated Entry (Fork)

```json
{
  "event_id": "sim_fork_abc_101",
  "kind": "zone_enter",
  "timestamp_ms": 1706000001000,
  "status": "pending",
  "source": "client_intent",
  "details": {
    "simulated": true,
    "to_zone": "Rookguard"
  }
}
```

Note: `status` is "pending" (never "confirmed"), `source` is "client_intent", and `event_id` starts with "sim_".

---

## Appendix B: Conformance Checklist

### B.1 Witness-Lite Checklist

- [ ] Witness Events with all required fields
- [ ] EventStatus tracking (pending/confirmed/rejected)
- [ ] EventSource attribution
- [ ] Explanations with rule citations
- [ ] JSON export

### B.2 Witness-Standard Checklist

- [ ] All Witness-Lite requirements
- [ ] Snapshots with cryptographic state hash
- [ ] Snapshot sequence monotonicity
- [ ] Proof Bundles with BundleIntegrity
- [ ] Deterministic content_hash
- [ ] Canonical JSON export (sorted keys)
- [ ] Bundle verification API

### B.3 Witness-Full Checklist

- [ ] All Witness-Standard requirements
- [ ] Fork creation from timeline
- [ ] Isolation invariant #1: No confirmed simulations
- [ ] Isolation invariant #2: Client source for simulations
- [ ] Isolation invariant #3: sim_/fork_ prefix
- [ ] Isolation invariant #4: [SIMULATED] marker
- [ ] Isolation invariant #5: No interleaving
- [ ] Fork validation on create/append
- [ ] Violation raises error (not warning)

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| Chronicle | The append-only ledger of witness events |
| Contamination | When simulated data incorrectly appears authoritative |
| Determinism | Same inputs always produce same outputs |
| Fork | Non-authoritative branch for simulation |
| Isolation | Separation of simulated from authoritative data |
| Proof Bundle | Portable, self-contained evidence packet |
| Receipt | Authoritative acknowledgment from authority |
| Snapshot | Point-in-time state commitment |
| Witness | A system conforming to this specification |

---

*End of RFC WLA-001*
