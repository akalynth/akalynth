package com.akalynth.client.action

import com.akalynth.client.protocol.Direction
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.UUID

/**
 * Client action intents for server communication.
 *
 * Each intent represents a player action that will be sent to the server.
 * Actions generate correlation IDs for matching with server receipts.
 *
 * Lifecycle:
 * 1. UI triggers action (tap, long-press, etc.)
 * 2. ActionBus.dispatch(intent) generates correlationId
 * 3. Intent sent to server via WebSocket
 * 4. Server processes and returns receipt with matching correlationId
 * 5. ChronicleStore matches receipt to pending event
 */
@Serializable
sealed class ActionIntent {
    /** Correlation ID for matching server receipts */
    abstract val actionId: String

    /** Timestamp when action was created (ISO 8601) */
    abstract val timestamp: String

    /**
     * Move intent: player wants to move in a direction.
     */
    @Serializable
    @SerialName("move")
    data class Move(
        val direction: Direction,
        override val actionId: String = generateActionId(),
        override val timestamp: String = currentTimestamp()
    ) : ActionIntent()

    /**
     * Item drop intent: player wants to drop an item from hotbar.
     */
    @Serializable
    @SerialName("drop")
    data class Drop(
        val slotIndex: Int,
        val itemId: String,
        override val actionId: String = generateActionId(),
        override val timestamp: String = currentTimestamp()
    ) : ActionIntent()

    /**
     * Item pickup intent: player wants to pick up an item from ground.
     */
    @Serializable
    @SerialName("pickup")
    data class Pickup(
        val itemId: String,
        val x: Int,
        val y: Int,
        override val actionId: String = generateActionId(),
        override val timestamp: String = currentTimestamp()
    ) : ActionIntent()

    /**
     * Chat message intent: player wants to send a chat message.
     */
    @Serializable
    @SerialName("chat")
    data class Chat(
        val message: String,
        val channel: ChatChannel = ChatChannel.LOCAL,
        override val actionId: String = generateActionId(),
        override val timestamp: String = currentTimestamp()
    ) : ActionIntent()

    /**
     * Use item intent: player wants to use an item from hotbar.
     */
    @Serializable
    @SerialName("use_item")
    data class UseItem(
        val slotIndex: Int,
        val itemId: String,
        val targetX: Int? = null,
        val targetY: Int? = null,
        override val actionId: String = generateActionId(),
        override val timestamp: String = currentTimestamp()
    ) : ActionIntent()

    companion object {
        /**
         * Generate unique action ID for correlation.
         * Format: action_{uuid}
         */
        fun generateActionId(): String = "action_${UUID.randomUUID()}"

        /**
         * Get current timestamp in ISO 8601 format.
         */
        fun currentTimestamp(): String {
            return java.time.Instant.now().toString()
        }
    }
}


/**
 * Chat channel enum.
 */
@Serializable
enum class ChatChannel {
    @SerialName("local") LOCAL,
    @SerialName("global") GLOBAL,
    @SerialName("party") PARTY,
    @SerialName("whisper") WHISPER
}
