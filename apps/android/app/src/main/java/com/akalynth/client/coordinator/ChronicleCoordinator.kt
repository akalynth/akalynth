package com.akalynth.client.coordinator

import com.akalynth.client.action.ActionBus
import com.akalynth.client.action.ActionIntent
import com.akalynth.client.store.ChronicleStore
import com.akalynth.client.store.ReceiptMessage
import com.akalynth.client.store.ReceiptStream
import com.akalynth.client.ui.state.ChronicleEvent
import com.akalynth.client.ui.state.ChronicleEventKind
import com.akalynth.client.ui.state.DeathNotice
import com.akalynth.client.ui.state.toChronicleEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Chronicle coordinator wiring UI to the event pipeline.
 *
 * Responsibilities:
 * - Connect ChronicleStore, ActionBus, and ReceiptStream
 * - Process incoming receipts and update store
 * - Emit UI events (death notices, etc.)
 * - Manage optimistic updates for client actions
 *
 * Usage:
 * ```kotlin
 * val coordinator = ChronicleCoordinator(scope)
 *
 * // Listen for death events to show toast
 * coordinator.deathNotices.collect { notice ->
 *     overlayState = UiOverlayState.Toast(notice)
 * }
 *
 * // Dispatch player actions
 * coordinator.dispatch(ActionIntent.Drop(...))
 *
 * // Process WebSocket messages
 * coordinator.processMessage(rawJson)
 * ```
 */
class ChronicleCoordinator(
    private val scope: CoroutineScope,
    val actionBus: ActionBus = ActionBus(),
    val chronicleStore: ChronicleStore = ChronicleStore(actionBus),
    val receiptStream: ReceiptStream = ReceiptStream()
) {
    private val _deathNotices = MutableSharedFlow<DeathNotice>(
        replay = 0,
        extraBufferCapacity = 8
    )

    /** Flow of death notices for UI toast display */
    val deathNotices: SharedFlow<DeathNotice> = _deathNotices.asSharedFlow()

    private val _hasMore = MutableStateFlow(false)

    /** Whether there are more chronicle events to load */
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()

    /** Observable chronicle events from store */
    val events: StateFlow<List<ChronicleEvent>> = chronicleStore.events

    /** Current zone (updated by coordinator) */
    private var currentZone: String = "Unknown"

    /** Current player position */
    private var currentX: Int = 0
    private var currentY: Int = 0

    init {
        // Subscribe to receipt stream
        scope.launch {
            receiptStream.messages.collect { message ->
                handleReceiptMessage(message)
            }
        }
    }

    /**
     * Dispatch a player action.
     * Creates optimistic event and sends to server.
     *
     * @param intent The action intent
     */
    suspend fun dispatch(intent: ActionIntent) {
        // Create optimistic event if applicable
        when (intent) {
            is ActionIntent.Drop -> {
                val event = ChronicleStore.createOptimisticDrop(
                    intent = intent,
                    zone = currentZone,
                    x = currentX,
                    y = currentY,
                    itemName = intent.itemId  // TODO: Resolve item name
                )
                chronicleStore.addOptimistic(event)
            }
            is ActionIntent.Pickup -> {
                val event = ChronicleStore.createOptimisticPickup(
                    intent = intent,
                    zone = currentZone,
                    itemName = intent.itemId  // TODO: Resolve item name
                )
                chronicleStore.addOptimistic(event)
            }
            else -> {
                // Move, Chat, UseItem don't create chronicle events directly
            }
        }

        // Dispatch to action bus (sends to WebSocket)
        actionBus.dispatch(intent)
    }

    /**
     * Process a raw WebSocket message.
     *
     * @param rawMessage The raw JSON message
     */
    suspend fun processMessage(rawMessage: String) {
        receiptStream.process(rawMessage)
    }

    /**
     * Update player position (called from game loop).
     */
    fun updatePosition(zone: String, x: Int, y: Int) {
        currentZone = zone
        currentX = x
        currentY = y
    }

    /**
     * Handle a parsed receipt message.
     */
    private suspend fun handleReceiptMessage(message: ReceiptMessage) {
        when (message) {
            is ReceiptMessage.Event -> handleEvent(message.event)
            is ReceiptMessage.Snapshot -> handleSnapshot(message)
            is ReceiptMessage.Ack -> handleAck(message)
            is ReceiptMessage.Reject -> handleReject(message)
        }
    }

    /**
     * Handle a single event from server.
     */
    private suspend fun handleEvent(event: ChronicleEvent) {
        // Add to store (will match pending if applicable)
        chronicleStore.addFromReceipt(event)

        // Emit death notice for toast
        if (event.kind == ChronicleEventKind.DEATH) {
            val notice = eventToDeathNotice(event)
            _deathNotices.emit(notice)
        }
    }

    /**
     * Handle a snapshot of events.
     */
    private fun handleSnapshot(snapshot: ReceiptMessage.Snapshot) {
        if (chronicleStore.count() == 0) {
            // Initial load - replace all
            chronicleStore.replaceAll(snapshot.events)
        } else {
            // Pagination - add new events
            snapshot.events.forEach { event ->
                chronicleStore.addFromReceipt(event)
            }
        }
        _hasMore.value = snapshot.hasMore
    }

    /**
     * Handle acknowledgment of client action.
     */
    private fun handleAck(ack: ReceiptMessage.Ack) {
        // Confirm pending event
        val pending = chronicleStore.findPendingByActionId(ack.actionId)
        if (pending != null) {
            chronicleStore.confirmEvent(pending.id, ack.eventId)
        }
        actionBus.complete(ack.actionId)
    }

    /**
     * Handle rejection of client action.
     */
    private fun handleReject(reject: ReceiptMessage.Reject) {
        chronicleStore.rejectByActionId(reject.actionId)
    }

    /**
     * Convert a chronicle event to a death notice.
     */
    private fun eventToDeathNotice(event: ChronicleEvent): DeathNotice {
        require(event.kind == ChronicleEventKind.DEATH)
        return DeathNotice(
            killerName = event.details.killerName,
            zone = event.zone,
            x = event.x,
            y = event.y,
            timestamp = event.timestamp,
            itemsLost = event.details.itemsLost ?: emptyList(),
            chronicleEventId = event.id
        )
    }

    /**
     * Request more chronicle events (pagination).
     */
    suspend fun loadMore() {
        // TODO: Send chronicle_load_more message via WebSocket
    }

    /**
     * Cleanup expired pending actions.
     */
    fun cleanup() {
        actionBus.cleanupExpired()
        chronicleStore.cleanupRejected()
    }
}
