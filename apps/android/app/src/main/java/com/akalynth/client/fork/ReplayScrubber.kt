package com.akalynth.client.fork

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.ChronicleEventKind
import com.akalynth.client.chronicle.EventSource
import com.akalynth.client.chronicle.EventStatus
import com.akalynth.client.explain.ExplainDecision
import com.akalynth.client.explain.Explanation
import com.akalynth.client.snapshot.SnapshotEvidence
import com.akalynth.client.snapshot.SnapshotEvidenceAdapter
import com.akalynth.client.snapshot.SnapshotV0
import com.akalynth.client.snapshot.diff.SnapshotDiff
import com.akalynth.client.snapshot.diff.SnapshotDiffAdapter

/**
 * Replay scrubber for navigating and mutating forks.
 *
 * The scrubber provides:
 * - Navigation through fork entries
 * - "What-if" simulation (append simulated entries)
 * - Reset to branch point
 * - Comparison to baseline
 *
 * INVARIANT: All mutations return NEW instances (immutable).
 * INVARIANT: Simulated events are NEVER confirmed.
 *
 * @property fork The current fork state
 * @property currentSequence Current position in the fork
 */
class ReplayScrubber private constructor(
    val fork: ForkTimeline,
    private var currentSequence: Long
) {
    /**
     * Current entry in the fork.
     */
    fun current(): ForkEntry? = fork.getAtSequence(currentSequence)

    /**
     * Current cursor position.
     */
    fun cursor(): Long = currentSequence

    /**
     * Fork ID.
     */
    val forkId: String get() = fork.forkId

    /**
     * Fork label.
     */
    val label: String get() = fork.label

    /**
     * True if at branch point.
     */
    val isAtBranchPoint: Boolean get() = currentSequence == fork.branchSequence

    /**
     * True if past branch point (in simulated territory).
     */
    val isPastBranch: Boolean get() = currentSequence > fork.branchSequence

    /**
     * True if fork has diverged.
     */
    val hasDiverged: Boolean get() = fork.hasDiverged

    // =========================================================================
    // Navigation
    // =========================================================================

    /**
     * Go to a specific sequence.
     */
    fun goToSequence(seq: Long): ForkEntry? {
        val entry = fork.getAtSequence(seq)
        if (entry != null) {
            currentSequence = seq
        }
        return entry
    }

    /**
     * Go to next entry.
     */
    fun next(): ForkEntry? {
        val nextEntry = fork.nextAfter(currentSequence)
        if (nextEntry != null) {
            currentSequence = nextEntry.sequence
        }
        return nextEntry
    }

    /**
     * Go to previous entry.
     */
    fun prev(): ForkEntry? {
        val prevEntry = fork.prevBefore(currentSequence)
        if (prevEntry != null) {
            currentSequence = prevEntry.sequence
        }
        return prevEntry
    }

    /**
     * Go to branch point.
     */
    fun goToBranchPoint(): ForkEntry? = goToSequence(fork.branchSequence)

    /**
     * Go to start of fork.
     */
    fun goToStart(): ForkEntry? {
        val first = fork.first()
        if (first != null) {
            currentSequence = first.sequence
        }
        return first
    }

    /**
     * Go to end of fork.
     */
    fun goToEnd(): ForkEntry? {
        val last = fork.last()
        if (last != null) {
            currentSequence = last.sequence
        }
        return last
    }

    /**
     * Check if there's a next entry.
     */
    fun hasNext(): Boolean = fork.nextAfter(currentSequence) != null

    /**
     * Check if there's a previous entry.
     */
    fun hasPrev(): Boolean = fork.prevBefore(currentSequence) != null

    // =========================================================================
    // What-if simulation
    // =========================================================================

    /**
     * Simulate an event and get a new scrubber with the result.
     *
     * This creates a simulated entry and returns a NEW scrubber
     * positioned at the simulated entry.
     *
     * @param kind Event kind to simulate
     * @param details Event details
     * @param reason Explanation reason
     * @param ruleIds Rules that apply
     * @param snapshot Optional resulting snapshot
     */
    fun simulateEvent(
        kind: ChronicleEventKind,
        details: Map<String, Any?> = emptyMap(),
        reason: String,
        ruleIds: List<String>,
        snapshot: SnapshotV0? = null,
        zone: String? = current()?.event?.zone,
        x: Int? = current()?.event?.x,
        y: Int? = current()?.event?.y
    ): ReplayScrubber {
        val nextSeq = (fork.maxSequence ?: 0) + 1
        val timestampMs = System.currentTimeMillis()

        // Create simulated event
        val event = ChronicleEvent(
            eventId = "sim_${fork.forkId}_$nextSeq",
            actionId = "sim_action_$nextSeq",
            kind = kind,
            timestampMs = timestampMs,
            zone = zone,
            x = x,
            y = y,
            details = details,
            status = EventStatus.PENDING, // Never confirmed
            source = EventSource.CLIENT_INTENT // Always client-side
        )

        // Create explanation
        val explanation = Explanation(
            explanationId = "sim_exp_$nextSeq",
            subjectId = event.eventId,
            decision = ExplainDecision.PENDING, // Never confirmed
            ruleIds = ruleIds,
            reason = "[SIMULATED] $reason",
            timestampMs = timestampMs
        )

        // Build snapshot evidence if we have snapshots
        val prevSnapshot = current()?.snapshot
        val evidence = if (prevSnapshot != null || snapshot != null) {
            SnapshotEvidenceAdapter.build(prevSnapshot, snapshot)
        } else null

        // Compute diff
        val diff = if (prevSnapshot != null || snapshot != null) {
            SnapshotDiffAdapter.diff(prevSnapshot, snapshot)
        } else null

        // Create fork entry
        val entry = ForkEntry.simulated(
            sequence = nextSeq,
            event = event,
            prevSnapshot = prevSnapshot,
            snapshot = snapshot,
            snapshotEvidence = evidence,
            snapshotDiff = diff,
            explanation = explanation
        )

        // Append to fork and return new scrubber
        val newFork = fork.appendSimulated(entry)
        return ReplayScrubber(newFork, nextSeq)
    }

    /**
     * Simulate a death event with items lost.
     */
    fun simulateDeath(
        killerName: String,
        itemsLost: List<String>,
        ruleIds: List<String> = listOf("DEATH_DROP_POLICY"),
        resultingSnapshot: SnapshotV0? = null
    ): ReplayScrubber = simulateEvent(
        kind = ChronicleEventKind.DEATH,
        details = mapOf(
            "killer_name" to killerName,
            "items_lost" to itemsLost,
            "simulated" to true
        ),
        reason = "Simulated death by $killerName",
        ruleIds = ruleIds,
        snapshot = resultingSnapshot
    )

    /**
     * Simulate an item pickup.
     */
    fun simulateItemPickup(
        itemId: String,
        itemName: String,
        ruleIds: List<String> = listOf("ITEM_PICKUP_POLICY"),
        resultingSnapshot: SnapshotV0? = null
    ): ReplayScrubber = simulateEvent(
        kind = ChronicleEventKind.ITEM_PICKUP,
        details = mapOf(
            "item_id" to itemId,
            "item_name" to itemName,
            "simulated" to true
        ),
        reason = "Simulated pickup of $itemName",
        ruleIds = ruleIds,
        snapshot = resultingSnapshot
    )

    /**
     * Simulate a zone transition.
     */
    fun simulateZoneTransition(
        toZone: String,
        ruleIds: List<String> = listOf("ZONE_ENTER_POLICY"),
        resultingSnapshot: SnapshotV0? = null
    ): ReplayScrubber {
        val fromZone = current()?.event?.zone
        return simulateEvent(
            kind = ChronicleEventKind.ZONE_ENTER,
            details = mapOf(
                "from_zone" to fromZone,
                "to_zone" to toZone,
                "simulated" to true
            ),
            reason = "Simulated zone transition to $toZone",
            ruleIds = ruleIds,
            snapshot = resultingSnapshot,
            zone = toZone
        )
    }

    // =========================================================================
    // Fork control
    // =========================================================================

    /**
     * Reset fork to branch point (clear all simulated entries).
     */
    fun resetToBase(): ReplayScrubber {
        val resetFork = fork.resetToBase()
        return ReplayScrubber(resetFork, fork.branchSequence)
    }

    /**
     * Trim fork to current position (remove everything after).
     */
    fun trimToCurrent(): ReplayScrubber {
        val trimmedFork = fork.trimToSequence(currentSequence)
        return ReplayScrubber(trimmedFork, currentSequence)
    }

    /**
     * Get a copy of this scrubber (for branching explorations).
     */
    fun copy(): ReplayScrubber = ReplayScrubber(fork, currentSequence)

    companion object {
        /**
         * Create scrubber from a fork, positioned at branch point.
         */
        fun from(fork: ForkTimeline): ReplayScrubber =
            ReplayScrubber(fork, fork.branchSequence)

        /**
         * Create scrubber from a fork, positioned at end.
         */
        fun atEnd(fork: ForkTimeline): ReplayScrubber =
            ReplayScrubber(fork, fork.maxSequence ?: fork.branchSequence)

        /**
         * Create scrubber from a fork at specific sequence.
         */
        fun at(fork: ForkTimeline, sequence: Long): ReplayScrubber =
            ReplayScrubber(fork, sequence)
    }
}
