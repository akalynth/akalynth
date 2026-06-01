# Witness–Ledger Architecture

This document describes the **Witness–Ledger Architecture** implemented in Akalynth — a design pattern for systems that must explain themselves, prove their history, and simulate alternatives without corrupting truth.

## Core Principle

> **The system is a witness that can leave the system and still be trusted.**

Every action is:
1. **Intended** (claimed by the actor)
2. **Receipted** (confirmed by authority)
3. **Recorded** (committed to the ledger)
4. **Explained** (justified by rules)
5. **Provable** (exportable as evidence)

## The Five Artifacts

### 1. Intent (Claim)

```text
Actor → System: "I want to move north"
```

An intent is a **claim** — a request for action that has no authority until acknowledged. Intents:
- Carry an `actionId` for correlation
- Are never trusted as truth
- May be rejected, modified, or ignored

### 2. Receipt (Authority)

```text
System → Actor: "Move accepted. Receipt: rcpt_12345"
```

A receipt is **authoritative acknowledgment**. It proves:
- The system processed the intent
- The outcome is now canonical
- The `receiptId` is the source of truth

### 3. ChronicleEvent (Ledger)

```kotlin
ChronicleEvent(
    eventId = "evt_12345",
    kind = DEATH,
    status = CONFIRMED,
    source = SERVER_RECEIPT
)
```

The chronicle is the **ledger of record**. Events are:
- Append-only (never mutated)
- Status-tracked (PENDING → CONFIRMED/REJECTED)
- Source-tagged (who said it's true)

### 4. Explanation (Justification)

```kotlin
Explanation(
    decision = CONFIRMED,
    ruleIds = ["DEATH_DROP_POLICY", "PROTECTED_SLOT_POLICY"],
    reason = "Death by Goblin triggered equipment drop",
    evidenceRefs = ["rcpt_12345", "snapshot:100"]
)
```

An explanation is **rule-grounded reasoning**. It:
- Cites specific rules by ID
- References evidence (receipts, snapshots)
- Never fabricates — only reports what rules determined

### 5. Snapshot (State Attestation)

```kotlin
SnapshotV0(
    sequence = 100,
    stateHash = "a1b2c3..."
)
```

A snapshot is a **point-in-time state commitment**. It:
- Proves what was true at sequence N
- Enables diffs (what changed between N and N+1)
- Is evidence, not law — receipts remain authoritative

## The Pipeline

```text
Intent → Receipt → ChronicleEvent → Snapshot → Explanation → ProofBundle
  ↑                                                              ↓
  └──────────── Replay Scrubber (fork for what-if) ──────────────┘
```

Each stage adds value:

| Stage | Question Answered | Artifact |
|-------|-------------------|----------|
| Intent | What did they want? | ActionIntent |
| Receipt | What did the system decide? | Receipt |
| Chronicle | What is now true? | ChronicleEvent |
| Snapshot | What is the state? | SnapshotV0 |
| Explanation | Why did this happen? | Explanation |
| Proof | Can I prove it to others? | ProofBundle |
| Fork | What if it hadn't? | ForkTimeline |

## Key Invariants

### 1. Receipt-First Persistence

> Nothing is true until receipted.

- Client intents create PENDING events
- Only server receipts upgrade to CONFIRMED
- The ledger never lies about source

### 2. Explanation Without Inference

> Report, don't interpret.

Explanations:
- Cite rules that fired
- Reference evidence that existed
- Never invent reasons

### 3. Simulation Without Lying

> Forks are explicitly non-authoritative.

Simulated events:
- NEVER have CONFIRMED status
- ALWAYS have CLIENT_INTENT source
- ALWAYS have `sim_` prefix on IDs
- ALWAYS have `[SIMULATED]` in explanations

### 4. Deterministic Everything

Same inputs → same outputs, always:
- Same receipt chain → same history
- Same snapshots → same diffs
- Same bundle inputs → same content hash

## Component Map

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Client Side                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ ActionBus   │───▶│ Chronicle   │───▶│ Explanation │         │
│  │ (intents)   │    │ Store       │    │ Engine      │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                  │                  │
│         │                  ▼                  ▼                  │
│         │           ┌─────────────┐    ┌─────────────┐         │
│         │           │ Snapshot    │    │ Rule        │         │
│         │           │ Store       │    │ Registry    │         │
│         │           └─────────────┘    └─────────────┘         │
│         │                  │                  │                  │
│         │                  ▼                  ▼                  │
│         │           ┌─────────────────────────────────┐         │
│         │           │       Timeline Index            │         │
│         │           │  (aligned events + snapshots)   │         │
│         │           └─────────────────────────────────┘         │
│         │                         │                              │
│         │            ┌────────────┴────────────┐                │
│         │            ▼                         ▼                │
│         │     ┌─────────────┐          ┌─────────────┐         │
│         │     │ TimeTravel  │          │ Proof       │         │
│         │     │ Debugger    │          │ Bundle      │         │
│         │     └─────────────┘          └─────────────┘         │
│         │            │                                          │
│         │            ▼                                          │
│         │     ┌─────────────┐                                   │
│         │     │ Replay      │◀─── Fork (what-if)               │
│         │     │ Scrubber    │                                   │
│         │     └─────────────┘                                   │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Network Layer                             ││
│  │  ActionTransport ◀──────────────────────▶ ReceiptStream     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Server (Authority)                         │
├─────────────────────────────────────────────────────────────────┤
│  Intent → Validate → Execute → Receipt → Broadcast              │
│                                    │                             │
│                                    ▼                             │
│                            JSONL Audit Log                       │
└─────────────────────────────────────────────────────────────────┘
```

## Why This Matters

### For Games

- Players can prove what happened (dispute resolution)
- Replays are verifiable, not reconstructed
- Anti-cheat has audit trail
- "Why did I die?" has a real answer

### For Regulated Systems

- Every decision is traceable
- Audit logs are cryptographically bound
- Simulations are explicitly labeled
- No hidden state mutations

### For AI Systems

- Actions are receipted (not just logged)
- Explanations cite rules (not vibes)
- Counterfactuals are grounded in reality
- Truth and imagination are clearly separated

## Implementation Reference

| Package | Purpose |
|---------|---------|
| `chronicle/` | Events, receipts, ledger |
| `snapshot/` | State attestation, evidence, diffs |
| `explain/` | Explanation engine, rules |
| `timeline/` | Aligned indices, time-travel |
| `proof/` | Proof bundles, export formats |
| `fork/` | Simulation, replay, isolation |

## Summary

The Witness–Ledger Architecture is not a framework — it's a discipline:

1. **Claim** with intent
2. **Confirm** with receipt
3. **Record** in ledger
4. **Attest** with snapshot
5. **Explain** with rules
6. **Prove** with bundles
7. **Explore** with forks (but never lie)

The result is a system that can answer any question about its history, prove its answers to external parties, and imagine alternatives without corrupting what actually happened.

This is what it means to be a witness.
