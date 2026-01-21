package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
sealed class ClientMessage {
    abstract val type: String
}

@Serializable
@SerialName("connect")
data object ConnectMessage : ClientMessage() {
    override val type: String = "connect"
}

@Serializable
@SerialName("login")
data class LoginMessage(
    @SerialName("guest_token") val guestToken: String? = null,
    val token: String? = null
) : ClientMessage() {
    override val type: String = "login"
}

@Serializable
@SerialName("enter_world")
data object EnterWorldMessage : ClientMessage() {
    override val type: String = "enter_world"
}

@Serializable
@SerialName("move_intent")
data class MoveIntentMessage(
    val direction: Direction
) : ClientMessage() {
    override val type: String = "move_intent"
}

@Serializable
@SerialName("chat")
data class ChatMessage(
    val message: String
) : ClientMessage() {
    override val type: String = "chat"
}

@Serializable
@SerialName("tem_response")
data class TemResponseMessage(
    val response: String
) : ClientMessage() {
    override val type: String = "tem_response"
}

@Serializable
@SerialName("tem_witness_response")
data class TemWitnessResponseMessage(
    @SerialName("request_id") val requestId: String,
    val response: WitnessResponse
) : ClientMessage() {
    override val type: String = "tem_witness_response"
}

@Serializable
@SerialName("attack_intent")
data class AttackIntentMessage(
    @SerialName("target_id") val targetId: String
) : ClientMessage() {
    override val type: String = "attack_intent"
}
