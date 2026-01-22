package com.akalynth.client.timeline

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.Receipt
import com.akalynth.client.explain.Explanation
import com.akalynth.client.snapshot.SnapshotEvidence
import com.akalynth.client.snapshot.SnapshotEvidenceAdapter
import com.akalynth.client.snapshot.SnapshotV0
import java.util.NavigableMap
import java.util.TreeMap

/**
 * Read-only timeline index built from existing stores.
 *
 * Provides efficient lookups by:
 * - Sequence number (primary spine)
 * - Event ID
 * - Action ID
 *
 * The index is immutable once built. To update, create a new index.
 *
 * @property bySequence Entries ordered by sequence (NavigableMap for efficient range queries)
 * @property byEventId Map from eventId to sequence
 * @property byActionId Map from actionId to sequence
 * @property minSequence Minimum sequence in index (or null if empty)
 * @property maxSequence Maximum sequence in index (or null if empty)
 */
data class TimelineIndex(
    val bySequence: NavigableMap<Long, TimelineEntry>,
    val byEventId: Map<String, Long>,
    val byActionId: Map<String, Long>,
    val minSequence: Long?,
    val maxSequence: Long?
) {
    /**
     * Get entry at a specific sequence.
     */
    fun getAtSequence(seq: Long): TimelineEntry? = bySequence[seq]

    /**
     * Get sequence for an event ID.
     */
    fun getSequenceForEvent(eventId: String): Long? = byEventId[eventId]

    /**
     * Get sequence for an action ID.
     */
    fun getSequenceForAction(actionId: String): Long? = byActionId[actionId]

    /**
     * Get entry by event ID.
     */
    fun getByEventId(eventId: String): TimelineEntry? {
        val seq = byEventId[eventId] ?: return null
        return bySequence[seq]
    }

    /**
     * Get entry by action ID.
     */
    fun getByActionId(actionId: String): TimelineEntry? {
        val seq = byActionId[actionId] ?: return null
        return bySequence[seq]
    }

    /**
     * Get the next sequence after the given one.
     */
    fun nextSequence(seq: Long): Long? = bySequence.higherKey(seq)

    /**
     * Get the previous sequence before the given one.
     */
    fun prevSequence(seq: Long): Long? = bySequence.lowerKey(seq)

    /**
     * Get the first entry.
     */
    fun first(): TimelineEntry? = minSequence?.let { bySequence[it] }

    /**
     * Get the last entry.
     */
    fun last(): TimelineEntry? = maxSequence?.let { bySequence[it] }

    /**
     * Total number of entries.
     */
    val size: Int get() = bySequence.size

    /**
     * True if index is empty.
     */
    val isEmpty: Boolean get() = bySequence.isEmpty()

    companion object {
        /**
         * Empty index.
         */
        val EMPTY = TimelineIndex(
            bySequence = TreeMap(),
            byEventId = emptyMap(),
            byActionId = emptyMap(),
            minSequence = null,
            maxSequence = null
        )

        /**
         * Build index from events.
         *
         * Uses timestamp as sequence (events sorted chronologically).
         *
         * @param events List of chronicle events
         * @param receipts Optional receipts to align (by receiptId)
         * @param snapshots Optional snapshots to align (by sequence)
         * @param explanations Optional explanations to align (by subjectId)
         */
        fun build(
            events: List<ChronicleEvent>,
            receipts: Map<String, Receipt> = emptyMap(),
            snapshots: Map<Long, SnapshotV0> = emptyMap(),
            explanations: Map<String, Explanation> = emptyMap()
        ): TimelineIndex {
            if (events.isEmpty()) return EMPTY

            val bySequence = TreeMap<Long, TimelineEntry>()
            val byEventId = mutableMapOf<String, Long>()
            val byActionId = mutableMapOf<String, Long>()

            // Sort events by timestamp (oldest first for chronological sequence)
            val sortedEvents = events.sortedBy { it.timestampMs }

            // Assign sequence numbers (1-indexed) based on chronological order
            sortedEvents.forEachIndexed { index, event ->
                val sequence = (index + 1).toLong()

                // Find aligned receipt
                val receipt = event.actionId?.let { receipts[it] }
                    ?: receipts[event.eventId]

                // Find aligned snapshots (use sequence if available, else timestamp)
                val snapshot = snapshots[sequence]
                val prevSnapshot = if (sequence > 1) snapshots[sequence - 1] else null

                // Build snapshot evidence if we have snapshots
                val snapshotEvidence = if (snapshot != null || prevSnapshot != null) {
                    SnapshotEvidenceAdapter.build(prevSnapshot, snapshot)
                } else null

                // Find aligned explanation (by eventId or actionId)
                val explanation = explanations[event.eventId]
                    ?: event.actionId?.let { explanations[it] }

                val cursor = TimelineCursor(
                    sequence = sequence,
                    eventId = event.eventId,
                    actionId = event.actionId
                )

                val entry = TimelineEntry(
                    sequence = sequence,
                    cursor = cursor,
                    event = event,
                    receipt = receipt,
                    prevSnapshot = prevSnapshot,
                    snapshot = snapshot,
                    snapshotEvidence = snapshotEvidence,
                    explanation = explanation
                )

                bySequence[sequence] = entry
                byEventId[event.eventId] = sequence
                event.actionId?.let { byActionId[it] = sequence }
            }

            return TimelineIndex(
                bySequence = bySequence,
                byEventId = byEventId.toMap(),
                byActionId = byActionId.toMap(),
                minSequence = bySequence.firstKey(),
                maxSequence = bySequence.lastKey()
            )
        }

        /**
         * Build index from events only (minimal).
         */
        fun fromEvents(events: List<ChronicleEvent>): TimelineIndex {
            return build(events)
        }
    }
}
