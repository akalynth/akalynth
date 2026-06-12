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
import com.akalynth.client.protocol.SovereignVocation
import com.akalynth.client.ui.theme.ClassicButton
import com.akalynth.client.ui.theme.ClassicDock
import com.akalynth.client.ui.theme.ClassicShellColors

private val ROOKGUARD_VOCATION_ACTIONS = listOf(
    SovereignVocation.WARDEN to "Wdn",
    SovereignVocation.CANTOR to "Cnt",
    SovereignVocation.HEXER to "Hex",
    SovereignVocation.REAVER to "Rvr"
)

private val ROUTE_SURVEY_ACTIONS = listOf(
    "route:survey:forgehold" to "Forge",
    "route:survey:moonspire" to "Dream"
)

@Composable
fun ActionButtons(
    onChat: () -> Unit,
    onChronicle: () -> Unit = {},
    showWitnessMothBloom: Boolean = false,
    onWorldEventContribution: (String) -> Unit = {},
    showRouteSurveys: Boolean = false,
    onRouteSurvey: (String) -> Unit = {},
    showRookguardActions: Boolean = false,
    showRookguardVocations: Boolean = false,
    showHighCityActions: Boolean = false,
    onTalkToNpc: (String) -> Unit = {},
    onDeclareVocation: (SovereignVocation) -> Unit = {},
    onInspectWallet: () -> Unit = {},
    onStartWork: () -> Unit = {},
    onTickWork: () -> Unit = {},
    onBuyHouse: (String) -> Unit = {},
    onListHouse: (String, Int) -> Unit = { _, _ -> },
    onUnlistHouse: (String) -> Unit = {},
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

            if (showRouteSurveys) {
                Text(
                    text = "Routes",
                    style = MaterialTheme.typography.labelSmall,
                    color = ClassicShellColors.Brass,
                    modifier = Modifier.testTag("ActionButtons_RouteSurveys")
                )
                ROUTE_SURVEY_ACTIONS.forEach { (skillId, label) ->
                    ClassicButton(
                        text = label,
                        onClick = { onRouteSurvey(skillId) },
                        compact = true,
                        modifier = Modifier.testTag("ActionButtons_RouteSurvey_$label")
                    )
                }
            }

            if (showRookguardActions) {
                Text(
                    text = "Rookguard",
                    style = MaterialTheme.typography.labelSmall,
                    color = ClassicShellColors.Brass,
                    modifier = Modifier.testTag("ActionButtons_RookguardActions")
                )
                ClassicButton(
                    text = "Guide",
                    onClick = { onTalkToNpc("rookguard_guide") },
                    compact = true,
                    modifier = Modifier.testTag("ActionButtons_Talk_RookguardGuide")
                )
                if (showRookguardVocations) {
                    ClassicButton(
                        text = "Steward",
                        onClick = { onTalkToNpc("rookguard_steward") },
                        compact = true,
                        modifier = Modifier.testTag("ActionButtons_Talk_RookguardSteward")
                    )
                    Text(
                        text = "Codex",
                        style = MaterialTheme.typography.labelSmall,
                        color = ClassicShellColors.MutedText,
                        modifier = Modifier.testTag("ActionButtons_RookguardCodexVocations")
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        ROOKGUARD_VOCATION_ACTIONS.forEach { (vocation, label) ->
                            VocationChip(
                                label = label,
                                tag = "ActionButtons_Declare_${vocation.name}",
                                onClick = { onDeclareVocation(vocation) }
                            )
                        }
                    }
                }
            }

            if (showHighCityActions) {
                Text(
                    text = "High City",
                    style = MaterialTheme.typography.labelSmall,
                    color = ClassicShellColors.Brass,
                    modifier = Modifier.testTag("ActionButtons_HighCityActions")
                )
                ClassicButton(
                    text = "Wallet",
                    onClick = onInspectWallet,
                    compact = true,
                    modifier = Modifier.testTag("ActionButtons_Wallet")
                )
                ClassicButton(
                    text = "Herald",
                    onClick = { onTalkToNpc("azura_herald") },
                    compact = true,
                    modifier = Modifier.testTag("ActionButtons_Talk_AzuraHerald")
                )
                ClassicButton(
                    text = "Steward",
                    onClick = { onTalkToNpc("azura_steward") },
                    compact = true,
                    modifier = Modifier.testTag("ActionButtons_Talk_AzuraSteward")
                )
                ClassicButton(
                    text = "Work",
                    onClick = onStartWork,
                    compact = true,
                    modifier = Modifier.testTag("ActionButtons_StartWork")
                )
                ClassicButton(
                    text = "Tick",
                    onClick = onTickWork,
                    compact = true,
                    modifier = Modifier.testTag("ActionButtons_TickWork")
                )
                ClassicButton(
                    text = "Buy H1",
                    onClick = { onBuyHouse("Azura:H1") },
                    compact = true,
                    modifier = Modifier.testTag("ActionButtons_BuyHouse_H1")
                )
                ClassicButton(
                    text = "List H1",
                    onClick = { onListHouse("Azura:H1", 750) },
                    compact = true,
                    modifier = Modifier.testTag("ActionButtons_ListHouse_H1")
                )
                ClassicButton(
                    text = "Unlist H1",
                    onClick = { onUnlistHouse("Azura:H1") },
                    compact = true,
                    modifier = Modifier.testTag("ActionButtons_UnlistHouse_H1")
                )
            }
        }
    }
}

@Composable
private fun VocationChip(
    label: String,
    tag: String,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .width(44.dp)
            .height(32.dp)
            .clip(CircleShape)
            .background(ClassicShellColors.Stone.copy(alpha = 0.92f))
            .border(1.dp, ClassicShellColors.Brass.copy(alpha = 0.75f), CircleShape)
            .clickable { onClick() }
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
