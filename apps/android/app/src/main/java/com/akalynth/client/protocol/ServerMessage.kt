package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * Server -> Client messages.
 *
 * Mirrors `packages/shared/protocol.ts` (PROTOCOL_VERSION 2.1.0). protocol.ts is the authoritative
 * contract; this file follows it and must not diverge.
 *
 * Open-ended `reason` / `code` / `status` fields stay as plain [String] (known values catalogued in
 * [ProtocolEnums]) so an unrecognised future value never crashes decode. Deeply nested, rarely
 * consumed wire payloads (evidence bundles, drop explanations, metric internals) are kept as
 * [JsonElement] to preserve fidelity without brittle over-typing.
 */
@Serializable
sealed class ServerMessage

@Serializable
@SerialName("welcome")
data class WelcomeMessage(
    val version: String
) : ServerMessage()

@Serializable
@SerialName("login_ack")
data class LoginAckMessage(
    val ok: Boolean? = true,
    @SerialName("player_id") val playerId: String,
    @SerialName("guest_token") val guestToken: String? = null,
    val token: String? = null,
    @SerialName("expires_at") val expiresAt: Long? = null,
    val name: String,
    val reason: String? = null
) : ServerMessage()

@Serializable
@SerialName("world_state")
data class WorldStateMessage(
    val map: MapName,
    val player: PlayerPublic,
    @SerialName("nearby_players") val nearbyPlayers: List<PlayerPublic>
) : ServerMessage()

@Serializable
@SerialName("move_result")
data class MoveResultMessage(
    val ok: Boolean,
    val x: Int,
    val y: Int,
    val reason: String? = null,
    val map: MapName? = null
) : ServerMessage()

@Serializable
data class RookguardQuestStep(
    @SerialName("step_id") val stepId: String,
    val label: String,
    val complete: Boolean,
    @SerialName("receipt_actions") val receiptActions: List<String> = emptyList()
)

@Serializable
data class RookguardCodexShelf(
    @SerialName("object_id") val objectId: String,
    val title: String,
    val subtitle: String,
    val role: String,
    @SerialName("gameplay_hint") val gameplayHint: String
)

@Serializable
data class RookguardCodexAnchor(
    @SerialName("object_id") val objectId: String,
    val status: String,
    val source: String,
    val evidence: String,
    val authority: String,
    val related: List<String> = emptyList()
)

@Serializable
data class RookguardCodexProfession(
    val vocation: String,
    @SerialName("lore_id") val loreId: String,
    @SerialName("codex_anchor") val codexAnchor: RookguardCodexAnchor,
    val title: String,
    val oath: String,
    @SerialName("starter_role") val starterRole: String,
    @SerialName("starter_actions") val starterActions: List<String> = emptyList()
)

@Serializable
data class RookguardQuestProgress(
    @SerialName("quest_id") val questId: String,
    val title: String,
    val phase: String,
    val steps: List<RookguardQuestStep> = emptyList(),
    val codexShelves: List<RookguardCodexShelf> = emptyList(),
    val codexProfession: RookguardCodexProfession? = null,
    val completed: Boolean = false
)

@Serializable
data class OnwardRouteObjective(
    val id: String,
    val label: String,
    val system: String
)

@Serializable
data class OnwardRouteProgress(
    @SerialName("route_id") val routeId: String,
    val title: String,
    val status: String,
    @SerialName("unlock_requirement") val unlockRequirement: String,
    @SerialName("next_objective") val nextObjective: String,
    val objectives: List<OnwardRouteObjective> = emptyList(),
    @SerialName("completed_objective_ids") val completedObjectiveIds: List<String> = emptyList(),
    @SerialName("source_drop") val sourceDrop: String,
    @SerialName("receipt_actions") val receiptActions: List<String> = emptyList()
)

@Serializable
data class PlayLoopProgress(
    val move: Boolean = false,
    val chat: Boolean = false,
    val tem: Boolean = false,
    val gate: Boolean = false,
    val complete: Boolean = false,
    val gateOpen: Boolean = false,
    val objective: String = "",
    val rookguardQuest: RookguardQuestProgress? = null,
    val onwardRoutes: List<OnwardRouteProgress> = emptyList(),
    val lastEvent: String? = null
)

