package com.akalynth.client.network

import com.akalynth.client.actions.ActionIntent
import com.akalynth.client.actions.ActionTransport
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Routes [ActionIntent] payloads through an existing [WsClient] connection.
 */
class WsClientActionTransport(
    private val wsClient: WsClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
) : ActionTransport {

    override suspend fun send(intent: ActionIntent) {
        wsClient.sendRaw(serializeIntent(intent))
    }

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

        return json.encodeToString(JsonObject.serializer(), jsonObject)
    }
}
