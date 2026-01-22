package com.akalynth.client.timeline

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.ChronicleStore
import com.akalynth.client.chronicle.Receipt
import com.akalynth.client.explain.Explanation
import com.akalynth.client.snapshot.SnapshotStore
import com.akalynth.client.snapshot.SnapshotV0

/**
 * Builder for creating TimeTravelDebugger instances from stores.
 *
 * Collects data from:
 * - ChronicleStore (events)
 * - SnapshotStore (snapshots)
 * - Receipt cache (optional)
 * - Explanation cache (optional)
 *
 * Then builds an immutable TimelineIndex and creates the debugger.
 */
class TimelineBuilder {

    private var events: List<ChronicleEvent> = emptyList()
    private var receipts: Map<String, Receipt> = emptyMap()
    private var snapshots: Map<Long, SnapshotV0> = emptyMap()
    private var explanations: Map<String, Explanation> = emptyMap()

    /**
     * Set events from a list.
     */
    fun events(events: List<ChronicleEvent>): TimelineBuilder {
        this.events = events
        return this
    }

    /**
     * Set events from ChronicleStore (synchronously, from current state).
     */
    fun eventsFrom(store: ChronicleStore): TimelineBuilder {
        this.events = store.events.value
        return this
    }

    /**
     * Set receipts from a map (keyed by receiptId or actionId).
     */
    fun receipts(receipts: Map<String, Receipt>): TimelineBuilder {
        this.receipts = receipts
        return this
    }

    /**
     * Set receipts from a list (indexed by receiptId).
     */
    fun receipts(receipts: List<Receipt>): TimelineBuilder {
        this.receipts = receipts.associateBy { it.receiptId }
        return this
    }

    /**
     * Set snapshots from a map (keyed by sequence).
     */
    fun snapshots(snapshots: Map<Long, SnapshotV0>): TimelineBuilder {
        this.snapshots = snapshots
        return this
    }

    /**
     * Set snapshots from a list (indexed by sequence).
     */
    fun snapshots(snapshots: List<SnapshotV0>): TimelineBuilder {
        this.snapshots = snapshots.associateBy { it.sequence }
        return this
    }

    /**
     * Set explanations from a map (keyed by subjectId).
     */
    fun explanations(explanations: Map<String, Explanation>): TimelineBuilder {
        this.explanations = explanations
        return this
    }

    /**
     * Set explanations from a list (indexed by subjectId).
     */
    fun explanations(explanations: List<Explanation>): TimelineBuilder {
        this.explanations = explanations.associateBy { it.subjectId }
        return this
    }

    /**
     * Build the timeline index.
     */
    fun buildIndex(): TimelineIndex {
        return TimelineIndex.build(
            events = events,
            receipts = receipts,
            snapshots = snapshots,
            explanations = explanations
        )
    }

    /**
     * Build the time-travel debugger.
     */
    fun build(): TimeTravelDebugger {
        val index = buildIndex()
        return TimelineDebuggerImpl(index)
    }

    companion object {
        /**
         * Create a builder starting with events.
         */
        fun withEvents(events: List<ChronicleEvent>): TimelineBuilder {
            return TimelineBuilder().events(events)
        }

        /**
         * Create a builder from ChronicleStore.
         */
        fun fromStore(store: ChronicleStore): TimelineBuilder {
            return TimelineBuilder().eventsFrom(store)
        }

        /**
         * Create an empty timeline.
         */
        fun empty(): TimeTravelDebugger {
            return TimelineDebuggerImpl.empty()
        }
    }
}

/**
 * Suspend version for async store access.
 */
object TimelineBuilderAsync {

    /**
     * Build timeline from stores asynchronously.
     *
     * @param chronicleStore Source of events
     * @param snapshotStore Source of snapshots (optional)
     * @param receipts Receipts to align (optional)
     * @param explanations Explanations to align (optional)
     */
    suspend fun build(
        chronicleStore: ChronicleStore,
        snapshotStore: SnapshotStore? = null,
        receipts: Map<String, Receipt> = emptyMap(),
        explanations: Map<String, Explanation> = emptyMap()
    ): TimeTravelDebugger {
        val events = chronicleStore.events.value
        val snapshots = snapshotStore?.toMap() ?: emptyMap()

        val index = TimelineIndex.build(
            events = events,
            receipts = receipts,
            snapshots = snapshots,
            explanations = explanations
        )

        return TimelineDebuggerImpl(index)
    }
}
