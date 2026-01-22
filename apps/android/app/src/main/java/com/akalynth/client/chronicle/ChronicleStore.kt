package com.akalynth.client.chronicle

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Chronicle store with idempotent upsert.
 *
 * Uses linkedMapOf for stable iteration order and mutex for thread safety.
 * Events are sorted by timestamp (newest first), then by eventId for stability.
 *
 * Upsert rules:
 * - Key selection: actionId takes priority over eventId
 * - Merge policy: CONFIRMED always wins over PENDING
 * - Duplicates: Same key = same event, idempotent
 */
class ChronicleStore {

    private val mutex = Mutex()
    private val map = linkedMapOf<String, ChronicleEvent>()
    private val _events = MutableStateFlow<List<ChronicleEvent>>(emptyList())

    /** Observable list of chronicle events (newest first) */
    val events: StateFlow<List<ChronicleEvent>> = _events.asStateFlow()

    /**
     * Upsert a chronicle event.
     *
     * @param e The event to upsert
     */
    suspend fun upsert(e: ChronicleEvent) = mutex.withLock {
        val k = ChronicleKey.keyFor(e)
        map[k] = merge(map[k], e)
        emitSorted()
    }

    /**
     * Upsert from a receipt (converts to event first).
     *
     * @param r The receipt to process
     */
    suspend fun upsertReceipt(r: Receipt) {
        upsert(ReceiptToChronicleEvent.map(r))
    }

    /**
     * Get an event by its canonical key.
     */
    suspend fun getByKey(key: String): ChronicleEvent? = mutex.withLock {
        map[key]
    }

    /**
     * Get an event by actionId.
     */
    suspend fun getByActionId(actionId: String): ChronicleEvent? = mutex.withLock {
        map["a:$actionId"]
    }

    /**
     * Get an event by eventId.
     */
    suspend fun getByEventId(eventId: String): ChronicleEvent? = mutex.withLock {
        // First try direct eventId key
        map["e:$eventId"] ?: run {
            // Fall back to scanning (event might be keyed by actionId)
            map.values.find { it.eventId == eventId }
        }
    }

    /**
     * Get all pending events.
     */
    suspend fun getPending(): List<ChronicleEvent> = mutex.withLock {
        map.values.filter { it.isPending() }
    }

    /**
     * Get all confirmed events.
     */
    suspend fun getConfirmed(): List<ChronicleEvent> = mutex.withLock {
        map.values.filter { it.isConfirmed() }
    }

    /**
     * Get events by kind.
     */
    suspend fun getByKind(kind: ChronicleEventKind): List<ChronicleEvent> = mutex.withLock {
        map.values.filter { it.kind == kind }
    }

    /**
     * Get count of all events.
     */
    suspend fun count(): Int = mutex.withLock {
        map.size
    }

    /**
     * Get count of pending events.
     */
    suspend fun pendingCount(): Int = mutex.withLock {
        map.values.count { it.isPending() }
    }

    /**
     * Clear all events.
     */
    suspend fun clear() = mutex.withLock {
        map.clear()
        _events.value = emptyList()
    }

    /**
     * Remove rejected events older than maxAgeMs.
     *
     * @param maxAgeMs Maximum age in milliseconds
     * @return Number of events removed
     */
    suspend fun cleanupRejected(maxAgeMs: Long = 60_000): Int = mutex.withLock {
        val cutoff = System.currentTimeMillis() - maxAgeMs
        val toRemove = map.entries
            .filter { (_, e) -> e.isRejected() && e.timestampMs < cutoff }
            .map { it.key }

        toRemove.forEach { map.remove(it) }

        if (toRemove.isNotEmpty()) {
            emitSorted()
        }

        toRemove.size
    }

    /**
     * Emit sorted events to the flow.
     * Must be called within mutex lock.
     */
    private fun emitSorted() {
        _events.value = map.values
            .sortedWith(
                compareByDescending<ChronicleEvent> { it.timestampMs }
                    .thenBy { it.eventId }
            )
    }

    companion object {
        /**
         * Merge policy for upsert.
         *
         * Priority:
         * 1. CONFIRMED always wins over PENDING
         * 2. If both CONFIRMED, keep newer timestamp (or same = idempotent)
         * 3. If both PENDING, keep earlier (avoid jitter)
         */
        fun merge(existing: ChronicleEvent?, incoming: ChronicleEvent): ChronicleEvent {
            if (existing == null) return incoming

            // Confirmed always wins over pending
            if (existing.status != EventStatus.CONFIRMED && incoming.status == EventStatus.CONFIRMED) {
                return incoming
            }

            // If both confirmed, keep the one with newer timestamp (idempotent for same)
            if (existing.status == EventStatus.CONFIRMED && incoming.status == EventStatus.CONFIRMED) {
                return if (incoming.timestampMs >= existing.timestampMs) incoming else existing
            }

            // Pending vs pending: keep earliest (avoid jitter)
            return if (incoming.timestampMs >= existing.timestampMs) existing else incoming
        }
    }
}