@Serializable
@SerialName("loop_update")
data class LoopUpdateMessage(
    val event: String,
    val loop: PlayLoopProgress
) : ServerMessage()

@Serializable
@SerialName("player_moved")
data class PlayerMovedMessage(
    @SerialName("player_id") val playerId: String,
    val x: Int,
    val y: Int
) : ServerMessage()

@Serializable
@SerialName("player_joined")
data class PlayerJoinedMessage(
    val player: PlayerPublic
) : ServerMessage()

@Serializable
@SerialName("player_left")
data class PlayerLeftMessage(
    @SerialName("player_id") val playerId: String
) : ServerMessage()

@Serializable
@SerialName("chat_broadcast")
data class ChatBroadcastMessage(
    @SerialName("player_id") val playerId: String,
    val name: String,
    val message: String
) : ServerMessage()

@Serializable
@SerialName("tem_challenge")
data class TemChallengeMessage(
    @SerialName("challenge_id") val challengeId: String,
    val message: String,
    @SerialName("timeout_seconds") val timeoutSeconds: Int
) : ServerMessage()

@Serializable
@SerialName("tem_witness_request")
data class TemWitnessRequestMessage(
    @SerialName("request_id") val requestId: String,
    val timestamp: String,
    val map: MapName,
    @SerialName("target_actor") val targetActor: String,
    val prompt: String,
    val kind: String
) : ServerMessage()

@Serializable
@SerialName("error")
data class ErrorMessage(
    val code: String,
    val message: String
) : ServerMessage()

@Serializable
data class SpawnPoint(val x: Int, val y: Int)

@Serializable
data class LostItemSummary(
    val kind: String,
    val qty: Int? = null,
    val rarity: String? = null
)

@Serializable
@SerialName("death_notice")
data class DeathNoticeMessage(
    val ok: Boolean,
    @SerialName("respawn_in_ms") val respawnInMs: Long,
    val map: MapName,
    val spawn: SpawnPoint,
    val reason: String,
    // DeathNoticeExtras (optional)
    @SerialName("chronicle_event_id") val chronicleEventId: Long? = null,
    @SerialName("lost_items") val lostItems: List<LostItemSummary>? = null,
    @SerialName("killer_name") val killerName: String? = null,
    val zone: String? = null,
    val x: Int? = null,
    val y: Int? = null,
    val time: String? = null
) : ServerMessage()

@Serializable
@SerialName("runestone_result")
data class RunestoneResultMessage(
    @SerialName("table_id") val tableId: String,
    val caster: RunestoneCaster,
    val face: Element,
    val whisper: String
) : ServerMessage()

@Serializable
data class RunestoneCaster(val id: String, val name: String)

@Serializable
@SerialName("runestone_denied")
data class RunestoneDeniedMessage(
    val reason: String
) : ServerMessage()

// Phase 2: Item response messages
@Serializable
data class ItemInfo(
    @SerialName("item_id") val itemId: String,
    @SerialName("item_type") val itemType: String,
    val slot: String? = null
)

@Serializable
@SerialName("drop_item_result")
data class DropItemResultMessage(
    val ok: Boolean,
    @SerialName("item_id") val itemId: String,
    val reason: String? = null
) : ServerMessage()

@Serializable
@SerialName("pickup_item_result")
data class PickupItemResultMessage(
    val ok: Boolean,
    @SerialName("item_id") val itemId: String,
    val reason: String? = null
) : ServerMessage()

@Serializable
@SerialName("inventory_snapshot")
data class InventorySnapshotMessage(
    val items: List<ItemInfo>
) : ServerMessage()

@Serializable
@SerialName("world_item_added")
data class WorldItemAddedMessage(
    @SerialName("item_id") val itemId: String,
    @SerialName("item_type") val itemType: String,
    val x: Int,
    val y: Int
) : ServerMessage()

@Serializable
@SerialName("world_item_removed")
data class WorldItemRemovedMessage(
    @SerialName("item_id") val itemId: String
) : ServerMessage()

