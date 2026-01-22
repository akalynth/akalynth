package com.akalynth.client.ui.state

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Death notice payload for UI display.
 * Derived from server DeathNoticeMessage + any enriched data.
 *
 * This is the bridge between protocol messages and UI rendering.
 */
@Serializable
data class DeathNotice(
    /** Name of the killer (null if environment death) */
    val killerName: String? = null,

    /** Zone where death occurred */
    val zone: String,

    /** X coordinate of death location */
    val x: Int,

    /** Y coordinate of death location */
    val y: Int,

    /** ISO 8601 timestamp of death */
    val timestamp: String,

    /** Items lost on death (item names) */
    val itemsLost: List<String> = emptyList(),

    /** Chronicle event ID for audit lookup (null if not yet assigned) */
    val chronicleEventId: String? = null,

    /** Death reason from server */
    val reason: String = "unknown"
)

/**
 * Event confirmation status for chronicle events.
 *
 * Lifecycle:
 * - Pending: Client-generated event awaiting server acknowledgment
 * - Confirmed: Server receipt received, event is authoritative
 * - Rejected: Server rejected the action (rollback required)
 */
@Serializable
enum class EventStatus {
    @SerialName("pending") PENDING,
    @SerialName("confirmed") CONFIRMED,
    @SerialName("rejected") REJECTED
}

/**
 * Event source discriminator.
 *
 * - ServerReceipt: Event originated from server receipt (authoritative)
 * - ClientIntent: Event originated from client action (optimistic)
 */
@Serializable
enum class EventSource {
    @SerialName("server_receipt") SERVER_RECEIPT,
    @SerialName("client_intent") CLIENT_INTENT
}

/**
 * Chronicle event for history feed.
 * Represents any recorded player event with type discrimination.
 *
 * Canonical model for Sprint 5A event pipeline:
 * - id: Server-provided or client-generated (pending_* prefix) until ack
 * - status: Tracks confirmation lifecycle
 * - source: Discriminates authoritative vs optimistic events
 * - actionId: Correlates client intent with server receipt
 */
@Serializable
data class ChronicleEvent(
    /** Event ID for unique identification and lookup */
    val id: String,

    /** Event kind discriminator */
    val kind: ChronicleEventKind,

    /** ISO 8601 timestamp */
    val timestamp: String,

    /** Zone where event occurred */
    val zone: String,

    /** X coordinate */
    val x: Int,

    /** Y coordinate */
    val y: Int,

    /** Kind-specific details (death: killerName, itemsLost; pickup: itemName; etc.) */
    val details: ChronicleEventDetails = ChronicleEventDetails(),

    /** Confirmation status (Pending until server ack) */
    val status: EventStatus = EventStatus.CONFIRMED,

    /** Event source discriminator */
    val source: EventSource = EventSource.SERVER_RECEIPT,

    /** Client action ID for intent correlation (null for server-only events) */
    val actionId: String? = null
)

/**
 * Chronicle event kinds matching server receipt types.
 */
@Serializable
enum class ChronicleEventKind {
    @SerialName("death") DEATH,
    @SerialName("zone_enter") ZONE_ENTER,
    @SerialName("item_pickup") ITEM_PICKUP,
    @SerialName("item_drop") ITEM_DROP,
    @SerialName("combat_kill") COMBAT_KILL,
    @SerialName("tutorial_complete") TUTORIAL_COMPLETE,
    @SerialName("character_created") CHARACTER_CREATED,
    @SerialName("unknown") UNKNOWN;

    /**
     * Icon for display in chronicle feed.
     */
    val icon: String get() = when (this) {
        DEATH -> "☠"
        ZONE_ENTER -> "🏛"
        ITEM_PICKUP -> "📦"
        ITEM_DROP -> "📤"
        COMBAT_KILL -> "⚔"
        TUTORIAL_COMPLETE -> "🎓"
        CHARACTER_CREATED -> "✨"
        UNKNOWN -> "❓"
    }

    /**
     * Whether this event kind is tappable (opens detail view).
     */
    val isTappable: Boolean get() = this == DEATH
}

/**
 * Kind-specific details for chronicle events.
 * All fields optional; presence depends on event kind.
 */
@Serializable
data class ChronicleEventDetails(
    /** Death: name of killer */
    val killerName: String? = null,

    /** Death: items lost */
    val itemsLost: List<String>? = null,

    /** Pickup/drop: item name */
    val itemName: String? = null,

    /** Kill: name of victim */
    val victimName: String? = null,

    /** Zone enter: previous zone */
    val fromZone: String? = null
)

