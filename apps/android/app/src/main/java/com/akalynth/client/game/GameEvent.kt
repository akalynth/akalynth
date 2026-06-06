package com.akalynth.client.game

import com.akalynth.client.protocol.Direction
import com.akalynth.client.protocol.WitnessResponse

sealed class GameEvent {
    // Connection
    data object Connect : GameEvent()
    data object Disconnect : GameEvent()
    data object CheckHealth : GameEvent()
    data object ResetServerUrl : GameEvent()

    // Movement
    data class Move(val direction: Direction) : GameEvent()

    // Chat
    data class SendChat(val message: String) : GameEvent()
    data object ToggleChat : GameEvent()

    // Combat
    data class Attack(val targetId: String) : GameEvent()

    // World events
    data class WorldEventContribution(val contributionId: String) : GameEvent()

    // Tem/Witness
    data class AnswerTemChallenge(val response: String) : GameEvent()
    data class AnswerWitness(val requestId: String, val response: WitnessResponse) : GameEvent()

    // UI
    data object DismissError : GameEvent()
    data object DismissTemChallenge : GameEvent()
    data object DismissWitnessRequest : GameEvent()
    data object ToggleChronicle : GameEvent()

    // Settings
    data class SetServerUrl(val url: String) : GameEvent()

    // Debug
    data object ToggleDebugDrawer : GameEvent()
    data object ClearDebugLog : GameEvent()
}
