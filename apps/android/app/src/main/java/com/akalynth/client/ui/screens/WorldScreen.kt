package com.akalynth.client.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.akalynth.client.game.GameEvent
import com.akalynth.client.game.GameState
import com.akalynth.client.game.MapRepository
import com.akalynth.client.network.EndpointInfo
import com.akalynth.client.protocol.MapName
import com.akalynth.client.protocol.OnwardRouteProgress
import com.akalynth.client.protocol.PlayerPublic
import com.akalynth.client.ui.diagnostics.DiagnosticsFormatter
import com.akalynth.client.ui.components.*
import com.akalynth.client.ui.components.chronicle.ChronicleSheet
import com.akalynth.client.ui.theme.ClassicButton
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors
import kotlinx.coroutines.delay

@Composable
fun WorldScreen(
    state: GameState,
    onEvent: (GameEvent) -> Unit
) {
    val context = LocalContext.current
    val endpoint = EndpointInfo.fromWsUrl(state.session.serverUrl)
    val nowMs = rememberNowMs()
    val reconnectLabel = DiagnosticsFormatter.reconnectCountdownLabel(state.ui.connectionDiagnostics, nowMs)
    val mapData = remember(context, state.world.currentMap) {
        MapRepository.load(context, state.world.currentMap)
    }
    val showRookguardVocations = isRookguardGuildHallContext(
        map = state.world.currentMap,
        me = state.world.me,
        inGuildHall = state.world.me?.let { me ->
            mapData?.landmarks?.get("guild_hall")?.contains(me.x, me.y)
        } == true
    )
    val routeActionSkillIds = routeActionSkillIdsFor(state.progression.loop?.onwardRoutes ?: emptyList())
    val showRouteSurveys = routeActionSkillIds.isNotEmpty()
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ClassicShellColors.Void)
    ) {
        GameCanvas(
            map = state.world.currentMap,
            me = state.world.me,
            others = state.world.otherPlayers.values.toList(),
            modifier = Modifier.fillMaxSize()
        )

        HUD(
            playerName = state.session.playerName,
            me = state.world.me,
            playerCount = state.world.otherPlayers.size,
            gold = state.economy.gold,
            propertyCount = state.economy.properties.size,
            propertyStatus = propertyStatusLabel(state.economy.lastPropertyResult),
            workStatus = workStatusLabel(state.economy.work),
            npcStatus = npcStatusLabel(state.ui.npcDialogue),
            connectionState = state.connection,
            modifier = Modifier.align(Alignment.TopStart)
        )

        ClassicPanel(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 12.dp),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 7.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            Text(
                text = state.world.currentMap.displayName,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = ClassicShellColors.Brass
            )
            Text(
                text = reconnectLabel
                    ?: "${endpoint.lane} - ${DiagnosticsFormatter.connectionLabel(state.connection)}",
                style = MaterialTheme.typography.labelSmall,
                color = if (reconnectLabel != null) ClassicShellColors.Warning else ClassicShellColors.MutedText,
                modifier = Modifier.testTag("WorldScreen_ConnectionLine")
            )
        }

        OnwardRoutesPanel(
            routes = state.progression.loop?.onwardRoutes ?: emptyList(),
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 12.dp)
        )

        Row(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ClassicButton(
                text = "Issue",
                onClick = {
                    copyTextToClipboard(
                        context = context,
                        label = "Akalynth Issue Report",
                        text = DiagnosticsFormatter.formatIssueReport(state),
                        toast = "Issue report copied"
                    )
                },
                compact = true,
                modifier = Modifier.testTag("WorldScreen_ReportIssue")
            )
            ClassicButton(
                text = "DBG",
                onClick = { onEvent(GameEvent.ToggleDebugDrawer) },
                compact = true,
                modifier = Modifier.testTag("WorldScreen_Debug")
            )
        }

        if (!state.ui.showDebugDrawer) {
            DPad(
                onMove = { dir -> onEvent(GameEvent.Move(dir)) },
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 12.dp, bottom = if (state.ui.chatOpen) 304.dp else 12.dp)
            )

            ActionButtons(
                onChat = { onEvent(GameEvent.ToggleChat) },
                onChronicle = { onEvent(GameEvent.ToggleChronicle) },
                showWitnessMothBloom = state.world.currentMap.isHighCityCompatible,
                onWorldEventContribution = { contributionId ->
                    onEvent(GameEvent.WorldEventContribution(contributionId))
                },
                showRouteSurveys = showRouteSurveys,
                routeActionSkillIds = routeActionSkillIds,
                onRouteSurvey = { skillId -> onEvent(GameEvent.RouteSurvey(skillId)) },
                showRookguardActions = !state.world.currentMap.isHighCityCompatible,
                showRookguardVocations = showRookguardVocations,
                showHighCityActions = state.world.currentMap.isHighCityCompatible,
                onTalkToNpc = { npcId -> onEvent(GameEvent.TalkToNpc(npcId)) },
                onDeclareVocation = { vocation -> onEvent(GameEvent.DeclareVocation(vocation)) },
                onInspectWallet = { onEvent(GameEvent.InspectWallet) },
                onStartWork = { onEvent(GameEvent.StartWorkContract) },
                onTickWork = { onEvent(GameEvent.TickWorkContract) },
                onBuyHouse = { propertyId -> onEvent(GameEvent.BuyHouse(propertyId)) },
                onListHouse = { propertyId, price -> onEvent(GameEvent.ListHouse(propertyId, price)) },
                onUnlistHouse = { propertyId -> onEvent(GameEvent.UnlistHouse(propertyId)) },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 12.dp, bottom = if (state.ui.chatOpen) 304.dp else 12.dp)
            )

            ChatOverlay(
                messages = state.world.chatMessages,
                isOpen = state.ui.chatOpen,
                onSend = { msg -> onEvent(GameEvent.SendChat(msg)) },
                onClose = { onEvent(GameEvent.ToggleChat) },
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }

        if (state.ui.showDebugDrawer) {
            DebugDrawer(
                state = state,
                onClose = { onEvent(GameEvent.ToggleDebugDrawer) },
                onClear = { onEvent(GameEvent.ClearDebugLog) },
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }

        if (state.ui.showChronicleSheet) {
            ChronicleSheet(
                events = state.ui.chronicleEvents,
                hasMore = state.ui.chronicleHasMore,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = { onEvent(GameEvent.ToggleChronicle) },
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }

        state.ui.temChallenge?.let { challenge ->
            TemChallengeDialog(
                message = challenge.message,
                expiresAt = challenge.expiresAt,
                onSubmit = { response -> onEvent(GameEvent.AnswerTemChallenge(response)) },
                onDismiss = { onEvent(GameEvent.DismissTemChallenge) }
            )
        }

        state.ui.witnessRequest?.let { request ->
            WitnessDialog(
                prompt = request.prompt,
                expiresAt = request.expiresAt,
                onRespond = { response ->
                    onEvent(GameEvent.AnswerWitness(request.requestId, response))
                },
                onDismiss = { onEvent(GameEvent.DismissWitnessRequest) }
            )
        }

        state.ui.errorMessage?.let { error ->
            Snackbar(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(16.dp),
                action = {
                    TextButton(onClick = { onEvent(GameEvent.DismissError) }) {
                        Text("Dismiss")
                    }
                }
            ) {
                Text(error)
            }
        }
    }
}

