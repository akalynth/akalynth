package com.akalynth.client.action

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Action bus for dispatching client intents.
 *
 * Responsibilities:
 * - Emit actions to subscribers (WebSocket, Chronicle store, analytics)
 * - Track pending actions by correlation ID
 * - Provide lookup for receipt matching
 *
 * Thread safety:
 * - Uses SharedFlow for thread-safe emission
 * - Pending map synchronized for concurrent access
 *
 * Usage:
 * ```kotlin
 * // Dispatch action
 * val intent = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")
 * actionBus.dispatch(intent)
 *
 * // Subscribe to actions
 * actionBus.actions.collect { action ->
 *     webSocket.send(action)
 * }
 * ```
 */
class ActionBus {
    private val _actions = MutableSharedFlow<ActionIntent>(
        replay = 0,
        extraBufferCapacity = 64
    )

    /** Flow of dispatched actions */
    val actions: SharedFlow<ActionIntent> = _actions.asSharedFlow()

    /** Pending actions awaiting server receipt */
    private val pending = mutableMapOf<String, PendingAction>()
    private val pendingLock = Any()

    /**
     * Dispatch an action intent.
     *
     * @param intent The action to dispatch
     * @return The action ID for correlation
     */
    suspend fun dispatch(intent: ActionIntent): String {
        // Track pending action
        synchronized(pendingLock) {
            pending[intent.actionId] = PendingAction(
                intent = intent,
                dispatchedAt = System.currentTimeMillis()
            )
        }

        // Emit to subscribers
        _actions.emit(intent)

        return intent.actionId
    }

    /**
     * Dispatch an action intent without suspending.
     * Uses tryEmit which may fail if buffer is full.
     *
     * @param intent The action to dispatch
     * @return The action ID for correlation, or null if emit failed
     */
    fun dispatchBlocking(intent: ActionIntent): String? {
        synchronized(pendingLock) {
            pending[intent.actionId] = PendingAction(
                intent = intent,
                dispatchedAt = System.currentTimeMillis()
            )
        }

        return if (_actions.tryEmit(intent)) {
            intent.actionId
        } else {
            // Emit failed, remove from pending
            synchronized(pendingLock) {
                pending.remove(intent.actionId)
            }
            null
        }
    }

    /**
     * Mark an action as completed (receipt received).
     *
     * @param actionId The action ID from the server receipt
     * @return The original action, or null if not found/expired
     */
    fun complete(actionId: String): ActionIntent? {
        return synchronized(pendingLock) {
            pending.remove(actionId)?.intent
        }
    }

    /**
     * Mark an action as rejected by the server.
     *
     * @param actionId The action ID from the server receipt
     * @return The original action, or null if not found/expired
     */
    fun reject(actionId: String): ActionIntent? {
        return synchronized(pendingLock) {
            pending.remove(actionId)?.intent
        }
    }

    /**
     * Get a pending action by ID.
     *
     * @param actionId The action ID
     * @return The pending action, or null if not found
     */
    fun getPending(actionId: String): PendingAction? {
        return synchronized(pendingLock) {
            pending[actionId]
        }
    }

    /**
     * Get all pending actions.
     */
    fun getAllPending(): List<PendingAction> {
        return synchronized(pendingLock) {
            pending.values.toList()
        }
    }

    /**
     * Get count of pending actions.
     */
    fun pendingCount(): Int {
        return synchronized(pendingLock) {
            pending.size
        }
    }

    /**
     * Cleanup expired pending actions.
     *
     * @param maxAgeMs Maximum age in milliseconds (default 30 seconds)
     * @return Number of expired actions removed
     */
    fun cleanupExpired(maxAgeMs: Long = 30_000): Int {
        val now = System.currentTimeMillis()
        val expired = mutableListOf<String>()

        synchronized(pendingLock) {
            pending.entries.forEach { (id, action) ->
                if (now - action.dispatchedAt > maxAgeMs) {
                    expired.add(id)
                }
            }
            expired.forEach { pending.remove(it) }
        }

        return expired.size
    }

    /**
     * Clear all pending actions.
     * Useful for disconnect/reconnect scenarios.
     */
    fun clearPending() {
        synchronized(pendingLock) {
            pending.clear()
        }
    }
}

/**
 * Pending action wrapper with dispatch timestamp.
 */
data class PendingAction(
    val intent: ActionIntent,
    val dispatchedAt: Long
) {
    /**
     * Check if this action has expired.
     */
    fun isExpired(maxAgeMs: Long = 30_000): Boolean {
        return System.currentTimeMillis() - dispatchedAt > maxAgeMs
    }

    /**
     * Get age of this pending action in milliseconds.
     */
    fun ageMs(): Long = System.currentTimeMillis() - dispatchedAt
}
