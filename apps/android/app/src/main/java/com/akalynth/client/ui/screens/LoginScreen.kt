package com.akalynth.client.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.akalynth.client.game.GameEvent
import com.akalynth.client.game.GameState
import com.akalynth.client.network.ConnectionState

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
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            Text(
                text = "AKALYNTH",
                style = MaterialTheme.typography.displayLarge,
                color = MaterialTheme.colorScheme.primary
            )

            Text(
                text = "A server-authoritative MMO",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Server URL configuration (collapsible)
            TextButton(onClick = { showAdvanced = !showAdvanced }) {
                Text(if (showAdvanced) "Hide Server Settings" else "Server Settings")
            }

            if (showAdvanced) {
                OutlinedTextField(
                    value = serverUrlInput,
                    onValueChange = { serverUrlInput = it },
                    label = { Text("Server URL") },
                    placeholder = { Text("ws://10.0.2.2:3000") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(0.9f),
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

                // Save button if URL changed
                if (serverUrlInput != state.session.serverUrl) {
                    Button(
                        onClick = {
                            keyboardController?.hide()
                            onEvent(GameEvent.SetServerUrl(serverUrlInput))
                        },
                        modifier = Modifier.fillMaxWidth(0.5f)
                    ) {
                        Text("Save URL")
                    }
                }

                // Preset URL chips
                Text(
                    text = "Quick presets:",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Emulator preset
                    FilterChip(
                        selected = state.session.serverUrl == "ws://10.0.2.2:3000",
                        onClick = {
                            serverUrlInput = "ws://10.0.2.2:3000"
                            onEvent(GameEvent.SetServerUrl("ws://10.0.2.2:3000"))
                        },
                        label = { Text("Emulator", style = MaterialTheme.typography.labelSmall) }
                    )

                    // localhost (for physical device via USB port forward)
                    FilterChip(
                        selected = state.session.serverUrl == "ws://localhost:3000",
                        onClick = {
                            serverUrlInput = "ws://localhost:3000"
                            onEvent(GameEvent.SetServerUrl("ws://localhost:3000"))
                        },
                        label = { Text("USB", style = MaterialTheme.typography.labelSmall) }
                    )

                    // Production (placeholder)
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

            Spacer(modifier = Modifier.height(16.dp))

            when (val conn = state.connection) {
                is ConnectionState.Idle -> {
                    Button(
                        onClick = { onEvent(GameEvent.Connect) },
                        modifier = Modifier.fillMaxWidth(0.7f)
                    ) {
                        Text("Connect")
                    }
                }
                is ConnectionState.Connecting -> {
                    CircularProgressIndicator()
                    Text(
                        text = "Connecting to ${state.session.serverUrl}...",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                is ConnectionState.Disconnected -> {
                    Text(
                        text = "Disconnected: ${conn.reason}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { onEvent(GameEvent.Connect) },
                        modifier = Modifier.fillMaxWidth(0.7f)
                    ) {
                        Text("Reconnect")
                    }
                }
                is ConnectionState.Error -> {
                    Text(
                        text = "Error: ${conn.message}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { onEvent(GameEvent.Connect) },
                        modifier = Modifier.fillMaxWidth(0.7f)
                    ) {
                        Text("Retry")
                    }
                }
                else -> {
                    CircularProgressIndicator()
                    Text(
                        text = "Loading...",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            // Show saved token status
            state.session.guestToken?.let {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Returning player",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.tertiary
                )
            }
        }
    }
}