// Phase 3: Combat response messages
@Serializable
@SerialName("combat_resolved")
data class CombatResolvedMessage(
    @SerialName("attacker_id") val attackerId: String,
    @SerialName("defender_id") val defenderId: String,
    val outcome: String,
    val map: MapName,
    val x: Int,
    val y: Int
) : ServerMessage()

@Serializable
@SerialName("combat_rejected")
data class CombatRejectedMessage(
    val reason: String
) : ServerMessage()

// Phase 3.2: Protected slots
@Serializable
@SerialName("protected_slot_set")
data class ProtectedSlotSetMessage(
    @SerialName("player_id") val playerId: String,
    @SerialName("item_id") val itemId: String,
    @SerialName("prev_item_id") val prevItemId: String? = null
) : ServerMessage()

// Phase 4: Chronicle
@Serializable
data class EvidenceRef(
    @SerialName("chronicle_event_id") val chronicleEventId: Long,
    @SerialName("receipt_hash") val receiptHash: String
)

@Serializable
data class ChronicleEvent(
    val kind: String,
    val timestamp: String,
    val zone: String? = null,
    val x: Int? = null,
    val y: Int? = null,
    val details: JsonElement? = null,
    @SerialName("evidence_ref") val evidenceRef: EvidenceRef? = null
)

@Serializable
@SerialName("chronicle_snapshot")
data class ChronicleSnapshotMessage(
    @SerialName("player_id") val playerId: String,
    val events: List<ChronicleEvent>,
    @SerialName("has_more") val hasMore: Boolean
) : ServerMessage()

// Phase 4.4: Chronicle Evidence
@Serializable
@SerialName("evidence_snapshot")
data class EvidenceSnapshotMessage(
    val status: String,
    @SerialName("player_id") val playerId: String,
    @SerialName("chronicle_event_id") val chronicleEventId: Long? = null,
    @SerialName("receipt_hash") val receiptHash: String? = null,
    @SerialName("source_action") val sourceAction: String? = null,
    val kind: String? = null,
    // Present when status == "ok"; nested wire payload kept opaque.
    val evidence: JsonElement? = null,
    @SerialName("error_code") val errorCode: String? = null
) : ServerMessage()

// Phase 5: Pressure Metrics
@Serializable
@SerialName("pressure_metrics_snapshot")
data class PressureMetricsSnapshotMessage(
    @SerialName("player_id") val playerId: String,
    val since: String,
    val until: String,
    val status: String,
    // Full metrics object kept opaque; consumers project the fields they need.
    val metrics: JsonElement? = null,
    @SerialName("error_code") val errorCode: String? = null
) : ServerMessage()

// Sovereign Vocations: Player inspect response
@Serializable
@SerialName("player_inspect")
data class PlayerInspectMessage(
    @SerialName("player_id") val playerId: String,
    val name: String,
    val vocation: SovereignVocation? = null,
    @SerialName("display_vocation") val displayVocation: String? = null,
    val badges: List<String> = emptyList(),
    val mark: String? = null,
    val error: String? = null
) : ServerMessage()

// Treasury Kernel v0
@Serializable
@SerialName("wallet_snapshot")
data class WalletSnapshotMessage(
    val gold: Int
) : ServerMessage()

@Serializable
@SerialName("tithe_result")
data class TitheResultMessage(
    val success: Boolean,
    @SerialName("new_balance") val newBalance: Int? = null,
    val error: String? = null
) : ServerMessage()

// Work Contract Faucet v0
@Serializable
@SerialName("work_contract_started")
data class WorkContractStartedMessage(
    @SerialName("contract_id") val contractId: String,
    @SerialName("contract_type") val contractType: String,
    @SerialName("payout_gold") val payoutGold: Int,
    @SerialName("cooldown_seconds") val cooldownSeconds: Int,
    @SerialName("min_duration_ms") val minDurationMs: Long
) : ServerMessage()

@Serializable
@SerialName("work_progress")
data class WorkProgressMessage(
    @SerialName("contract_id") val contractId: String,
    @SerialName("ticks_observed") val ticksObserved: Int,
    @SerialName("ticks_required") val ticksRequired: Int,
    @SerialName("remaining_ms") val remainingMs: Long
) : ServerMessage()

