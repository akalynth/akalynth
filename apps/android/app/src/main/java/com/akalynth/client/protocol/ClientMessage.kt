package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Client -> Server messages.
 *
 * Mirrors `packages/shared/protocol.ts` (PROTOCOL_VERSION 2.1.0). protocol.ts is the
 * authoritative contract; this file follows it and must not diverge from it.
 *
 * Encoding is hand-rolled in [MessageSerializer.encodeClient] (the client never relies on
 * polymorphic kotlinx serialization for outgoing frames), so each subtype must be added there too.
 */
@Serializable
sealed class ClientMessage {
    abstract val type: String
}

@Serializable
@SerialName("connect")
data object ConnectMessage : ClientMessage() {
    override val type: String = "connect"
}

@Serializable
@SerialName("login")
data class LoginMessage(
    val token: String? = null,
    @SerialName("guest_token") val guestToken: String? = null
) : ClientMessage() {
    override val type: String = "login"
}

@Serializable
@SerialName("enter_world")
data object EnterWorldMessage : ClientMessage() {
    override val type: String = "enter_world"
}

@Serializable
@SerialName("move_intent")
data class MoveIntentMessage(
    val direction: Direction
) : ClientMessage() {
    override val type: String = "move_intent"
}

@Serializable
@SerialName("chat")
data class ChatMessage(
    val message: String
) : ClientMessage() {
    override val type: String = "chat"
}

@Serializable
@SerialName("tem_response")
data class TemResponseMessage(
    val response: String
) : ClientMessage() {
    override val type: String = "tem_response"
}

@Serializable
@SerialName("kill_self")
data object KillSelfMessage : ClientMessage() {
    override val type: String = "kill_self"
}

@Serializable
@SerialName("runestone_cast")
data class RunestoneCastMessage(
    @SerialName("table_id") val tableId: String,
    val guess: Element? = null
) : ClientMessage() {
    override val type: String = "runestone_cast"
}

@Serializable
@SerialName("tem_witness_response")
data class TemWitnessResponseMessage(
    @SerialName("request_id") val requestId: String,
    val response: WitnessResponse
) : ClientMessage() {
    override val type: String = "tem_witness_response"
}

// Phase 2: Item messages
@Serializable
@SerialName("drop_item")
data class DropItemMessage(
    @SerialName("item_id") val itemId: String
) : ClientMessage() {
    override val type: String = "drop_item"
}

@Serializable
@SerialName("pickup_item")
data class PickupItemMessage(
    @SerialName("item_id") val itemId: String
) : ClientMessage() {
    override val type: String = "pickup_item"
}

// Phase 3: Combat messages
@Serializable
@SerialName("attack_intent")
data class AttackIntentMessage(
    @SerialName("target_id") val targetId: String
) : ClientMessage() {
    override val type: String = "attack_intent"
}

// Dev-only: Legendary minting (gated server-side by env flag)
@Serializable
@SerialName("mint_legendary")
data class MintLegendaryMessage(
    @SerialName("item_type") val itemType: String? = null,
    val tier: Int? = null
) : ClientMessage() {
    override val type: String = "mint_legendary"
}

// Phase 3.2: Protected slots
@Serializable
@SerialName("set_protected_slot")
data class SetProtectedSlotMessage(
    @SerialName("item_id") val itemId: String
) : ClientMessage() {
    override val type: String = "set_protected_slot"
}

// Phase 4: Chronicle
@Serializable
@SerialName("get_chronicle")
data class GetChronicleMessage(
    @SerialName("player_id") val playerId: String? = null,
    val limit: Int? = null,
    val before: String? = null
) : ClientMessage() {
    override val type: String = "get_chronicle"
}

// Phase 4.4: Chronicle Evidence (server requires at least one anchor)
@Serializable
@SerialName("get_evidence")
data class GetEvidenceMessage(
    @SerialName("chronicle_event_id") val chronicleEventId: Long? = null,
    @SerialName("receipt_hash") val receiptHash: String? = null,
    val kind: String? = null
) : ClientMessage() {
    override val type: String = "get_evidence"
}

// Phase 5: Pressure Metrics
@Serializable
@SerialName("get_pressure_metrics")
data class GetPressureMetricsMessage(
    val since: String? = null,
    val until: String? = null
) : ClientMessage() {
    override val type: String = "get_pressure_metrics"
}

// Sovereign Vocations (Identity Layer v0)
@Serializable
@SerialName("declare_vocation")
data class DeclareVocationMessage(
    val vocation: SovereignVocation
) : ClientMessage() {
    override val type: String = "declare_vocation"
}

@Serializable
@SerialName("inspect_player")
data class InspectPlayerMessage(
    @SerialName("target_player_id") val targetPlayerId: String
) : ClientMessage() {
    override val type: String = "inspect_player"
}

