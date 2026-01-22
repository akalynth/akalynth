package com.akalynth.client.timeline

/**
 * Selection cursor for time-travel navigation.
 *
 * This is the **selection**, not the data. It identifies a point in time
 * that can be used to look up the full TimelineEntry.
 *
 * @property sequence Primary spine (monotonic ordering)
 * @property eventId Optional event ID anchor
 * @property actionId Optional action ID anchor (for intent correlation)
 */
data class TimelineCursor(
    val sequence: Long,
    val eventId: String? = null,
    val actionId: String? = null
) {
    companion object {
        /**
         * Create cursor at a specific sequence.
         */
        fun atSequence(seq: Long) = TimelineCursor(sequence = seq)

        /**
         * Create cursor from an event ID.
         */
        fun fromEvent(eventId: String, sequence: Long) = TimelineCursor(
            sequence = sequence,
            eventId = eventId
        )

        /**
         * Create cursor from an action ID.
         */
        fun fromAction(actionId: String, sequence: Long) = TimelineCursor(
            sequence = sequence,
            actionId = actionId
        )

        /**
         * Starting cursor (sequence 0).
         */
        val START = TimelineCursor(sequence = 0)
    }
}