@Serializable
@SerialName("work_contract_result")
data class WorkContractResultMessage(
    @SerialName("contract_id") val contractId: String,
    val success: Boolean,
    @SerialName("credited_gold") val creditedGold: Int? = null,
    val error: String? = null
) : ServerMessage()

// NPC Recognition v0
@Serializable
@SerialName("npc_dialogue")
data class NpcDialogueMessage(
    @SerialName("npc_id") val npcId: String,
    @SerialName("place_id") val placeId: String,
    val tier: String,
    val line: String
) : ServerMessage()

@Serializable
@SerialName("npc_dialogue_error")
data class NpcDialogueErrorMessage(
    @SerialName("npc_id") val npcId: String,
    val error: String
) : ServerMessage()

// Skills v0
@Serializable
@SerialName("skill_result")
data class SkillResultMessage(
    @SerialName("skill_id") val skillId: String,
    val success: Boolean,
    val reason: String? = null,
    @SerialName("cooldown_until_ms") val cooldownUntilMs: Long? = null,
    val payload: JsonElement? = null
) : ServerMessage()

// Moderation v1
@Serializable
data class ModerationReport(
    @SerialName("case_id") val caseId: String,
    @SerialName("receipt_hash") val receiptHash: String,
    @SerialName("reporter_id") val reporterId: String,
    @SerialName("target_id") val targetId: String,
    @SerialName("reported_at") val reportedAt: String,
    val status: String,
    @SerialName("resolved_by") val resolvedBy: String? = null,
    @SerialName("resolved_at") val resolvedAt: String? = null,
    val resolution: String? = null,
    val reason: String? = null,
    @SerialName("resolution_receipt_hash") val resolutionReceiptHash: String? = null
)

@Serializable
@SerialName("mod_reports_snapshot")
data class ModReportsSnapshotMessage(
    val reports: List<ModerationReport>,
    @SerialName("has_more") val hasMore: Boolean
) : ServerMessage()

@Serializable
@SerialName("mod_resolve_result")
data class ModResolveResultMessage(
    val success: Boolean,
    @SerialName("case_id") val caseId: String,
    val error: String? = null
) : ServerMessage()

// Property Ownership v0
@Serializable
data class PropertyPublic(
    @SerialName("property_id") val propertyId: String,
    val zone: String,
    @SerialName("plot_id") val plotId: String,
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int,
    val district: String? = null,
    val status: String,
    @SerialName("owner_name") val ownerName: String? = null,
    @SerialName("primary_price_gold") val primaryPriceGold: Int,
    @SerialName("listed_price_gold") val listedPriceGold: Int? = null,
    @SerialName("sale_count") val saleCount: Int
)

@Serializable
data class PropertyOwnerHistoryEntry(
    @SerialName("from_name") val fromName: String? = null,
    @SerialName("to_name") val toName: String,
    val price: Int,
    val action: String,
    val timestamp: String
)

@Serializable
@SerialName("property_snapshot")
data class PropertySnapshotMessage(
    val properties: List<PropertyPublic>
) : ServerMessage()

@Serializable
@SerialName("property_state")
data class PropertyStateMessage(
    val property: PropertyPublic
) : ServerMessage()

@Serializable
@SerialName("house_sold")
data class HouseSoldMessage(
    @SerialName("property_id") val propertyId: String,
    @SerialName("plot_id") val plotId: String,
    val zone: String,
    @SerialName("buyer_name") val buyerName: String,
    @SerialName("seller_name") val sellerName: String? = null,
    val price: Int,
    @SerialName("sale_count") val saleCount: Int
) : ServerMessage()

@Serializable
@SerialName("property_result")
data class PropertyResultMessage(
    val action: String,
    val success: Boolean,
    @SerialName("property_id") val propertyId: String,
    val reason: String? = null
) : ServerMessage()

@Serializable
@SerialName("property_ledger")
data class PropertyLedgerMessage(
    @SerialName("property_id") val propertyId: String,
    @SerialName("owner_history") val ownerHistory: List<PropertyOwnerHistoryEntry>,
    @SerialName("sale_count") val saleCount: Int
) : ServerMessage()

