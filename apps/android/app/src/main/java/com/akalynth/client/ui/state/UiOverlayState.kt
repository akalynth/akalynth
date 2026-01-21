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
 * Chronicle event for history feed.
 * Represents any recorded player event with type discrimination.
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
    val details: ChronicleEventDetails = ChronicleEventDetails()
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
 * UI overlay state for death experience flow.
 *
 * State transitions:
 * - None → Toast(notice) : on death event
 * - Toast(notice) → Recap(event) : on toast tap
 * - Toast(notice) → None : on auto-dismiss timeout
 * - Recap(event) → None : on dismiss
 *
 * Chronicle can also open Recap directly:
 * - None → Recap(event) : on chronicle death row tap
 */
sealed class UiOverlayState {
    /** No overlay displayed */
    data object None : UiOverlayState()

    /** Death toast displayed (auto-dismisses after timeout) */
    data class Toast(val notice: DeathNotice) : UiOverlayState()

    /** Death recap sheet displayed */
    data class Recap(val event: ChronicleEvent) : UiOverlayState()
}

/**
 * Extension to convert DeathNotice to ChronicleEvent for recap display.
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
    )
)