private fun routeActionSkillIdsFor(routes: List<OnwardRouteProgress>): List<String> {
    return routes.flatMap { route ->
        if (route.status != "available") return@flatMap emptyList()
        val completed = route.completedObjectiveIds.toSet()
        when (route.routeId) {
            "forgehold_route_slice_v1" -> when {
                !completed.contains("forgehold_route_survey") -> listOf("route:survey:forgehold")
                !completed.contains("forgehold_missing_shipment") -> listOf("route:quest:shipment")
                !completed.contains("forgehold_economy_receipts") -> listOf("route:economy:forgehold")
                !completed.contains("soulsteel_stabilization") -> listOf("route:craft:soulsteel")
                !completed.contains("forgehold_abuse_notes") -> listOf("route:safety:forgehold")
                !completed.contains("heartforge_trial_server_gate") -> listOf("route:gate:heartforge")
                !completed.contains("ashglass_evidence_recovery") -> listOf("route:craft:ashglass")
                !completed.contains("soulsteel_refinement_authorization") -> listOf("route:craft:refine")
                !completed.contains("soulsteel_component_mint") -> listOf("route:craft:mint")
                else -> emptyList()
            }
            "moonspire_dream_gate_slice_v1" -> when {
                !completed.contains("dream_gate_rumor") -> listOf("route:survey:moonspire")
                !completed.contains("symbolic_puzzle_projection") -> listOf("route:dream:interpret")
                !completed.contains("dream_fragment_evidence") -> listOf("route:dream:fragment")
                !completed.contains("dream_gate_abuse_notes") -> listOf("route:safety:moonspire")
                !completed.contains("dream_gate_server_seal") -> listOf("route:gate:moonspire")
                else -> emptyList()
            }
            else -> emptyList()
        }
    }
}

