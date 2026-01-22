package com.akalynth.client.timeline

/**
 * Implementation of TimeTravelDebugger.
 *
 * Maintains current position and delegates to TimelineIndex for lookups.
 * All operations are pure - no mutation of underlying data.
 *
 * @property timelineIndex The index to navigate
 */
class TimelineDebuggerImpl(
    private val timelineIndex: TimelineIndex
) : TimeTravelDebugger {

    private var currentSequence: Long = timelineIndex.minSequence ?: 0

    override fun current(): TimelineEntry {
        return timelineIndex.getAtSequence(currentSequence)
            ?: TimelineEntry.empty(currentSequence)
    }

    override fun cursor(): TimelineCursor {
        return current().cursor
    }

    override fun goToSequence(seq: Long): TimelineEntry? {
        val entry = timelineIndex.getAtSequence(seq)
        if (entry != null) {
            currentSequence = seq
        }
        return entry
    }

    override fun next(): TimelineEntry? {
        val nextSeq = timelineIndex.nextSequence(currentSequence) ?: return null
        currentSequence = nextSeq
        return timelineIndex.getAtSequence(nextSeq)
    }

    override fun prev(): TimelineEntry? {
        val prevSeq = timelineIndex.prevSequence(currentSequence) ?: return null
        currentSequence = prevSeq
        return timelineIndex.getAtSequence(prevSeq)
    }

    override fun goToEvent(eventId: String): TimelineEntry? {
        val entry = timelineIndex.getByEventId(eventId)
        if (entry != null) {
            currentSequence = entry.sequence
        }
        return entry
    }

    override fun goToAction(actionId: String): TimelineEntry? {
        val entry = timelineIndex.getByActionId(actionId)
        if (entry != null) {
            currentSequence = entry.sequence
        }
        return entry
    }

    override fun goToStart(): TimelineEntry? {
        val minSeq = timelineIndex.minSequence ?: return null
        currentSequence = minSeq
        return timelineIndex.getAtSequence(minSeq)
    }

    override fun goToEnd(): TimelineEntry? {
        val maxSeq = timelineIndex.maxSequence ?: return null
        currentSequence = maxSeq
        return timelineIndex.getAtSequence(maxSeq)
    }

    override fun hasNext(): Boolean {
        return timelineIndex.nextSequence(currentSequence) != null
    }

    override fun hasPrev(): Boolean {
        return timelineIndex.prevSequence(currentSequence) != null
    }

    override fun index(): TimelineIndex = timelineIndex

    override fun allEntries(): List<TimelineEntry> {
        return timelineIndex.bySequence.values.toList()
    }

    override fun size(): Int = timelineIndex.size

    companion object {
        /**
         * Create a debugger from a timeline index.
         */
        fun from(index: TimelineIndex): TimelineDebuggerImpl {
            return TimelineDebuggerImpl(index)
        }

        /**
         * Create an empty debugger.
         */
        fun empty(): TimelineDebuggerImpl {
            return TimelineDebuggerImpl(TimelineIndex.EMPTY)
        }
    }
}
