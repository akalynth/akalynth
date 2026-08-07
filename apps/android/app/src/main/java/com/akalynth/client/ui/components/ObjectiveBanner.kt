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
import androidx.compose.ui.text.style.TextOverflow
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

    // Compact top rail: keep quest readable without covering the world interaction band.
    ClassicPanel(
        modifier = modifier
            .widthIn(max = 280.dp)
            .testTag("ObjectiveBanner"),
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelSmall,
            color = ClassicShellColors.Brass,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = objective,
            style = MaterialTheme.typography.bodySmall,
            color = ClassicShellColors.Text,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
        accent?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.labelSmall,
                color = ClassicShellColors.Good,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
