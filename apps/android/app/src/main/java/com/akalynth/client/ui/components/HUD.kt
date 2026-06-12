package com.akalynth.client.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.akalynth.client.network.ConnectionState
import com.akalynth.client.protocol.PlayerPublic
import com.akalynth.client.protocol.PlayerStatus
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors
import com.akalynth.client.ui.theme.ClassicStatusDot

@Composable
fun HUD(
    playerName: String?,
    me: PlayerPublic?,
    playerCount: Int,
    gold: Int? = null,
    propertyCount: Int = 0,
    propertyStatus: String? = null,
    workStatus: String? = null,
    npcStatus: String? = null,
    connectionState: ConnectionState,
    modifier: Modifier = Modifier
) {
    ClassicPanel(
        modifier = modifier
            .padding(12.dp)
            .widthIn(min = 150.dp, max = 250.dp),
        contentPadding = PaddingValues(10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ClassicStatusDot(
                color = when (connectionState) {
                    is ConnectionState.InWorld -> ClassicShellColors.Good
                    is ConnectionState.Connected,
                    is ConnectionState.Authenticating -> ClassicShellColors.Warning
                    else -> ClassicShellColors.Danger
                },
                modifier = Modifier
                    .size(11.dp)
            )
            Text(
                text = when (connectionState) {
                    is ConnectionState.InWorld -> "Connected"
                    is ConnectionState.Authenticating -> "Authenticating..."
                    is ConnectionState.Connected -> "Connected"
                    is ConnectionState.Connecting -> "Connecting..."
                    is ConnectionState.Disconnected -> "Disconnected"
                    is ConnectionState.Error -> "Error"
                    is ConnectionState.Idle -> "Idle"
                },
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = ClassicShellColors.Text
            )
        }

        playerName?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = ClassicShellColors.Text
            )
        }

        me?.let { player ->
            Text(
                text = "Pos: ${player.x}, ${player.y}",
                style = MaterialTheme.typography.bodySmall,
                color = ClassicShellColors.MutedText
            )

            if (player.status == PlayerStatus.DEAD) {
                Text(
                    text = "DEAD",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = ClassicShellColors.Danger
                )
            }
        }

        if (playerCount > 0) {
            Text(
                text = "Nearby: $playerCount",
                style = MaterialTheme.typography.bodySmall,
                color = ClassicShellColors.MutedText
            )
        }

        gold?.let {
            Text(
                text = "Gold: $it",
                style = MaterialTheme.typography.bodySmall,
                color = ClassicShellColors.Brass
            )
        }

        if (propertyCount > 0) {
            Text(
                text = "Properties seen: $propertyCount",
                style = MaterialTheme.typography.bodySmall,
                color = ClassicShellColors.MutedText
            )
        }

        propertyStatus?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = ClassicShellColors.MutedText
            )
        }

        workStatus?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = ClassicShellColors.MutedText
            )
        }

        npcStatus?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = ClassicShellColors.MutedText
            )
        }
    }
}
