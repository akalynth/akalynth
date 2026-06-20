package com.akalynth.client.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.akalynth.client.protocol.WitnessResponse
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors

@Composable
fun WitnessDialog(
    prompt: String,
    expiresAt: Long,
    onRespond: (WitnessResponse) -> Unit,
    onDismiss: () -> Unit
) {
    var remainingSeconds by remember { mutableIntStateOf(0) }

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
        ClassicPanel(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Nearby fairness check",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = ClassicShellColors.Brass
            )

            Text(
                text = "Another player nearby triggered a Ledger review. Your answer is optional and anonymous.",
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                color = ClassicShellColors.MutedText
            )

            Text(
                text = prompt,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
                color = ClassicShellColors.Text
            )

            Text(
                text = "Time left: ${remainingSeconds}s",
                style = MaterialTheme.typography.labelMedium,
                color = ClassicShellColors.MutedText
            )

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { onRespond(WitnessResponse.CONFIRM) },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ClassicShellColors.Good.copy(alpha = 0.35f),
                        contentColor = ClassicShellColors.Text
                    )
                ) {
                    Text("Looked human")
                }

                Button(
                    onClick = { onRespond(WitnessResponse.DENY) },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ClassicShellColors.Danger.copy(alpha = 0.35f),
                        contentColor = ClassicShellColors.Text
                    )
                ) {
                    Text("Looked automated")
                }
            }

            OutlinedButton(
                onClick = { onRespond(WitnessResponse.UNCERTAIN) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Not sure")
            }

            TextButton(onClick = onDismiss) {
                Text("Skip for now")
            }
        }
    }
}