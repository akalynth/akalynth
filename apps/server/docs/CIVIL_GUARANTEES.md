# Akalynth Civil Guarantees v1 — Index

**Scope**: These guarantees are construction-backed. Any future change must preserve them or explicitly amend this index with a version bump.

---

## Receipts

**G1 — Canonical Ledger**
Receipts are append-only and constitute the sole canonical history.

**G2 — Deterministic Hashing**
Receipt hashes are BLAKE3 over canonical JSON; identical receipts → identical hashes.

**G3 — Durable Ordering**
Receipts are fsynced before any projection or materialization occurs.

**G4 — Idempotent Replay**
Replaying the same receipts produces the same state, without duplication.

---

## Projection

**G5 — Rebuildable State**
SQLite is a projection only and is fully reconstructable from receipts.

---

## Items

**G6 — Receipt-Native Identity**
Item IDs are deterministically derived from mint receipts.

**G7 — Location Exclusivity**
An item exists in exactly one place: inventory XOR world (never both).

---

## Death & Combat

**G8 — Single Death Path**
All deaths flow through `applyDeath()` and emit a complete, ordered death chain.

**G9 — Server Authority**
Clients submit intent only; all combat validation and resolution is server-side.

---

## Drops

**G10 — Deterministic Selection**
Given the same canonical pre-state and seed, drop outcomes are identical.

**G11 — Explainability**
Every drop can be re-derived and explained from receipts + policy.

---

## Legendary Pressure

**G12 — Replay-Proof Heat**
Legendary heat is receipt-backed, reconstructable, and auditable.

**G13 — Bounded Protection**
Each player may protect at most one item; protected items never drop.

---

## Chronicle

**G14 — Auditable Civil Record**
Chronicle events are dedup-safe, receipt-traceable, and pagination-stable.

---

## Forensics

**G15 — External Auditability**
An independent party can verify outcomes using receipts and policy alone.

---

## Amendment Rule

Any change that alters determinism, hashing, receipt ordering, or invariant scope must:

1. Update this index (version bump)
2. Preserve replay determinism
3. Include verifier coverage

---

## Enforcement

**Phase Gate**: `npm run verify`

All commits are blocked by pre-commit hook unless guarantees pass.

```bash
# Install hooks (one-time)
npm run install-hooks

# Manual verification
npm run verify           # Full gate (build + all checks)
npm run verify:quick     # Skip build (fast)
npm run verify:verbose   # Show detailed output
```

---

## Verifier Suite

| Tool | Guarantees Covered |
|------|-------------------|
| `tools/verify-guarantees.ts` | G1-G15 (unified gate) |
| `tools/verify-heat.ts` | G12 |
| `tools/verify-protected.ts` | G13 |
| `tools/verify-chronicle.ts` | G14 (C1-C8) |
| `tools/why-drop.ts` | G10, G11, G15 |
| SQL invariants A-E | G7 |

---

## Reference

Full constitution with enforcement details, verification procedures, and non-goals: see project documentation.
