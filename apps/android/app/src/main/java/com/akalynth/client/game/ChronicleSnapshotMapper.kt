package com.akalynth.client.game

import com.akalynth.client.protocol.ChronicleEvent as WireChronicleEvent
import com.akalynth.client.protocol.ChronicleSnapshotMessage
import com.akalynth.client.ui.state.ChronicleEvent
import com.akalynth.client.ui.state.ChronicleEventDetails
import com.akalynth.client.ui.state.ChronicleEventKind
import com.akalynth.client.ui.state.EventSource
import com.akalynth.client.ui.state.EventStatus
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

data class ChronicleSnapshotUi(
    val events: List<ChronicleEvent>,
    val hasMore: Boolean
)

object ChronicleSnapshotMapper {
    fun map(snapshot: ChronicleSnapshotMessage): ChronicleSnapshotUi =
        ChronicleSnapshotUi(
            events = snapshot.events.mapIndexed { index, event -> event.toUiChronicleEvent(index) },
            hasMore = snapshot.hasMore
        )

    fun mapEvent(event: WireChronicleEvent, index: Int = 0): ChronicleEvent =
        event.toUiChronicleEvent(index)

    private fun WireChronicleEvent.toUiChronicleEvent(index: Int): ChronicleEvent {
        val detailsObject = details as? JsonObject
        val receiptId = evidenceRef?.chronicleEventId?.toString()
        return ChronicleEvent(
            id = receiptId ?: "${kind}_${timestamp}_$index",
            kind = mapChronicleKind(kind),
            timestamp = timestamp,
            zone = zone ?: "Unknown",
            x = x ?: 0,
            y = y ?: 0,
            details = ChronicleEventDetails(
                killerName = detailsObject?.string("killer_name") ?: detailsObject?.string("killerName"),
                itemsLost = detailsObject?.stringList("items_lost") ?: detailsObject?.stringList("itemsLost"),
                itemName = detailsObject?.string("item_name") ?: detailsObject?.string("itemName"),
                victimName = detailsObject?.string("victim_name") ?: detailsObject?.string("victimName"),
                fromZone = detailsObject?.string("from_zone") ?: detailsObject?.string("fromZone"),
                eventId = detailsObject?.string("event_id") ?: detailsObject?.string("eventId"),
                phase = detailsObject?.string("phase"),
                contributionId = detailsObject?.string("contribution_id")
                    ?: detailsObject?.string("contributionId"),
                outcome = detailsObject?.string("outcome")
            ),
            status = EventStatus.CONFIRMED,
            source = EventSource.SERVER_RECEIPT
        )
    }

    private fun mapChronicleKind(kind: String): ChronicleEventKind = when (kind.lowercase()) {
        "death" -> ChronicleEventKind.DEATH
        "zone_enter" -> ChronicleEventKind.ZONE_ENTER
        "item_pickup" -> ChronicleEventKind.ITEM_PICKUP
        "item_drop" -> ChronicleEventKind.ITEM_DROP
        "combat_kill" -> ChronicleEventKind.COMBAT_KILL
        "tutorial_complete" -> ChronicleEventKind.TUTORIAL_COMPLETE
        "character_created" -> ChronicleEventKind.CHARACTER_CREATED
        "world_event",
        "world_event_started",
        "world_event_contribution",
        "world_event_resolved" -> ChronicleEventKind.WORLD_EVENT
        else -> ChronicleEventKind.UNKNOWN
    }

    private fun JsonObject.string(name: String): String? =
        (this[name] as? JsonPrimitive)?.contentOrNull

    private fun JsonObject.stringList(name: String): List<String>? =
        (this[name] as? JsonArray)
            ?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }
            ?.takeIf { it.isNotEmpty() }
}
