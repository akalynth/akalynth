package com.akalynth.client.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.akalynth.client.game.GameEvent
import com.akalynth.client.game.GameState
import com.akalynth.client.ui.components.*
import com.akalynth.client.ui.theme.ClassicButton
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors

@Composable
fun WorldScreen(
    state: GameState,
    onEvent: (GameEvent) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ClassicShellColors.Void)
    ) {
        GameCanvas(
            map = state.world.currentMap,
            me = state.world.me,
            others = state.world.otherPlayers.values.toList(),
            modifier = Modifier.fillMaxSize()
        )

        HUD(
            playerName = state.session.playerName,
            me = state.world.me,
            playerCount = state.world.otherPlayers.size,
            connectionState = state.connection,
            modifier = Modifier.align(Alignment.TopStart)
        )

        ClassicPanel(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 12.dp),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 7.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            Text(
                text = state.world.currentMap.displayName,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = ClassicShellColors.Brass
            )
            Text(
                text = "Local debug",
                style = MaterialTheme.typography.labelSmall,
                color = ClassicShellColors.MutedText
            )
        }

        ClassicButton(
            text = "DBG",
            onClick = { onEvent(GameEvent.ToggleDebugDrawer) },
            compact = true,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(12.dp)
        )

        if (!state.ui.showDebugDrawer) {
            DPad(
                onMove = { dir -> onEvent(GameEvent.Move(dir)) },
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 12.dp, bottom = if (state.ui.chatOpen) 304.dp else 12.dp)
            )

            ActionButtons(
                onChat = { onEvent(GameEvent.ToggleChat) },
                showWitnessMothBloom = state.world.currentMap.isHighCityCompatible,
                onWorldEventContribution = { contributionId ->
                    onEvent(GameEvent.WorldEventContribution(contributionId))
                },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 12.dp, bottom = if (state.ui.chatOpen) 304.dp else 12.dp)
            )

            ChatOverlay(
                messages = state.world.chatMessages,
                isOpen = state.ui.chatOpen,
                onSend = { msg -> onEvent(GameEvent.SendChat(msg)) },
                onClose = { onEvent(GameEvent.ToggleChat) },
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }

        if (state.ui.showDebugDrawer) {
            DebugDrawer(
                state = state,
                onClose = { onEvent(GameEvent.ToggleDebugDrawer) },
                onClear = { onEvent(GameEvent.ClearDebugLog) },
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }

        state.ui.temChallenge?.let { challenge ->
            TemChallengeDialog(
                message = challenge.message,
                expiresAt = challenge.expiresAt,
                onSubmit = { response -> onEvent(GameEvent.AnswerTemChallenge(response)) },
                onDismiss = { onEvent(GameEvent.DismissTemChallenge) }
            )
        }

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
