package com.akalynth.client.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.akalynth.client.game.GameEvent
import com.akalynth.client.game.GameState
import com.akalynth.client.ui.components.*

@Composable
fun WorldScreen(
    state: GameState,
    onEvent: (GameEvent) -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        // Game canvas (map + players)
        GameCanvas(
            map = state.world.currentMap,
            me = state.world.me,
            others = state.world.otherPlayers.values.toList(),
            modifier = Modifier.fillMaxSize()
        )

        // HUD overlay (top-left)
        HUD(
            playerName = state.session.playerName,
            me = state.world.me,
            playerCount = state.world.otherPlayers.size,
            connectionState = state.connection,
            modifier = Modifier.align(Alignment.TopStart)
        )

        // Debug button (top-right)
        Text(
            text = "[DBG]",
            color = Color.Yellow.copy(alpha = 0.7f),
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp)
                .clickable { onEvent(GameEvent.ToggleDebugDrawer) }
        )

        // Hide controls when debug drawer is open
        if (!state.ui.showDebugDrawer) {
            // D-Pad (bottom-left)
            DPad(
                onMove = { dir -> onEvent(GameEvent.Move(dir)) },
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(16.dp)
                    .padding(bottom = if (state.ui.chatOpen) 300.dp else 0.dp)
            )

            // Action buttons (bottom-right)
            ActionButtons(
                onChat = { onEvent(GameEvent.ToggleChat) },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(16.dp)
                    .padding(bottom = if (state.ui.chatOpen) 300.dp else 0.dp)
            )

            // Chat overlay (bottom)
            ChatOverlay(
                messages = state.world.chatMessages,
                isOpen = state.ui.chatOpen,
                onSend = { msg -> onEvent(GameEvent.SendChat(msg)) },
                onClose = { onEvent(GameEvent.ToggleChat) },
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }

        // Debug drawer (bottom, slides up)
        if (state.ui.showDebugDrawer) {
            DebugDrawer(
                state = state,
                onClose = { onEvent(GameEvent.ToggleDebugDrawer) },
                onClear = { onEvent(GameEvent.ClearDebugLog) },
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }

        // Tem challenge dialog
        state.ui.temChallenge?.let { challenge ->
            TemChallengeDialog(
                message = challenge.message,
                expiresAt = challenge.expiresAt,
                onSubmit = { response -> onEvent(GameEvent.AnswerTemChallenge(response)) },
                onDismiss = { onEvent(GameEvent.DismissTemChallenge) }
            )
        }

        // Witness request dialog
        state.ui.witnessRequest?.let { request ->
            WitnessDialog(
                prompt = request.prompt,
                expiresAt = request.expiresAt,
                onRespond = { response ->
                    onEvent(GameEvent.AnswerWitness(request.requestId, response))
                },
                onDismiss = { onEvent(GameEvent.DismissWitnessRequest) }
            )
        }

        // Error snackbar
        state.ui.errorMessage?.let { error ->
            Snackbar(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(16.dp),
                action = {
                    TextButton(onClick = { onEvent(GameEvent.DismissError) }) {
                        Text("Dismiss")
                    }
                }
            ) {
                Text(error)
            }
        }
    }
}
