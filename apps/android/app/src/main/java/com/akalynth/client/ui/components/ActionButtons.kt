package com.akalynth.client.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.akalynth.client.actions.WorldEventSkillIds
import com.akalynth.client.ui.theme.ClassicDock
import com.akalynth.client.ui.theme.ClassicShellColors

@Composable
fun ActionButtons(
    onChat: () -> Unit,
    onChronicle: () -> Unit = {},
    showWitnessMothBloom: Boolean = false,
    onWorldEventContribution: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    ClassicDock(modifier = modifier) {
        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(62.dp)
                    .clip(CircleShape)
                    .background(ClassicShellColors.Stone.copy(alpha = 0.92f))
                    .border(1.dp, ClassicShellColors.IronBright.copy(alpha = 0.75f), CircleShape)
                    .clickable { onChat() },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Email,
                    contentDescription = "Chat",
                    tint = ClassicShellColors.Text,
                    modifier = Modifier.size(30.dp)
                )
            }

            Text(
                text = "Chat",
                style = MaterialTheme.typography.labelSmall,
                color = ClassicShellColors.Text
            )

            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(CircleShape)
                    .background(ClassicShellColors.Stone.copy(alpha = 0.92f))
                    .border(1.dp, ClassicShellColors.Rune.copy(alpha = 0.75f), CircleShape)
                    .clickable { onChronicle() }
                    .testTag("ActionButtons_Chronicle"),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "C",
                    style = MaterialTheme.typography.titleMedium,
                    color = ClassicShellColors.Text
                )
            }

            Text(
                text = "Chronicle",
                style = MaterialTheme.typography.labelSmall,
                color = ClassicShellColors.Text
            )

            if (showWitnessMothBloom) {
                Text(
                    text = "Witness Moth",
                    style = MaterialTheme.typography.labelSmall,
                    color = ClassicShellColors.Brass,
                    modifier = Modifier.testTag("ActionButtons_WitnessMothBloom")
                )
                WitnessMothButton(
                    label = "Read",
                    tag = "ActionButtons_WitnessMoth_Verify",
                    contributionId = WorldEventSkillIds.VERIFY_TESTIMONY,
                    onWorldEventContribution = onWorldEventContribution
                )
                WitnessMothButton(
                    label = "Frame",
                    tag = "ActionButtons_WitnessMoth_Frame",
                    contributionId = WorldEventSkillIds.CRAFT_LANTERN_FRAME,
                    onWorldEventContribution = onWorldEventContribution
                )
                WitnessMothButton(
                    label = "Guard",
                    tag = "ActionButtons_WitnessMoth_Guard",
                    contributionId = WorldEventSkillIds.DEFEND_SCRIBES,
                    onWorldEventContribution = onWorldEventContribution
                )
            }
        }
    }
}

@Composable
private fun WitnessMothButton(
    label: String,
    tag: String,
    contributionId: String,
    onWorldEventContribution: (String) -> Unit,
) {
    Box(
        modifier = Modifier
            .width(72.dp)
            .height(34.dp)
            .clip(CircleShape)
            .background(ClassicShellColors.Stone.copy(alpha = 0.92f))
            .border(1.dp, ClassicShellColors.Brass.copy(alpha = 0.75f), CircleShape)
            .clickable { onWorldEventContribution(contributionId) }
            .testTag(tag),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = ClassicShellColors.Text
        )
    }
}
