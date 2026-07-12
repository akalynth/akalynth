package com.akalynth.client.network

import com.akalynth.client.actions.ActionIntent
import com.akalynth.client.actions.ActionTransport
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

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
     *   [type-specific fields]
     * }
     */
    private fun serializeIntent(intent: ActionIntent): String {
        val jsonObject = when (intent) {
            is ActionIntent.Attack -> buildJsonObject {
                put("type", "attack_intent")
                put("action_id", intent.actionId)
                intent.targetId?.let {
                    put("target_id", it)
                }
            }

            is ActionIntent.UseHotbarSlot -> buildJsonObject {
                put("type", "use_skill")
                put("action_id", intent.actionId)
                put("skill_id", "item:use:${intent.itemId}")
            }

            is ActionIntent.DropHotbarSlot -> buildJsonObject {
                put("type", "drop_item")
                put("action_id", intent.actionId)
                put("item_id", intent.itemId)
            }

            is ActionIntent.PickupItem -> buildJsonObject {
                put("type", "pickup_item")
                put("action_id", intent.actionId)
                put("item_id", intent.itemId)
            }

            is ActionIntent.WorldEventContribution -> buildJsonObject {
                put("type", "use_skill")
                put("action_id", intent.actionId)
                put("skill_id", intent.skillId)
            }
        }

        return json.encodeToString(jsonObject)
    }
}
