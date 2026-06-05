package com.akalynth.client.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.akalynth.client.game.ChatEntry
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors

@Composable
fun ChatOverlay(
    messages: List<ChatEntry>,
    isOpen: Boolean,
    onSend: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    // Auto-scroll to bottom when new messages arrive
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    AnimatedVisibility(
        visible = isOpen,
        enter = slideInVertically { it },
        exit = slideOutVertically { it },
        modifier = modifier
    ) {
        ClassicPanel(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 680.dp)
                .height(288.dp),
            contentPadding = PaddingValues(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Chat",
                    style = MaterialTheme.typography.titleSmall,
                    color = ClassicShellColors.Brass
                )
                IconButton(onClick = onClose) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = ClassicShellColors.Text
                    )
                }
            }

            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                items(messages, key = { it.id }) { entry ->
                    ChatMessageItem(entry)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Input field
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it.take(240) },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Type a message...") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(
                        onSend = {
                            if (inputText.isNotBlank()) {
                                onSend(inputText)
                                inputText = ""
                            }
                        }
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = ClassicShellColors.Text,
                        unfocusedTextColor = ClassicShellColors.Text,
                        focusedBorderColor = ClassicShellColors.Brass,
                        unfocusedBorderColor = ClassicShellColors.IronBright,
                        focusedContainerColor = ClassicShellColors.Iron.copy(alpha = 0.72f),
                        unfocusedContainerColor = ClassicShellColors.Iron.copy(alpha = 0.72f)
                    )
                )

                IconButton(
                    onClick = {
                        if (inputText.isNotBlank()) {
                            onSend(inputText)
                            inputText = ""
                        }
                    }
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Send,
                        contentDescription = "Send",
                        tint = ClassicShellColors.Brass
                    )
                }
            }
        }
    }
}

@Composable
private fun ChatMessageItem(entry: ChatEntry) {
    val color = when (entry.from) {
        "system" -> ClassicShellColors.Warning
        "combat" -> ClassicShellColors.Danger
        "tem" -> ClassicShellColors.Rune
        else -> ClassicShellColors.Text
    }

    Text(
        text = "${entry.from}: ${entry.message}",
        style = MaterialTheme.typography.bodySmall,
        color = color
    )
}
