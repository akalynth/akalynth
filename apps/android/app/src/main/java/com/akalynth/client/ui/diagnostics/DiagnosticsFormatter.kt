package com.akalynth.client.ui.diagnostics

import com.akalynth.client.game.GameState
import com.akalynth.client.game.HealthCheckState
import com.akalynth.client.game.ConnectionDiagnostics
import com.akalynth.client.network.ConnectionState
import com.akalynth.client.network.EndpointInfo

object DiagnosticsFormatter {
    fun format(state: GameState): String {
        val endpoint = EndpointInfo.fromWsUrl(state.session.serverUrl)
        val diagnostics = state.ui.connectionDiagnostics
        return buildString {
            appendLine("Akalynth Android diagnostics")
            appendLine("lane=${endpoint.lane}")
            appendLine("version=${endpoint.appVersion}")
            appendLine("build=${endpoint.buildType}")
            appendLine("ws=${endpoint.wsUrl}")
            appendLine("health=${endpoint.httpBaseUrl}/v1/health")
            appendLine("connection=${connectionLabel(state.connection)}")
            appendLine("health_state=${healthLabel(state.ui.healthCheck)}")
            appendLine("reconnect_attempts=${diagnostics.reconnectAttempts}")
            appendLine("next_backoff_ms=${diagnostics.nextBackoffMs}")
            appendLine("next_reconnect_at_ms=${diagnostics.nextReconnectAtMs ?: ""}")
            appendLine("last_close_code=${diagnostics.lastCloseCode ?: ""}")
            appendLine("last_close_reason=${diagnostics.lastCloseReason ?: ""}")
            appendLine("player=${state.session.playerName ?: state.session.savedCharacterName ?: ""}")
            appendLine("map=${state.world.currentMap.displayName}")
            appendLine("nearby=${state.world.otherPlayers.size}")
        }
    }

    fun formatIssueReport(state: GameState): String = buildString {
        appendLine("Akalynth Android issue report")
        appendLine()
        appendLine("What happened:")
        appendLine("- ")
        appendLine()
        appendLine("Diagnostics:")
        append(format(state))
    }

    fun connectionLabel(connection: ConnectionState): String = when (connection) {
        is ConnectionState.Idle -> "Idle"
        is ConnectionState.Connecting -> "Connecting"
        is ConnectionState.Connected -> "Connected"
        is ConnectionState.Authenticating -> "Authenticating"
        is ConnectionState.InWorld -> "In world"
        is ConnectionState.Disconnected -> "Disconnected: ${connection.reason.ifBlank { "closed" }}"
        is ConnectionState.Error -> "Error: ${connection.message}"
    }

    fun healthLabel(health: HealthCheckState): String = when (health) {
        is HealthCheckState.Unknown -> "Not checked"
        is HealthCheckState.Checking -> "Checking"
        is HealthCheckState.Reachable -> "Reachable v${health.version} tick=${health.tickMs}ms"
        is HealthCheckState.Unreachable -> "Unreachable: ${health.message}"
    }

    fun reconnectCountdownLabel(diagnostics: ConnectionDiagnostics, nowMs: Long): String? {
        val nextReconnectAtMs = diagnostics.nextReconnectAtMs ?: return null
        val remainingSeconds = ((nextReconnectAtMs - nowMs).coerceAtLeast(0L) + 999L) / 1000L
        return "Reconnect #${diagnostics.reconnectAttempts} in ${remainingSeconds}s"
    }

    fun healthCheckedAtLabel(health: HealthCheckState, nowMs: Long): String? {
        val checkedAtMs = when (health) {
            is HealthCheckState.Reachable -> health.checkedAtMs
            is HealthCheckState.Unreachable -> health.checkedAtMs
            else -> null
        } ?: return null
        val ageSeconds = ((nowMs - checkedAtMs).coerceAtLeast(0L)) / 1000L
        return "Checked ${formatAge(ageSeconds)} ago"
    }

    private fun formatAge(ageSeconds: Long): String = when {
        ageSeconds < 60 -> "${ageSeconds}s"
        ageSeconds < 3600 -> "${ageSeconds / 60}m"
        else -> "${ageSeconds / 3600}h"
    }
}
