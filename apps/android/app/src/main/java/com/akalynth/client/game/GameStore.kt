package com.akalynth.client.game

import android.content.Context
import com.akalynth.client.BuildConfig
import com.akalynth.client.network.ConnectionState
import com.akalynth.client.network.EndpointInfo
import com.akalynth.client.network.HealthApi
import com.akalynth.client.network.IdentityStore
import com.akalynth.client.network.WsClient
import com.akalynth.client.network.WsEvent
import com.akalynth.client.protocol.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val PREFS_NAME = "akalynth_prefs"
private const val KEY_GUEST_TOKEN = "guest_token"
private const val KEY_SERVER_URL = "server_url"
private val DEFAULT_SERVER_URL = BuildConfig.WS_BASE_URL
private const val MAX_CHAT_MESSAGES = 50
private const val MAX_DEBUG_LOG = 100
private const val WITNESS_TTL_MS = 12000L

class GameStore(
    private val wsClient: WsClient,
    private val scope: CoroutineScope,
    private val context: Context
) {
    private val _state = MutableStateFlow(GameState.INITIAL)
    val state: StateFlow<GameState> = _state.asStateFlow()

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val identityStore = IdentityStore(context)

    init {
        // Load saved guest token and server URL
        val savedToken = prefs.getString(KEY_GUEST_TOKEN, null)
        val savedUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL

        _state.update {
            it.copy(
                session = it.session.copy(
                    guestToken = savedToken,
                    savedCharacterName = identityStore.getPlayerName(),
                    serverUrl = savedUrl
                )
            )
        }

        observeWsEvents()
        observeConnectionState()
        observeWsDiagnostics()
        checkHealth()
    }

    private fun observeWsEvents() {
        scope.launch {
            wsClient.events.collect { event ->
                when (event) {
                    is WsEvent.Connected -> {
                        logDebug("sys", "connected")
                        onConnected()
                    }
                    is WsEvent.MessageReceived -> {
                        logReceived(event.message)
                        handleServerMessage(event.message)
                    }
                    is WsEvent.Disconnected -> {
                        logDebug("sys", "disconnected: ${event.reason}")
                    }
                    is WsEvent.Error -> {
                        logDebug("sys", "error: ${event.throwable.message}")
                    }
                }
            }
        }
    }

    private fun logDebug(direction: String, preview: String) {
        val entry = DebugLogEntry(
            timestamp = System.currentTimeMillis(),
            direction = direction,
            messageType = "",
            preview = preview
        )
        val log = (_state.value.ui.debugLog + entry).takeLast(MAX_DEBUG_LOG)
        _state.update { it.copy(ui = it.ui.copy(debugLog = log)) }
    }

    private fun logReceived(msg: ServerMessage) {
        val type = msg::class.simpleName ?: "Unknown"
        val preview = when (msg) {
            is WelcomeMessage -> "v${msg.version}"
            is LoginAckMessage -> if (msg.ok != false) "ok, id=${msg.playerId}" else "fail: ${msg.reason}"
            is WorldStateMessage -> "map=${msg.map}, players=${msg.nearbyPlayers.size}"
            is MoveResultMessage -> "ok=${msg.ok}, pos=(${msg.x},${msg.y})"
            is LoopUpdateMessage -> "${msg.event}: ${msg.loop.objective}"
            is PlayerMovedMessage -> "${msg.playerId} -> (${msg.x},${msg.y})"
            is PlayerJoinedMessage -> msg.player.name
            is PlayerLeftMessage -> msg.playerId
            is ChatBroadcastMessage -> "${msg.name}: ${msg.message.take(20)}"
            is TemChallengeMessage -> msg.message.take(30)
            is TemWitnessRequestMessage -> msg.prompt.take(30)
            is ErrorMessage -> "${msg.code}: ${msg.message}"
            is DeathNoticeMessage -> msg.reason
            is RunestoneResultMessage -> "${msg.caster.name}: ${msg.face}"
            is RunestoneDeniedMessage -> msg.reason
            is CombatResolvedMessage -> "${msg.attackerId} killed ${msg.defenderId}"
            is CombatRejectedMessage -> msg.reason
            is DropItemResultMessage -> "drop ${msg.itemId} ok=${msg.ok}"
            is PickupItemResultMessage -> "pickup ${msg.itemId} ok=${msg.ok}"
            is InventorySnapshotMessage -> "${msg.items.size} items"
            is WorldItemAddedMessage -> "${msg.itemType}@(${msg.x},${msg.y})"
            is WorldItemRemovedMessage -> msg.itemId
            is ProtectedSlotSetMessage -> "slot=${msg.itemId}"
            is ChronicleSnapshotMessage -> "${msg.events.size} events"
            is EvidenceSnapshotMessage -> "status=${msg.status}"
            is PressureMetricsSnapshotMessage -> "status=${msg.status}"
            is PlayerInspectMessage -> "${msg.name} (${msg.displayVocation ?: "—"})"
            is WalletSnapshotMessage -> "gold=${msg.gold}"
            is TitheResultMessage -> "ok=${msg.success}"
            is WorkContractStartedMessage -> msg.contractId
            is WorkProgressMessage -> "${msg.ticksObserved}/${msg.ticksRequired}"
            is WorkContractResultMessage -> "ok=${msg.success}"
            is NpcDialogueMessage -> "${msg.npcId}: ${msg.line.take(20)}"
            is NpcDialogueErrorMessage -> "${msg.npcId}: ${msg.error}"
            is SkillResultMessage -> "${msg.skillId} ok=${msg.success}"
            is ModReportsSnapshotMessage -> "${msg.reports.size} reports"
            is ModResolveResultMessage -> "${msg.caseId} ok=${msg.success}"
            is PropertySnapshotMessage -> "${msg.properties.size} props"
            is PropertyStateMessage -> msg.property.propertyId
            is HouseSoldMessage -> "${msg.plotId} -> ${msg.buyerName}"
            is PropertyResultMessage -> "${msg.action} ok=${msg.success}"
            is PropertyLedgerMessage -> "${msg.propertyId}: ${msg.ownerHistory.size} entries"
            is PropertyAuctionStateMessage -> "${msg.propertyId} next=${msg.minNext}"
            is HouseAuctionSettledMessage -> "${msg.plotId} price=${msg.price}"
            is UnknownMessage -> (msg.type?.let { "$it " } ?: "") + msg.raw.take(50)
        }
        val entry = DebugLogEntry(
            timestamp = System.currentTimeMillis(),
            direction = "\u2190", // ←
            messageType = type.removeSuffix("Message"),
            preview = preview
        )
        val log = (_state.value.ui.debugLog + entry).takeLast(MAX_DEBUG_LOG)
        _state.update { it.copy(ui = it.ui.copy(debugLog = log)) }
    }

    private fun logSent(type: String, preview: String) {
        val entry = DebugLogEntry(
            timestamp = System.currentTimeMillis(),
            direction = "\u2192", // →
            messageType = type,
            preview = preview
        )
        val log = (_state.value.ui.debugLog + entry).takeLast(MAX_DEBUG_LOG)
        _state.update { it.copy(ui = it.ui.copy(debugLog = log)) }
    }

    private fun observeConnectionState() {
        scope.launch {
            wsClient.connectionState.collect { connState ->
                _state.update {
                    it.copy(
                        connection = connState
                    )
                }
            }
        }
    }

    private fun observeWsDiagnostics() {
        scope.launch {
            wsClient.diagnostics.collect { diag ->
                _state.update {
                    it.copy(
                        ui = it.ui.copy(
                            connectionDiagnostics = ConnectionDiagnostics(
                                lastCloseCode = diag.lastCloseCode,
                                lastCloseReason = diag.lastCloseReason,
                                reconnectAttempts = diag.reconnectAttempts,
                                nextBackoffMs = diag.nextBackoffMs,
                                nextReconnectAtMs = diag.nextReconnectAtMs
                            )
                        )
                    )
                }
            }
        }
    }

    fun onEvent(event: GameEvent) {
        when (event) {
            is GameEvent.Connect -> {
                wsClient.setUrl(_state.value.session.serverUrl)
                wsClient.connect()
            }
            is GameEvent.Disconnect -> wsClient.disconnect()
            is GameEvent.CheckHealth -> checkHealth()
            is GameEvent.ResetServerUrl -> setServerUrl(DEFAULT_SERVER_URL)
            is GameEvent.Move -> sendMove(event.direction)
            is GameEvent.SendChat -> sendChat(event.message)
            is GameEvent.ToggleChat -> toggleChat()
            is GameEvent.Attack -> sendAttack(event.targetId)
            is GameEvent.WorldEventContribution -> sendWorldEventContribution(event.contributionId)
            is GameEvent.RouteSurvey -> sendRouteSurvey(event.skillId)
            is GameEvent.TalkToNpc -> talkToNpc(event.npcId)
            is GameEvent.DeclareVocation -> declareVocation(event.vocation)
            is GameEvent.InspectWallet -> inspectWallet()
            is GameEvent.BuyHouse -> buyHouse(event.propertyId)
            is GameEvent.ListHouse -> listHouse(event.propertyId, event.price)
            is GameEvent.UnlistHouse -> unlistHouse(event.propertyId)
            is GameEvent.StartWorkContract -> startWorkContract()
            is GameEvent.TickWorkContract -> tickWorkContract()
            is GameEvent.AnswerTemChallenge -> sendTemResponse(event.response)
            is GameEvent.AnswerWitness -> sendWitnessResponse(event.requestId, event.response)
            is GameEvent.DismissError -> clearError()
            is GameEvent.DismissTemChallenge -> dismissTemChallenge()
            is GameEvent.DismissWitnessRequest -> dismissWitnessRequest()
            is GameEvent.ToggleChronicle -> toggleChronicle()
            is GameEvent.SetServerUrl -> setServerUrl(event.url)
            is GameEvent.ToggleDebugDrawer -> toggleDebugDrawer()
            is GameEvent.ClearDebugLog -> clearDebugLog()
        }
    }

    private fun toggleDebugDrawer() {
        _state.update { it.copy(ui = it.ui.copy(showDebugDrawer = !it.ui.showDebugDrawer)) }
    }

    private fun toggleChronicle() {
        _state.update { it.copy(ui = it.ui.copy(showChronicleSheet = !it.ui.showChronicleSheet)) }
    }

    private fun clearDebugLog() {
        _state.update { it.copy(ui = it.ui.copy(debugLog = emptyList())) }
        logDebug("sys", "log cleared")
    }

    private fun setServerUrl(rawUrl: String) {
        val normalized = normalizeServerUrl(rawUrl)
        if (normalized == null) {
            _state.update {
                it.copy(ui = it.ui.copy(errorMessage = "Invalid URL. Use ws:// or wss://"))
            }
            return
        }

        // If currently connected, disconnect first
        val currentState = _state.value.connection
        if (currentState != ConnectionState.Idle &&
            currentState !is ConnectionState.Disconnected &&
            currentState !is ConnectionState.Error) {
            wsClient.disconnect()
            logDebug("sys", "disconnected for URL change")
        }

        prefs.edit().putString(KEY_SERVER_URL, normalized).apply()
        _state.update { it.copy(session = it.session.copy(serverUrl = normalized)) }
        logDebug("sys", "URL set: $normalized")
        checkHealth()
    }

    private fun checkHealth() {
        val endpoint = EndpointInfo.fromWsUrl(_state.value.session.serverUrl)
        _state.update { it.copy(ui = it.ui.copy(healthCheck = HealthCheckState.Checking)) }
        HealthApi(endpoint.httpBaseUrl).check(object : HealthApi.HealthCallback {
            override fun onSuccess(health: HealthApi.HealthResponse) {
                scope.launch {
                    _state.update {
                        it.copy(
                            ui = it.ui.copy(
                                healthCheck = HealthCheckState.Reachable(
                                    version = health.version,
                                    tickMs = health.tickMs,
                                    checkedAtMs = System.currentTimeMillis()
                                )
                            )
                        )
                    }
                    logDebug("sys", "health OK: v${health.version} tick=${health.tickMs}ms")
                }
            }

            override fun onFailure(error: String) {
                scope.launch {
                    _state.update {
                        it.copy(
                            ui = it.ui.copy(
                                healthCheck = HealthCheckState.Unreachable(
                                    message = error,
                                    checkedAtMs = System.currentTimeMillis()
                                )
                            )
                        )
                    }
                    logDebug("sys", "health FAIL: $error")
                }
            }
        })
    }

    private fun normalizeServerUrl(raw: String): String? {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return null

        // Already has ws:// or wss://
        if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
            return trimmed
        }

        // Reject http/https - don't auto-convert
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return null
        }

        // Bare host:port -> prepend ws://
        return "ws://$trimmed"
    }

    private fun onConnected() {
        val authToken = identityStore.getToken()
        val hasAuthToken = !authToken.isNullOrBlank()
        val guestToken = _state.value.session.guestToken
        wsClient.send(ConnectMessage)
        logSent("connect", "")
        if (hasAuthToken) {
            wsClient.send(LoginMessage(token = authToken))
            logSent("login", "token")
        } else {
            wsClient.send(LoginMessage(guestToken = guestToken))
            logSent("login", if (guestToken != null) "returning" else "new")
        }
        wsClient.updateState(ConnectionState.Authenticating)
    }

    private fun handleServerMessage(msg: ServerMessage) {
        when (msg) {
            is WelcomeMessage -> handleWelcome(msg)
            is LoginAckMessage -> handleLoginAck(msg)
            is WorldStateMessage -> handleWorldState(msg)
            is MoveResultMessage -> handleMoveResult(msg)
            is LoopUpdateMessage -> handleLoopUpdate(msg)
            is PlayerMovedMessage -> handlePlayerMoved(msg)
            is PlayerJoinedMessage -> handlePlayerJoined(msg)
            is PlayerLeftMessage -> handlePlayerLeft(msg)
            is ChatBroadcastMessage -> handleChat(msg)
            is TemChallengeMessage -> handleTemChallenge(msg)
            is TemWitnessRequestMessage -> handleWitnessRequest(msg)
            is ErrorMessage -> handleError(msg)
            is DeathNoticeMessage -> handleDeath(msg)
            is CombatResolvedMessage -> handleCombatResolved(msg)
            is CombatRejectedMessage -> handleCombatRejected(msg)
            // Phase 2+ message types are decoded and surfaced in the debug log for protocol parity.
            // Gameplay handling for these is intentionally deferred (server stays authoritative).
            is RunestoneResultMessage -> {}
            is RunestoneDeniedMessage -> {}
            is DropItemResultMessage -> {}
            is PickupItemResultMessage -> {}
            is InventorySnapshotMessage -> {}
            is WorldItemAddedMessage -> {}
            is WorldItemRemovedMessage -> {}
            is ProtectedSlotSetMessage -> {}
            is ChronicleSnapshotMessage -> handleChronicleSnapshot(msg)
            is EvidenceSnapshotMessage -> {}
            is PressureMetricsSnapshotMessage -> {}
            is PlayerInspectMessage -> {}
            is WalletSnapshotMessage -> handleWalletSnapshot(msg)
            is TitheResultMessage -> {}
            is WorkContractStartedMessage -> handleWorkContractStarted(msg)
            is WorkProgressMessage -> handleWorkProgress(msg)
            is WorkContractResultMessage -> handleWorkContractResult(msg)
            is NpcDialogueMessage -> handleNpcDialogue(msg)
            is NpcDialogueErrorMessage -> handleNpcDialogueError(msg)
            is SkillResultMessage -> handleSkillResult(msg)
            is ModReportsSnapshotMessage -> {}
            is ModResolveResultMessage -> {}
            is PropertySnapshotMessage -> handlePropertySnapshot(msg)
            is PropertyStateMessage -> handlePropertyState(msg)
            is HouseSoldMessage -> {}
            is PropertyResultMessage -> handlePropertyResult(msg)
            is PropertyLedgerMessage -> {}
            is PropertyAuctionStateMessage -> {}
            is HouseAuctionSettledMessage -> {}
            is UnknownMessage -> {} // Ignore unknown
        }
    }

    /**
     * Validate the server's protocol version against the client's [Protocol.PROTOCOL_VERSION].
     *
     * A clear, user-visible mismatch is surfaced on incompatibility (different major version or an
     * unparseable version string) rather than silently dropping the connection. A minor/patch skew
     * is logged but tolerated so a forward-compatible server still works.
     */
    private fun handleWelcome(msg: WelcomeMessage) {
        when (Protocol.versionCompatibility(msg.version)) {
            Protocol.VersionCompatibility.MATCH -> {
                logDebug("sys", "protocol v${msg.version} OK")
            }
            Protocol.VersionCompatibility.MINOR_MISMATCH -> {
                logDebug(
                    "sys",
                    "protocol minor skew: server v${msg.version}, client v${Protocol.PROTOCOL_VERSION}"
                )
            }
            Protocol.VersionCompatibility.INCOMPATIBLE -> {
                logDebug(
                    "sys",
                    "protocol MISMATCH: server v${msg.version}, client v${Protocol.PROTOCOL_VERSION}"
                )
                _state.update {
                    it.copy(
                        ui = it.ui.copy(
                            errorMessage = "Protocol mismatch: server v${msg.version}, " +
                                "client v${Protocol.PROTOCOL_VERSION}. Update the app."
                        )
                    )
                }
            }
        }
    }

    private fun handleLoginAck(msg: LoginAckMessage) {
        val currentServerUrl = _state.value.session.serverUrl

        if (msg.ok == false) {
            // Clear saved token on failure but preserve server URL
            prefs.edit().remove(KEY_GUEST_TOKEN).apply()
            _state.update {
                it.copy(
                    connection = ConnectionState.Error(msg.reason ?: "Login failed"),
                    session = SessionState(serverUrl = currentServerUrl)
                )
            }
            return
        }

        val rotatedToken = msg.token?.takeIf { it.isNotBlank() }
        val expiresAt = msg.expiresAt
        if (rotatedToken != null && expiresAt != null) {
            identityStore.saveIfNewer(msg.playerId, msg.name, rotatedToken, expiresAt)
            prefs.edit().remove(KEY_GUEST_TOKEN).apply()
        } else {
            val guestToken = msg.guestToken?.takeIf { it.isNotBlank() }
            if (guestToken != null) {
                prefs.edit().putString(KEY_GUEST_TOKEN, guestToken).apply()
            } else {
                prefs.edit().remove(KEY_GUEST_TOKEN).apply()
            }
        }

        _state.update {
            it.copy(
                session = SessionState(
                    guestToken = msg.guestToken?.takeIf { token -> token.isNotBlank() },
                    playerId = msg.playerId,
                    playerName = msg.name,
                    savedCharacterName = identityStore.getPlayerName(),
                    serverUrl = currentServerUrl
                )
            )
        }
        wsClient.send(EnterWorldMessage)
        logSent("enter_world", "")
    }

    private fun handleWorldState(msg: WorldStateMessage) {
        wsClient.updateState(ConnectionState.InWorld)
        val others = msg.nearbyPlayers.associateBy { it.id }
        _state.update {
            it.copy(
                world = it.world.copy(
                    currentMap = msg.map,
                    me = msg.player,
                    otherPlayers = others
                ),
                progression = it.progression.copy(loop = msg.player.loop)
            )
        }
    }

    private fun handleLoopUpdate(msg: LoopUpdateMessage) {
        _state.update {
            it.copy(
                progression = it.progression.copy(
                    loop = msg.loop,
                    lastEvent = msg.event
                )
            )
        }
    }

    private fun handleMoveResult(msg: MoveResultMessage) {
        val currentMe = _state.value.world.me ?: return
        // Always snap to server position (server authoritative)
        _state.update {
            it.copy(
                world = it.world.copy(
                    me = currentMe.copy(x = msg.x, y = msg.y),
                    currentMap = msg.map ?: it.world.currentMap
                )
            )
        }
    }

    private fun handlePlayerMoved(msg: PlayerMovedMessage) {
        val current = _state.value
        if (msg.playerId == current.session.playerId) {
            // Our own movement confirmed - snap to position
            val me = current.world.me?.copy(x = msg.x, y = msg.y)
            _state.update { it.copy(world = it.world.copy(me = me)) }
        } else {
            // Another player moved
            val updated = current.world.otherPlayers[msg.playerId]?.copy(x = msg.x, y = msg.y)
            if (updated != null) {
                val others = current.world.otherPlayers + (msg.playerId to updated)
                _state.update { it.copy(world = it.world.copy(otherPlayers = others)) }
            }
        }
    }

    private fun handlePlayerJoined(msg: PlayerJoinedMessage) {
        if (msg.player.id == _state.value.session.playerId) return
        val others = _state.value.world.otherPlayers + (msg.player.id to msg.player)
        _state.update { it.copy(world = it.world.copy(otherPlayers = others)) }
    }

    private fun handlePlayerLeft(msg: PlayerLeftMessage) {
        val others = _state.value.world.otherPlayers - msg.playerId
        _state.update { it.copy(world = it.world.copy(otherPlayers = others)) }
    }

    private fun handleWalletSnapshot(msg: WalletSnapshotMessage) {
        _state.update { it.copy(economy = it.economy.copy(gold = msg.gold)) }
    }

    private fun handlePropertySnapshot(msg: PropertySnapshotMessage) {
        _state.update {
            it.copy(
                economy = it.economy.copy(
                    properties = msg.properties.associateBy { property -> property.propertyId }
                )
            )
        }
    }

    private fun handlePropertyState(msg: PropertyStateMessage) {
        _state.update {
            it.copy(
                economy = it.economy.copy(
                    properties = it.economy.properties + (msg.property.propertyId to msg.property)
                )
            )
        }
    }

    private fun handlePropertyResult(msg: PropertyResultMessage) {
        _state.update {
            it.copy(
                economy = it.economy.copy(
                    lastPropertyResult = PropertyResultStatus(
                        action = msg.action,
                        propertyId = msg.propertyId,
                        success = msg.success,
                        reason = msg.reason
                    )
                )
            )
        }
    }

    private fun handleWorkContractStarted(msg: WorkContractStartedMessage) {
        _state.update {
            it.copy(
                economy = it.economy.copy(
                    work = WorkContractStatus(
                        contractId = msg.contractId,
                        contractType = msg.contractType,
                        payoutGold = msg.payoutGold
                    )
                )
            )
        }
    }

    private fun handleWorkProgress(msg: WorkProgressMessage) {
        _state.update {
            val current = it.economy.work
            it.copy(
                economy = it.economy.copy(
                    work = WorkContractStatus(
                        contractId = msg.contractId,
                        contractType = current?.contractType ?: "temple_sweep",
                        payoutGold = current?.payoutGold,
                        ticksObserved = msg.ticksObserved,
                        ticksRequired = msg.ticksRequired,
                        remainingMs = msg.remainingMs
                    )
                )
            )
        }
    }

    private fun handleWorkContractResult(msg: WorkContractResultMessage) {
        _state.update {
            val current = it.economy.work
            it.copy(
                economy = it.economy.copy(
                    work = WorkContractStatus(
                        contractId = msg.contractId.ifBlank { current?.contractId ?: "" },
                        contractType = current?.contractType ?: "temple_sweep",
                        payoutGold = msg.creditedGold ?: current?.payoutGold,
                        ticksObserved = current?.ticksObserved ?: 0,
                        ticksRequired = current?.ticksRequired ?: 0,
                        remainingMs = current?.remainingMs,
                        complete = msg.success,
                        error = msg.error
                    )
                )
            )
        }
    }

    private fun handleNpcDialogue(msg: NpcDialogueMessage) {
        _state.update {
            it.copy(
                ui = it.ui.copy(
                    npcDialogue = NpcDialogueStatus(
                        npcId = msg.npcId,
                        placeId = msg.placeId,
                        tier = msg.tier,
                        line = msg.line
                    )
                )
            )
        }
    }

    private fun handleNpcDialogueError(msg: NpcDialogueErrorMessage) {
        _state.update {
            it.copy(
                ui = it.ui.copy(
                    npcDialogue = NpcDialogueStatus(
                        npcId = msg.npcId,
                        error = msg.error
                    )
                )
            )
        }
    }

    private fun handleSkillResult(msg: SkillResultMessage) {
        if (
            !msg.skillId.startsWith("route:survey:") &&
            !msg.skillId.startsWith("route:safety:") &&
            msg.skillId != "route:quest:shipment" &&
            msg.skillId != "route:economy:forgehold" &&
            msg.skillId != "route:craft:soulsteel" &&
            msg.skillId != "route:gate:heartforge" &&
            msg.skillId != "route:gate:moonspire" &&
            msg.skillId != "route:dream:interpret" &&
            msg.skillId != "route:dream:fragment"
        ) return
        val title = when (msg.skillId) {
            "route:survey:forgehold" -> "Forgehold Route"
            "route:survey:moonspire" -> "Moonspire Dream Gate"
            "route:safety:forgehold" -> "Forgehold safety"
            "route:safety:moonspire" -> "Dream Gate safety"
            "route:quest:shipment" -> "Forgehold shipment"
            "route:economy:forgehold" -> "Forgehold economy"
            "route:craft:soulsteel" -> "Soulsteel"
            "route:gate:heartforge" -> "Heartforge gate"
            "route:gate:moonspire" -> "Dream Gate seal"
            "route:dream:interpret" -> "Dream Gate"
            "route:dream:fragment" -> "Dream fragment"
            else -> "Route"
        }
        val line = if (msg.success) {
            when (msg.skillId) {
                "route:safety:forgehold", "route:safety:moonspire" -> "$title boundary reviewed by server."
                "route:quest:shipment" -> "$title investigation recorded by server."
                "route:economy:forgehold" -> "$title quote recorded by server."
                "route:craft:soulsteel" -> "$title stabilization recorded by server."
                "route:gate:heartforge", "route:gate:moonspire" -> "$title prepared by server."
                "route:dream:interpret" -> "$title interpretation recorded by server."
                "route:dream:fragment" -> "$title evidence anchored by server."
                else -> "$title survey recorded by server."
            }
        } else {
            "$title action unavailable: ${msg.reason ?: "rejected"}"
        }
        _state.update {
            it.copy(
                ui = it.ui.copy(
                    npcDialogue = NpcDialogueStatus(
                        npcId = "route_survey",
                        placeId = "onward_routes",
                        tier = if (msg.success) "surveyed" else "rejected",
                        line = line
                    )
                )
            )
        }
    }

    private fun inspectWallet() {
        wsClient.send(InspectWalletMessage)
        logSent("inspect_wallet", "")
    }

    private fun talkToNpc(npcId: String) {
        wsClient.send(TalkToNpcMessage(npcId = npcId))
        logSent("talk_to_npc", npcId)
    }

    private fun declareVocation(vocation: SovereignVocation) {
        wsClient.send(DeclareVocationMessage(vocation = vocation))
        logSent("declare_vocation", vocation.name.lowercase())
    }

    private fun startWorkContract() {
        wsClient.send(StartWorkContractMessage())
        logSent("start_work_contract", "temple_sweep")
    }

    private fun tickWorkContract() {
        val contractId = _state.value.economy.work?.contractId?.takeIf { it.isNotBlank() }
        if (contractId == null) {
            _state.update { it.copy(ui = it.ui.copy(errorMessage = "Start work before ticking.")) }
            return
        }
        wsClient.send(WorkTickMessage(contractId = contractId))
        logSent("work_tick", contractId)
    }

    private fun buyHouse(propertyId: String) {
        wsClient.send(BuyHouseMessage(propertyId = propertyId))
        logSent("buy_house", propertyId)
    }

    private fun listHouse(propertyId: String, price: Int) {
        wsClient.send(ListHouseMessage(propertyId = propertyId, price = price))
        logSent("list_house", "$propertyId price=$price")
    }

    private fun unlistHouse(propertyId: String) {
        wsClient.send(UnlistHouseMessage(propertyId = propertyId))
        logSent("unlist_house", propertyId)
    }

    private fun handleChat(msg: ChatBroadcastMessage) {
        val entry = ChatEntry(
            id = "${msg.playerId}-${System.currentTimeMillis()}",
            from = msg.name,
            message = msg.message,
            timestamp = System.currentTimeMillis()
        )
        val messages = (_state.value.world.chatMessages + entry).takeLast(MAX_CHAT_MESSAGES)
        _state.update { it.copy(world = it.world.copy(chatMessages = messages)) }
    }

    private fun handleChronicleSnapshot(msg: ChronicleSnapshotMessage) {
        val snapshot = ChronicleSnapshotMapper.map(msg)
        _state.update {
            it.copy(
                ui = it.ui.copy(
                    chronicleEvents = snapshot.events,
                    chronicleHasMore = snapshot.hasMore
                )
            )
        }
    }

    private fun handleTemChallenge(msg: TemChallengeMessage) {
        val data = TemChallengeData(
            challengeId = msg.challengeId,
            message = msg.message,
            expiresAt = System.currentTimeMillis() + (msg.timeoutSeconds * 1000L)
        )
        _state.update { it.copy(ui = it.ui.copy(temChallenge = data)) }
    }

    private fun handleWitnessRequest(msg: TemWitnessRequestMessage) {
        val data = WitnessRequestData(
            requestId = msg.requestId,
            prompt = msg.prompt,
            expiresAt = System.currentTimeMillis() + WITNESS_TTL_MS
        )
        _state.update { it.copy(ui = it.ui.copy(witnessRequest = data)) }
    }

    private fun handleError(msg: ErrorMessage) {
        if (msg.code == "token_invalid" || msg.code == "token_expired") {
            identityStore.clear()
            prefs.edit().remove(KEY_GUEST_TOKEN).apply()
        }
        _state.update {
            it.copy(ui = it.ui.copy(errorMessage = "${msg.code}: ${msg.message}"))
        }
    }

    private fun handleDeath(msg: DeathNoticeMessage) {
        val me = _state.value.world.me ?: return
        _state.update {
            it.copy(
                world = it.world.copy(
                    me = me.copy(
                        status = PlayerStatus.DEAD,
                        deadUntilMs = System.currentTimeMillis() + msg.respawnInMs
                    )
                )
            )
        }
    }

    private fun handleCombatResolved(msg: CombatResolvedMessage) {
        // Add a chat entry for combat
        val current = _state.value
        val isMeAttacker = current.session.playerId == msg.attackerId
        val isMeDefender = current.session.playerId == msg.defenderId
        val defenderName = current.world.otherPlayers[msg.defenderId]?.name ?: msg.defenderId

        val line = when {
            isMeAttacker -> "You killed $defenderName"
            isMeDefender -> "You were killed"
            else -> "${msg.attackerId} killed $defenderName"
        }

        val entry = ChatEntry(
            id = "combat-${System.currentTimeMillis()}",
            from = "combat",
            message = line,
            timestamp = System.currentTimeMillis()
        )
        val messages = (current.world.chatMessages + entry).takeLast(MAX_CHAT_MESSAGES)
        _state.update { it.copy(world = it.world.copy(chatMessages = messages)) }
    }

    private fun handleCombatRejected(msg: CombatRejectedMessage) {
        val entry = ChatEntry(
            id = "combat-reject-${System.currentTimeMillis()}",
            from = "system",
            message = "Attack rejected: ${msg.reason}",
            timestamp = System.currentTimeMillis()
        )
        val messages = (_state.value.world.chatMessages + entry).takeLast(MAX_CHAT_MESSAGES)
        _state.update { it.copy(world = it.world.copy(chatMessages = messages)) }
    }

    private fun sendMove(direction: Direction) {
        wsClient.send(MoveIntentMessage(direction))
        logSent("move_intent", direction.name.lowercase())
    }

    private fun sendChat(message: String) {
        if (message.isBlank()) return
        wsClient.send(ChatMessage(message.take(240)))
        logSent("chat", message.take(20))
    }

    private fun toggleChat() {
        _state.update { it.copy(ui = it.ui.copy(chatOpen = !it.ui.chatOpen)) }
    }

    private fun sendAttack(targetId: String) {
        wsClient.send(AttackIntentMessage(targetId))
        logSent("attack_intent", targetId)
    }

    private fun sendWorldEventContribution(contributionId: String) {
        val skillId = "event:witness_moth_bloom:$contributionId"
        wsClient.send(UseSkillMessage(skillId = skillId))
        logSent("use_skill", skillId)
    }

    private fun sendRouteSurvey(skillId: String) {
        if (
            skillId != "route:survey:forgehold" &&
            skillId != "route:survey:moonspire" &&
            skillId != "route:safety:forgehold" &&
            skillId != "route:safety:moonspire" &&
            skillId != "route:quest:shipment" &&
            skillId != "route:economy:forgehold" &&
            skillId != "route:craft:soulsteel" &&
            skillId != "route:gate:heartforge" &&
            skillId != "route:gate:moonspire" &&
            skillId != "route:dream:interpret" &&
            skillId != "route:dream:fragment"
        ) return
        wsClient.send(UseSkillMessage(skillId = skillId))
        logSent("use_skill", skillId)
    }

    private fun sendTemResponse(response: String) {
        wsClient.send(TemResponseMessage(response))
        logSent("tem_response", response)
        _state.update { it.copy(ui = it.ui.copy(temChallenge = null)) }
    }

    private fun sendWitnessResponse(requestId: String, response: WitnessResponse) {
        wsClient.send(TemWitnessResponseMessage(requestId, response))
        logSent("tem_witness_response", response.name.lowercase())
        _state.update { it.copy(ui = it.ui.copy(witnessRequest = null)) }
    }

    private fun clearError() {
        _state.update { it.copy(ui = it.ui.copy(errorMessage = null)) }
    }

    private fun dismissTemChallenge() {
        _state.update { it.copy(ui = it.ui.copy(temChallenge = null)) }
    }

    private fun dismissWitnessRequest() {
        _state.update { it.copy(ui = it.ui.copy(witnessRequest = null)) }
    }
}
