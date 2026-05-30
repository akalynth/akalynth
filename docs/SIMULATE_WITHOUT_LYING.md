# Simulate Without Lying

This document describes the **Fork/Replay** system — a mechanism for exploring counterfactual scenarios ("what if?") while maintaining absolute separation from authoritative truth.

## The Problem

Users want to answer questions like:
- "What would have happened if I hadn't entered that zone?"
- "How many items would I have if I'd survived?"
- "What if the combat had gone differently?"

But simulation is dangerous. If not carefully isolated, imagined outcomes can:
- Contaminate the ledger
- Create false memories
- Generate "proof" of things that never happened
- Undermine trust in the entire system

## The Solution

**Forks are explicitly non-authoritative branches.**

They:
- Branch from proven history
- Never claim to be real
- Never contaminate the authoritative timeline
- Are clearly labeled at every level

This is what it means to "simulate without lying."

## Architecture

```text
Authoritative Timeline
  │
  ├── seq 1: CONFIRMED (inherited)
  ├── seq 2: CONFIRMED (inherited)
  ├── seq 3: CONFIRMED (inherited) ◀── Branch Point
  │
  └── Fork "What if I survived?"
        ├── seq 1: INHERITED
        ├── seq 2: INHERITED
        ├── seq 3: INHERITED (branch point)
        ├── seq 4: SIMULATED ← "sim_fork_123_4"
        └── seq 5: SIMULATED ← "sim_fork_123_5"
```

## The Five Isolation Invariants

These invariants are **enforced in code** by `ForkIsolation`:

### 1. Simulated Events Are Never Confirmed

```kotlin
// VIOLATION - will throw ForkIsolationViolation
ForkEntry.simulated(
    event = ChronicleEvent(
        status = EventStatus.CONFIRMED  // ❌ NEVER
    )
)
```

Simulated events always have `PENDING` status. There is no path to confirmation.

### 2. Simulated Events Always Have Client Source

```kotlin
// VIOLATION - will throw ForkIsolationViolation
ForkEntry.simulated(
    event = ChronicleEvent(
        source = EventSource.SERVER_RECEIPT  // ❌ NEVER
    )
)
```

Simulated events always have `CLIENT_INTENT` source. They never claim server authority.

### 3. Simulated Event IDs Always Start With "sim_"

```kotlin
// VIOLATION - will throw ForkIsolationViolation
ForkEntry.simulated(
    event = ChronicleEvent(
        eventId = "evt_123"  // ❌ Must be "sim_*"
    )
)
```

The ID prefix makes simulation obvious at a glance, in logs, in exports.

### 4. Simulated Explanations Always Contain "[SIMULATED]"

```kotlin
// VIOLATION - will throw ForkIsolationViolation
ForkEntry.simulated(
    explanation = Explanation(
        reason = "Death by Goblin"  // ❌ Missing marker
    )
)

// Correct
ForkEntry.simulated(
    explanation = Explanation(
        reason = "[SIMULATED] Death by Goblin"  // ✓
    )
)
```

Explanations for simulated events are clearly labeled.

### 5. Inherited Entries Precede Simulated Entries

```kotlin
// VIOLATION - interleaving is forbidden
fork.entries = [
    seq 1: INHERITED,
    seq 2: SIMULATED,
    seq 3: INHERITED,  // ❌ Can't go back to inherited
    seq 4: SIMULATED
]
```

A fork is: inherited history, then simulated divergence. Never interleaved.

## Components

### ForkPoint

Where the fork branches from the authoritative timeline.

```kotlin
data class ForkPoint(
    val sequence: Long,         // Branch sequence
    val eventId: String?,       // Event at branch (if any)
    val stateHash: String?,     // State hash at branch
    val timestamp: Long         // When fork was created
)
```

### ForkMetadata

Provenance and classification.

```kotlin
data class ForkMetadata(
    val forkId: String,         // Unique ID (fork_*)
    val label: String,          // Human label
    val createdAtMs: Long,      // Creation time
    val createdBy: String,      // Who created it
    val purpose: ForkPurpose,   // Why it exists
    val description: String?    // Optional details
)

enum class ForkPurpose {
    WHAT_IF,    // "What would happen if..."
    DEBUG,      // Developer debugging
    TRAINING,   // Learning scenarios
    DEMO        // Demonstration
}
```

### ForkEntry

An entry in a forked timeline, with explicit origin.

```kotlin
data class ForkEntry(
    val sequence: Long,
    val cursor: TimelineCursor,
    val event: ChronicleEvent?,
    val explanation: Explanation?,
    // ... snapshots, diffs
    val origin: ForkEntryOrigin  // INHERITED or SIMULATED
)
```

### ForkTimeline

The immutable fork container.

