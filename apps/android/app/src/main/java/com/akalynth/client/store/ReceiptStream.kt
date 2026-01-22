package com.akalynth.client.store

import com.akalynth.client.ui.state.ChronicleEvent
import com.akalynth.client.ui.state.ChronicleEventDetails
import com.akalynth.client.ui.state.ChronicleEventKind
import com.akalynth.client.ui.state.EventSource
import com.akalynth.client.ui.state.EventStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Receipt stream for parsing and emitting server receipts.
 *
 * Responsibilities:
 * - Parse incoming WebSocket messages
 * - Convert receipts to ChronicleEvents
 * - Emit events to subscribers (ChronicleStore)
 *
 * Supported message types:
 * - chronicle_event: Single event from server
 * - chronicle_snapshot: Bulk events (initial sync)
 * - receipt_ack: Acknowledgment of client action
 * - receipt_reject: Rejection of client action
 */
class ReceiptStream {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val _events = MutableSharedFlow<ReceiptMessage>(
        replay = 0,
        extraBufferCapacity = 64
    )

    /** Flow of parsed receipt messages */
    val messages: Flow<ReceiptMessage> = _events.asSharedFlow()

    /**
     * Process a raw WebSocket message.
     *
     * @param rawMessage The raw JSON message from server
     * @return The parsed message, or null if invalid
     */
    suspend fun process(rawMessage: String): ReceiptMessage? {
        return try {
            val parsed = parseMessage(rawMessage)
            if (parsed != null) {
                _events.emit(parsed)
            }
            parsed
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Process a raw message without suspending.
     *
     * @param rawMessage The raw JSON message from server
     * @return The parsed message, or null if invalid/buffer full
     */
    fun processBlocking(rawMessage: String): ReceiptMessage? {
        return try {
            val parsed = parseMessage(rawMessage)
            if (parsed != null) {
                _events.tryEmit(parsed)
            }
            parsed
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Parse a raw JSON message into a ReceiptMessage.
     */
    private fun parseMessage(rawMessage: String): ReceiptMessage? {
        val jsonElement = json.parseToJsonElement(rawMessage)
        if (jsonElement !is JsonObject) return null

        val type = jsonElement["type"]?.jsonPrimitive?.contentOrNull ?: return null

        return when (type) {
            "chronicle_event" -> parseChronicleEvent(jsonElement)
            "chronicle_snapshot" -> parseChronicleSnapshot(jsonElement)
            "receipt_ack" -> parseReceiptAck(jsonElement)
            "receipt_reject" -> parseReceiptReject(jsonElement)
            else -> null
        }
    }

    /**
     * Parse a single chronicle event message.
     */
    private fun parseChronicleEvent(jsonObject: JsonObject): ReceiptMessage.Event? {
        val payload = jsonObject["payload"]?.jsonObject ?: return null
        val event = parseEventPayload(payload) ?: return null
        return ReceiptMessage.Event(event)
    }

    /**
     * Parse a chronicle snapshot (bulk events).
     */
    private fun parseChronicleSnapshot(jsonObject: JsonObject): ReceiptMessage.Snapshot? {
        val payload = jsonObject["payload"]?.jsonObject ?: return null
        val eventsArray = payload["events"]?.jsonArray ?: return null

        val events = eventsArray.mapNotNull { element ->
            if (element is JsonObject) {
                parseEventPayload(element)
            } else null
        }

        val hasMore = payload["has_more"]?.jsonPrimitive?.contentOrNull?.toBoolean() ?: false

        return ReceiptMessage.Snapshot(events, hasMore)
    }

    /**
     * Parse a receipt acknowledgment.
     */
    private fun parseReceiptAck(jsonObject: JsonObject): ReceiptMessage.Ack? {
        val payload = jsonObject["payload"]?.jsonObject ?: return null
        val actionId = payload["action_id"]?.jsonPrimitive?.contentOrNull ?: return null
        val eventId = payload["event_id"]?.jsonPrimitive?.contentOrNull ?: return null

        return ReceiptMessage.Ack(actionId, eventId)
    }

    /**
     * Parse a receipt rejection.
     */
    private fun parseReceiptReject(jsonObject: JsonObject): ReceiptMessage.Reject? {
        val payload = jsonObject["payload"]?.jsonObject ?: return null
        val actionId = payload["action_id"]?.jsonPrimitive?.contentOrNull ?: return null
        val reason = payload["reason"]?.jsonPrimitive?.contentOrNull ?: "unknown"

        return ReceiptMessage.Reject(actionId, reason)
    }

    /**
     * Parse an event payload into a ChronicleEvent.
     */
    private fun parseEventPayload(payload: JsonObject): ChronicleEvent? {
        val id = payload["id"]?.jsonPrimitive?.contentOrNull ?: return null
        val kindStr = payload["kind"]?.jsonPrimitive?.contentOrNull ?: return null
        val timestamp = payload["timestamp"]?.jsonPrimitive?.contentOrNull ?: return null
        val zone = payload["zone"]?.jsonPrimitive?.contentOrNull ?: return null
        val x = payload["x"]?.jsonPrimitive?.intOrNull ?: return null
        val y = payload["y"]?.jsonPrimitive?.intOrNull ?: return null

        val kind = parseEventKind(kindStr)
        val details = parseEventDetails(payload["details"]?.jsonObject)
        val actionId = payload["action_id"]?.jsonPrimitive?.contentOrNull

        return ChronicleEvent(
            id = id,
            kind = kind,
            timestamp = timestamp,
            zone = zone,
            x = x,
            y = y,
            details = details,
            status = EventStatus.CONFIRMED,
            source = EventSource.SERVER_RECEIPT,
            actionId = actionId
        )
    }

    /**
     * Parse event kind from string.
     */
    private fun parseEventKind(kindStr: String): ChronicleEventKind {
        return when (kindStr.lowercase()) {
            "death" -> ChronicleEventKind.DEATH
            "zone_enter" -> ChronicleEventKind.ZONE_ENTER
            "item_pickup" -> ChronicleEventKind.ITEM_PICKUP
            "item_drop" -> ChronicleEventKind.ITEM_DROP
            "combat_kill" -> ChronicleEventKind.COMBAT_KILL
            "tutorial_complete" -> ChronicleEventKind.TUTORIAL_COMPLETE
            "character_created" -> ChronicleEventKind.CHARACTER_CREATED
            else -> ChronicleEventKind.UNKNOWN
        }
    }

    /**
     * Parse event details from JSON object.
     */
    private fun parseEventDetails(detailsObj: JsonObject?): ChronicleEventDetails {
        if (detailsObj == null) return ChronicleEventDetails()

        return ChronicleEventDetails(
            killerName = detailsObj["killer_name"]?.jsonPrimitive?.contentOrNull,
            itemsLost = detailsObj["items_lost"]?.jsonArray?.mapNotNull {
                it.jsonPrimitive.contentOrNull
            },
            itemName = detailsObj["item_name"]?.jsonPrimitive?.contentOrNull,
            victimName = detailsObj["victim_name"]?.jsonPrimitive?.contentOrNull,
            fromZone = detailsObj["from_zone"]?.jsonPrimitive?.contentOrNull
        )
    }
}

/**
 * Parsed receipt message types.
 */
sealed class ReceiptMessage {
    /**
     * Single chronicle event from server.
     */
    data class Event(
        val event: ChronicleEvent
    ) : ReceiptMessage()

    /**
     * Bulk chronicle events (initial sync or pagination).
     */
    data class Snapshot(
        val events: List<ChronicleEvent>,
        val hasMore: Boolean
    ) : ReceiptMessage()

    /**
     * Acknowledgment of client action.
     * Used to confirm pending events.
     */
    data class Ack(
        val actionId: String,
        val eventId: String
    ) : ReceiptMessage()

    /**
     * Rejection of client action.
     * Used to rollback optimistic events.
     */
    data class Reject(
        val actionId: String,
        val reason: String
    ) : ReceiptMessage()
}
