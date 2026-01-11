# Evidence UI Specification (Phase 4.4 E4)

Client handoff contract for Chronicle Evidence clickthrough UI.

---

## 1. Scope + Guarantees

**E4 is UI-only. Zero server changes required.**

| Property | Guarantee |
|----------|-----------|
| **Read-only** | No new receipts emitted, no state mutation |
| **Ownership-gated** | Client can only request evidence for own chronicle events |
| **Receipt-anchored** | Evidence anchored by `receipt_hash`; `chronicle_event_id` is a projection-local convenience |
| **Deterministic** | Same inputs always produce same evidence snapshot |

**Preserved guarantees:**
- **G11** (Explainability): Every drop is traceable to deterministic policy
- **G14** (Chronicle Stability): Evidence reproducible from receipts
- **G15** (External Auditability): Receipt hashes exposed for verification

---

## 2. Wire Format Reference

### 2.1 EvidenceRef (in chronicle events)

```typescript
interface EvidenceRef {
  chronicle_event_id: number;  // Projection-local anchor (stable within DB instance, not replay-stable)
  receipt_hash: string;        // Ledger-stable anchor (portable across rebuilds)
}
```

**Semantics:**
- `EvidenceRef` indicates the event has derivable forensic evidence
- Absence of `EvidenceRef` is authoritative (not an error)
- Client should prefer `receipt_hash` for caching and requests

Present in `ChronicleEvent` when `kind` is:
- `death` (self-referencing)
- `item_lost` (points to causing death, when `reason=death`)
- `legendary_lost` (points to causing death, when `reason=death`)

### 2.2 ChronicleEvent

```typescript
interface ChronicleEvent {
  kind: string;
  timestamp: string;                    // ISO8601
  zone: string | null;
  x: number | null;
  y: number | null;
  details: Record<string, unknown>;
  evidence_ref?: EvidenceRef | null;    // Present for evidence-eligible events
}
```

### 2.3 GetEvidenceMessage (client → server)

```typescript
interface GetEvidenceMessage {
  type: 'get_evidence';
  chronicle_event_id?: number;  // Projection-local anchor (fallback)
  receipt_hash?: string;        // Ledger-stable anchor (preferred)
  kind?: string;                // Optional: server validates if provided
}
```

**Request preference order:**
1. If `receipt_hash` provided → server uses it
2. Else → use `chronicle_event_id`
3. If neither provided → server returns `invalid_request`

### 2.4 EvidenceSnapshotMessage (server → client)

```typescript
type EvidenceStatus = 'ok' | 'not_found' | 'not_applicable' | 'insufficient_data';

interface EvidenceSnapshotMessage {
  type: 'evidence_snapshot';
  status: EvidenceStatus;
  player_id: string;

  // Echo back anchor
  chronicle_event_id?: number;
  receipt_hash?: string;
  source_action?: string;
  kind?: string;

  // Present when status === 'ok'
  evidence?: {
    receipt_hashes: {
      anchor: string;
      combat_resolved?: string;
      death?: string;
    };
    drop_explanation?: DropExplanationWire;
  };

  // If not ok, machine-readable error
  error_code?: string;
}
```

### 2.5 DropExplanationWire

Full breakdown of drop selection logic.

**Server contract:** `candidates[]` is returned already sorted by `rank` ascending. Clients MUST render in received order.

