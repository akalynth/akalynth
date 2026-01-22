package com.akalynth.client.fork

import com.akalynth.client.timeline.TimelineCursor
import com.akalynth.client.timeline.TimelineEntry

/**
 * A point where a fork branches from the authoritative timeline.
 *
 * The fork point captures the exact state at branching:
 * - The cursor (sequence/event/action)
 * - The entry data at that point
 * - The state hash at branching (for integrity)
 *
 * @property cursor The timeline cursor where fork branches
 * @property entry The full entry data at the branch point (immutable copy)
 * @property stateHash The state hash at branching (integrity marker)
 * @property branchedAtMs When this fork was created
 */
data class ForkPoint(
    val cursor: TimelineCursor,
    val entry: TimelineEntry,
    val stateHash: String?,
    val branchedAtMs: Long
) {
    /**
     * Sequence number at branch point.
     */
    val sequence: Long get() = cursor.sequence

    /**
     * Event ID at branch point (if any).
     */
    val eventId: String? get() = cursor.eventId

    /**
     * Action ID at branch point (if any).
     */
    val actionId: String? get() = cursor.actionId

    companion object {
        /**
         * Create fork point from a timeline entry.
         */
        fun from(
            entry: TimelineEntry,
            branchedAtMs: Long = System.currentTimeMillis()
        ) = ForkPoint(
            cursor = entry.cursor,
            entry = entry,
            stateHash = entry.snapshot?.stateHash,
            branchedAtMs = branchedAtMs
        )

        /**
         * Create fork point from cursor and entry.
         */
        fun from(
            cursor: TimelineCursor,
            entry: TimelineEntry,
            branchedAtMs: Long = System.currentTimeMillis()
        ) = ForkPoint(
            cursor = cursor,
            entry = entry,
            stateHash = entry.snapshot?.stateHash,
            branchedAtMs = branchedAtMs
        )
    }
}
