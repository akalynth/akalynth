package com.akalynth.client.ui.components

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.akalynth.client.game.ConnectionDiagnostics
import com.akalynth.client.game.DebugLogEntry
import com.akalynth.client.game.GameState
import com.akalynth.client.network.ConnectionState
import com.akalynth.client.protocol.PlayerPublic
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun DebugDrawer(
    state: GameState,
    onClose: () -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val listState = rememberLazyListState()
    var autoScroll by remember { mutableStateOf(true) }

    // Auto-scroll to bottom when new entries arrive (if enabled)
    LaunchedEffect(state.ui.debugLog.size, autoScroll) {
        if (autoScroll && state.ui.debugLog.isNotEmpty()) {
            listState.animateScrollToItem(state.ui.debugLog.size - 1)
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .fillMaxHeight(0.6f)
            .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
            .background(Color(0xF0121212))
            .padding(8.dp)
    ) {
        // Header row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Debug Console",
                style = MaterialTheme.typography.titleMedium,
                color = Color.White
            )

            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                // Auto-scroll toggle
                FilterChip(
                    selected = autoScroll,
                    onClick = { autoScroll = !autoScroll },
                    label = { Text("Auto", style = MaterialTheme.typography.labelSmall) },
                    modifier = Modifier.height(28.dp)
                )

                // Copy button
                TextButton(
                    onClick = { copyLogToClipboard(context, state.ui.debugLog) },
                    contentPadding = PaddingValues(horizontal = 8.dp)
                ) {
                    Text("Copy", color = Color.Cyan, style = MaterialTheme.typography.labelSmall)
                }

                // Clear button
                IconButton(onClick = onClear, modifier = Modifier.size(32.dp)) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Clear",
                        tint = Color.Red.copy(alpha = 0.7f),
                        modifier = Modifier.size(18.dp)
                    )
                }

                // Close button
                IconButton(onClick = onClose, modifier = Modifier.size(32.dp)) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }

        HorizontalDivider(color = Color.Gray.copy(alpha = 0.3f))

        // Player info row
        state.world.me?.let { me ->
            PlayerInfoRow(me, state.session.playerId, state.session.serverUrl)
        }

        // Connection diagnostics row (always show when not connected OK)
        ConnectionDiagnosticsRow(
            connection = state.connection,
            diagnostics = state.ui.connectionDiagnostics
        )

        HorizontalDivider(color = Color.Gray.copy(alpha = 0.3f))

        // Debug log
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            items(state.ui.debugLog, key = { "${it.timestamp}-${it.messageType}" }) { entry ->
                DebugLogRow(entry)
            }
        }

        // Stats footer
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Entries: ${state.ui.debugLog.size}/100",
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray
            )
            Text(
                text = "Players: ${state.world.otherPlayers.size}",
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray
            )
            Text(
                text = state.connection::class.simpleName ?: "?",
                style = MaterialTheme.typography.bodySmall,
                color = when (state.connection::class.simpleName) {
                    "InWorld" -> Color.Green
                    "Connected", "Authenticating" -> Color.Yellow
                    "Error" -> Color.Red
                    else -> Color.Gray
                }
            )
        }
    }
}

private fun copyLogToClipboard(context: Context, log: List<DebugLogEntry>) {
    val timeFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)
    val text = log.takeLast(50).joinToString("\n") { entry ->
        val ts = timeFormat.format(Date(entry.timestamp))
        "$ts ${entry.direction} ${entry.messageType} ${entry.preview}"
    }

    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("Akalynth Debug Log", text)
    clipboard.setPrimaryClip(clip)

    Toast.makeText(context, "Copied ${log.takeLast(50).size} entries", Toast.LENGTH_SHORT).show()
}

@Composable
private fun PlayerInfoRow(me: PlayerPublic, playerId: String?, serverUrl: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        InfoChip("ID", playerId?.take(8) ?: "?")
        InfoChip("Name", me.name)
        InfoChip("Pos", "(${me.x}, ${me.y})")
        InfoChip("URL", serverUrl.removePrefix("ws://").removePrefix("wss://").take(15))
    }
}

@Composable
private fun InfoChip(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = Color.Gray
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            color = Color.White,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
private fun ConnectionDiagnosticsRow(
    connection: ConnectionState,
    diagnostics: ConnectionDiagnostics
) {
    // Only show when there's something interesting to show
    val showRow = diagnostics.lastCloseCode != null ||
            diagnostics.reconnectAttempts > 0 ||
            connection is ConnectionState.Error ||
            connection is ConnectionState.Disconnected

    if (!showRow) return

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        // Last close info
        if (diagnostics.lastCloseCode != null) {
            InfoChip(
                label = "Close",
                value = "${diagnostics.lastCloseCode}" +
                        (diagnostics.lastCloseReason?.let { " $it" } ?: "")
            )
        }

        // Reconnect attempts
        if (diagnostics.reconnectAttempts > 0) {
            InfoChip(
                label = "Retry",
                value = "#${diagnostics.reconnectAttempts}"
            )
        }

        // Next backoff
        if (diagnostics.nextBackoffMs > 0) {
            InfoChip(
                label = "Backoff",
                value = "${diagnostics.nextBackoffMs / 1000.0}s"
            )
        }

        // Connection error message
        when (connection) {
            is ConnectionState.Error -> {
                InfoChip(
                    label = "Error",
                    value = connection.message.take(15)
                )
            }
            is ConnectionState.Disconnected -> {
                InfoChip(
                    label = "DC",
                    value = connection.reason.ifEmpty { "closed" }.take(15)
                )
            }
            else -> {}
        }
    }
}

@Composable
private fun DebugLogRow(entry: DebugLogEntry) {
    val timeFormat = remember { SimpleDateFormat("HH:mm:ss.SSS", Locale.US) }
    val timestamp = timeFormat.format(Date(entry.timestamp))

    val dirColor = when (entry.direction) {
        "\u2192" -> Color(0xFF4CAF50) // Green for sent
        "\u2190" -> Color(0xFF2196F3) // Blue for received
        else -> Color.Yellow // System
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 1.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = timestamp,
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 10.sp),
            color = Color.Gray,
            fontFamily = FontFamily.Monospace
        )

        Text(
            text = entry.direction,
            style = MaterialTheme.typography.bodySmall,
            color = dirColor,
            fontFamily = FontFamily.Monospace
        )

        if (entry.messageType.isNotEmpty()) {
            Text(
                text = entry.messageType,
                style = MaterialTheme.typography.bodySmall,
                color = Color.Cyan,
                fontFamily = FontFamily.Monospace
            )
        }

        Text(
            text = entry.preview,
            style = MaterialTheme.typography.bodySmall,
            color = Color.White.copy(alpha = 0.8f),
            fontFamily = FontFamily.Monospace,
            maxLines = 1
        )
    }
}
