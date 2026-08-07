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
import com.akalynth.client.game.GatherLoopPresentation
import com.akalynth.client.protocol.SovereignVocation
import com.akalynth.client.ui.theme.ClassicActionDock
import com.akalynth.client.ui.theme.ClassicActionRingButton
import com.akalynth.client.ui.theme.ClassicButton
import com.akalynth.client.ui.theme.ClassicShellColors

private val ROOKGUARD_VOCATION_ACTIONS = listOf(
    SovereignVocation.WARDEN to "Wdn",
    SovereignVocation.CANTOR to "Cnt",
    SovereignVocation.HEXER to "Hex",
    SovereignVocation.REAVER to "Rvr"
)

private val ROUTE_ACTIONS = listOf(
    "route:survey:forgehold" to "Forge",
    "route:survey:moonspire" to "Dream",
    "route:safety:forgehold" to "FSafe",
    "route:safety:moonspire" to "DSafe",
    "route:quest:shipment" to "Ship",
    "route:economy:forgehold" to "Quote",
    "route:economy:settle" to "Settle",
    "route:economy:payout" to "Pay",
    "route:craft:soulsteel" to "Steel",
    "route:craft:ashglass" to "Glass",
    "route:craft:refine" to "Refine",
    "route:craft:mint" to "Mint",
    "route:gate:heartforge" to "HGate",
    "route:gate:moonspire" to "Seal",
    "route:dream:traverse" to "Pass",
    "route:dream:arrive" to "Arrv",
    "route:dream:interpret" to "Interp",
    "route:dream:fragment" to "Frag",
    "activity:fishing:rookguard" to "Fish"
)
private val ROUTE_ACTION_LABELS = ROUTE_ACTIONS.toMap()

