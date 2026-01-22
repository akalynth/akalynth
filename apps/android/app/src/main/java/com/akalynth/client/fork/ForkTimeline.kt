package com.akalynth.client.fork

import com.akalynth.client.timeline.TimelineEntry
import java.util.NavigableMap
import java.util.TreeMap

/**
 * A forked timeline branching from authoritative history.
 *
 * INVARIANT: Forks are **explicitly non-authoritative**.
 * They cannot:
 * - Claim to be confirmed
 * - Contaminate the authoritative timeline
 * - Generate real receipts
 *
 * Forks can:
 * - Explore "what-if" scenarios
 * - Test rule variants
 * - Compare outcomes to baseline
 *
 * @property metadata Fork provenance and labeling
 * @property branchPoint Where this fork diverges from authoritative
 * @property entries All entries in the fork (inherited + simulated)
 * @property inheritedCount Number of entries inherited from authoritative
 * @property simulatedCount Number of entries simulated in fork
 */
data class ForkTimeline(
    val metadata: ForkMetadata,
    val branchPoint: ForkPoint,
    private val entries: NavigableMap<Long, ForkEntry>
) {
    /**
     * Fork ID.
     */
    val forkId: String get() = metadata.forkId

    /**
     * Human label.
     */
    val label: String get() = metadata.label

    /**
     * Sequence where fork branches from authoritative.
     */
    val branchSequence: Long get() = branchPoint.sequence

    /**
     * State hash at branch point.
     */
    val branchStateHash: String? get() = branchPoint.stateHash

    /**
     * Number of inherited entries.
     */
    val inheritedCount: Int get() = entries.values.count { it.isInherited }

    /**
     * Number of simulated entries.
     */
    val simulatedCount: Int get() = entries.values.count { it.isSimulated }

    /**
     * Total entries in fork.
     */
    val size: Int get() = entries.size

    /**
     * Minimum sequence in fork.
     */
    val minSequence: Long? get() = entries.firstEntry()?.key

    /**
     * Maximum sequence in fork.
     */
    val maxSequence: Long? get() = entries.lastEntry()?.key

    /**
     * True if fork has diverged (has simulated entries).
     */
    val hasDiverged: Boolean get() = simulatedCount > 0

    // =========================================================================
    // Navigation
    // =========================================================================

    /**
     * Get entry at sequence.
     */
    fun getAtSequence(seq: Long): ForkEntry? = entries[seq]

    /**
     * Get all entries in sequence order.
     */
    fun allEntries(): List<ForkEntry> = entries.values.toList()

    /**
     * Get inherited entries only.
     */
    fun inheritedEntries(): List<ForkEntry> =
        entries.values.filter { it.isInherited }

    /**
     * Get simulated entries only.
     */
    fun simulatedEntries(): List<ForkEntry> =
        entries.values.filter { it.isSimulated }

    /**
     * Get entry by event ID.
     */
    fun getByEventId(eventId: String): ForkEntry? =
        entries.values.find { it.eventId == eventId }

    /**
     * Get next entry after sequence.
     */
    fun nextAfter(seq: Long): ForkEntry? =
        entries.higherEntry(seq)?.value

    /**
     * Get previous entry before sequence.
     */
    fun prevBefore(seq: Long): ForkEntry? =
        entries.lowerEntry(seq)?.value

    /**
     * Get first entry.
     */
    fun first(): ForkEntry? = entries.firstEntry()?.value

    /**
     * Get last entry.
     */
    fun last(): ForkEntry? = entries.lastEntry()?.value

    // =========================================================================
    // Fork mutation (returns new fork)
    // =========================================================================

    /**
     * Append a simulated entry to the fork.
     *
     * Returns a NEW ForkTimeline (immutable).
     */
    fun appendSimulated(entry: ForkEntry): ForkTimeline {
        require(entry.isSimulated) { "Can only append simulated entries" }
        require(entry.sequence > (maxSequence ?: 0)) {
            "Simulated entry must have higher sequence than current max"
        }

        val newEntries = TreeMap(entries)
        newEntries[entry.sequence] = entry

        return copy(entries = newEntries)
    }

    /**
     * Clear all simulated entries (reset to branch point).
     */
    fun resetToBase(): ForkTimeline {
        val inheritedOnly = TreeMap<Long, ForkEntry>()
        entries.forEach { (seq, entry) ->
            if (entry.isInherited) {
                inheritedOnly[seq] = entry
            }
        }
        return copy(entries = inheritedOnly)
    }

    /**
     * Trim fork to a specific sequence (remove everything after).
     */
    fun trimToSequence(seq: Long): ForkTimeline {
        val trimmed = TreeMap(entries.headMap(seq, true))
        return copy(entries = trimmed)
    }

    companion object {
        /**
         * Create empty fork (for testing).
         */
        fun empty(metadata: ForkMetadata, branchPoint: ForkPoint) = ForkTimeline(
            metadata = metadata,
            branchPoint = branchPoint,
            entries = TreeMap()
        )
    }
}
