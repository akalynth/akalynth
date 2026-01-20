package com.akalynth.client.protocol

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

object MessageSerializer {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    fun encodeClient(msg: ClientMessage): String {
        return when (msg) {
            is ConnectMessage -> """{"type":"connect"}"""
            is LoginMessage -> {
                val token = msg.guestToken?.let { """"$it"""" } ?: "null"
                """{"type":"login","guest_token":$token}"""
            }
            is EnterWorldMessage -> """{"type":"enter_world"}"""
            is MoveIntentMessage -> {
                val dir = when (msg.direction) {
                    Direction.NORTH -> "north"
                    Direction.SOUTH -> "south"
                    Direction.EAST -> "east"
                    Direction.WEST -> "west"
                }
                """{"type":"move_intent","direction":"$dir"}"""
            }
            is ChatMessage -> {
                val escaped = msg.message.replace("\\", "\\\\").replace("\"", "\\\"")
                """{"type":"chat","message":"$escaped"}"""
            }
            is TemResponseMessage -> {
                val escaped = msg.response.replace("\\", "\\\\").replace("\"", "\\\"")
                """{"type":"tem_response","response":"$escaped"}"""
            }
            is TemWitnessResponseMessage -> {
                val resp = when (msg.response) {
                    WitnessResponse.CONFIRM -> "confirm"
                    WitnessResponse.DENY -> "deny"
                    WitnessResponse.UNCERTAIN -> "uncertain"
                }
                """{"type":"tem_witness_response","request_id":"${msg.requestId}","response":"$resp"}"""
            }
            is AttackIntentMessage -> {
                """{"type":"attack_intent","target_id":"${msg.targetId}"}"""
            }
        }
    }

    fun decodeServer(raw: String): ServerMessage {
        return try {
            val obj = json.decodeFromString<JsonObject>(raw)
            val type = obj["type"]?.jsonPrimitive?.content ?: return UnknownMessage(raw)

            when (type) {
                "welcome" -> json.decodeFromString<WelcomeMessage>(raw)
                "login_ack" -> json.decodeFromString<LoginAckMessage>(raw)
                "world_state" -> json.decodeFromString<WorldStateMessage>(raw)
                "move_result" -> json.decodeFromString<MoveResultMessage>(raw)
                "player_moved" -> json.decodeFromString<PlayerMovedMessage>(raw)
                "player_joined" -> json.decodeFromString<PlayerJoinedMessage>(raw)
                "player_left" -> json.decodeFromString<PlayerLeftMessage>(raw)
                "chat_broadcast" -> json.decodeFromString<ChatBroadcastMessage>(raw)
                "tem_challenge" -> json.decodeFromString<TemChallengeMessage>(raw)
                "tem_witness_request" -> json.decodeFromString<TemWitnessRequestMessage>(raw)
                "error" -> json.decodeFromString<ErrorMessage>(raw)
                "death_notice" -> json.decodeFromString<DeathNoticeMessage>(raw)
                "combat_resolved" -> json.decodeFromString<CombatResolvedMessage>(raw)
                "combat_rejected" -> json.decodeFromString<CombatRejectedMessage>(raw)
                else -> UnknownMessage(raw)
            }
        } catch (e: Exception) {
            UnknownMessage(raw)
        }
    }
}
