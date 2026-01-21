package com.akalynth.client.actions

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.ChronicleEventKind
import com.akalynth.client.chronicle.EventSource
import com.akalynth.client.chronicle.EventStatus

/**
 * Clock interface for testable timestamps.
 */
fun interface Clock {
    fun nowMs(): Long
}

/**
 * System clock for production.
 */
object SystemClock : Clock {
    override fun nowMs(): Long = System.currentTimeMillis()
}

/**
 * Fixed clock for deterministic tests.
 */
class FixedClock(var timeMs: Long = 0L) : Clock {
    override fun nowMs(): Long = timeMs

    fun advance(ms: Long) {
        timeMs += ms
    }
}

/**
 * Maps ActionIntent to pending ChronicleEvent.
 *
 * Authoritative policy:
 * - status = PENDING
 * - source = CLIENT_INTENT
 * - eventId = "pending:{actionId}" (synthetic, stable)
 * - timestampMs = clock.nowMs() (injectable for tests)
 *
 * Kind mapping matches ReceiptToChronicleEvent.mapKind() so pending
 * events upgrade cleanly when receipt arrives.
 */
object PendingEventMapper {

    /**
     * Map an action intent to a pending chronicle event.
     *
     * @param intent The stamped action intent
     * @param clock Clock for timestamp (injectable)
     * @param zone Current player zone
     * @param x Current player X coordinate
     * @param y Current player Y coordinate
     * @return Pending chronicle event, or null if this action doesn't create a chronicle event
     */
    fun map(
        intent: ActionIntent,
        clock: Clock = SystemClock,
        zone: String? = null,
        x: Int? = null,
        y: Int? = null
    ): ChronicleEvent? {
        return when (intent) {
            is ActionIntent.Attack -> mapAttack(intent, clock, zone, x, y)
            is ActionIntent.UseHotbarSlot -> null // Most uses don't create chronicle events
            is ActionIntent.DropHotbarSlot -> mapDrop(intent, clock, zone, x, y)
            is ActionIntent.PickupItem -> mapPickup(intent, clock, zone)
            is ActionIntent.CreateCharacter -> mapCreateCharacter(intent, clock, zone, x, y)
        }
    }

    private fun mapAttack(
        intent: ActionIntent.Attack,
        clock: Clock,
        zone: String?,
        x: Int?,
        y: Int?
    ): ChronicleEvent {
        return ChronicleEvent(
            eventId = syntheticId(intent.actionId),
            actionId = intent.actionId,
            kind = ChronicleEventKind.COMBAT_KILL, // Will be confirmed/rejected by server
            timestampMs = clock.nowMs(),
            zone = zone,
            x = x,
            y = y,
            details = buildMap {
                intent.targetId?.let { put("target_id", it) }
            },
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT
        )
    }

    private fun mapDrop(
        intent: ActionIntent.DropHotbarSlot,
        clock: Clock,
        zone: String?,
        x: Int?,
        y: Int?
    ): ChronicleEvent {
        return ChronicleEvent(
            eventId = syntheticId(intent.actionId),
            actionId = intent.actionId,
            kind = ChronicleEventKind.ITEM_DROP,
            timestampMs = clock.nowMs(),
            zone = zone,
            x = x,
            y = y,
            details = mapOf(
                "item_id" to intent.itemId,
                "item_name" to intent.itemName,
                "slot_index" to intent.slotIndex,
                "rarity" to intent.rarity.name
            ),
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT
        )
    }

    private fun mapPickup(
        intent: ActionIntent.PickupItem,
        clock: Clock,
        zone: String?
    ): ChronicleEvent {
        return ChronicleEvent(
            eventId = syntheticId(intent.actionId),
            actionId = intent.actionId,
            kind = ChronicleEventKind.ITEM_PICKUP,
            timestampMs = clock.nowMs(),
            zone = zone,
            x = intent.x,
            y = intent.y,
            details = mapOf(
                "item_id" to intent.itemId,
                "item_name" to intent.itemName
            ),
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT
        )
    }

    private fun mapCreateCharacter(
        intent: ActionIntent.CreateCharacter,
        clock: Clock,
        zone: String?,
        x: Int?,
        y: Int?
    ): ChronicleEvent {
        return ChronicleEvent(
            eventId = syntheticId(intent.actionId),
            actionId = intent.actionId,
            kind = ChronicleEventKind.CHARACTER_CREATED,
            timestampMs = clock.nowMs(),
            zone = zone,
            x = x,
            y = y,
            details = mapOf(
                "name" to intent.name,
                "sex" to intent.sex.name
            ),
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT
        )
    }

    /**
     * Generate synthetic event ID for pending events.
     * Format: "pending:{actionId}"
     */
    private fun syntheticId(actionId: String): String = "pending:$actionId"
}
