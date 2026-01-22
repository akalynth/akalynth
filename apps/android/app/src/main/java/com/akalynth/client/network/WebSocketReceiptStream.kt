package com.akalynth.client.network

import com.akalynth.client.chronicle.Receipt
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.mapNotNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

/**
 * WebSocket-based receipt stream.
 *
 * Parses incoming WebSocket messages and emits Receipts.
 * Handles chronicle_event and chronicle_snapshot message types.
 */
class WebSocketReceiptStream(
    private val connection: WebSocketConnection,
    private val json: Json = Json { ignoreUnknownKeys = true },
    private val replayProvider: suspend () -> List<Receipt> = { emptyList() }
) : ReceiptStream {

    override fun receipts(): Flow<Receipt> {
        return connection.incoming().mapNotNull { message ->
            parseMessage(message)
        }
    }

    override suspend fun replay(): List<Receipt> {
        return replayProvider()
    }

    /**
     * Parse a WebSocket message into a Receipt.
     * Returns null for non-receipt messages.
     */
    private fun parseMessage(rawMessage: String): Receipt? {
        return try {
            val jsonElement = json.parseToJsonElement(rawMessage)
            if (jsonElement !is JsonObject) return null

            val type = jsonElement["type"]?.jsonPrimitive?.contentOrNull ?: return null

            when (type) {
                "chronicle_event" -> parseChronicleEvent(jsonElement)
                // chronicle_snapshot handled separately (multiple receipts)
                "receipt_ack" -> null // Handled by ReceiptIngestionService
                "receipt_reject" -> null // Handled by ReceiptIngestionService
                else -> null
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Parse chronicle_event message into Receipt.
     */
    private fun parseChronicleEvent(jsonObject: JsonObject): Receipt? {
        val payload = jsonObject["payload"]?.jsonObject ?: return null
        return parseReceiptPayload(payload)
    }

    /**
     * Parse receipt payload into Receipt.
     */
    private fun parseReceiptPayload(payload: JsonObject): Receipt? {
        val receiptId = payload["id"]?.jsonPrimitive?.contentOrNull
            ?: payload["receipt_id"]?.jsonPrimitive?.contentOrNull
            ?: return null

        val type = payload["kind"]?.jsonPrimitive?.contentOrNull
            ?: payload["type"]?.jsonPrimitive?.contentOrNull
            ?: return null

        val timestampMs = payload["timestamp_ms"]?.jsonPrimitive?.longOrNull
            ?: parseTimestampString(payload["timestamp"]?.jsonPrimitive?.contentOrNull)
            ?: System.currentTimeMillis()

        val actionId = payload["action_id"]?.jsonPrimitive?.contentOrNull

        // Extract payload fields for details
        val details = buildMap<String, Any?> {
            payload["zone"]?.jsonPrimitive?.contentOrNull?.let { put("zone", it) }
            payload["x"]?.jsonPrimitive?.intOrNull?.let { put("x", it) }
            payload["y"]?.jsonPrimitive?.intOrNull?.let { put("y", it) }

            // Copy all detail fields
            payload["details"]?.jsonObject?.let { detailsObj ->
                detailsObj.forEach { (key, value) ->
                    val v = when {
                        value.jsonPrimitive.isString -> value.jsonPrimitive.content
                        value.jsonPrimitive.longOrNull != null -> value.jsonPrimitive.longOrNull
                        value.jsonPrimitive.intOrNull != null -> value.jsonPrimitive.intOrNull
                        else -> value.jsonPrimitive.contentOrNull
                    }
                    put(key, v)
                }
            }

            // Direct fields that might be at top level
            payload["killer_name"]?.jsonPrimitive?.contentOrNull?.let { put("killer_name", it) }
            payload["item_name"]?.jsonPrimitive?.contentOrNull?.let { put("item_name", it) }
            payload["victim_name"]?.jsonPrimitive?.contentOrNull?.let { put("victim_name", it) }
            payload["from_zone"]?.jsonPrimitive?.contentOrNull?.let { put("from_zone", it) }

            // Items lost array
            payload["items_lost"]?.jsonArray?.let { arr ->
                put("items_lost", arr.mapNotNull { it.jsonPrimitive.contentOrNull })
            }
        }

        return Receipt(
            receiptId = receiptId,
            actionId = actionId,
            type = type,
            timestampMs = timestampMs,
            payload = details
        )
    }

    /**
     * Parse ISO 8601 timestamp string to epoch millis.
     */
    private fun parseTimestampString(timestamp: String?): Long? {
        if (timestamp == null) return null
        return try {
            java.time.Instant.parse(timestamp).toEpochMilli()
        } catch (e: Exception) {
            null
        }
    }

    companion object {
        /**
         * Parse a chronicle_snapshot message into a list of Receipts.
         * Useful for replay.
         */
        fun parseSnapshot(rawMessage: String, json: Json = Json { ignoreUnknownKeys = true }): List<Receipt> {
            return try {
                val jsonElement = json.parseToJsonElement(rawMessage)
                if (jsonElement !is JsonObject) return emptyList()

                val type = jsonElement["type"]?.jsonPrimitive?.contentOrNull
                if (type != "chronicle_snapshot") return emptyList()

                val payload = jsonElement["payload"]?.jsonObject ?: return emptyList()
                val events = payload["events"]?.jsonArray ?: return emptyList()

                events.mapNotNull { element ->
                    if (element is JsonObject) {
                        parseReceiptPayloadStatic(element, json)
                    } else null
                }
            } catch (e: Exception) {
                emptyList()
            }
        }

        private fun parseReceiptPayloadStatic(payload: JsonObject, json: Json): Receipt? {
            val receiptId = payload["id"]?.jsonPrimitive?.contentOrNull
                ?: payload["receipt_id"]?.jsonPrimitive?.contentOrNull
                ?: return null

            val type = payload["kind"]?.jsonPrimitive?.contentOrNull
                ?: payload["type"]?.jsonPrimitive?.contentOrNull
                ?: return null

            val timestampMs = payload["timestamp_ms"]?.jsonPrimitive?.longOrNull
                ?: try {
                    payload["timestamp"]?.jsonPrimitive?.contentOrNull?.let {
                        java.time.Instant.parse(it).toEpochMilli()
                    }
                } catch (e: Exception) { null }
                ?: System.currentTimeMillis()

            val actionId = payload["action_id"]?.jsonPrimitive?.contentOrNull

            val details = buildMap<String, Any?> {
                payload["zone"]?.jsonPrimitive?.contentOrNull?.let { put("zone", it) }
                payload["x"]?.jsonPrimitive?.intOrNull?.let { put("x", it) }
                payload["y"]?.jsonPrimitive?.intOrNull?.let { put("y", it) }
            }

            return Receipt(
                receiptId = receiptId,
                actionId = actionId,
                type = type,
                timestampMs = timestampMs,
                payload = details
            )
        }
    }
}