```kotlin
class ForkTimeline(
    val metadata: ForkMetadata,
    val branchPoint: ForkPoint,
    val entries: TreeMap<Long, ForkEntry>
) {
    val hasDiverged: Boolean  // True if fork has simulated entries
    val inheritedCount: Int   // Entries from authoritative
    val simulatedCount: Int   // Entries created in fork

    fun appendSimulated(entry: ForkEntry): ForkTimeline  // Returns NEW fork
    fun resetToBase(): ForkTimeline  // Clear simulated, keep inherited
}
```

### ReplayScrubber

Navigate and mutate forks.

```kotlin
class ReplayScrubber(
    val fork: ForkTimeline,
    private var currentSequence: Long
) {
    // Navigation
    fun next(): ForkEntry?
    fun prev(): ForkEntry?
    fun goToBranchPoint(): ForkEntry?

    // Simulation (returns NEW scrubber with NEW fork)
    fun simulateEvent(...): ReplayScrubber
    fun simulateDeath(...): ReplayScrubber
    fun simulateItemPickup(...): ReplayScrubber
    fun simulateZoneTransition(...): ReplayScrubber

    // Control
    fun resetToBase(): ReplayScrubber
    fun trimToCurrent(): ReplayScrubber
}
```

## Usage

### Creating a Fork

```kotlin
// From a timeline debugger
val fork = ForkBuilder.forkAt(
    debugger = timeTravelDebugger,
    cursor = TimelineCursor.atSequence(100),
    label = "What if I survived?",
    createdBy = "player_123",
    purpose = ForkPurpose.WHAT_IF
)

// From a timeline index
val fork = ForkBuilder.forkAtSequence(
    index = timelineIndex,
    sequence = 100,
    label = "Debug scenario",
    createdBy = "developer"
)
```

### Simulating Events

```kotlin
var scrubber = ReplayScrubber.from(fork)

// Simulate survival instead of death
scrubber = scrubber.simulateEvent(
    kind = ChronicleEventKind.ZONE_ENTER,
    reason = "Escaped to safety",
    ruleIds = listOf("ZONE_ENTER_POLICY")
)

// Simulate picking up a reward
scrubber = scrubber.simulateItemPickup(
    itemId = "gold_1000",
    itemName = "1000 Gold",
    ruleIds = listOf("PICKUP_POLICY")
)
```

### Comparing Outcomes

```kotlin
val comparison = ForkComparison.compare(
    fork = scrubber.fork,
    baseline = authoritativeIndex
)

println(comparison.toSummary())
// Fork Comparison: fork_123
// ─────────────────────────────────────
// Baseline events: 150
// Fork events:     152 (+2)
// Divergence at:   sequence 100
// Status:          DIVERGED
//
// Outcome differs:
// + gold: 1000 (gained)
// + sword_1: kept (not lost)
```

### Resetting

```kotlin
// Clear all simulations, return to branch point
scrubber = scrubber.resetToBase()
assert(!scrubber.hasDiverged)
```

## Immutability

All fork operations return **new instances**:

```kotlin
val fork1 = createFork()
val fork2 = fork1.appendSimulated(entry)

// fork1 is unchanged
assert(fork1.size == originalSize)
// fork2 has the new entry
assert(fork2.size == originalSize + 1)
```

This prevents accidental mutation and enables safe exploration.

## Integration with Proof Bundles

Forks can emit their own proof bundles:

```kotlin
val simulatedBundle = ProofBundleBuilder.fromTimelineEntry(
    entry = forkEntry.toTimelineEntry(),
    playerId = playerId,
    label = "Simulated outcome"
)
```

The bundle will:
- Have simulated event IDs (`sim_*`)
- Have `[SIMULATED]` in explanations
- Be clearly distinguishable from authoritative bundles

## What This Enables

### "What if?" UI

```text
[Player Death Screen]
You died to Goblin and lost:
- Iron Sword
- Leather Shield

[What if I had survived?]
  → Shows fork with items retained
  → "You would have 2 more items"
```

### Debug Scenarios

```kotlin
// Developer creates test scenario
var debug = ReplayScrubber.from(fork)
debug = debug.simulateDeath(killer = "Dragon", items = listOf("all"))
debug = debug.simulateItemPickup(item = "respawn_kit")
// Observe behavior, never affects real players
```

### Training Mode

```kotlin
// New player practices without consequences
val training = ForkBuilder.forkAt(
    debugger = liveTimeline,
    cursor = currentCursor,
    label = "Training session",
    purpose = ForkPurpose.TRAINING
)
// All actions are simulated, nothing persists
```

## The Guarantee

When you see:
- `origin = SIMULATED`
- `eventId = "sim_*"`
- `status = PENDING`
- `source = CLIENT_INTENT`
- `reason = "[SIMULATED] ..."`

You know with certainty: **this is imagination, not history.**

The authoritative timeline remains untouched.

## Summary

Simulate Without Lying means:
1. Fork from proven history
2. Explore alternate outcomes
3. Keep everything explicitly labeled
4. Never contaminate the ledger
5. Let imagination and truth coexist

The fork is a sandbox. The ledger is the law.