/**
 * UI overlay state for modal overlays.
 *
 * State transitions:
 * - None → Toast(notice) : on death event
 * - Toast(notice) → Recap(event) : on toast tap
 * - Toast(notice) → None : on auto-dismiss timeout
 * - Recap(event) → None : on dismiss
 * - None → ConfirmDrop(slot, item) : on hotbar slot long-press
 * - ConfirmDrop → None : on confirm or cancel
 * - None → Why(context) : on Why button press (only if None)
 * - Why → None : on dismiss
 *
 * Chronicle can also open Recap directly:
 * - None → Recap(event) : on chronicle death row tap
 *
 * Overlay contention policy:
 * - Why button is BLOCKED if current state is not None
 * - This prevents Why from overriding critical overlays (Toast, Recap, ConfirmDrop)
 * - Use [canOpenWhy] extension to check before transitioning
 */
sealed class UiOverlayState {
    /** No overlay displayed */
    data object None : UiOverlayState()

    /** Death toast displayed (auto-dismisses after timeout) */
    data class Toast(val notice: DeathNotice) : UiOverlayState()

    /** Death recap sheet displayed */
    data class Recap(val event: ChronicleEvent) : UiOverlayState()

    /**
     * Hotbar drop confirmation overlay.
     * Routes to Tier2 (hold) or Tier3 (slide) based on item rarity.
     */
    data class ConfirmDrop(
        val slotIndex: Int,
        val itemId: String,
        val itemName: String,
        val isLegendary: Boolean
    ) : UiOverlayState()

    /**
     * Why explanation sheet.
     * Shows contextual help based on current game context.
     */
    data class Why(
        val context: WhyContext
    ) : UiOverlayState()
}

/**
 * Context for Why explanation.
 */
@Serializable
data class WhyContext(
    /** Current zone */
    val zone: String,

    /** Recent events that may need explanation */
    val recentEvents: List<ChronicleEvent> = emptyList(),

    /** Specific question/topic (optional) */
    val topic: String? = null
)

/**
 * Check if Why overlay can be opened (only from None state).
 * Enforces overlay contention policy.
 */
fun UiOverlayState.canOpenWhy(): Boolean = this is UiOverlayState.None

/**
 * Priority of overlay states for contention resolution.
 * Higher priority overlays cannot be replaced by lower priority ones.
 */
val UiOverlayState.priority: Int get() = when (this) {
    is UiOverlayState.None -> 0
    is UiOverlayState.Why -> 1
    is UiOverlayState.Toast -> 2
    is UiOverlayState.Recap -> 3
    is UiOverlayState.ConfirmDrop -> 4
}

/**
 * Extension to convert DeathNotice to ChronicleEvent for recap display.
 * DeathNotice always comes from server, so source is SERVER_RECEIPT
 * and status is CONFIRMED.
 */
fun DeathNotice.toChronicleEvent(): ChronicleEvent = ChronicleEvent(
    id = chronicleEventId ?: "pending_${timestamp}",
    kind = ChronicleEventKind.DEATH,
    timestamp = timestamp,
    zone = zone,
    x = x,
    y = y,
    details = ChronicleEventDetails(
        killerName = killerName,
        itemsLost = itemsLost.ifEmpty { null }
    ),
    status = EventStatus.CONFIRMED,
    source = EventSource.SERVER_RECEIPT,
    actionId = null
)

/**
 * Check if event is pending confirmation.
 */
fun ChronicleEvent.isPending(): Boolean = status == EventStatus.PENDING

/**
 * Check if event is confirmed by server.
 */
fun ChronicleEvent.isConfirmed(): Boolean = status == EventStatus.CONFIRMED

/**
 * Check if event was rejected by server.
 */
fun ChronicleEvent.isRejected(): Boolean = status == EventStatus.REJECTED

/**
 * Check if event originated from client intent (optimistic).
 */
fun ChronicleEvent.isOptimistic(): Boolean = source == EventSource.CLIENT_INTENT

/**
 * Check if event is authoritative (from server receipt).
 */
fun ChronicleEvent.isAuthoritative(): Boolean = source == EventSource.SERVER_RECEIPT

/**
 * Create a confirmed copy of a pending event with server-provided ID.
 */
fun ChronicleEvent.confirm(serverId: String): ChronicleEvent = copy(
    id = serverId,
    status = EventStatus.CONFIRMED,
    source = EventSource.SERVER_RECEIPT
)

/**
 * Create a rejected copy of a pending event.
 */
fun ChronicleEvent.reject(): ChronicleEvent = copy(
    status = EventStatus.REJECTED
)
