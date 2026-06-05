package com.akalynth.client.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.akalynth.client.game.GameEvent
import com.akalynth.client.game.GameState
import com.akalynth.client.network.ConnectionState
import com.akalynth.client.ui.theme.ClassicButton
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors

@Composable
fun LoginScreen(
    state: GameState,
    onEvent: (GameEvent) -> Unit
) {
    var serverUrlInput by remember(state.session.serverUrl) {
        mutableStateOf(state.session.serverUrl)
    }
    var showAdvanced by remember { mutableStateOf(false) }
    val keyboardController = LocalSoftwareKeyboardController.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ClassicShellColors.Void)
            .padding(18.dp),
        contentAlignment = Alignment.Center
    ) {
        ClassicPanel(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 580.dp),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = "AKALYNTH",
                style = MaterialTheme.typography.displayLarge,
                fontWeight = FontWeight.Black,
                color = ClassicShellColors.Brass
            )

            Text(
                text = "A server-authoritative MMO",
                style = MaterialTheme.typography.bodyLarge,
                color = ClassicShellColors.MutedText
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                ClassicButton(
                    text = if (showAdvanced) "Hide Server" else "Server",
                    onClick = { showAdvanced = !showAdvanced },
                    compact = true
                )
            }

            if (showAdvanced) {
                OutlinedTextField(
                    value = serverUrlInput,
                    onValueChange = { serverUrlInput = it },
                    label = { Text("Server URL") },
                    placeholder = { Text("ws://10.0.2.2:3000") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            keyboardController?.hide()
                            if (serverUrlInput != state.session.serverUrl) {
                                onEvent(GameEvent.SetServerUrl(serverUrlInput))
                            }
                        }
                    )
                )

                if (serverUrlInput != state.session.serverUrl) {
                    ClassicButton(
                        text = "Save URL",
                        onClick = {
                            keyboardController?.hide()
                            onEvent(GameEvent.SetServerUrl(serverUrlInput))
                        },
                        modifier = Modifier.fillMaxWidth(0.62f)
                    )
                }

                Text(
                    text = "Quick presets",
                    style = MaterialTheme.typography.labelMedium,
                    color = ClassicShellColors.MutedText
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FilterChip(
                        selected = state.session.serverUrl == "ws://10.0.2.2:3000",
                        onClick = {
                            serverUrlInput = "ws://10.0.2.2:3000"
                            onEvent(GameEvent.SetServerUrl("ws://10.0.2.2:3000"))
                        },
                        label = { Text("Emulator", style = MaterialTheme.typography.labelSmall) }
                    )

                    FilterChip(
                        selected = state.session.serverUrl == "ws://localhost:3000",
                        onClick = {
                            serverUrlInput = "ws://localhost:3000"
                            onEvent(GameEvent.SetServerUrl("ws://localhost:3000"))
                        },
                        label = { Text("USB", style = MaterialTheme.typography.labelSmall) }
                    )

                    FilterChip(
                        selected = state.session.serverUrl.contains("akalynth.com"),
                        onClick = {
                            serverUrlInput = "wss://api.akalynth.com"
                            onEvent(GameEvent.SetServerUrl("wss://api.akalynth.com"))
                        },
                        label = { Text("Prod", style = MaterialTheme.typography.labelSmall) }
                    )
                }
            }

            when (val conn = state.connection) {
                is ConnectionState.Idle -> {
                    ClassicButton(
                        text = "Connect",
                        onClick = { onEvent(GameEvent.Connect) },
                        modifier = Modifier.fillMaxWidth(0.72f)
                    )
                }
                is ConnectionState.Connecting -> {
                    CircularProgressIndicator(color = ClassicShellColors.Brass)
                    Text(
                        text = "Connecting to ${state.session.serverUrl}...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = ClassicShellColors.Text,
                        textAlign = TextAlign.Center
                    )
                }
                is ConnectionState.Disconnected -> {
                    Text(
                        text = "Disconnected: ${conn.reason}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = ClassicShellColors.Danger,
                        textAlign = TextAlign.Center
                    )
                    ClassicButton(
                        text = "Reconnect",
                        onClick = { onEvent(GameEvent.Connect) },
                        modifier = Modifier.fillMaxWidth(0.72f)
                    )
                }
                is ConnectionState.Error -> {
                    Text(
                        text = "Error: ${conn.message}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = ClassicShellColors.Danger,
                        textAlign = TextAlign.Center
                    )
                    ClassicButton(
                        text = "Retry",
                        onClick = { onEvent(GameEvent.Connect) },
                        modifier = Modifier.fillMaxWidth(0.72f)
                    )
                }
                else -> {
                    CircularProgressIndicator(color = ClassicShellColors.Brass)
                    Text(
                        text = "Loading...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = ClassicShellColors.Text
                    )
                }
            }

            state.session.guestToken?.let {
                Text(
                    text = "Returning player",
                    style = MaterialTheme.typography.bodySmall,
                    color = ClassicShellColors.Rune
                )
            }
        }
    }
}
