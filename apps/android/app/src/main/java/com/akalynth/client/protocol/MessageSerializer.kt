package com.akalynth.client.protocol

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Encodes outgoing [ClientMessage]s and decodes incoming [ServerMessage]s.
 *
 * Wire format follows `packages/shared/protocol.ts` (PROTOCOL_VERSION 1.1.0) exactly. Outgoing
 * frames are built explicitly (per the existing client convention) rather than via polymorphic
 * kotlinx serialization, which keeps the `type` discriminator unambiguous and lets us omit absent
 * optional fields. Decoding dispatches on the `type` field; anything unknown or malformed becomes an
 * [UnknownMessage] so a single bad/forward-dated frame can never tear down the connection.
 */
object MessageSerializer {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
        explicitNulls = false
    }

    fun encodeClient(msg: ClientMessage): String {
        val obj: JsonObject = when (msg) {
            is ConnectMessage -> obj("connect")
            is EnterWorldMessage -> obj("enter_world")
            is KillSelfMessage -> obj("kill_self")
            is InspectWalletMessage -> obj("inspect_wallet")

            is LoginMessage -> obj("login") {
                msg.token?.takeIf { it.isNotBlank() }?.let { put("token", it) }
                // guest_token is always present on the wire (nullable) for legacy compatibility.
                put("guest_token", msg.guestToken?.takeIf { it.isNotBlank() })
            }

            is MoveIntentMessage -> obj("move_intent") {
                put("direction", msg.direction.wire())
            }

            is ChatMessage -> obj("chat") { put("message", msg.message) }

            is TemResponseMessage -> obj("tem_response") { put("response", msg.response) }

            is TemWitnessResponseMessage -> obj("tem_witness_response") {
                put("request_id", msg.requestId)
                put("response", msg.response.wire())
            }

            is RunestoneCastMessage -> obj("runestone_cast") {
                put("table_id", msg.tableId)
                // guess is intentionally nullable on the wire.
                put("guess", msg.guess?.wire())
            }

            is DropItemMessage -> obj("drop_item") { put("item_id", msg.itemId) }

            is PickupItemMessage -> obj("pickup_item") { put("item_id", msg.itemId) }

            is AttackIntentMessage -> obj("attack_intent") { put("target_id", msg.targetId) }

            is MintLegendaryMessage -> obj("mint_legendary") {
                msg.itemType?.let { put("item_type", it) }
                msg.tier?.let { put("tier", it) }
            }

            is SetProtectedSlotMessage -> obj("set_protected_slot") { put("item_id", msg.itemId) }

            is GetChronicleMessage -> obj("get_chronicle") {
                msg.playerId?.let { put("player_id", it) }
                msg.limit?.let { put("limit", it) }
                msg.before?.let { put("before", it) }
            }

            is GetEvidenceMessage -> obj("get_evidence") {
                msg.chronicleEventId?.let { put("chronicle_event_id", it) }
                msg.receiptHash?.let { put("receipt_hash", it) }
                msg.kind?.let { put("kind", it) }
            }

            is GetPressureMetricsMessage -> obj("get_pressure_metrics") {
                msg.since?.let { put("since", it) }
                msg.until?.let { put("until", it) }
            }

            is DeclareVocationMessage -> obj("declare_vocation") {
                put("vocation", msg.vocation.wire())
            }

            is InspectPlayerMessage -> obj("inspect_player") {
                put("target_player_id", msg.targetPlayerId)
            }

            is GrantSovereignPrefixMessage -> obj("grant_sovereign_prefix") {
                put("target_player_id", msg.targetPlayerId)
                put("grant", msg.grant)
            }

            is PayTitheMessage -> obj("pay_tithe") { put("amount", msg.amount) }

            is GrantGoldMessage -> obj("grant_gold") {
                put("target_player_id", msg.targetPlayerId)
                put("amount", msg.amount)
            }

            is StartWorkContractMessage -> obj("start_work_contract") {
                put("contract_type", msg.contractType)
            }

            is WorkTickMessage -> obj("work_tick") { put("contract_id", msg.contractId) }

            is TalkToNpcMessage -> obj("talk_to_npc") { put("npc_id", msg.npcId) }

            is UseSkillMessage -> obj("use_skill") {
                put("skill_id", msg.skillId)
                msg.targetId?.let { put("target_id", it) }
            }

            is GetModReportsMessage -> obj("get_mod_reports") {
                msg.status?.let { put("status", it.wire()) }
                msg.limit?.let { put("limit", it) }
            }

            is ModResolveMessage -> obj("mod_resolve") {
                msg.caseId?.let { put("case_id", it) }
                msg.receiptHash?.let { put("receipt_hash", it) }
                put("resolution", msg.resolution.wire())
                msg.reason?.let { put("reason", it) }
            }

            is BuyHouseMessage -> obj("buy_house") { put("property_id", msg.propertyId) }

            is ListHouseMessage -> obj("list_house") {
                put("property_id", msg.propertyId)
                put("price", msg.price)
            }

            is UnlistHouseMessage -> obj("unlist_house") { put("property_id", msg.propertyId) }

            is GetPropertyLedgerMessage -> obj("get_property_ledger") {
                put("property_id", msg.propertyId)
            }
        }
        return json.encodeToString(JsonObject.serializer(), obj)
    }

    fun decodeServer(raw: String): ServerMessage {
        return try {
            val root = json.decodeFromString<JsonObject>(raw)
            val type = root["type"]?.jsonPrimitive?.content ?: return UnknownMessage(raw)

            when (type) {
                "welcome" -> json.decodeFromString<WelcomeMessage>(raw)
                "login_ack" -> json.decodeFromString<LoginAckMessage>(raw)
                "world_state" -> json.decodeFromString<WorldStateMessage>(raw)
                "move_result" -> json.decodeFromString<MoveResultMessage>(raw)
                "player_moved" -> json.decodeFromString<PlayerMovedMessage>(raw)
                "player_joined" -> json.decodeFromString<PlayerJoinedMessage>(raw)
                "player_left" -> json.decodeFromString<PlayerLeftMessage>(raw)
                "chat_broadcast" -> json.decodeFromString<ChatBroadcastMessage>(raw)
                "tem_challenge" -> json.decodeFromString<TemChallengeMessage>(raw)
                "tem_witness_request" -> json.decodeFromString<TemWitnessRequestMessage>(raw)
                "error" -> json.decodeFromString<ErrorMessage>(raw)
                "death_notice" -> json.decodeFromString<DeathNoticeMessage>(raw)
                "runestone_result" -> json.decodeFromString<RunestoneResultMessage>(raw)
                "runestone_denied" -> json.decodeFromString<RunestoneDeniedMessage>(raw)
                "drop_item_result" -> json.decodeFromString<DropItemResultMessage>(raw)
                "pickup_item_result" -> json.decodeFromString<PickupItemResultMessage>(raw)
                "inventory_snapshot" -> json.decodeFromString<InventorySnapshotMessage>(raw)
                "world_item_added" -> json.decodeFromString<WorldItemAddedMessage>(raw)
                "world_item_removed" -> json.decodeFromString<WorldItemRemovedMessage>(raw)
                "combat_resolved" -> json.decodeFromString<CombatResolvedMessage>(raw)
                "combat_rejected" -> json.decodeFromString<CombatRejectedMessage>(raw)
                "protected_slot_set" -> json.decodeFromString<ProtectedSlotSetMessage>(raw)
                "chronicle_snapshot" -> json.decodeFromString<ChronicleSnapshotMessage>(raw)
                "evidence_snapshot" -> json.decodeFromString<EvidenceSnapshotMessage>(raw)
                "pressure_metrics_snapshot" -> json.decodeFromString<PressureMetricsSnapshotMessage>(raw)
                "player_inspect" -> json.decodeFromString<PlayerInspectMessage>(raw)
                "wallet_snapshot" -> json.decodeFromString<WalletSnapshotMessage>(raw)
                "tithe_result" -> json.decodeFromString<TitheResultMessage>(raw)
                "work_contract_started" -> json.decodeFromString<WorkContractStartedMessage>(raw)
                "work_progress" -> json.decodeFromString<WorkProgressMessage>(raw)
                "work_contract_result" -> json.decodeFromString<WorkContractResultMessage>(raw)
                "npc_dialogue" -> json.decodeFromString<NpcDialogueMessage>(raw)
                "npc_dialogue_error" -> json.decodeFromString<NpcDialogueErrorMessage>(raw)
                "skill_result" -> json.decodeFromString<SkillResultMessage>(raw)
                "mod_reports_snapshot" -> json.decodeFromString<ModReportsSnapshotMessage>(raw)
                "mod_resolve_result" -> json.decodeFromString<ModResolveResultMessage>(raw)
                "property_snapshot" -> json.decodeFromString<PropertySnapshotMessage>(raw)
                "property_state" -> json.decodeFromString<PropertyStateMessage>(raw)
                "house_sold" -> json.decodeFromString<HouseSoldMessage>(raw)
                "property_result" -> json.decodeFromString<PropertyResultMessage>(raw)
                "property_ledger" -> json.decodeFromString<PropertyLedgerMessage>(raw)
                else -> UnknownMessage(raw, type)
            }
        } catch (e: Exception) {
            UnknownMessage(raw)
        }
    }

    // ---- helpers ------------------------------------------------------------

    private fun obj(type: String, build: JsonObjectBuilder.() -> Unit = {}): JsonObject =
        buildJsonObject {
            put("type", type)
            build()
        }

    private fun Direction.wire(): String = when (this) {
        Direction.NORTH -> "north"
        Direction.SOUTH -> "south"
        Direction.EAST -> "east"
        Direction.WEST -> "west"
        Direction.NORTHEAST -> "northeast"
        Direction.NORTHWEST -> "northwest"
        Direction.SOUTHEAST -> "southeast"
        Direction.SOUTHWEST -> "southwest"
    }

    private fun WitnessResponse.wire(): String = when (this) {
        WitnessResponse.CONFIRM -> "confirm"
        WitnessResponse.DENY -> "deny"
        WitnessResponse.UNCERTAIN -> "uncertain"
    }

    private fun Element.wire(): String = when (this) {
        Element.FIRE -> "fire"
        Element.WATER -> "water"
        Element.EARTH -> "earth"
        Element.AIR -> "air"
        Element.LIGHT -> "light"
        Element.SHADOW -> "shadow"
    }

    private fun SovereignVocation.wire(): String = when (this) {
        SovereignVocation.WARDEN -> "warden"
        SovereignVocation.CANTOR -> "cantor"
        SovereignVocation.HEXER -> "hexer"
        SovereignVocation.REAVER -> "reaver"
    }

    private fun ModerationResolution.wire(): String = when (this) {
        ModerationResolution.NO_ACTION -> "no_action"
        ModerationResolution.WARNING -> "warning"
        ModerationResolution.TEMP_MUTE -> "temp_mute"
    }

    private fun ModReportStatus.wire(): String = when (this) {
        ModReportStatus.OPEN -> "open"
        ModReportStatus.RESOLVED -> "resolved"
        ModReportStatus.ALL -> "all"
    }
}
