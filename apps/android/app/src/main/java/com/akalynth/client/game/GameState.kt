package com.akalynth.client.game

import com.akalynth.client.BuildConfig
import com.akalynth.client.network.ConnectionState
import com.akalynth.client.protocol.GatherNodePublic
import com.akalynth.client.protocol.GatherStationPublic
import com.akalynth.client.protocol.MapName
import com.akalynth.client.protocol.PlayLoopProgress
import com.akalynth.client.protocol.PlayerPublic
import com.akalynth.client.protocol.PropertyPublic
import com.akalynth.client.ui.state.ChronicleEvent

data class GameState(
    val connection: ConnectionState = ConnectionState.Idle,
    val session: SessionState = SessionState(),
    val world: WorldState = WorldState(),
    val progression: ProgressionState = ProgressionState(),
    val economy: EconomyState = EconomyState(),
    val gather: GatherState = GatherState(),
    val ui: UiState = UiState()
) {
    companion object {
        val INITIAL = GameState()
    }
}

data class SessionState(
    val guestToken: String? = null,
    val playerId: String? = null,
    val playerName: String? = null,
    val savedCharacterName: String? = null,
    val serverUrl: String = BuildConfig.WS_BASE_URL
)

data class WorldState(
    val currentMap: MapName = MapName.ROOKGUARD,
    val me: PlayerPublic? = null,
    val otherPlayers: Map<String, PlayerPublic> = emptyMap(),
    val chatMessages: List<ChatEntry> = emptyList()
)

data class ProgressionState(
    val loop: PlayLoopProgress? = null,
    val lastEvent: String? = null
)

data class EconomyState(
    val gold: Int? = null,
    val properties: Map<String, PropertyPublic> = emptyMap(),
    val lastPropertyResult: PropertyResultStatus? = null,
    val work: WorkContractStatus? = null
)

data class GatherState(
    val nodes: Map<String, GatherNodePublic> = emptyMap(),
    val stations: Map<String, GatherStationPublic> = emptyMap(),
    val activeNodeId: String? = null,
    // Refine (step 3): station being refined at, or null. Gathering XOR refining, so progressPct
    // is shared between the two activities.
    val activeRefineStationId: String? = null,
    val progressPct: Float = 0f,
    val heldItemType: String? = null,
    val tendingTokens: Int = 0,
    val keystoneTokens: Int = 0,
    val status: String? = null,
) {
    val isEnabled: Boolean get() = nodes.isNotEmpty() || stations.isNotEmpty()
}

data class PropertyResultStatus(
    val action: String,
    val propertyId: String,
    val success: Boolean,
    val reason: String? = null
)

data class WorkContractStatus(
    val contractId: String,
    val contractType: String,
    val payoutGold: Int? = null,
    val ticksObserved: Int = 0,
    val ticksRequired: Int = 0,
    val remainingMs: Long? = null,
    val complete: Boolean = false,
    val error: String? = null
)

data class ChatEntry(
    val id: String,
    val from: String,
    val message: String,
    val timestamp: Long
)

data class UiState(
    val temChallenge: TemChallengeData? = null,
    val witnessRequest: WitnessRequestData? = null,
    val npcDialogue: NpcDialogueStatus? = null,
    val errorMessage: String? = null,
    val chatOpen: Boolean = false,
    val showChronicleSheet: Boolean = false,
    val chronicleEvents: List<ChronicleEvent> = emptyList(),
    val chronicleHasMore: Boolean = false,
    val debugLog: List<DebugLogEntry> = emptyList(),
    val showDebugDrawer: Boolean = false,
    val connectionDiagnostics: ConnectionDiagnostics = ConnectionDiagnostics(),
    val healthCheck: HealthCheckState = HealthCheckState.Unknown
)

data class DebugLogEntry(
    val timestamp: Long,
    val direction: String, // "→" for sent, "←" for received
    val messageType: String,
    val preview: String
)

data class TemChallengeData(
    val challengeId: String,
    val message: String,
    val expiresAt: Long,
    val inlineError: String? = null
)

data class WitnessRequestData(
    val requestId: String,
    val prompt: String,
    val expiresAt: Long
)

data class NpcDialogueStatus(
    val npcId: String,
    val placeId: String? = null,
    val tier: String? = null,
    val line: String? = null,
    val error: String? = null
)

data class ConnectionDiagnostics(
    val lastCloseCode: Int? = null,
    val lastCloseReason: String? = null,
    val reconnectAttempts: Int = 0,
    val nextBackoffMs: Long = 0L,
    val nextReconnectAtMs: Long? = null
)

sealed class HealthCheckState {
    data object Unknown : HealthCheckState()
    data object Checking : HealthCheckState()
    data class Reachable(
        val version: String,
        val tickMs: Int,
        val checkedAtMs: Long
    ) : HealthCheckState()
    data class Unreachable(
        val message: String,
        val checkedAtMs: Long
    ) : HealthCheckState()
}
