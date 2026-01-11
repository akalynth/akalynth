package com.akalynth.client.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.akalynth.client.network.ConnectionState
import com.akalynth.client.protocol.PlayerPublic
import com.akalynth.client.protocol.PlayerStatus

@Composable
fun HUD(
    playerName: String?,
    me: PlayerPublic?,
    playerCount: Int,
    connectionState: ConnectionState,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .padding(16.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color.Black.copy(alpha = 0.6f))
            .padding(12.dp)
    ) {
        // Connection status indicator
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(
                        when (connectionState) {
                            is ConnectionState.InWorld -> Color.Green
                            is ConnectionState.Connected,
                            is ConnectionState.Authenticating -> Color.Yellow
                            else -> Color.Red
                        }
                    )
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
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Player info
        playerName?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.titleMedium,
                color = Color.White
            )
        }

        me?.let { player ->
            Text(
                text = "Pos: ${player.x}, ${player.y}",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.8f)
            )

            if (player.status == PlayerStatus.DEAD) {
                Text(
                    text = "DEAD",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.Red
                )
            }
        }

        if (playerCount > 0) {
            Text(
                text = "Nearby: $playerCount",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.7f)
            )
        }
    }
}