@Composable
fun ActionButtons(
    onChat: () -> Unit,
    onChronicle: () -> Unit = {},
    showWitnessMothBloom: Boolean = false,
    onWorldEventContribution: (String) -> Unit = {},
    showRouteActions: Boolean = false,
    routeActionSkillIds: List<String> = ROUTE_ACTIONS.map { it.first },
    onRouteAction: (String) -> Unit = {},
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
    showTrainingAttack: Boolean = false,
    trainingSlimeTargetId: String? = null,
    onAttack: (String) -> Unit = {},
    showGather: Boolean = false,
    gatherNodeId: String? = null,
    gatherStationId: String? = null,
    gatherRefineStationId: String? = null,
    gatherBusy: Boolean = false,
    gatherRefining: Boolean = false,
    gatherProgressPct: Float = 0f,
    gatherHeldItem: String? = null,
    gatherStatus: String? = null,
    onGather: (String) -> Unit = {},
    onDeliver: (String) -> Unit = {},
    onRefine: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val routeActions = routeActionSkillIds.mapNotNull { skillId ->
        ROUTE_ACTION_LABELS[skillId]?.let { label -> skillId to label }
    }

    ClassicActionDock(modifier = modifier, maxWidth = 220.dp) {
            ClassicActionRingButton(
                onClick = onChat,
                modifier = Modifier.size(62.dp),
            ) {
                Icon(
                    imageVector = Icons.Default.Email,
                    contentDescription = "Chat",
                    tint = ClassicShellColors.Text,
                    modifier = Modifier.size(30.dp),
                )
            }

            Text(
                text = "Chat",
                style = MaterialTheme.typography.labelSmall,
                color = ClassicShellColors.Text
            )

            ClassicActionRingButton(
                onClick = onChronicle,
                modifier = Modifier
                    .size(54.dp)
                    .testTag("ActionButtons_Chronicle"),
            ) {
                Text(
                    text = "C",
                    style = MaterialTheme.typography.titleMedium,
                    color = ClassicShellColors.Text,
                )
            }

            Text(
                text = "Chronicle",
                style = MaterialTheme.typography.labelSmall,
                color = ClassicShellColors.Text
            )

            if (showTrainingAttack && !trainingSlimeTargetId.isNullOrBlank()) {
                Text(
                    text = "Training",
                    style = MaterialTheme.typography.labelSmall,
                    color = ClassicShellColors.Brass,
                    modifier = Modifier.testTag("ActionButtons_TrainingAttackLabel")
                )
                ClassicActionRingButton(
                    onClick = { onAttack(trainingSlimeTargetId) },
                    danger = true,
                    modifier = Modifier
                        .size(62.dp)
                        .testTag("ActionButtons_AttackTrainingSlime"),
                ) {
                    Text(
                        text = "ATK",
                        style = MaterialTheme.typography.titleMedium,
                        color = ClassicShellColors.Text,
                    )
                }
                Text(
                    text = "Slime",
                    style = MaterialTheme.typography.labelSmall,
                    color = ClassicShellColors.Text
                )
            }

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

            if (showRouteActions && routeActions.isNotEmpty()) {
                Text(
                    text = "Routes",
                    style = MaterialTheme.typography.labelSmall,
                    color = ClassicShellColors.Brass,
                    modifier = Modifier.testTag("ActionButtons_RouteActions")
                )
                routeActions.forEach { (skillId, label) ->
                    ClassicButton(
                        text = label,
                        onClick = { onRouteAction(skillId) },
                        compact = true,
                        modifier = Modifier.testTag("ActionButtons_RouteAction_$label")
                    )
                }
            }

            if (showGather) {
                Text(
                    text = "Ley Mote",
                    style = MaterialTheme.typography.labelSmall,
                    color = ClassicShellColors.Brass,
                    modifier = Modifier.testTag("ActionButtons_GatherSection")
                )
                val loopCompleteHint =
                    gatherHeldItem == null &&
                        (gatherStatus?.startsWith("Delivered") == true)
                Text(
                    text = GatherLoopPresentation.compactSummary(
                        heldItemType = gatherHeldItem,
                        loopCompleteHint = loopCompleteHint,
                    ),
                    style = MaterialTheme.typography.labelSmall,
                    color = ClassicShellColors.Text,
                    modifier = Modifier.testTag("ActionButtons_GatherLoopSteps")
                )
                if (gatherBusy) {
                    Text(
                        text = "${if (gatherRefining) "Refining" else "Gathering"} ${gatherProgressPct.toInt()}%",
                        style = MaterialTheme.typography.labelSmall,
                        color = ClassicShellColors.MutedText,
                        modifier = Modifier.testTag("ActionButtons_GatherProgress")
                    )
                }
                Text(
                    text = "Held: ${GatherLoopPresentation.heldItemLabel(gatherHeldItem)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = ClassicShellColors.Text,
                    modifier = Modifier.testTag("ActionButtons_GatherHeld")
                )
                gatherStatus?.takeIf { it.isNotBlank() }?.let { status ->
                    Text(
                        text = status,
                        style = MaterialTheme.typography.labelSmall,
                        color = ClassicShellColors.MutedText,
                        modifier = Modifier.testTag("ActionButtons_GatherStatus")
                    )
                }
                gatherNodeId?.let { nodeId ->
                    ClassicButton(
                        text = "Gthr",
                        onClick = { onGather(nodeId) },
                        compact = true,
                        enabled = !gatherBusy && gatherHeldItem == null,
                        modifier = Modifier.testTag("ActionButtons_Gather")
                    )
                }
                gatherRefineStationId?.let { stationId ->
                    ClassicButton(
                        text = "Refn",
                        onClick = { onRefine(stationId) },
                        compact = true,
                        enabled = !gatherBusy && gatherHeldItem != null && gatherHeldItem.startsWith("refined_").not(),
                        modifier = Modifier.testTag("ActionButtons_Refine")
                    )
                }
                gatherStationId?.let { stationId ->
                    ClassicButton(
                        text = "Deliv",
                        onClick = { onDeliver(stationId) },
                        compact = true,
                        enabled = !gatherBusy && gatherHeldItem != null,
                        modifier = Modifier.testTag("ActionButtons_Deliver")
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
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
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

@Composable
private fun VocationChip(
    label: String,
    tag: String,
    onClick: () -> Unit
) {
    ClassicActionRingButton(
        onClick = onClick,
        modifier = Modifier
            .size(44.dp)
            .testTag(tag),
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
