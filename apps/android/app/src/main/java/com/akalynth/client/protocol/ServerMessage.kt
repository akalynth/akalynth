package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
sealed class ServerMessage

@Serializable
@SerialName("welcome")
data class WelcomeMessage(
    val version: String
) : ServerMessage()

@Serializable
@SerialName("login_ack")
data class LoginAckMessage(
    val ok: Boolean? = true,
    @SerialName("player_id") val playerId: String,
    @SerialName("guest_token") val guestToken: String? = null,
    val token: String? = null,
    @SerialName("expires_at") val expiresAt: Long? = null,
    val name: String,
    val reason: String? = null
) : ServerMessage()

@Serializable
@SerialName("world_state")
data class WorldStateMessage(
    val map: MapName,
    val player: PlayerPublic,
    @SerialName("nearby_players") val nearbyPlayers: List<PlayerPublic>
) : ServerMessage()

@Serializable
@SerialName("move_result")
data class MoveResultMessage(
    val ok: Boolean,
    val x: Int,
    val y: Int,
    val reason: String? = null,
    val map: MapName? = null
) : ServerMessage()

@Serializable
@SerialName("player_moved")
data class PlayerMovedMessage(
    @SerialName("player_id") val playerId: String,
    val x: Int,
    val y: Int
) : ServerMessage()

@Serializable
@SerialName("player_joined")
data class PlayerJoinedMessage(
    val player: PlayerPublic
) : ServerMessage()

@Serializable
@SerialName("player_left")
data class PlayerLeftMessage(
    @SerialName("player_id") val playerId: String
) : ServerMessage()

@Serializable
@SerialName("chat_broadcast")
data class ChatBroadcastMessage(
    @SerialName("player_id") val playerId: String,
    val name: String,
    val message: String
) : ServerMessage()

@Serializable
@SerialName("tem_challenge")
data class TemChallengeMessage(
    @SerialName("challenge_id") val challengeId: String,
    val message: String,
    @SerialName("timeout_seconds") val timeoutSeconds: Int
) : ServerMessage()

@Serializable
@SerialName("tem_witness_request")
data class TemWitnessRequestMessage(
    @SerialName("request_id") val requestId: String,
    val timestamp: String,
    val map: MapName,
    @SerialName("target_actor") val targetActor: String,
    val prompt: String,
    val kind: String
) : ServerMessage()

@Serializable
@SerialName("error")
data class ErrorMessage(
    val code: String,
    val message: String
) : ServerMessage()

@Serializable
@SerialName("death_notice")
data class DeathNoticeMessage(
    val ok: Boolean,
    @SerialName("respawn_in_ms") val respawnInMs: Long,
    val map: MapName,
    val spawn: SpawnPoint,
    val reason: String
) : ServerMessage()

@Serializable
data class SpawnPoint(val x: Int, val y: Int)

@Serializable
@SerialName("combat_resolved")
data class CombatResolvedMessage(
    @SerialName("attacker_id") val attackerId: String,
    @SerialName("defender_id") val defenderId: String,
    val outcome: String,
    val map: MapName,
    val x: Int,
    val y: Int
) : ServerMessage()

@Serializable
@SerialName("combat_rejected")
data class CombatRejectedMessage(
    val reason: String
) : ServerMessage()

// Fallback for unknown messages
data class UnknownMessage(val raw: String = "") : ServerMessage()
