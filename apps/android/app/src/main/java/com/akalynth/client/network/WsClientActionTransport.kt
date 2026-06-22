package com.akalynth.client.network

import com.akalynth.client.actions.ActionIntent
import com.akalynth.client.actions.ActionTransport
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject

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

            is ActionIntent.WorldEventContribution -> buildJsonObject {
                put("type", "use_skill")
                put("action_id", intent.actionId)
                put("skill_id", intent.skillId)
            }
        }

        return json.encodeToString(JsonObject.serializer(), jsonObject)
    }
}