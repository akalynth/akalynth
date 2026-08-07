package com.akalynth.client.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors
import com.akalynth.client.update.ClientUpdateState

@Composable
fun ClientUpdateOverlay(
    state: ClientUpdateState,
    onOpenInstallPermission: (() -> Unit)? = null,
) {
    val message = when (state) {
        is ClientUpdateState.Checking -> "Checking beta server for client updates..."
        is ClientUpdateState.Downloading -> "Downloading ${state.versionName} (${state.progressPercent}%)"
        is ClientUpdateState.ReadyToInstall -> "Installing ${state.versionName}..."
        is ClientUpdateState.NeedsInstallPermission ->
            "Allow Akalynth to install updates, then return to the app. (${state.versionName})"
        is ClientUpdateState.Failed -> "Update failed: ${state.message}"
        else -> return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ClassicShellColors.Void.copy(alpha = 0.82f)),
        contentAlignment = Alignment.Center
    ) {
        ClassicPanel(
            modifier = Modifier.padding(24.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Client Update",
                style = MaterialTheme.typography.titleMedium,
                color = ClassicShellColors.Brass,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = ClassicShellColors.Text,
                textAlign = TextAlign.Center
            )
            if (state is ClientUpdateState.Downloading && state.progressPercent > 0) {
                LinearProgressIndicator(
                    progress = { state.progressPercent / 100f },
                    modifier = Modifier.fillMaxWidth()
                )
            } else if (
                state !is ClientUpdateState.Failed &&
                state !is ClientUpdateState.NeedsInstallPermission
            ) {
                CircularProgressIndicator(color = ClassicShellColors.Brass)
            }
            if (state is ClientUpdateState.NeedsInstallPermission && onOpenInstallPermission != null) {
                Button(onClick = onOpenInstallPermission) {
                    Text("Open install permission")
                }
            }
        }
    }
}
