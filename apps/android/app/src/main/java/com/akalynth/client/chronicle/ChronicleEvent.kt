package com.akalynth.client.chronicle

/**
 * Event confirmation status for chronicle events.
 *
 * Lifecycle:
 * - PENDING: Client-generated event awaiting server acknowledgment
 * - CONFIRMED: Server receipt received, event is authoritative
 * - REJECTED: Server rejected the action (rollback required)
 */
enum class EventStatus {
    PENDING,
    CONFIRMED,
    REJECTED
}

/**
 * Event source discriminator.
 *
 * - SERVER_RECEIPT: Event originated from server receipt (authoritative)
 * - CLIENT_INTENT: Event originated from client action (optimistic)
 */
enum class EventSource {
    CLIENT_INTENT,
    SERVER_RECEIPT
}

/**
 * Chronicle event kinds matching server receipt types.
 * Closed enum - no stringly-typed kinds allowed.
 */
enum class ChronicleEventKind {
    DEATH,
    ZONE_ENTER,
    ITEM_PICKUP,
    ITEM_DROP,
    COMBAT_KILL,
    TUTORIAL_COMPLETE,
    CHARACTER_CREATED,
    WORLD_EVENT,
    UNKNOWN;

    /** Icon for display in chronicle feed */
    val icon: String get() = when (this) {
        DEATH -> "☠"
        ZONE_ENTER -> "🏛"
        ITEM_PICKUP -> "📦"
        ITEM_DROP -> "📤"
        COMBAT_KILL -> "⚔"
        TUTORIAL_COMPLETE -> "🎓"
        CHARACTER_CREATED -> "✨"
        WORLD_EVENT -> "✦"
        UNKNOWN -> "❓"
    }

    /** Whether this event kind is tappable (opens detail view) */
    val isTappable: Boolean get() = this == DEATH
}

/**
 * Canonical chronicle event model.
 *
 * Key principles:
 * - eventId: Authoritative when confirmed (from receipt), synthetic otherwise
 * - actionId: Always present for user-initiated actions; used for idempotency
 * - timestampMs: Server timestamp when confirmed, local otherwise
 * - details: Flexible map for kind-specific data
 *
 * @property eventId Receipt ID when confirmed; synthetic ID otherwise
 * @property actionId Correlation ID from UI intent (for idempotency)
 * @property kind Event type discriminator
 * @property timestampMs Epoch milliseconds (server when confirmed, local otherwise)
 * @property zone Zone where event occurred (optional)
 * @property x X coordinate (optional)
 * @property y Y coordinate (optional)
 * @property details Kind-specific payload as flexible map
 * @property status Confirmation lifecycle status
 * @property source Origin discriminator (client vs server)
 */
data class ChronicleEvent(
    val eventId: String,
    val actionId: String? = null,
    val kind: ChronicleEventKind,
    val timestampMs: Long,
    val zone: String? = null,
    val x: Int? = null,
    val y: Int? = null,
    val details: Map<String, Any?> = emptyMap(),
    val status: EventStatus = EventStatus.PENDING,
    val source: EventSource = EventSource.CLIENT_INTENT
) {
    /** Check if event is pending confirmation */
    fun isPending(): Boolean = status == EventStatus.PENDING

    /** Check if event is confirmed by server */
    fun isConfirmed(): Boolean = status == EventStatus.CONFIRMED

    /** Check if event was rejected by server */
    fun isRejected(): Boolean = status == EventStatus.REJECTED

    /** Check if event originated from client intent (optimistic) */
    fun isOptimistic(): Boolean = source == EventSource.CLIENT_INTENT

    /** Check if event is authoritative (from server receipt) */
    fun isAuthoritative(): Boolean = source == EventSource.SERVER_RECEIPT

    // =========================================================================
    // Detail accessors for common fields
    // =========================================================================

    /** Death: killer name */
    val killerName: String? get() = details["killer_name"] as? String

    /** Death: items lost */
    @Suppress("UNCHECKED_CAST")
    val itemsLost: List<String>? get() = details["items_lost"] as? List<String>

    /** Pickup/drop: item name */
    val itemName: String? get() = details["item_name"] as? String

    /** Kill: victim name */
    val victimName: String? get() = details["victim_name"] as? String

    /** Zone enter: previous zone */
    val fromZone: String? get() = details["from_zone"] as? String

    /** World event: event identifier */
    val worldEventId: String? get() = details["event_id"] as? String

    /** World event: current/event receipt phase */
    val worldEventPhase: String? get() = details["phase"] as? String

    /** World event: accepted contribution id */
    val worldEventContributionId: String? get() = details["contribution_id"] as? String

    /** World event: final outcome */
    val worldEventOutcome: String? get() = details["outcome"] as? String

    companion object {
        /**
         * Generate a synthetic event ID for pending events.
         */
        fun syntheticId(actionId: String): String = "pending_$actionId"

        /**
         * Generate a synthetic event ID with timestamp fallback.
         */
        fun syntheticId(timestampMs: Long): String = "pending_$timestampMs"
    }
}
