package com.akalynth.client.ui.components

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors

@Composable
fun ObjectiveBanner(
    title: String = "Objective",
    objective: String,
    modifier: Modifier = Modifier,
    accent: String? = null
) {
    if (objective.isBlank()) return

    ClassicPanel(
        modifier = modifier
            .widthIn(max = 360.dp)
            .testTag("ObjectiveBanner"),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelSmall,
            color = ClassicShellColors.Brass,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = objective,
            style = MaterialTheme.typography.bodySmall,
            color = ClassicShellColors.Text,
            textAlign = TextAlign.Center
        )
        accent?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.labelSmall,
                color = ClassicShellColors.Good,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        }
    }
}
