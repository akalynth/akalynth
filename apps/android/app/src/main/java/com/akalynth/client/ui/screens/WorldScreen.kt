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
import com.akalynth.client.game.GatherHelpers
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
import com.akalynth.client.ui.components.hotbar.DropConfirmationOverlay
import com.akalynth.client.ui.components.hotbar.Hotbar
import com.akalynth.client.ui.components.hud.GameHUD
import com.akalynth.client.ui.state.UiOverlayState
import com.akalynth.client.ui.theme.ClassicButton
import com.akalynth.client.ui.theme.ClassicPanel
import com.akalynth.client.ui.theme.ClassicShellColors
import com.akalynth.client.ui.theme.akalynthWallpaperBrush
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
    val loop = state.progression.loop
    val routeActionSkillIds = routeActionSkillIdsFor(loop?.onwardRoutes ?: emptyList())
    val showRouteActions = routeActionSkillIds.isNotEmpty()
    val objective = loop?.objective.orEmpty()
    val trainingSlime = findTrainingSlime(state.world.otherPlayers.values)
    val showTrainingAttack = state.world.currentMap == MapName.ROOKGUARD &&
        loop?.rookguardQuest?.steps?.any { it.stepId == "training" && !it.complete } == true
    val mapMarkers = rookguardObjectiveMarkers(state.world.currentMap, loop)
    val forgeholdRoute = loop?.onwardRoutes?.firstOrNull { it.routeId == "forgehold_route_slice_v1" }
    val forgeholdPromoSkill = routeActionSkillIds.firstOrNull { it.startsWith("route:") }
    val forgeholdPayoutPending = forgeholdRoute?.completedObjectiveIds?.contains("forgehold_component_settlement") == true &&
        forgeholdRoute.completedObjectiveIds.contains("forgehold_component_payout").not()
    val gatherNode = GatherHelpers.nearestGatherableNode(state.gather, state.world.me)
    val gatherStation = GatherHelpers.nearestDeliverableStation(state.gather, state.world.me)
    val gatherRefinery = GatherHelpers.nearestRefineryStation(state.gather, state.world.me)
    var showcaseMap by remember { mutableStateOf(false) }
    var overlayState by remember { mutableStateOf<UiOverlayState>(UiOverlayState.None) }
    val unlockStage = state.unlock.stage
    val hotbarBottomPadding = if (state.ui.chatOpen) 292.dp else 0.dp
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(akalynthWallpaperBrush())
    ) {
        GameCanvas(
            map = if (showcaseMap) MapName.TILE_SHOWCASE else state.world.currentMap,
            me = state.world.me,
            others = state.world.otherPlayers.values.toList(),
            objectiveMarkers = mapMarkers,
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
            questProgress = codexQuestProgress(loop),
            modifier = Modifier
                .align(Alignment.TopStart)
                .statusBarsPadding()
        )

        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top,
            ) {
                Spacer(modifier = Modifier.width(172.dp))
                ClassicPanel(
                    modifier = Modifier
                        .weight(1f)
                        .testTag("WorldScreen_MapChip"),
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
                Row(
                    modifier = Modifier.widthIn(min = 172.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                    verticalAlignment = Alignment.Top,
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
                    ClassicButton(
                        text = if (showcaseMap) "MAP" else "TILES",
                        onClick = { showcaseMap = !showcaseMap },
                        compact = true,
                        modifier = Modifier.testTag("WorldScreen_TileShowcase")
                    )
                }
            }
            if (objective.isNotBlank()) {
                ObjectiveBanner(
                    objective = objective,
                    accent = when {
                        showTrainingAttack && trainingSlime != null ->
                            "Training slime nearby — tap ATK (${trainingSlime.x},${trainingSlime.y})"
                        loop?.gateOpen == true && !loop.complete ->
                            "Gate is open — walk onto the golden tiles"
                        else -> null
                    }
                )
            }
            if (loop?.complete == true && forgeholdRoute?.status == "available" && forgeholdPromoSkill != null) {
                ForgeholdPromoBanner(
                    nextObjective = forgeholdRoute.nextObjective,
                    payoutPending = forgeholdPayoutPending,
                    onRouteAction = { onEvent(GameEvent.RouteAction(forgeholdPromoSkill)) }
                )
            }
        }

        OnwardRoutesPanel(
            routes = state.progression.loop?.onwardRoutes ?: emptyList(),
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 12.dp)
        )

        if (!state.ui.showDebugDrawer) {
            GameHUD(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = hotbarBottomPadding),
                stage = unlockStage,
                dpad = { modifier ->
                    DPad(
                        onMove = { dir -> onEvent(GameEvent.Move(dir)) },
                        modifier = modifier
                    )
                },
                actions = { modifier ->
                    ActionButtons(
                        onChat = { onEvent(GameEvent.ToggleChat) },
                        onChronicle = { onEvent(GameEvent.ToggleChronicle) },
                        showWitnessMothBloom = state.world.currentMap.isHighCityCompatible,
                        onWorldEventContribution = { contributionId ->
                            onEvent(GameEvent.WorldEventContribution(contributionId))
                        },
                        showRouteActions = showRouteActions,
                        routeActionSkillIds = routeActionSkillIds,
                        onRouteAction = { skillId -> onEvent(GameEvent.RouteAction(skillId)) },
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
                        showTrainingAttack = showTrainingAttack,
                        trainingSlimeTargetId = trainingSlime?.id,
                        onAttack = { targetId -> onEvent(GameEvent.Attack(targetId)) },
                        showGather = state.gather.isEnabled,
                        gatherNodeId = gatherNode?.nodeId,
                        gatherStationId = gatherStation?.stationId,
                        gatherRefineStationId = gatherRefinery?.stationId,
                        gatherBusy = state.gather.activeNodeId != null || state.gather.activeRefineStationId != null,
                        gatherRefining = state.gather.activeRefineStationId != null,
                        gatherProgressPct = state.gather.progressPct,
                        gatherHeldItem = state.gather.heldItemType,
                        onGather = { nodeId -> onEvent(GameEvent.Gather(nodeId)) },
                        onDeliver = { stationId -> onEvent(GameEvent.Deliver(stationId)) },
                        onRefine = { stationId -> onEvent(GameEvent.Refine(stationId)) },
                        modifier = modifier
                    )
                },
                hotbar = { modifier ->
                    Box(
                        modifier = modifier.fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Hotbar(
                            slots = state.inventory.hotbarSlots,
                            onSlotTap = { index -> onEvent(GameEvent.UseHotbarSlot(index)) },
                            onSlotLongPress = { index ->
                                val item = state.inventory.hotbarSlots.getOrNull(index) ?: return@Hotbar
                                overlayState = UiOverlayState.ConfirmDrop(
                                    slotIndex = index,
                                    itemId = item.id,
                                    itemName = item.name,
                                    isLegendary = item.rarity.requiresTier3Confirm
                                )
                            }
                        )
                    }
                }
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
                inlineError = challenge.inlineError,
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

        when (val overlay = overlayState) {
            is UiOverlayState.ConfirmDrop -> {
                DropConfirmationOverlay(
                    slotIndex = overlay.slotIndex,
                    itemId = overlay.itemId,
                    itemName = overlay.itemName,
                    isLegendary = overlay.isLegendary,
                    onConfirmDrop = { slotIndex, _ ->
                        overlayState = UiOverlayState.None
                        onEvent(GameEvent.DropHotbarSlot(slotIndex))
                    },
                    onCancel = { overlayState = UiOverlayState.None },
                    modifier = Modifier.fillMaxSize()
                )
            }
            else -> Unit
        }
    }
}

