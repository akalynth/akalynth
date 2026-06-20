package com.akalynth.client.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.akalynth.client.game.TemContracts
import com.akalynth.client.ui.theme.ClassicButton
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors

@Composable
fun TemChallengeDialog(
    message: String,
    expiresAt: Long,
    inlineError: String? = null,
    onSubmit: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var response by remember { mutableStateOf("") }
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

    Dialog(
        onDismissRequest = {},
        properties = DialogProperties(
            dismissOnBackPress = false,
            dismissOnClickOutside = false
        )
    ) {
        ClassicPanel(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Quick human check",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = ClassicShellColors.Brass,
                modifier = Modifier.testTag("TemChallenge_Title")
            )

            Text(
                text = "Tem pauses movement until you confirm you are playing by hand. This is routine — not a ban.",
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                color = ClassicShellColors.MutedText,
                modifier = Modifier.testTag("TemChallenge_Explanation")
            )

            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
                color = ClassicShellColors.Text,
                modifier = Modifier.testTag("TemChallenge_Message")
            )

            Text(
                text = TemContracts.CHALLENGE_RESPONSE,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Black,
                color = ClassicShellColors.Rune,
                modifier = Modifier.testTag("TemChallenge_AnswerWord")
            )

            Text(
                text = "Time left: ${remainingSeconds}s",
                style = MaterialTheme.typography.labelMedium,
                color = if (remainingSeconds <= 5) ClassicShellColors.Warning else ClassicShellColors.MutedText,
                modifier = Modifier.testTag("TemChallenge_Timer")
            )

            if (inlineError != null) {
                Text(
                    text = inlineError,
                    style = MaterialTheme.typography.bodySmall,
                    color = ClassicShellColors.Danger,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.testTag("TemChallenge_InlineError")
                )
            }

            ClassicButton(
                text = "I'm here — confirm",
                onClick = { onSubmit(TemContracts.CHALLENGE_RESPONSE) },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("TemChallenge_QuickConfirm")
            )

            OutlinedTextField(
                value = response,
                onValueChange = { response = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("TemChallenge_ResponseField"),
                label = { Text("Or type the word above") },
                placeholder = { Text(TemContracts.CHALLENGE_RESPONSE) },
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
                ClassicButton(
                    text = "Submit typed answer",
                    onClick = { onSubmit(response) },
                    modifier = Modifier
                        .weight(1f)
                        .testTag("TemChallenge_Submit"),
                    enabled = response.isNotBlank()
                )
            }
        }
    }
}