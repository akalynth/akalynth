package com.akalynth.client.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.akalynth.client.game.GameEvent
import com.akalynth.client.game.GameState
import com.akalynth.client.network.EndpointInfo
import com.akalynth.client.ui.diagnostics.DiagnosticsFormatter
import com.akalynth.client.ui.components.*
import com.akalynth.client.ui.components.chronicle.ChronicleSheet
import com.akalynth.client.ui.theme.ClassicButton
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors
import kotlinx.coroutines.delay

@Composable
fun WorldScreen(
    state: GameState,
    onEvent: (GameEvent) -> Unit
) {
    val context = LocalContext.current
    val endpoint = EndpointInfo.fromWsUrl(state.session.serverUrl)
    val nowMs = rememberNowMs()
    val reconnectLabel = DiagnosticsFormatter.reconnectCountdownLabel(state.ui.connectionDiagnostics, nowMs)
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
                text = reconnectLabel
                    ?: "${endpoint.lane} - ${DiagnosticsFormatter.connectionLabel(state.connection)}",
                style = MaterialTheme.typography.labelSmall,
                color = if (reconnectLabel != null) ClassicShellColors.Warning else ClassicShellColors.MutedText,
                modifier = Modifier.testTag("WorldScreen_ConnectionLine")
            )
        }

        Row(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ClassicButton(
                text = "Issue",
                onClick = {
                    copyTextToClipboard(
                        context = context,
                        label = "Akalynth Issue Report",
                        text = DiagnosticsFormatter.formatIssueReport(state),
                        toast = "Issue report copied"
                    )
                },
                compact = true,
                modifier = Modifier.testTag("WorldScreen_ReportIssue")
            )
            ClassicButton(
                text = "DBG",
                onClick = { onEvent(GameEvent.ToggleDebugDrawer) },
                compact = true,
                modifier = Modifier.testTag("WorldScreen_Debug")
            )
        }

        if (!state.ui.showDebugDrawer) {
            DPad(
                onMove = { dir -> onEvent(GameEvent.Move(dir)) },
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 12.dp, bottom = if (state.ui.chatOpen) 304.dp else 12.dp)
            )

            ActionButtons(
                onChat = { onEvent(GameEvent.ToggleChat) },
                onChronicle = { onEvent(GameEvent.ToggleChronicle) },
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

        if (state.ui.showChronicleSheet) {
            ChronicleSheet(
                events = state.ui.chronicleEvents,
                hasMore = state.ui.chronicleHasMore,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = { onEvent(GameEvent.ToggleChronicle) },
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

@Composable
private fun rememberNowMs(): Long {
    var nowMs by remember { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            nowMs = System.currentTimeMillis()
        }
    }
    return nowMs
}

private fun copyTextToClipboard(
    context: Context,
    label: String,
    text: String,
    toast: String
) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText(label, text))
    Toast.makeText(context, toast, Toast.LENGTH_SHORT).show()
}