```typescript
interface DropExplanationWire {
  policy: {
    base_drop_ratio: number;
    min_drop: number;
    max_drop: number | null;
    rep_bias: number;
    stack_bias: number;
    protected_slots: number;
    decay_minutes: number;
  };

  ratio_breakdown: {
    base_drop_ratio: number;
    reputation: number;
    neg_rep: number;
    inventory_size: number;
    stack_excess: number;
    rep_contribution: number;
    stack_contribution: number;
    final_ratio: number;
    K_raw: number;
    K_bounded: number;
    K_final: number;
  };

  player_protected_ids: string[];
  policy_protected_ids: string[];

  // SORTED by rank ascending by server
  candidates: Array<{
    item_id: string;
    item_type: string;
    base_weight: number;
    legendary: boolean;
    legendary_tier: number | null;
    heat: number;
    legendary_multiplier: number | null;
    final_weight: number;
    deterministic_u: number;
    selection_key: number;
    rank: number;
    dropped: boolean;
    exclusion_reason: 'none' | 'player_protected' | 'policy_protected' | 'below_cutoff';
  }>;

  dropped_item_ids: string[];
  kept_item_ids: string[];
  seed_hash: string;
}
```

---

## 3. UI Component Structure

### 3.1 ChronicleList

Renders player's chronicle events.

```
[ChronicleList]
├── [ChronicleRow] kind=death, timestamp, zone
│   └── [ViewEvidenceButton] ← shown if evidence_ref != null
├── [ChronicleRow] kind=item_lost, item_id, reason=death
│   └── [ViewEvidenceButton] ← shown if evidence_ref != null
├── [ChronicleRow] kind=reputation_change
│   └── (no button) ← evidence_ref is null
```

**Logic:**
```
if (event.evidence_ref != null) {
  show "View evidence" button/icon
}
```

### 3.2 EvidenceDrawer (or Modal)

Opened when user clicks "View evidence".

**States:**
- `loading` — Spinner, "Loading evidence..."
- `loaded` — Render evidence sections
- `error` — Show error message with optional retry

**Sections (when loaded):**

#### A. Anchor
| Field | Value |
|-------|-------|
| Receipt Hash | `evidence.receipt_hashes.anchor` (copy button) |
| Death Receipt | `evidence.receipt_hashes.death` (if present) |
| Chronicle Event ID | `chronicle_event_id` (projection-local) |

#### B. Outcome Summary
- **Dropped Items:** `drop_explanation.dropped_item_ids[]` (verbatim)
- **Kept Items:** `drop_explanation.kept_item_ids[]` (verbatim)
- **Protected (player):** `drop_explanation.player_protected_ids[]` (verbatim)
- **Protected (policy):** `drop_explanation.policy_protected_ids[]` (verbatim)

#### C. Why-Table (Drop Breakdown)

Render `drop_explanation.candidates[]` in received order (already sorted by rank):

| Item | Type | Weight | Legendary | Heat | Multiplier | u | Key | Rank | Dropped | Reason |
|------|------|--------|-----------|------|------------|---|-----|------|---------|--------|
| `item_id` | `item_type` | `final_weight` | `legendary` | `heat` | `legendary_multiplier` | `deterministic_u` | `selection_key` | `rank` | `dropped` | `exclusion_reason` |

**Display rule:** Render in received order. If defensive sorting is required, only `(rank asc, item_id asc)` is permitted.

#### D. Repro Notes (Footer)

> "This explanation is fully reproducible from receipts + policy."
>
> Seed: `drop_explanation.seed_hash`

**Copy JSON button:** Copies entire `evidence_snapshot` as formatted JSON.

### 3.3 EvidenceCache

Session-only memory cache, keyed by `receipt_hash`:

```typescript
const evidenceCache = new Map<string, EvidenceSnapshotMessage>();

function getCachedEvidence(receiptHash: string): EvidenceSnapshotMessage | null {
  return evidenceCache.get(receiptHash) ?? null;
}

function cacheEvidence(snapshot: EvidenceSnapshotMessage): void {
  if (snapshot.status === 'ok' && snapshot.evidence?.receipt_hashes.anchor) {
    evidenceCache.set(snapshot.evidence.receipt_hashes.anchor, snapshot);
  }
}
```

**Cache key:** `receipt_hashes.anchor` (ledger-stable, survives rebuilds)

---

## 4. Error States

