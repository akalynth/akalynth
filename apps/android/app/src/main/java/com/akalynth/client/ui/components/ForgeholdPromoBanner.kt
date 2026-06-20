package com.akalynth.client.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.akalynth.client.ui.theme.ClassicButton
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors

@Composable
fun ForgeholdPromoBanner(
    nextObjective: String,
    onRouteAction: () -> Unit,
    modifier: Modifier = Modifier,
    payoutPending: Boolean = false
) {
    ClassicPanel(
        modifier = modifier
            .widthIn(max = 320.dp)
            .testTag("ForgeholdPromoBanner"),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = if (payoutPending) "Forgehold payout ready (+25 gold)" else "Forgehold Route (+25 gold)",
            style = MaterialTheme.typography.labelMedium,
            color = ClassicShellColors.Brass,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = nextObjective,
            style = MaterialTheme.typography.bodySmall,
            color = ClassicShellColors.Text
        )
        ClassicButton(
            text = if (payoutPending) "Claim payout" else "Next Forgehold step",
            onClick = onRouteAction,
            compact = true,
            modifier = Modifier.testTag("ForgeholdPromoBanner_Action")
        )
    }
}