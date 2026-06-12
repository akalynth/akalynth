package com.akalynth.client.game

import com.akalynth.client.BuildConfig
import com.akalynth.client.network.ConnectionState
import com.akalynth.client.protocol.MapName
import com.akalynth.client.protocol.PlayerPublic
import com.akalynth.client.protocol.PropertyPublic
import com.akalynth.client.ui.state.ChronicleEvent

data class GameState(
    val connection: ConnectionState = ConnectionState.Idle,
    val session: SessionState = SessionState(),
    val world: WorldState = WorldState(),
    val economy: EconomyState = EconomyState(),
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

data class EconomyState(
    val gold: Int? = null,
    val properties: Map<String, PropertyPublic> = emptyMap(),
    val lastPropertyResult: PropertyResultStatus? = null
)

data class PropertyResultStatus(
    val action: String,
    val propertyId: String,
    val success: Boolean,
    val reason: String? = null
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
    val expiresAt: Long
)

data class WitnessRequestData(
    val requestId: String,
    val prompt: String,
    val expiresAt: Long
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
