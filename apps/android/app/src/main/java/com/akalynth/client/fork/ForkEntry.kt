package com.akalynth.client.fork

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.EventSource
import com.akalynth.client.chronicle.EventStatus
import com.akalynth.client.explain.Explanation
import com.akalynth.client.snapshot.SnapshotEvidence
import com.akalynth.client.snapshot.SnapshotV0
import com.akalynth.client.snapshot.diff.SnapshotDiff
import com.akalynth.client.timeline.TimelineCursor

/**
 * An entry in a forked timeline.
 *
 * Similar to TimelineEntry but explicitly marked as non-authoritative.
 * Fork entries can be:
 * - Inherited from authoritative timeline (before branch point)
 * - Simulated/projected (after branch point)
 *
 * @property sequence Position in fork (matches authoritative before branch)
 * @property cursor Fork cursor
 * @property event Event (may be simulated)
 * @property prevSnapshot Previous snapshot (simulated after branch)
 * @property snapshot Current snapshot (simulated after branch)
 * @property snapshotEvidence Evidence (simulated after branch)
 * @property snapshotDiff Diff (computed)
 * @property explanation Explanation (simulated after branch)
 * @property origin Whether this entry is inherited or simulated
 */
data class ForkEntry(
    val sequence: Long,
    val cursor: TimelineCursor,
    val event: ChronicleEvent? = null,
    val prevSnapshot: SnapshotV0? = null,
    val snapshot: SnapshotV0? = null,
    val snapshotEvidence: SnapshotEvidence? = null,
    val snapshotDiff: SnapshotDiff? = null,
    val explanation: Explanation? = null,
    val origin: ForkEntryOrigin
) {
    /**
     * True if this entry is inherited from authoritative timeline.
     */
    val isInherited: Boolean get() = origin == ForkEntryOrigin.INHERITED

    /**
     * True if this entry is simulated (diverged from authoritative).
     */
    val isSimulated: Boolean get() = origin == ForkEntryOrigin.SIMULATED

    /**
     * True if this entry has an event.
     */
    val hasEvent: Boolean get() = event != null

    /**
     * True if this entry has a diff.
     */
    val hasDiff: Boolean get() = snapshotDiff != null && snapshotDiff.hasChanges

    /**
     * Event ID if present.
     */
    val eventId: String? get() = event?.eventId

    companion object {
        /**
         * Create inherited entry from authoritative timeline.
         */
        fun inherited(
            sequence: Long,
            cursor: TimelineCursor,
            event: ChronicleEvent? = null,
            prevSnapshot: SnapshotV0? = null,
            snapshot: SnapshotV0? = null,
            snapshotEvidence: SnapshotEvidence? = null,
            snapshotDiff: SnapshotDiff? = null,
            explanation: Explanation? = null
        ) = ForkEntry(
            sequence = sequence,
            cursor = cursor,
            event = event,
            prevSnapshot = prevSnapshot,
            snapshot = snapshot,
            snapshotEvidence = snapshotEvidence,
            snapshotDiff = snapshotDiff,
            explanation = explanation,
            origin = ForkEntryOrigin.INHERITED
        )

        /**
         * Create simulated entry for fork.
         */
        fun simulated(
            sequence: Long,
            event: ChronicleEvent,
            prevSnapshot: SnapshotV0? = null,
            snapshot: SnapshotV0? = null,
            snapshotEvidence: SnapshotEvidence? = null,
            snapshotDiff: SnapshotDiff? = null,
            explanation: Explanation? = null
        ) = ForkEntry(
            sequence = sequence,
            cursor = TimelineCursor(
                sequence = sequence,
                eventId = event.eventId,
                actionId = event.actionId
            ),
            event = event.copy(
                status = EventStatus.PENDING, // Simulated events are never confirmed
                source = EventSource.CLIENT_INTENT // Always client-side simulation
            ),
            prevSnapshot = prevSnapshot,
            snapshot = snapshot,
            snapshotEvidence = snapshotEvidence,
            snapshotDiff = snapshotDiff,
            explanation = explanation,
            origin = ForkEntryOrigin.SIMULATED
        )
    }
}

/**
 * Origin of a fork entry.
 */
enum class ForkEntryOrigin {
    /** Inherited from authoritative timeline (before branch) */
    INHERITED,

    /** Simulated in fork (after branch) */
    SIMULATED
}