private fun routeActionSkillIdsFor(routes: List<OnwardRouteProgress>): List<String> {
    return listOf("activity:fishing:rookguard") + routes.flatMap { route ->
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
                !completed.contains("forgehold_component_settlement") -> listOf("route:economy:settle")
                !completed.contains("forgehold_component_payout") -> listOf("route:economy:payout")
                else -> emptyList()
            }
            "moonspire_dream_gate_slice_v1" -> when {
                !completed.contains("dream_gate_rumor") -> listOf("route:survey:moonspire")
                !completed.contains("symbolic_puzzle_projection") -> listOf("route:dream:interpret")
                !completed.contains("dream_fragment_evidence") -> listOf("route:dream:fragment")
                !completed.contains("dream_gate_abuse_notes") -> listOf("route:safety:moonspire")
                !completed.contains("dream_gate_server_seal") -> listOf("route:gate:moonspire")
                !completed.contains("dream_gate_traversal_authorization") -> listOf("route:dream:traverse")
                !completed.contains("dream_gate_arrival_record") -> listOf("route:dream:arrive")
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
            val nextObjectiveId = if (open) {
                route.objectives.firstOrNull { objective -> !completed.contains(objective.id) }?.id
            } else {
                null
            }
            val routeStepObjectives = route.objectives.filter { objective ->
                objective.system != "ui" && objective.system != "android"
            }
            val routeStepCompleted = routeStepObjectives.count { objective -> completed.contains(objective.id) }
            val systems = route.objectives
                .map { objective -> objective.system }
                .distinct()
                .joinToString(", ")
            Text(
                text = "${if (open) "Open" else "Locked"}: ${route.title} ($routeStepCompleted/${routeStepObjectives.size})",
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
                    val marker = when {
                        done -> "Done"
                        !open -> "Locked"
                        objective.id == nextObjectiveId -> "Next"
                        else -> "Later"
                    }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = marker,
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

private fun findTrainingSlime(others: Collection<PlayerPublic>): PlayerPublic? {
    return others.firstOrNull { player ->
        player.id.startsWith("mob:training_slime") ||
            player.name.equals("Training Slime", ignoreCase = true) ||
            player.mark == "training_mob"
    }
}

private fun rookguardObjectiveMarkers(
    map: MapName,
    loop: com.akalynth.client.protocol.PlayLoopProgress?
): List<Pair<Int, Int>> {
    if (map != MapName.ROOKGUARD || loop == null) return emptyList()
    val quest = loop.rookguardQuest ?: return emptyList()
    val markers = mutableListOf<Pair<Int, Int>>()
    quest.steps.forEach { step ->
        if (step.complete) return@forEach
        when (step.stepId) {
            "move" -> markers.add(3 to 2)
            "tem" -> markers.add(7 to 2)
            "training" -> markers.add(14 to 14)
            "gate" -> if (loop.gateOpen) markers.add(10 to 2)
        }
    }
    return markers
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

private fun codexQuestProgress(loop: com.akalynth.client.protocol.PlayLoopProgress?): Float? {
    val steps = loop?.rookguardQuest?.steps ?: return null
    if (steps.isEmpty()) return null
    return steps.count { it.complete }.toFloat() / steps.size.toFloat()
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