// Admin: grant/revoke sovereign prefix (DEBUG-gated server-side)
@Serializable
@SerialName("grant_sovereign_prefix")
data class GrantSovereignPrefixMessage(
    @SerialName("target_player_id") val targetPlayerId: String,
    val grant: Boolean
) : ClientMessage() {
    override val type: String = "grant_sovereign_prefix"
}

// Treasury Kernel v0 (Gold)
@Serializable
@SerialName("inspect_wallet")
data object InspectWalletMessage : ClientMessage() {
    override val type: String = "inspect_wallet"
}

@Serializable
@SerialName("pay_tithe")
data class PayTitheMessage(
    val amount: Int
) : ClientMessage() {
    override val type: String = "pay_tithe"
}

// Admin: grant gold (DEBUG-gated server-side)
@Serializable
@SerialName("grant_gold")
data class GrantGoldMessage(
    @SerialName("target_player_id") val targetPlayerId: String,
    val amount: Int
) : ClientMessage() {
    override val type: String = "grant_gold"
}

// Work Contract Faucet v0
@Serializable
@SerialName("start_work_contract")
data class StartWorkContractMessage(
    @SerialName("contract_type") val contractType: String = WorkContractType.TEMPLE_SWEEP
) : ClientMessage() {
    override val type: String = "start_work_contract"
}

@Serializable
@SerialName("work_tick")
data class WorkTickMessage(
    @SerialName("contract_id") val contractId: String
) : ClientMessage() {
    override val type: String = "work_tick"
}

// NPC Recognition v0
@Serializable
@SerialName("talk_to_npc")
data class TalkToNpcMessage(
    @SerialName("npc_id") val npcId: String
) : ClientMessage() {
    override val type: String = "talk_to_npc"
}

// Skills v0
@Serializable
@SerialName("use_skill")
data class UseSkillMessage(
    @SerialName("skill_id") val skillId: String,
    @SerialName("target_id") val targetId: String? = null
) : ClientMessage() {
    override val type: String = "use_skill"
}

// Moderation v1 (Admin-only, DEBUG-gated server-side)
@Serializable
@SerialName("get_mod_reports")
data class GetModReportsMessage(
    val status: ModReportStatus? = null,
    val limit: Int? = null
) : ClientMessage() {
    override val type: String = "get_mod_reports"
}

@Serializable
@SerialName("mod_resolve")
data class ModResolveMessage(
    @SerialName("case_id") val caseId: String? = null,
    @SerialName("receipt_hash") val receiptHash: String? = null,
    val resolution: ModerationResolution,
    val reason: String? = null
) : ClientMessage() {
    override val type: String = "mod_resolve"
}

// Property Ownership v0 (House Market)
@Serializable
@SerialName("buy_house")
data class BuyHouseMessage(
    @SerialName("property_id") val propertyId: String
) : ClientMessage() {
    override val type: String = "buy_house"
}

@Serializable
@SerialName("list_house")
data class ListHouseMessage(
    @SerialName("property_id") val propertyId: String,
    val price: Int
) : ClientMessage() {
    override val type: String = "list_house"
}

@Serializable
@SerialName("unlist_house")
data class UnlistHouseMessage(
    @SerialName("property_id") val propertyId: String
) : ClientMessage() {
    override val type: String = "unlist_house"
}

@Serializable
@SerialName("get_property_ledger")
data class GetPropertyLedgerMessage(
    @SerialName("property_id") val propertyId: String
) : ClientMessage() {
    override val type: String = "get_property_ledger"
}

// Property Auctions v2
@Serializable
@SerialName("open_house_auction")
data class OpenHouseAuctionMessage(
    @SerialName("property_id") val propertyId: String,
    @SerialName("min_bid") val minBid: Int,
    @SerialName("min_increment_gold") val minIncrementGold: Int,
    @SerialName("duration_s") val durationS: Int
) : ClientMessage() {
    override val type: String = "open_house_auction"
}

@Serializable
@SerialName("place_house_bid")
data class PlaceHouseBidMessage(
    @SerialName("property_id") val propertyId: String,
    val amount: Int
) : ClientMessage() {
    override val type: String = "place_house_bid"
}

@Serializable
@SerialName("cancel_house_auction")
data class CancelHouseAuctionMessage(
    @SerialName("property_id") val propertyId: String
) : ClientMessage() {
    override val type: String = "cancel_house_auction"
}

// Chill-Zone Gather v0 (Step 2) — client sends intent only; server owns the outcome.
@Serializable
@SerialName("gather_intent")
data class GatherIntentMessage(
    @SerialName("node_id") val nodeId: String
) : ClientMessage() {
    override val type: String = "gather_intent"
}

@Serializable
@SerialName("deliver_intent")
data class DeliverIntentMessage(
    @SerialName("station_id") val stationId: String
) : ClientMessage() {
    override val type: String = "deliver_intent"
}

// Chill-Zone Refine (Step 3) — refine the held raw item at a refinery station.
@Serializable
@SerialName("refine_intent")
data class RefineIntentMessage(
    @SerialName("station_id") val stationId: String
) : ClientMessage() {
    override val type: String = "refine_intent"
}