| Status | Error Code | UI Display |
|--------|------------|------------|
| `not_found` | `event_not_found` | "Evidence not found" |
| `not_found` | `not_owner` | "Evidence unavailable" |
| `not_found` | `invalid_request` | "Invalid evidence request" |
| `not_applicable` | `evidence_not_supported_for_kind` | "No evidence for this event type" |
| `not_applicable` | `schema_too_old` | "Evidence unavailable on this server version" |
| `insufficient_data` | `no_death_found` | "Evidence incomplete (missing death)" |
| `insufficient_data` | `*` | "Evidence data unavailable" |
| Network error | — | "Connection lost. [Retry]" |

**Error UI:**
```
┌────────────────────────────────┐
│  ⚠️ Evidence unavailable       │
│                                │
│  This event's evidence cannot  │
│  be displayed.                 │
│                                │
│  Error: not_owner              │
│                                │
│  [Close]                       │
└────────────────────────────────┘
```

---

## 5. Acceptance Tests

### E4-A: Death event opens evidence drawer

**Given:** Chronicle contains a `death` event with `evidence_ref`
**When:** User clicks "View evidence"
**Then:**
- Drawer opens
- Shows dropped items from `drop_explanation.dropped_item_ids`
- Shows Why-table with item breakdown in rank order

### E4-B: item_lost opens death evidence via linkage

**Given:** Chronicle contains `item_lost` with `reason=death` and `evidence_ref` pointing to death
**When:** User clicks "View evidence"
**Then:**
- Drawer opens showing the **death's** evidence (via `evidence_ref.receipt_hash`)
- `receipt_hashes.death` matches `evidence_ref.receipt_hash`

### E4-C: No evidence_ref means no button

**Given:** Chronicle contains `reputation_change` event (no `evidence_ref`)
**When:** User views chronicle
**Then:** No "View evidence" button/icon is shown for that row

### E4-D: Caching prevents duplicate requests

**Given:** User has previously opened evidence for a death event
**When:** User opens the same evidence again
**Then:**
- No WebSocket request is sent
- Evidence displays immediately from cache (keyed by `receipt_hash`)

### E4-E: Error rendering is stable

**Given:** Server returns `status: 'not_found'` with `error_code: 'not_owner'`
**When:** User attempts to view evidence
**Then:**
- Error state renders without crash
- "Evidence unavailable" message shown
- Close button works

### E4-F: Determinism on reopen

**Given:** Evidence drawer opened and viewed
**When:** Close drawer, then reopen (cache hit or server hit)
**Then:**
- `dropped_item_ids` is byte-equal to previous render
- `seed_hash` is byte-equal
- Top N candidate rows match exactly (no formatting drift)

---

## 6. Non-Goals

| Explicitly NOT in scope |
|------------------------|
| Client-side recomputation of drop policy |
| Client-side explanation synthesis |
| Cross-player evidence browsing |
| New server endpoints |
| Persisted evidence cache |
| Evidence diffing between deaths |
| Export to external format (beyond JSON copy) |

---

## 7. Implementation Notes

### Request Flow

```
User clicks "View evidence"
    ↓
Extract evidence_ref from event
    ↓
Use evidence_ref.receipt_hash as cache key
    ↓ (cache miss)
Send: { type: 'get_evidence', receipt_hash: '...' }
       (or chronicle_event_id as fallback)
    ↓
Receive: evidence_snapshot
    ↓
Cache by receipt_hashes.anchor if status === 'ok'
    ↓
Render drawer
```

### Ownership Enforcement

The server enforces ownership. Client should:
- Only request evidence for events returned by own `chronicle_snapshot`
- Not attempt to forge `chronicle_event_id` or `receipt_hash` values
- Display error gracefully if server rejects

### Display-Only Rule

**CRITICAL:** Client must **display** `drop_explanation` verbatim. Never:
- Recompute weights locally
- Re-sort candidates (they arrive pre-sorted)
- Filter "unimportant" items
- Summarize or aggregate (showing arrays verbatim is allowed)
- Synthesize explanations or interpretations

The server's explanation is the source of truth.