@Composable
private fun OnwardRoutesPanel(
    routes: List<OnwardRouteProgress>,
    modifier: Modifier = Modifier
) {
    if (routes.isEmpty()) return

    ClassicPanel(
        modifier = modifier
            .widthIn(max = 260.dp)
            .testTag("WorldScreen_OnwardRoutes"),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = "Next routes",
            style = MaterialTheme.typography.labelMedium,
            color = ClassicShellColors.Brass,
            fontWeight = FontWeight.Bold
        )
        routes.forEach { route ->
            val open = route.status == "available"
            val completed = route.completedObjectiveIds.toSet()
            val systems = route.objectives
                .map { objective -> objective.system }
                .distinct()
                .joinToString(", ")
            Text(
                text = "${if (open) "Open" else "Locked"}: ${route.title} (${route.completedObjectiveIds.size}/${route.objectives.size})",
                style = MaterialTheme.typography.labelSmall,
                color = if (open) ClassicShellColors.Good else ClassicShellColors.MutedText,
                modifier = Modifier.testTag("WorldScreen_OnwardRoute_${route.routeId}")
            )
            Text(
                text = route.nextObjective,
                style = MaterialTheme.typography.bodySmall,
                color = ClassicShellColors.Text
            )
            Text(
                text = systems,
                style = MaterialTheme.typography.labelSmall,
                color = ClassicShellColors.Rune
            )
            Column(
                verticalArrangement = Arrangement.spacedBy(3.dp),
                modifier = Modifier.testTag("WorldScreen_OnwardRouteObjectives_${route.routeId}")
            ) {
                route.objectives.forEach { objective ->
                    val done = completed.contains(objective.id)
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (done) "Done" else "Next",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (done) ClassicShellColors.Good else ClassicShellColors.MutedText,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = objective.label,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (done) ClassicShellColors.Good else ClassicShellColors.Text,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = objective.system,
                            style = MaterialTheme.typography.labelSmall,
                            color = ClassicShellColors.Rune
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun rememberNowMs(): Long {
    var nowMs by remember { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            nowMs = System.currentTimeMillis()
        }
    }
    return nowMs
}

private fun isRookguardGuildHallContext(
    map: MapName,
    me: PlayerPublic?,
    inGuildHall: Boolean
): Boolean {
    if (map != MapName.ROOKGUARD || me == null || !inGuildHall) return false
    val badges = me.badges ?: emptyList()
    return badges.none { it.startsWith("vocation_") }
}

private fun propertyStatusLabel(status: com.akalynth.client.game.PropertyResultStatus?): String? {
    if (status == null) return null
    val action = when (status.action) {
        "buy_house" -> "Buy"
        "list_house" -> "List"
        "unlist_house" -> "Unlist"
        else -> status.action
    }
    return if (status.success) {
        "$action ${status.propertyId}: ok"
    } else {
        "$action ${status.propertyId}: ${status.reason ?: "failed"}"
    }
}

private fun workStatusLabel(status: com.akalynth.client.game.WorkContractStatus?): String? {
    if (status == null) return null
    if (status.error != null) return "Work: ${status.error}"
    if (status.complete) return "Work: +${status.payoutGold ?: 0} gold"
    return if (status.ticksRequired > 0) {
        "Work: ${status.ticksObserved}/${status.ticksRequired}"
    } else {
        "Work: started +${status.payoutGold ?: 0} gold"
    }
}

private fun npcStatusLabel(status: com.akalynth.client.game.NpcDialogueStatus?): String? {
    if (status == null) return null
    val name = status.npcId.replace('_', ' ')
    if (status.error != null) return "$name: ${status.error}"
    val line = status.line ?: return null
    return "$name: $line"
}

private fun copyTextToClipboard(
    context: Context,
    label: String,
    text: String,
    toast: String
) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText(label, text))
    Toast.makeText(context, toast, Toast.LENGTH_SHORT).show()
}
