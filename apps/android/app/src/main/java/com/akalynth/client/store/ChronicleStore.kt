package com.akalynth.client.store

import com.akalynth.client.action.ActionBus
import com.akalynth.client.action.ActionIntent
import com.akalynth.client.ui.state.ChronicleEvent
import com.akalynth.client.ui.state.ChronicleEventDetails
import com.akalynth.client.ui.state.ChronicleEventKind
import com.akalynth.client.ui.state.EventSource
import com.akalynth.client.ui.state.EventStatus
import com.akalynth.client.ui.state.confirm
import com.akalynth.client.ui.state.reject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * Chronicle store for managing player event history.
 *
 * Responsibilities:
 * - Store authoritative events from server receipts
 * - Create optimistic events from client intents
 * - Match server receipts to pending intents
 * - Provide observable state for UI
 *
 * Event lifecycle:
 * 1. Client action dispatched → optimistic event created (Pending)
 * 2. Server receipt received → match by actionId → event confirmed/rejected
 * 3. Server-only events → added directly as Confirmed
 *
 * @param actionBus Action bus for tracking pending intents
 */
class ChronicleStore(
    private val actionBus: ActionBus? = null
) {
    private val _events = MutableStateFlow<List<ChronicleEvent>>(emptyList())

    /** Observable list of chronicle events (newest first) */
    val events: StateFlow<List<ChronicleEvent>> = _events.asStateFlow()

    /** Maximum events to keep in memory */
    var maxEvents: Int = 100

    /**
     * Add an optimistic event from a client intent.
     * Event starts as Pending until server receipt confirms/rejects.
     *
     * @param event The optimistic event
     */
    fun addOptimistic(event: ChronicleEvent) {
        require(event.source == EventSource.CLIENT_INTENT) {
            "Optimistic events must have CLIENT_INTENT source"
        }
        require(event.status == EventStatus.PENDING) {
            "Optimistic events must have PENDING status"
        }

        _events.update { current ->
            (listOf(event) + current).take(maxEvents)
        }
    }

    /**
     * Add a confirmed event from a server receipt.
     * If actionId matches a pending event, confirms it instead of adding new.
     *
     * @param event The server event
     * @return The added or updated event
     */
    fun addFromReceipt(event: ChronicleEvent): ChronicleEvent {
        require(event.source == EventSource.SERVER_RECEIPT) {
            "Receipt events must have SERVER_RECEIPT source"
        }

        // Try to match with pending event by actionId
        val actionId = event.actionId
        if (actionId != null) {
            val matchedPending = findPendingByActionId(actionId)
            if (matchedPending != null) {
                // Confirm the pending event
                confirmEvent(matchedPending.id, event.id)
                actionBus?.complete(actionId)
                return event
            }
        }

        // No match found, add as new confirmed event
        _events.update { current ->
            (listOf(event) + current).take(maxEvents)
        }

        return event
    }

    /**
     * Reject a pending event by action ID.
     *
     * @param actionId The action ID from server rejection
     * @return The rejected event, or null if not found
     */
    fun rejectByActionId(actionId: String): ChronicleEvent? {
        val pending = findPendingByActionId(actionId) ?: return null

        _events.update { current ->
            current.map { event ->
                if (event.id == pending.id) {
                    event.reject()
                } else {
                    event
                }
            }
        }

        actionBus?.reject(actionId)
        return pending.reject()
    }

    /**
     * Confirm a pending event with server-provided ID.
     *
     * @param pendingId The client-generated pending ID
     * @param serverId The server-provided authoritative ID
     * @return The confirmed event, or null if not found
     */
    fun confirmEvent(pendingId: String, serverId: String): ChronicleEvent? {
        var confirmed: ChronicleEvent? = null

        _events.update { current ->
            current.map { event ->
                if (event.id == pendingId && event.status == EventStatus.PENDING) {
                    event.confirm(serverId).also { confirmed = it }
                } else {
                    event
                }
            }
        }

        return confirmed
    }

    /**
     * Find a pending event by action ID.
     */
    fun findPendingByActionId(actionId: String): ChronicleEvent? {
        return _events.value.find {
            it.actionId == actionId && it.status == EventStatus.PENDING
        }
    }

    /**
     * Find an event by ID.
     */
    fun findById(id: String): ChronicleEvent? {
        return _events.value.find { it.id == id }
    }

    /**
     * Get all pending events.
     */
    fun getPendingEvents(): List<ChronicleEvent> {
        return _events.value.filter { it.status == EventStatus.PENDING }
    }

    /**
     * Get all confirmed events.
     */
    fun getConfirmedEvents(): List<ChronicleEvent> {
        return _events.value.filter { it.status == EventStatus.CONFIRMED }
    }

    /**
     * Get events filtered by kind.
     */
    fun getEventsByKind(kind: ChronicleEventKind): List<ChronicleEvent> {
        return _events.value.filter { it.kind == kind }
    }

    /**
     * Get recent events (most recent N).
     */
    fun getRecentEvents(count: Int): List<ChronicleEvent> {
        return _events.value.take(count)
    }

    /**
     * Remove rejected events older than specified age.
     *
     * @param maxAgeMs Maximum age in milliseconds
     * @return Number of events removed
     */
    fun cleanupRejected(maxAgeMs: Long = 60_000): Int {
        val cutoff = System.currentTimeMillis() - maxAgeMs
        var removedCount = 0

        _events.update { current ->
            current.filter { event ->
                if (event.status == EventStatus.REJECTED) {
                    try {
                        val eventTime = java.time.Instant.parse(event.timestamp).toEpochMilli()
                        if (eventTime < cutoff) {
                            removedCount++
                            false
                        } else {
                            true
                        }
                    } catch (e: Exception) {
                        // Can't parse timestamp, keep the event
                        true
                    }
                } else {
                    true
                }
            }
        }

        return removedCount
    }

    /**
     * Clear all events.
     */
    fun clear() {
        _events.value = emptyList()
    }

    /**
     * Replace all events (e.g., from server sync).
     */
    fun replaceAll(events: List<ChronicleEvent>) {
        _events.value = events.take(maxEvents)
    }

    /**
     * Get count of all events.
     */
    fun count(): Int = _events.value.size

    /**
     * Get count of pending events.
     */
    fun pendingCount(): Int = _events.value.count { it.status == EventStatus.PENDING }

    companion object {
        /**
         * Create an optimistic event from a drop action.
         */
        fun createOptimisticDrop(
            intent: ActionIntent.Drop,
            zone: String,
            x: Int,
            y: Int,
            itemName: String
        ): ChronicleEvent = ChronicleEvent(
            id = "pending_${intent.actionId}",
            kind = ChronicleEventKind.ITEM_DROP,
            timestamp = intent.timestamp,
            zone = zone,
            x = x,
            y = y,
            details = ChronicleEventDetails(itemName = itemName),
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT,
            actionId = intent.actionId
        )

        /**
         * Create an optimistic event from a pickup action.
         */
        fun createOptimisticPickup(
            intent: ActionIntent.Pickup,
            zone: String,
            itemName: String
        ): ChronicleEvent = ChronicleEvent(
            id = "pending_${intent.actionId}",
            kind = ChronicleEventKind.ITEM_PICKUP,
            timestamp = intent.timestamp,
            zone = zone,
            x = intent.x,
            y = intent.y,
            details = ChronicleEventDetails(itemName = itemName),
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT,
            actionId = intent.actionId
        )
    }
}
