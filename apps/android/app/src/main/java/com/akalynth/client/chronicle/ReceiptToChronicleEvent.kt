package com.akalynth.client.chronicle

/**
 * Deterministic mapping: Receipt -> ChronicleEvent.
 *
 * Single source of truth for converting server receipts to chronicle events.
 * All receipt parsing happens here; no other code should interpret receipt payloads.
 */
object ReceiptToChronicleEvent {

    /**
     * Map a receipt to a chronicle event.
     *
     * @param r The normalized receipt
     * @return A confirmed chronicle event with SERVER_RECEIPT source
     */
    fun map(r: Receipt): ChronicleEvent {
        val kind = mapKind(r.type)

        // Extract standard location fields with safe casts
        val zone = r.payload["zone"] as? String
        val x = (r.payload["x"] as? Number)?.toInt()
        val y = (r.payload["y"] as? Number)?.toInt()

        return ChronicleEvent(
            eventId = r.receiptId,
            actionId = r.actionId,
            kind = kind,
            timestampMs = r.timestampMs,
            zone = zone,
            x = x,
            y = y,
            details = r.payload,
            status = EventStatus.CONFIRMED,
            source = EventSource.SERVER_RECEIPT
        )
    }

    /**
     * Map receipt type string to ChronicleEventKind.
     * Unknown types become UNKNOWN (still CONFIRMED).
     */
    fun mapKind(type: String): ChronicleEventKind {
        return when (type.lowercase()) {
            "death" -> ChronicleEventKind.DEATH
            "item_pickup" -> ChronicleEventKind.ITEM_PICKUP
            "item_drop" -> ChronicleEventKind.ITEM_DROP
            "zone_enter" -> ChronicleEventKind.ZONE_ENTER
            "combat_kill" -> ChronicleEventKind.COMBAT_KILL
            "tutorial_complete" -> ChronicleEventKind.TUTORIAL_COMPLETE
            "character_created" -> ChronicleEventKind.CHARACTER_CREATED
            "world_event",
            "world_event_started",
            "world_event_contribution",
            "world_event_resolved" -> ChronicleEventKind.WORLD_EVENT
            else -> ChronicleEventKind.UNKNOWN
        }
    }
}
