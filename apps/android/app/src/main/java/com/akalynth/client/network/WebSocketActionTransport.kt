package com.akalynth.client.network

import com.akalynth.client.actions.ActionIntent
import com.akalynth.client.actions.ActionTransport
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject

/**
 * WebSocket-based action transport.
 *
 * Sends ActionIntents over WebSocket connection as JSON messages.
 * Server must round-trip actionId in the receipt for correlation.
 */
class WebSocketActionTransport(
    private val connection: WebSocketConnection,
    private val json: Json = Json { ignoreUnknownKeys = true }
) : ActionTransport {

    override suspend fun send(intent: ActionIntent) {
        val message = serializeIntent(intent)
        connection.send(message)
    }

    /**
     * Serialize ActionIntent to JSON message format.
     *
     * Message format matches server protocol:
     * {
     *   "type": "<action_type>",
     *   "action_id": "<correlation_id>",
     *   "payload": { ... }
     * }
     */
    private fun serializeIntent(intent: ActionIntent): String {
        val jsonObject = when (intent) {
            is ActionIntent.Attack -> buildJsonObject {
                put("type", "attack")
                put("action_id", intent.actionId)
                putJsonObject("payload") {
                    intent.targetId?.let { put("target_id", it) }
                }
            }

            is ActionIntent.UseHotbarSlot -> buildJsonObject {
                put("type", "use_hotbar_slot")
                put("action_id", intent.actionId)
                putJsonObject("payload") {
                    put("slot_index", intent.slotIndex)
                    put("item_id", intent.itemId)
                }
            }

            is ActionIntent.DropHotbarSlot -> buildJsonObject {
                put("type", "drop_hotbar_slot")
                put("action_id", intent.actionId)
                putJsonObject("payload") {
                    put("slot_index", intent.slotIndex)
                    put("item_id", intent.itemId)
                    put("item_name", intent.itemName)
                    put("rarity", intent.rarity.name.lowercase())
                }
            }

            is ActionIntent.PickupItem -> buildJsonObject {
                put("type", "pickup_item")
                put("action_id", intent.actionId)
                putJsonObject("payload") {
                    put("item_id", intent.itemId)
                    put("item_name", intent.itemName)
                    put("x", intent.x)
                    put("y", intent.y)
                }
            }

            is ActionIntent.CreateCharacter -> buildJsonObject {
                put("type", "create_character")
                put("action_id", intent.actionId)
                putJsonObject("payload") {
                    put("name", intent.name)
                    put("sex", intent.sex.name.lowercase())
                }
            }
        }

        return json.encodeToString(jsonObject)
    }
}
