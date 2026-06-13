package com.akalynth.client.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.akalynth.client.game.GameEvent
import com.akalynth.client.game.GameState
import com.akalynth.client.game.HealthCheckState
import com.akalynth.client.network.ConnectionState
import com.akalynth.client.network.EndpointInfo
import com.akalynth.client.ui.diagnostics.DiagnosticsFormatter
import com.akalynth.client.ui.theme.ClassicButton
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors
import com.akalynth.client.ui.theme.akalynthWallpaperBrush
import kotlinx.coroutines.delay

@Composable
fun LoginScreen(
    state: GameState,
    onEvent: (GameEvent) -> Unit,
    onCreateCharacter: () -> Unit,
    onAdventurerSeal: () -> Unit
) {
    var serverUrlInput by remember(state.session.serverUrl) {
        mutableStateOf(state.session.serverUrl)
    }
    var showAdvanced by remember { mutableStateOf(false) }
    val keyboardController = LocalSoftwareKeyboardController.current
    val context = LocalContext.current
    val savedCharacterName = state.session.playerName ?: state.session.savedCharacterName
    val endpoint = EndpointInfo.fromWsUrl(state.session.serverUrl)
    val nowMs = rememberNowMs()
    val entryHint = when {
        savedCharacterName != null -> "Saved character: $savedCharacterName"
        state.session.guestToken != null -> "Saved guest session"
        else -> "Start in Rookguard, then step into High City"
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(akalynthWallpaperBrush())
            .padding(18.dp),
        contentAlignment = Alignment.Center
    ) {
        ClassicPanel(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 580.dp)
                .verticalScroll(rememberScrollState()),
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
                text = "Server-authoritative MMO - Rookguard opens into High City",
                style = MaterialTheme.typography.bodyLarge,
                color = ClassicShellColors.MutedText
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ClassicButton(
                    text = "Create Character",
                    onClick = onCreateCharacter,
                    compact = true,
                    modifier = Modifier.testTag("LoginScreen_CreateCharacter")
                )
                ClassicButton(
                    text = if (showAdvanced) "Hide Server" else "Server",
                    onClick = { showAdvanced = !showAdvanced },
                    compact = true,
                    modifier = Modifier.testTag("LoginScreen_ServerToggle")
                )
                ClassicButton(
                    text = "Check server",
                    onClick = { onEvent(GameEvent.CheckHealth) },
                    compact = true,
                    modifier = Modifier.testTag("LoginScreen_CheckHealth")
                )
            }

            ClassicButton(
                text = "Adventurer Seal",
                onClick = onAdventurerSeal,
                compact = true,
                modifier = Modifier.testTag("LoginScreen_AdventurerSeal")
            )

            Text(
                text = entryHint,
                style = MaterialTheme.typography.bodySmall,
                color = ClassicShellColors.Rune,
                textAlign = TextAlign.Center,
                modifier = Modifier.testTag("LoginScreen_EntryHint")
            )

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
                    PresetChip("Local", "ws://10.0.2.2:3000", state.session.serverUrl) {
                        serverUrlInput = it
                        onEvent(GameEvent.SetServerUrl(it))
                    }
                    PresetChip("Beta", "wss://beta-api.akalynth.com", state.session.serverUrl) {
                        serverUrlInput = it
                        onEvent(GameEvent.SetServerUrl(it))
                    }
                    PresetChip("Staging", "wss://staging-api.akalynth.com", state.session.serverUrl) {
                        serverUrlInput = it
                        onEvent(GameEvent.SetServerUrl(it))
                    }
                    PresetChip("Prod", "wss://api.akalynth.com", state.session.serverUrl) {
                        serverUrlInput = it
                        onEvent(GameEvent.SetServerUrl(it))
                    }
                }
            }

            when (val conn = state.connection) {
                is ConnectionState.Idle -> {
                    ClassicButton(
                        text = if (savedCharacterName != null) "Enter Play" else "Connect",
                        onClick = { onEvent(GameEvent.Connect) },
                        modifier = Modifier
                            .fillMaxWidth(0.72f)
                            .testTag("LoginScreen_Connect")
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
                        modifier = Modifier
                            .fillMaxWidth(0.72f)
                            .testTag("LoginScreen_Reconnect")
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
                        modifier = Modifier
                            .fillMaxWidth(0.72f)
                            .testTag("LoginScreen_Retry")
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

            EndpointStatusPanel(
                state = state,
                endpoint = endpoint,
                nowMs = nowMs,
                onCopyDiagnostics = {
                    copyDiagnosticsToClipboard(context, DiagnosticsFormatter.format(state))
                },
                onCopyIssueReport = {
                    copyIssueReportToClipboard(context, DiagnosticsFormatter.formatIssueReport(state))
                },
                onResetServer = {
                    onEvent(GameEvent.ResetServerUrl)
                }
            )

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

@Composable
private fun EndpointStatusPanel(
    state: GameState,
    endpoint: EndpointInfo,
    nowMs: Long,
    onCopyDiagnostics: () -> Unit,
    onCopyIssueReport: () -> Unit,
    onResetServer: () -> Unit
) {
    val diagnostics = state.ui.connectionDiagnostics
    val reconnectLabel = DiagnosticsFormatter.reconnectCountdownLabel(diagnostics, nowMs)
    val checkedAtLabel = DiagnosticsFormatter.healthCheckedAtLabel(state.ui.healthCheck, nowMs)
    val isBetaBuild = endpoint.lane == "Beta" || endpoint.buildType.equals("beta", ignoreCase = true)
    ClassicPanel(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("LoginScreen_StatusPanel"),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "${endpoint.lane} lane",
                style = MaterialTheme.typography.labelLarge,
                color = ClassicShellColors.Brass,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.testTag("LoginScreen_Lane")
            )
            Text(
                text = endpoint.host,
                style = MaterialTheme.typography.bodySmall,
                color = ClassicShellColors.Text,
                modifier = Modifier.testTag("LoginScreen_ServerHost")
            )
            if (isBetaBuild) {
                Text(
                    text = "BETA BUILD",
                    style = MaterialTheme.typography.labelSmall,
                    color = ClassicShellColors.Good,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.testTag("LoginScreen_BetaBuildBadge")
                )
            }
        }
        Text(
            text = DiagnosticsFormatter.connectionLabel(state.connection),
            style = MaterialTheme.typography.bodySmall,
            color = ClassicShellColors.MutedText,
            modifier = Modifier.testTag("LoginScreen_ConnectionState")
        )
        Text(
            text = DiagnosticsFormatter.healthLabel(state.ui.healthCheck),
            style = MaterialTheme.typography.bodySmall,
            color = when (state.ui.healthCheck) {
                is HealthCheckState.Reachable -> ClassicShellColors.Good
                is HealthCheckState.Unreachable -> ClassicShellColors.Danger
                is HealthCheckState.Checking -> ClassicShellColors.Warning
                is HealthCheckState.Unknown -> ClassicShellColors.MutedText
            },
            modifier = Modifier.testTag("LoginScreen_HealthState")
        )
        if (checkedAtLabel != null) {
            Text(
                text = checkedAtLabel,
                style = MaterialTheme.typography.labelSmall,
                color = ClassicShellColors.MutedText,
                modifier = Modifier.testTag("LoginScreen_HealthCheckedAt")
            )
        }
        if (reconnectLabel != null) {
            Text(
                text = reconnectLabel,
                style = MaterialTheme.typography.bodySmall,
                color = ClassicShellColors.Warning,
                modifier = Modifier.testTag("LoginScreen_ReconnectDiagnostics")
            )
        }
        Text(
            text = "App ${endpoint.appVersion} (${endpoint.buildType})",
            style = MaterialTheme.typography.labelSmall,
            color = ClassicShellColors.MutedText,
            modifier = Modifier.testTag("LoginScreen_AppVersion")
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ClassicButton(
                text = "Copy diagnostics",
                onClick = onCopyDiagnostics,
                compact = true,
                modifier = Modifier.testTag("LoginScreen_CopyDiagnostics")
            )
            ClassicButton(
                text = "Report issue",
                onClick = onCopyIssueReport,
                compact = true,
                modifier = Modifier.testTag("LoginScreen_ReportIssue")
            )
        }
        ClassicButton(
            text = "Reset Server",
            onClick = onResetServer,
            compact = true,
            modifier = Modifier.testTag("LoginScreen_ResetServer")
        )
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

@Composable
private fun PresetChip(
    label: String,
    url: String,
    currentUrl: String,
    onSelect: (String) -> Unit
) {
    FilterChip(
        selected = currentUrl == url,
        onClick = { onSelect(url) },
        label = { Text(label, style = MaterialTheme.typography.labelSmall) }
    )
}

private fun copyDiagnosticsToClipboard(context: Context, text: String) {
    copyTextToClipboard(context, "Akalynth Diagnostics", text, "Diagnostics copied")
}

private fun copyIssueReportToClipboard(context: Context, text: String) {
    copyTextToClipboard(context, "Akalynth Issue Report", text, "Issue report copied")
}

private fun copyTextToClipboard(context: Context, label: String, text: String, toast: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText(label, text))
    Toast.makeText(context, toast, Toast.LENGTH_SHORT).show()
}
