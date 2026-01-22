package com.akalynth.client.timeline

/**
 * Time-travel debugger for navigating the timeline.
 *
 * A **deterministic navigator** over aligned timelines:
 * 1. Intent timeline (claims)
 * 2. Receipt timeline (authority)
 * 3. Event timeline (ledger projection)
 * 4. Snapshot timeline (state consequences)
 * 5. Explanation layer (why, cited)
 *
 * TTD does **not** compute history. It **selects** and **aligns**
 * existing artifacts by sequence / time / IDs.
 *
 * This interface is read-only. No mutation, no branching, no "what-if".
 */
interface TimeTravelDebugger {

    /**
     * Get the current position in the timeline.
     */
    fun current(): TimelineEntry

    /**
     * Get the current cursor.
     */
    fun cursor(): TimelineCursor

    /**
     * Go to a specific sequence number.
     *
     * @param seq The sequence to navigate to
     * @return The entry at that sequence, or null if not found
     */
    fun goToSequence(seq: Long): TimelineEntry?

    /**
     * Go to the next entry in the timeline.
     *
     * @return The next entry, or null if at the end
     */
    fun next(): TimelineEntry?

    /**
     * Go to the previous entry in the timeline.
     *
     * @return The previous entry, or null if at the beginning
     */
    fun prev(): TimelineEntry?

    /**
     * Go to a specific event by ID.
     *
     * @param eventId The event ID to navigate to
     * @return The entry for that event, or null if not found
     */
    fun goToEvent(eventId: String): TimelineEntry?

    /**
     * Go to a specific action by ID.
     *
     * @param actionId The action ID to navigate to
     * @return The entry for that action, or null if not found
     */
    fun goToAction(actionId: String): TimelineEntry?

    /**
     * Go to the first entry in the timeline.
     *
     * @return The first entry, or null if empty
     */
    fun goToStart(): TimelineEntry?

    /**
     * Go to the last entry in the timeline.
     *
     * @return The last entry, or null if empty
     */
    fun goToEnd(): TimelineEntry?

    /**
     * Check if there's a next entry.
     */
    fun hasNext(): Boolean

    /**
     * Check if there's a previous entry.
     */
    fun hasPrev(): Boolean

    /**
     * Get the timeline index.
     */
    fun index(): TimelineIndex

    /**
     * Get all entries in sequence order.
     */
    fun allEntries(): List<TimelineEntry>

    /**
     * Get the total number of entries.
     */
    fun size(): Int
}
