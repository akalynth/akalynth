# AKALYNTH_RUNTIME_ARCHITECTURE_TEMPLATE_V1 — Adoption Proposal

Status: **proposed**

Decision date: **2026-07-12**

Authority: **Project direction; durable approver identity not yet recorded**

Supersedes: **none**

Superseded by: **none**

## Context

### Observed

The runtime has a proven Merchant Lora slice covering:

```text
intent → world event → scheduled consequence → autonomous actor
       → receipt and causal links → Chronicle → shared observation → replay
```

The proof is recorded in
[`verify-fishing-caravan-events.test.ts`](../../../apps/server/tools/verify-fishing-caravan-events.test.ts)
and uses the existing receipt, projection, Chronicle, and Codex/player parity
path.

### Boundary

The proof is a concrete slice. It is not evidence that a generic scheduler,
civilization engine, multi-process world clock, or universal persistence model
has been implemented.

### Risk

Future systems could bypass the proven path by introducing independent timers,
direct projection writes, client-owned time, or actor-specific persistence.

## Proposal

Adopt the proposed Runtime Architecture v1 as the **reusable engineering
template candidate** for future world systems, while keeping the architecture
and this proposal separate from canon, civil guarantees, and release claims.

New systems should enter through this sequence:

```text
intent or server-owned command
        ↓
authoritative resolution
        ↓
canonical receipt
        ↓
receipt-derived projection
        ↓
optional scheduled consequence
        ↓
causal downstream receipt
        ↓
Chronicle and audience-specific projections
```

The following boundaries are proposed as frozen for new work:

1. World time belongs to the authoritative runtime.
2. Clients observe and request; they do not resolve world consequences.
3. Accepted consequences enter through the receipt path.
4. Scheduled consequences are idempotent and do not mutate projections directly.
5. Autonomous actors emit server-owned commands; they are not privileged
   reducers or simulated clients.
6. `event_id` describes logical meaning; `event_instance_id` identifies one
   occurrence; parent/downstream links explain causality.
7. Replay rebuilds state and never re-runs live schedulers, actors, broadcasts,
   or random decisions.
8. Chronicle, SQLite, Android, and Codex remain derived views with explicit
   audience boundaries.

“Frozen” here means **do not widen or bypass these boundaries casually**. It
does not mean the current implementation is complete, approved canon, or a
production release guarantee.

## Future system admission gate

Before a new world-facing system is treated as complete, its design packet or
implementation review must answer:

1. Does it create a canonical event?
2. Does it enter through a server authority path?
3. Does it create causal links for downstream consequences?
4. Does time affect it, and if so, which world-time contract does it use?
5. Can its state be rebuilt by replay without executing live behavior?
6. Can another player or approved observer receive the same derived outcome?

If the answer is no, the behavior must be classified explicitly as a temporary
presentation effect, a non-world mechanic, or an unresolved architecture gap.
It must not silently introduce a second world-history path.

## Decision

**Pending authorized adoption.**

Until adoption is explicitly approved, this record and
[`RUNTIME_ARCHITECTURE_V1.md`](../../RUNTIME_ARCHITECTURE_V1.md) remain a
proposal and review surface.

## Rationale

- The smallest proven slice should become a template before the core expands.
- Reusing the existing path is safer than introducing a general scheduler in
  response to one successful actor proof.
- A boundary freeze preserves room for future implementation choices while
  preventing silent authority drift.
- The proposal keeps observed behavior, intended architecture, and approval
  status distinguishable.

## Consequences

- World/canon impact: **none**.
- Civil guarantees impact: **none**.
- Runtime behavior: **none from this proposal**.
- Engineering impact: future systems require an authority, time, receipt,
  projection, replay, and verification answer before implementation is treated
  as complete.
- Documentation affected: Runtime Architecture v1 and future system design
  packets.

## Implementation

Implementation status: **partial** — the Merchant Lora reference proof exists;
generic adoption and enforcement do not.

Evidence:

- Merchant Lora scheduler proof: [`verify-fishing-caravan-events.test.ts`](../../../apps/server/tools/verify-fishing-caravan-events.test.ts)
- Runtime architecture contract: [`RUNTIME_ARCHITECTURE_V1.md`](../../RUNTIME_ARCHITECTURE_V1.md)

## Approval

Approved by: **pending**

Approval evidence: **pending**