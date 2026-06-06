package com.akalynth.client.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog

@Composable
fun TemChallengeDialog(
    message: String,
    expiresAt: Long,
    onSubmit: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var response by remember { mutableStateOf("") }
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
                containerColor = MaterialTheme.colorScheme.errorContainer
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
                    text = "TEM HUMAN CHECK",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.testTag("TemChallenge_Title")
                )

                Text(
                    text = "Tem keeps High City for human play. Answer the prompt to continue.",
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.testTag("TemChallenge_Explanation")
                )

                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.testTag("TemChallenge_Message")
                )

                Text(
                    text = "Time remaining: ${remainingSeconds}s",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.error
                )

                OutlinedTextField(
                    value = response,
                    onValueChange = { response = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Your response") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            if (response.isNotBlank()) {
                                onSubmit(response)
                            }
                        }
                    )
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Skip")
                    }

                    Button(
                        onClick = { onSubmit(response) },
                        modifier = Modifier.weight(1f),
                        enabled = response.isNotBlank()
                    ) {
                        Text("Submit")
                    }
                }
            }
        }
    }
}
