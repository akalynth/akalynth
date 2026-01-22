package com.akalynth.client.timeline

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.Receipt
import com.akalynth.client.explain.Explanation
import com.akalynth.client.snapshot.SnapshotEvidence
import com.akalynth.client.snapshot.SnapshotV0

/**
 * Aligned data at a point in the timeline.
 *
 * Represents the full picture at a given sequence:
 * - What was attempted? (intent via actionId)
 * - What happened? (receipt)
 * - What's in the ledger? (event)
 * - What state resulted? (snapshot)
 * - Why did it happen? (explanation)
 *
 * Not all fields are always present. Missing data is represented as null.
 *
 * @property sequence Primary ordering key
 * @property cursor The selection that produced this entry
 * @property event The chronicle event at this point (if any)
 * @property receipt The receipt that caused this event (if any)
 * @property prevSnapshot Snapshot before this event (if tracked)
 * @property snapshot Snapshot after this event (if tracked)
 * @property snapshotEvidence Structured evidence from snapshot transition
 * @property explanation Explanation for this event (if generated)
 */
data class TimelineEntry(
    val sequence: Long,
    val cursor: TimelineCursor,
    val event: ChronicleEvent? = null,
    val receipt: Receipt? = null,
    val prevSnapshot: SnapshotV0? = null,
    val snapshot: SnapshotV0? = null,
    val snapshotEvidence: SnapshotEvidence? = null,
    val explanation: Explanation? = null
) {
    /**
     * True if this entry has an event.
     */
    val hasEvent: Boolean get() = event != null

    /**
     * True if this entry has a receipt.
     */
    val hasReceipt: Boolean get() = receipt != null

    /**
     * True if this entry has snapshot data.
     */
    val hasSnapshot: Boolean get() = snapshot != null

    /**
     * True if this entry has both prev and current snapshots (transition).
     */
    val hasTransition: Boolean get() = prevSnapshot != null && snapshot != null

    /**
     * True if this entry has an explanation.
     */
    val hasExplanation: Boolean get() = explanation != null

    /**
     * Get the event ID if present.
     */
    val eventId: String? get() = event?.eventId

    /**
     * Get the action ID if present (from event or receipt).
     */
    val actionId: String? get() = event?.actionId ?: receipt?.actionId

    /**
     * True if this entry represents an empty point (no data).
     */
    val isEmpty: Boolean get() = event == null && receipt == null && snapshot == null

    companion object {
        /**
         * Create an empty entry at a sequence.
         */
        fun empty(sequence: Long) = TimelineEntry(
            sequence = sequence,
            cursor = TimelineCursor.atSequence(sequence)
        )

        /**
         * Create entry from just an event.
         */
        fun fromEvent(event: ChronicleEvent, sequence: Long) = TimelineEntry(
            sequence = sequence,
            cursor = TimelineCursor(
                sequence = sequence,
                eventId = event.eventId,
                actionId = event.actionId
            ),
            event = event
        )
    }
}
