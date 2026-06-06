# APK Distribution Checklist (Ship & Observe)

**Status**: Option 1 — Ship & Observe
**Path**: Controlled rollout with evidence collection only

---

## 1. Ship (Minimal, Controlled)

### Pre-Distribution

- [ ] **Version tag**: `v0.1.0-observe`
- [ ] **Build type**: Release APK (signed)
- [ ] **Feature freeze**: No UI/logic changes during observation window
- [ ] **Cohort size**: 10–30 users maximum

### Distribution Checklist

- [ ] APK uploaded to distribution channel
- [ ] Cohort notified with install instructions
- [ ] Server endpoints verified (`wss://` connection stable)
- [ ] Receipt logging confirmed active

---

## 2. Observe (Evidence Only)

Instrument and review **only what already exists**. No new features.

### Receipt Metrics

| Metric | Source | What to Track |
|--------|--------|---------------|
| Volume | `receipts.jsonl` | Total count per session |
| Types | `receipt.type` | Distribution by type (death, item_drop, move, etc.) |
| Failures | `reject_code` | Rejection rate, rejection reasons |
| Timing | `timestamp` | Server response latency distribution |

### Chronicle Metrics

| Metric | Source | What to Track |
|--------|--------|---------------|
| Ordering | `ChronicleStore` | Events in correct chronological order |
| Upgrades | `EventStatus` | pending → confirmed transition rate |
| Drops | `ITEM_DROP` events | Drop frequency, locations, rarity distribution |
| Deaths | `DEATH` events | Death frequency, killer attribution |

### Explanation ("Why") Metrics

| Metric | Source | What to Track |
|--------|--------|---------------|
| Opens | `ExplanationEngine.explain()` | Frequency of "Why" button taps |
| Blocked reasons | `UiBlockReason` | Which blocks trigger most explanations |
| Confusion signals | Repeated opens | Same rule explained multiple times in session |
| Rule coverage | `RuleId` distribution | Which rules appear most often |

### Tier Friction Metrics

| Metric | Component | What to Track |
|--------|-----------|---------------|
| Tier 2 cancels | `Tier2HoldButton.onCancel` | Releases before 1500ms completion |
| Tier 2 confirms | `Tier2HoldButton.onConfirm` | Successful hold completions |
| Tier 2 cancel rate | Ratio | `cancels / (cancels + confirms)` |
| Tier 3 abandon | `Tier3SlideConfirm` | Slides that snap back (< 90%) |
| Tier 3 confirms | `Tier3SlideConfirm.onConfirm` | Successful slide completions |
| Tier 3 abandon rate | Ratio | `snap_backs / (snap_backs + confirms)` |

### Movement Metrics

| Metric | Component | What to Track |
|--------|-----------|---------------|
| D-pad holds | `DPad.isPressed` | Total hold events per session |
| Hold duration | `MOVE_REPEAT_MS` intervals | Average hold time |
| Accidental stops | Release patterns | Holds < 130ms (single tap vs hold intent) |
| Misfires | Direction changes | Rapid direction switching (confusion) |

---

## 3. Metrics to Watch (Binary, Not Vanity)

### Critical Signals

| Signal | Definition | Threshold |
|--------|------------|-----------|
| **Accidental loss** | Tier 2/3 confirm followed by immediate regret signal | Any occurrence |
| **Confusion** | Repeated "Why" opens for same rule in session | ≥3 opens same rule |
| **Latency feel** | Movement complaints vs receipt timing | Complaints + receipts > 200ms |
| **Abandon points** | Session ends within 30s of confirmation | Pattern detection |

### Regret Signals

A "regret signal" is defined as:
- Immediate `kill_self` after confirm (if DEBUG enabled)
- Repeated same action immediately after confirm
- Session end within 10s of confirm
- "Why" open within 5s of confirm

---

## 4. Rules During Observation Window

### Forbidden

- ❌ No new mechanics
- ❌ No tuning constants (hold duration, slide threshold, etc.)
- ❌ No UX tweaks
- ❌ No additional UI elements
- ❌ No server-side rule changes

### Permitted

- ✅ Log collection
- ✅ Aggregate metrics
- ✅ Annotate patterns
- ✅ Bug fixes for crashes/data loss only

---

## 5. Exit Criteria

Choose exactly one outcome based on evidence:

### Green: Proceed to Content Fill

**Condition**: No systemic friction detected

- Tier 2/3 abandon rates < 20%
- No repeated confusion patterns
- Movement feels responsive (no latency complaints)
- Receipt flow stable (< 1% failure rate)

**Action**: Begin content development phase

### Yellow: Single Targeted Fix

**Condition**: One clear, repeated friction point identified

- Single specific component causing > 50% of friction
- Clear remediation path (< 1 day implementation)
- No architectural changes required

**Action**:
1. Implement single fix
2. Re-observe with same cohort
3. Evaluate again

### Red: Pause and Reassess

**Condition**: Structural confusion or multiple friction points

- Multiple unrelated friction sources
- Architectural issue (receipts, chronicle, confirmation flow)
- > 30% abandon rate on Tier 2/3
- User complaints about core mechanics

**Action**:
1. Document all evidence
2. Pause public shipping
3. Architectural review required

---

## 6. Evidence Collection Locations

### Server Side

```text
apps/server/audit/receipts.jsonl    # All receipts (canonical append-only chain)
apps/server/data/akalynth.db        # SQLite projection of persisted state
```

> Paths shown are the defaults when the server is launched from `apps/server/` (the runbook convention). They can be overridden via `AKALYNTH_RECEIPT_CHAIN_PATH` and `AKALYNTH_DB_PATH`. See `packages/shared/paths.ts` (`resolveChainPaths`).

### Client Side (Android)

```
ChronicleStore                      # Event chronicle
GameStore                           # Game state snapshots
ExplanationEngine                   # Explanation requests
```

### Logging Points to Add (if not present)

| Component | Event | Data |
|-----------|-------|------|
| `Tier2HoldButton` | `onCancel` | timestamp, progress_at_cancel |
| `Tier2HoldButton` | `onConfirm` | timestamp, hold_duration |
| `Tier3SlideConfirm` | snap_back | timestamp, progress_at_release |
| `Tier3SlideConfirm` | `onConfirm` | timestamp |
| `DPad` | press | timestamp, direction |
| `DPad` | release | timestamp, direction, hold_duration |
| `ExplanationEngine` | explain | timestamp, subject_type, rule_ids |

---

## 7. Observation Window Duration

**Recommended**: 7 days minimum

- Days 1-2: Initial friction discovery
- Days 3-5: Pattern confirmation
- Days 6-7: Edge case collection

**End condition**: Sufficient evidence to choose Green/Yellow/Red

---

## 8. Post-Window Protocol

When observation ends:

1. **Aggregate all metrics** into single report
2. **Categorize friction** by component and severity
3. **Determine exit color** based on criteria above
4. **Document decision** with evidence citations
5. **Proceed** with exactly one action (or none if Green)

---

**Remember**: Bring data, not opinions. The evidence determines the move.
