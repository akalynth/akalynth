package com.akalynth.client.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.akalynth.client.protocol.WitnessResponse

@Composable
fun WitnessDialog(
    prompt: String,
    expiresAt: Long,
    onRespond: (WitnessResponse) -> Unit,
    onDismiss: () -> Unit
) {
    var remainingSeconds by remember { mutableIntStateOf(0) }

    // Update countdown
    LaunchedEffect(expiresAt) {
        while (true) {
            val remaining = ((expiresAt - System.currentTimeMillis()) / 1000).toInt()
            remainingSeconds = remaining.coerceAtLeast(0)
            if (remaining <= 0) {
                onDismiss()
                break
            }
            kotlinx.coroutines.delay(1000)
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.secondaryContainer
            )
        ) {
            Column(
                modifier = Modifier
                    .padding(24.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "WITNESS REQUEST",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )

                Text(
                    text = prompt,
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )

                Text(
                    text = "Time remaining: ${remainingSeconds}s",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.secondary
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Response buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { onRespond(WitnessResponse.CONFIRM) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        )
                    ) {
                        Text("Confirm")
                    }

                    Button(
                        onClick = { onRespond(WitnessResponse.DENY) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        Text("Deny")
                    }
                }

                OutlinedButton(
                    onClick = { onRespond(WitnessResponse.UNCERTAIN) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Uncertain")
                }

                TextButton(onClick = onDismiss) {
                    Text("Ignore")
                }
            }
        }
    }
}
