# Phase 6 — The Witness Interface

> Make the ledger legible to the human who lives inside it.

**Status (v1):** Deferred. This document is a future UI contract and is not implemented in v1.

---

## Charter

Phase 6 is where Akalynth stops being merely correct and becomes **experienced**.

The system already acts. The human now **witnesses** the action and its reasons.

This is not decoration. It is a boundary layer between civil truth and perception.

---

## Philosophy

| Term | Meaning |
|------|---------|
| **Witness** | The human observes what happened and why — not as participant, but as informed observer of their own history |
| **Interface** | A translation layer from receipt-backed truth to human-readable display |
| **Oath made tangible** | Clicking "Why did this drop?" and receiving a deterministic, auditable answer is the moment the system earns trust |

---

## Scope

### Included

| Component | Description |
|-----------|-------------|
| Chronicle List | Read-only view of player's civil record |
| Evidence Drawer | E4 clickthrough showing drop explanation |
| Deterministic Rendering | Fixtures produce identical UI every time |
| Offline-First | Client can test against fixtures without server |
| Verbatim Display | Server truth rendered as-is, no synthesis |

### Excluded

| Explicitly NOT in Phase 6 |
|---------------------------|
| Balance changes |
| New receipts |
| New mechanics |
| Interpretation or judgment |
| Any mutation of state |
| Client-side recomputation |
| Cross-player data |

**Phase 6 does not change the world. It changes what the human can see.**

---

## Success Condition

> A player can point to a loss and say:
> "I understand why this happened — and I can prove it."

When that sentence is true, Phase 6 is complete.

---

## Sub-Phases

### Phase 6.1 — Chronicle View

**Deliverable:** Scrollable list of chronicle events

**Contract:**
- Fetch `chronicle_snapshot` via WebSocket
- Render events in timestamp descending order
- Show "Evidence" button only when `evidence_ref != null`
- Pagination via `before` cursor

**Acceptance:**
- Offline test: Load `fixtures/chronicle_snapshot.json`, render list
- Online test: Connect to server, fetch own chronicle, verify display

### Phase 6.2 — Evidence Drawer

**Deliverable:** Modal/drawer showing drop explanation

**Contract:**
- Send `get_evidence` with `receipt_hash` (preferred) or `chronicle_event_id`
- Receive `evidence_snapshot`
- Render sections:
  - Anchor (receipt hashes)
  - Outcome Summary (dropped/kept/protected arrays verbatim)
  - Why-Table (candidates in server-provided rank order)
  - Footer (seed_hash, copy JSON button)

**Acceptance:**
- Offline test: Load `fixtures/evidence_snapshot.json`, verify:
  - `dropped_item_ids` exact match
  - `seed_hash` exact match
  - First 5 candidates match (rank, item_id, dropped)
- Online test: Click evidence button, verify drawer matches fixtures format

### Phase 6.3 — Deterministic UI Verification

**Deliverable:** Automated test suite for UI determinism

**Contract:**
- Given identical fixtures, UI renders identically
- No floating-point drift in displayed values
- Candidate order matches server (never re-sorted client-side)
- Receipt hashes displayed verbatim (copy works)

**Acceptance:**
- Run fixture-based tests in CI
- Rebuild portability: wipe DB, replay, verify UI unchanged

---

## Fixtures (Planned)

Located in `apps/server/fixtures/` (not yet committed for v1):

| File | Purpose |
|------|---------|
| `chronicle_snapshot.json` | Chronicle events with evidence_ref |
| `evidence_snapshot.json` | Full evidence payload |
| `test_receipts.jsonl` | Portable receipts for rebuild |
| `summary.json` | Metadata for assertions |
| `README.md` | Contract rules |

---

## Android Implementation Checklist

### A) Data Models
```kotlin
data class EvidenceRef(
    val chronicle_event_id: Int,
    val receipt_hash: String
)

data class ChronicleEvent(
    val kind: String,
    val timestamp: String,
    val zone: String?,
    val x: Int?,
    val y: Int?,
    val details: Map<String, Any>,
    val evidence_ref: EvidenceRef?
)

data class DropCandidate(
    val item_id: String,
    val item_type: String,
    val rank: Int,
    val dropped: Boolean,
    val exclusion_reason: String,
    // ... other fields
)

data class DropExplanation(
    val dropped_item_ids: List<String>,
    val kept_item_ids: List<String>,
    val seed_hash: String,
    val candidates: List<DropCandidate>  // Already sorted by rank
)
```

### B) Message Handlers
```kotlin
// Outgoing
fun getChronicle(limit: Int = 50, before: String? = null)
fun getEvidence(receiptHash: String)  // Preferred
fun getEvidence(chronicleEventId: Int) // Fallback

// Incoming
fun onChronicleSnapshot(snapshot: ChronicleSnapshotMessage)
fun onEvidenceSnapshot(snapshot: EvidenceSnapshotMessage)
```

### C) Cache Strategy
```kotlin
// Key by receipt_hash (ledger-stable), NOT chronicle_event_id
private val evidenceCache = mutableMapOf<String, EvidenceSnapshot>()

fun getCachedEvidence(receiptHash: String): EvidenceSnapshot? {
    return evidenceCache[receiptHash]
}

fun cacheEvidence(snapshot: EvidenceSnapshot) {
    if (snapshot.status == "ok") {
        val anchor = snapshot.evidence?.receipt_hashes?.anchor ?: return
        evidenceCache[anchor] = snapshot
    }
}
```

### D) Display Rules

1. **Chronicle List**
   - Show evidence button only if `evidence_ref != null`
   - Use `evidence_ref.receipt_hash` for cache lookup

2. **Evidence Drawer**
   - Render `candidates` in received order (already sorted)
   - Never re-sort, filter, or aggregate
   - Show arrays verbatim (dropped_item_ids, kept_item_ids)

3. **Error States**
   - `not_found` → "Evidence not found"
   - `not_applicable` → "No evidence for this event type"
   - `insufficient_data` → "Evidence incomplete"

---

## Phase Naming Ledger

| Phase | Name | Purpose |
|-------|------|---------|
| 4 | Chronicle | Memory |
| 5 | Pressure | Meaning |
| 6 | Witness | Perception |

---

## Guarantees Preserved

Phase 6 inherits and must not violate:
- G1–G15 (existing civil guarantees)
- PM1–PM3 (metrics invariants)

Phase 6 adds no new guarantees — it is purely observational.

---

## Timeline

Phase 6 has no timeline. It has milestones:

1. **6.1 Complete:** Chronicle list renders from fixtures
2. **6.2 Complete:** Evidence drawer renders from fixtures
3. **6.3 Complete:** Deterministic tests pass in CI
4. **Phase 6 Complete:** Player can point to a loss and prove why it happened