@Serializable
@SerialName("property_auction_state")
data class PropertyAuctionStateMessage(
    @SerialName("property_id") val propertyId: String,
    val kind: String,
    @SerialName("current_high") val currentHigh: Int? = null,
    @SerialName("high_bidder_name") val highBidderName: String? = null,
    @SerialName("min_next") val minNext: Int,
    @SerialName("scheduled_close") val scheduledClose: Long? = null
) : ServerMessage()

@Serializable
@SerialName("house_auction_settled")
data class HouseAuctionSettledMessage(
    @SerialName("property_id") val propertyId: String,
    @SerialName("plot_id") val plotId: String,
    val zone: String,
    @SerialName("winner_name") val winnerName: String? = null,
    @SerialName("seller_name") val sellerName: String? = null,
    val price: Int,
    @SerialName("sale_count") val saleCount: Int
) : ServerMessage()

// Chill-Zone Gather v0 (Step 2) — server-authoritative node/station registry + outcomes.
@Serializable
data class GatherNodePublic(
    @SerialName("node_id") val nodeId: String,
    val zone: String,
    val x: Int,
    val y: Int,
    val state: String,
    @SerialName("respawn_at_ms") val respawnAtMs: Long? = null,
)

@Serializable
data class GatherStationPublic(
    @SerialName("station_id") val stationId: String,
    val zone: String,
    val x: Int,
    val y: Int,
    // Step 3: curation = delivery point; refinery = refine point. Defaults to curation so an
    // older server that omits the field still decodes (forward-compat).
    val kind: String = "curation",
)

@Serializable
@SerialName("gather_snapshot")
data class GatherSnapshotMessage(
    val nodes: List<GatherNodePublic> = emptyList(),
    val stations: List<GatherStationPublic> = emptyList(),
) : ServerMessage()

@Serializable
@SerialName("gather_node_update")
data class GatherNodeUpdateMessage(
    val node: GatherNodePublic,
) : ServerMessage()

@Serializable
@SerialName("gather_result")
data class GatherResultMessage(
    val ok: Boolean,
    @SerialName("node_id") val nodeId: String? = null,
    @SerialName("complete_at_ms") val completeAtMs: Long? = null,
    val reason: String? = null,
) : ServerMessage()

@Serializable
@SerialName("gather_progress")
data class GatherProgressMessage(
    @SerialName("node_id") val nodeId: String,
    @SerialName("progress_pct") val progressPct: Float,
) : ServerMessage()

@Serializable
@SerialName("gather_completed")
data class GatherCompletedMessage(
    @SerialName("node_id") val nodeId: String,
    @SerialName("item_type") val itemType: String,
) : ServerMessage()

@Serializable
@SerialName("deliver_result")
data class DeliverResultMessage(
    val ok: Boolean,
    @SerialName("station_id") val stationId: String? = null,
    @SerialName("item_type") val itemType: String? = null,
    @SerialName("source_node_id") val sourceNodeId: String? = null,
    val reward: String? = null,
    val refined: Boolean = false,
    val reason: String? = null,
) : ServerMessage()

// Chill-Zone Refine (Step 3) — mirror the gather result/progress/completed trio.
@Serializable
@SerialName("refine_result")
data class RefineResultMessage(
    val ok: Boolean,
    @SerialName("station_id") val stationId: String? = null,
    @SerialName("complete_at_ms") val completeAtMs: Long? = null,
    val reason: String? = null,
) : ServerMessage()

@Serializable
@SerialName("refine_progress")
data class RefineProgressMessage(
    @SerialName("station_id") val stationId: String,
    @SerialName("progress_pct") val progressPct: Float,
) : ServerMessage()

@Serializable
@SerialName("refine_completed")
data class RefineCompletedMessage(
    @SerialName("station_id") val stationId: String,
    @SerialName("item_type") val itemType: String,
) : ServerMessage()

// Fallback for unknown / unparseable messages (forward-compat, never crashes decode).
data class UnknownMessage(val raw: String = "", val type: String? = null) : ServerMessage()
