package com.akalynth.client.ui.diagnostics

import com.akalynth.client.game.ConnectionDiagnostics
import com.akalynth.client.game.GameState
import com.akalynth.client.game.HealthCheckState
import com.akalynth.client.game.SessionState
import com.akalynth.client.game.UiState
import com.akalynth.client.network.ConnectionState
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DiagnosticsFormatterTest {
    @Test
    fun diagnosticsIncludeLaneVersionEndpointsAndReconnectData() {
        val state = GameState.INITIAL.copy(
            connection = ConnectionState.Error("network down"),
            session = SessionState(
                playerName = "Tester",
                serverUrl = "wss://beta-api.akalynth.com"
            ),
            ui = UiState(
                healthCheck = HealthCheckState.Reachable("0.1.0", 100, 1L),
                connectionDiagnostics = ConnectionDiagnostics(
                    reconnectAttempts = 2,
                    nextBackoffMs = 1500,
                    nextReconnectAtMs = 1234,
                    lastCloseCode = 1006,
                    lastCloseReason = "abnormal"
                )
            )
        )

        val text = DiagnosticsFormatter.format(state)

        assertTrue(text.contains("lane=Beta"))
        assertTrue(text.contains("ws=wss://beta-api.akalynth.com"))
        assertTrue(text.contains("health=https://beta-api.akalynth.com/v1/health"))
        assertTrue(text.contains("connection=Error: network down"))
        assertTrue(text.contains("health_state=Reachable v0.1.0 tick=100ms"))
        assertTrue(text.contains("reconnect_attempts=2"))
        assertTrue(text.contains("next_reconnect_at_ms=1234"))
        assertFalse(text.contains("guest_token"))
        assertFalse(text.contains("token="))
    }

    @Test
    fun issueReportWrapsDiagnosticsWithoutSecrets() {
        val state = GameState.INITIAL.copy(
            session = SessionState(
                playerName = "Reporter",
                serverUrl = "wss://beta-api.akalynth.com"
            )
        )

        val text = DiagnosticsFormatter.formatIssueReport(state)

        assertTrue(text.contains("Akalynth Android issue report"))
        assertTrue(text.contains("What happened:"))
        assertTrue(text.contains("lane=Beta"))
        assertFalse(text.contains("guest_token"))
        assertFalse(text.contains("token="))
    }
}
