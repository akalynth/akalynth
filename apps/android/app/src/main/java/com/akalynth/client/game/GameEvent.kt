package com.akalynth.client.game

import com.akalynth.client.protocol.Direction
import com.akalynth.client.protocol.SovereignVocation
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
    data class RouteSurvey(val skillId: String) : GameEvent()

    // NPC dialogue
    data class TalkToNpc(val npcId: String) : GameEvent()

    // Rookguard Codex profession
    data class DeclareVocation(val vocation: SovereignVocation) : GameEvent()

    // High City economy/property intents
    data object InspectWallet : GameEvent()
    data class BuyHouse(val propertyId: String) : GameEvent()
    data class ListHouse(val propertyId: String, val price: Int) : GameEvent()
    data class UnlistHouse(val propertyId: String) : GameEvent()

    // Work-contract faucet intents
    data object StartWorkContract : GameEvent()
    data object TickWorkContract : GameEvent()

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
