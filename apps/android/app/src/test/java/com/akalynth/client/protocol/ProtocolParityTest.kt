package com.akalynth.client.protocol

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Protocol parity coverage for the Android client vs `packages/shared/protocol.ts`
 * (PROTOCOL_VERSION 2.0.0).
 *
 * Asserts that:
 *  - every ClientMessage subtype encodes to a frame with the correct `type` discriminator,
 *  - every ServerMessage `type` decodes to its concrete class (not [UnknownMessage]),
 *  - the version handshake classifies match / minor-skew / incompatible correctly,
 *  - unknown / malformed frames degrade to [UnknownMessage] instead of throwing.
 */
class ProtocolParityTest {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    private fun typeOf(frame: String): String =
        json.decodeFromString<JsonObject>(frame)["type"]!!.jsonPrimitive.content

    private fun assertNoClientAuthorityFields(obj: JsonObject) {
        for (field in listOf("character_id", "player_id", "x", "y")) {
            assertFalse("gameplay intent frame must not carry $field", obj.containsKey(field))
        }
    }

    // ---- Version handshake --------------------------------------------------

    @Test
    fun protocolVersionMatchesContract() {
        assertEquals("2.0.0", Protocol.PROTOCOL_VERSION)
    }

    @Test
    fun versionExactMatchIsCompatible() {
        assertEquals(
            Protocol.VersionCompatibility.MATCH,
            Protocol.versionCompatibility("2.0.0")
        )
    }

    @Test
    fun minorOrPatchSkewIsTolerated() {
        assertEquals(
            Protocol.VersionCompatibility.MINOR_MISMATCH,
            Protocol.versionCompatibility("2.1.0")
        )
        assertEquals(
            Protocol.VersionCompatibility.MINOR_MISMATCH,
            Protocol.versionCompatibility("2.0.5")
        )
    }

    @Test
    fun majorDivergenceOrGarbageIsIncompatible() {
        assertEquals(
            Protocol.VersionCompatibility.INCOMPATIBLE,
            Protocol.versionCompatibility("1.1.0")
        )
        assertEquals(
            Protocol.VersionCompatibility.INCOMPATIBLE,
            Protocol.versionCompatibility("not-a-version")
        )
    }

    // ---- Client encode ------------------------------------------------------

    @Test
    fun everyClientMessageEncodesWithCorrectType() {
        val cases: List<Pair<ClientMessage, String>> = listOf(
            ConnectMessage to "connect",
            LoginMessage(token = "t") to "login",
            EnterWorldMessage to "enter_world",
            MoveIntentMessage(Direction.NORTH) to "move_intent",
            ChatMessage("hi") to "chat",
            TemResponseMessage("AKALYNTH") to "tem_response",
            KillSelfMessage to "kill_self",
            RunestoneCastMessage("table-1", Element.FIRE) to "runestone_cast",
            TemWitnessResponseMessage("req-1", WitnessResponse.CONFIRM) to "tem_witness_response",
            DropItemMessage("i1") to "drop_item",
            PickupItemMessage("i1") to "pickup_item",
            AttackIntentMessage("p2") to "attack_intent",
            MintLegendaryMessage("mark_token", 1) to "mint_legendary",
            SetProtectedSlotMessage("i1") to "set_protected_slot",
            GetChronicleMessage(limit = 50) to "get_chronicle",
            GetEvidenceMessage(chronicleEventId = 7) to "get_evidence",
            GetPressureMetricsMessage() to "get_pressure_metrics",
            DeclareVocationMessage(SovereignVocation.WARDEN) to "declare_vocation",
            InspectPlayerMessage("p2") to "inspect_player",
            GrantSovereignPrefixMessage("p2", true) to "grant_sovereign_prefix",
            InspectWalletMessage to "inspect_wallet",
            PayTitheMessage(5) to "pay_tithe",
            GrantGoldMessage("p2", 10) to "grant_gold",
            StartWorkContractMessage() to "start_work_contract",
            WorkTickMessage("c1") to "work_tick",
            TalkToNpcMessage("npc1") to "talk_to_npc",
            UseSkillMessage("light", "p2") to "use_skill",
            GetModReportsMessage(ModReportStatus.OPEN, 10) to "get_mod_reports",
            ModResolveMessage(caseId = "c1", resolution = ModerationResolution.WARNING) to "mod_resolve",
            BuyHouseMessage("prop1") to "buy_house",
            ListHouseMessage("prop1", 100) to "list_house",
            UnlistHouseMessage("prop1") to "unlist_house",
            GetPropertyLedgerMessage("prop1") to "get_property_ledger",
            OpenHouseAuctionMessage("prop1", minBid = 500, minIncrementGold = 50, durationS = 3600) to "open_house_auction",
            PlaceHouseBidMessage("prop1", amount = 600) to "place_house_bid",
            CancelHouseAuctionMessage("prop1") to "cancel_house_auction",
        )

        // 36 client message types in protocol.ts ClientMessage union.
        assertEquals(36, cases.size)
        for ((msg, expectedType) in cases) {
            val frame = MessageSerializer.encodeClient(msg)
            assertEquals("wrong type for ${msg::class.simpleName}", expectedType, typeOf(frame))
        }
    }

    @Test
    fun loginAlwaysCarriesGuestTokenAndOptionalToken() {
        val frame = MessageSerializer.encodeClient(LoginMessage(token = "tok", guestToken = null))
        val obj = json.decodeFromString<JsonObject>(frame)
        assertEquals("tok", obj["token"]!!.jsonPrimitive.content)
        assertTrue("guest_token key must be present (nullable)", obj.containsKey("guest_token"))
    }

    @Test
    fun moveIntentEncodesLowercaseDirection() {
        // Cardinals pass through unchanged on the wire.
        val cardinalFrame = MessageSerializer.encodeClient(MoveIntentMessage(Direction.SOUTH))
        val cardinalObj = json.decodeFromString<JsonObject>(cardinalFrame)
        assertEquals("south", cardinalObj["direction"]!!.jsonPrimitive.content)

        // Diagonals map to their vertical cardinal: the server protocol only accepts
        // north/south/east/west so SOUTHEAST → "south" on the wire.
        val diagFrame = MessageSerializer.encodeClient(MoveIntentMessage(Direction.SOUTHEAST))
        val diagObj = json.decodeFromString<JsonObject>(diagFrame)
        assertEquals("south", diagObj["direction"]!!.jsonPrimitive.content)
    }

    @Test
    fun chatEscapingIsHandledByJsonBuilder() {
        val frame = MessageSerializer.encodeClient(ChatMessage("she said \"hi\"\\bye"))
        // Round-trips back to the original string.
        val obj = json.decodeFromString<JsonObject>(frame)
        assertEquals("she said \"hi\"\\bye", obj["message"]!!.jsonPrimitive.content)
    }

    @Test
    fun `work gameplay messages omit client identity and coordinates`() {
        val startObj = json.decodeFromString<JsonObject>(
            MessageSerializer.encodeClient(StartWorkContractMessage())
        )
        assertEquals("start_work_contract", startObj["type"]!!.jsonPrimitive.content)
        assertEquals(WorkContractType.TEMPLE_SWEEP, startObj["contract_type"]!!.jsonPrimitive.content)
        assertNoClientAuthorityFields(startObj)

        val tickObj = json.decodeFromString<JsonObject>(
            MessageSerializer.encodeClient(WorkTickMessage("contract-1"))
        )
        assertEquals("work_tick", tickObj["type"]!!.jsonPrimitive.content)
        assertEquals("contract-1", tickObj["contract_id"]!!.jsonPrimitive.content)
        assertNoClientAuthorityFields(tickObj)
    }

    @Test
    fun `property gameplay messages omit client identity and coordinates`() {
        val buyObj = json.decodeFromString<JsonObject>(
            MessageSerializer.encodeClient(BuyHouseMessage("HighCity:H1"))
        )
        assertEquals("buy_house", buyObj["type"]!!.jsonPrimitive.content)
        assertEquals("HighCity:H1", buyObj["property_id"]!!.jsonPrimitive.content)
        assertNoClientAuthorityFields(buyObj)

        val listObj = json.decodeFromString<JsonObject>(
            MessageSerializer.encodeClient(ListHouseMessage("HighCity:H1", 123))
        )
        assertEquals("list_house", listObj["type"]!!.jsonPrimitive.content)
        assertEquals("HighCity:H1", listObj["property_id"]!!.jsonPrimitive.content)
        assertEquals("123", listObj["price"]!!.jsonPrimitive.content)
        assertNoClientAuthorityFields(listObj)

        val unlistObj = json.decodeFromString<JsonObject>(
            MessageSerializer.encodeClient(UnlistHouseMessage("HighCity:H1"))
        )
        assertEquals("unlist_house", unlistObj["type"]!!.jsonPrimitive.content)
        assertEquals("HighCity:H1", unlistObj["property_id"]!!.jsonPrimitive.content)
        assertNoClientAuthorityFields(unlistObj)
    }

    @Test
    fun highCityAndLegacyAzuraMapNamesDecode() {
        val highCity = MessageSerializer.decodeServer(
            """{"type":"world_state","map":"HighCity","player":{"id":"p","name":"n","x":1,"y":1},"nearby_players":[]}"""
        ) as WorldStateMessage
        val legacy = MessageSerializer.decodeServer(
            """{"type":"world_state","map":"Azura","player":{"id":"p","name":"n","x":1,"y":1},"nearby_players":[]}"""
        ) as WorldStateMessage

        assertEquals(MapName.HIGH_CITY, highCity.map)
        assertEquals(MapName.AZURA, legacy.map)
        assertEquals("High City", highCity.map.displayName)
        assertEquals("High City", legacy.map.displayName)
        assertTrue(highCity.map.isHighCityCompatible)
        assertTrue(legacy.map.isHighCityCompatible)
    }

    // ---- Server decode ------------------------------------------------------

    @Test
    fun everyServerMessageTypeDecodesToConcreteClass() {
        val frames: List<Pair<String, Class<out ServerMessage>>> = listOf(
            """{"type":"welcome","version":"2.0.0"}""" to WelcomeMessage::class.java,
            """{"type":"login_ack","player_id":"p","name":"n","ok":true}""" to LoginAckMessage::class.java,
            """{"type":"world_state","map":"Rookguard","player":{"id":"p","name":"n","x":1,"y":1},"nearby_players":[]}""" to WorldStateMessage::class.java,
            """{"type":"move_result","ok":true,"x":1,"y":2,"reason":null}""" to MoveResultMessage::class.java,
            """{"type":"player_moved","player_id":"p","x":1,"y":2}""" to PlayerMovedMessage::class.java,
            """{"type":"player_joined","player":{"id":"p","name":"n","x":0,"y":0}}""" to PlayerJoinedMessage::class.java,
            """{"type":"player_left","player_id":"p"}""" to PlayerLeftMessage::class.java,
            """{"type":"chat_broadcast","player_id":"p","name":"n","message":"hi"}""" to ChatBroadcastMessage::class.java,
            """{"type":"tem_challenge","challenge_id":"c","message":"m","timeout_seconds":30}""" to TemChallengeMessage::class.java,
            """{"type":"tem_witness_request","request_id":"r","timestamp":"t","map":"Azura","target_actor":"a","prompt":"p","kind":"heat_penalty"}""" to TemWitnessRequestMessage::class.java,
            """{"type":"error","code":"rate_limited","message":"slow down"}""" to ErrorMessage::class.java,
            """{"type":"death_notice","ok":true,"respawn_in_ms":1000,"map":"Rookguard","spawn":{"x":2,"y":2},"reason":"killed"}""" to DeathNoticeMessage::class.java,
            """{"type":"runestone_result","table_id":"t","caster":{"id":"p","name":"n"},"face":"water","whisper":"w"}""" to RunestoneResultMessage::class.java,
            """{"type":"runestone_denied","reason":"cooldown"}""" to RunestoneDeniedMessage::class.java,
            """{"type":"drop_item_result","ok":true,"item_id":"i","reason":null}""" to DropItemResultMessage::class.java,
            """{"type":"pickup_item_result","ok":false,"item_id":"i","reason":"gone"}""" to PickupItemResultMessage::class.java,
            """{"type":"inventory_snapshot","items":[{"item_id":"i","item_type":"sword","slot":null}]}""" to InventorySnapshotMessage::class.java,
            """{"type":"world_item_added","item_id":"i","item_type":"sword","x":1,"y":1}""" to WorldItemAddedMessage::class.java,
            """{"type":"world_item_removed","item_id":"i"}""" to WorldItemRemovedMessage::class.java,
            """{"type":"combat_resolved","attacker_id":"a","defender_id":"d","outcome":"kill","map":"Azura","x":1,"y":1}""" to CombatResolvedMessage::class.java,
            """{"type":"combat_rejected","reason":"not_adjacent"}""" to CombatRejectedMessage::class.java,
            """{"type":"protected_slot_set","player_id":"p","item_id":"i","prev_item_id":null}""" to ProtectedSlotSetMessage::class.java,
            """{"type":"chronicle_snapshot","player_id":"p","events":[],"has_more":false}""" to ChronicleSnapshotMessage::class.java,
            """{"type":"evidence_snapshot","status":"ok","player_id":"p"}""" to EvidenceSnapshotMessage::class.java,
            """{"type":"pressure_metrics_snapshot","player_id":"p","since":"s","until":"u","status":"ok"}""" to PressureMetricsSnapshotMessage::class.java,
            """{"type":"player_inspect","player_id":"p","name":"n","vocation":"warden","display_vocation":"Sovereign Warden","badges":[],"mark":null}""" to PlayerInspectMessage::class.java,
            """{"type":"wallet_snapshot","gold":42}""" to WalletSnapshotMessage::class.java,
            """{"type":"tithe_result","success":true,"new_balance":40}""" to TitheResultMessage::class.java,
            """{"type":"work_contract_started","contract_id":"c","contract_type":"temple_sweep","payout_gold":5,"cooldown_seconds":60,"min_duration_ms":1000}""" to WorkContractStartedMessage::class.java,
            """{"type":"work_progress","contract_id":"c","ticks_observed":1,"ticks_required":3,"remaining_ms":2000}""" to WorkProgressMessage::class.java,
            """{"type":"work_contract_result","contract_id":"c","success":true,"credited_gold":5}""" to WorkContractResultMessage::class.java,
            """{"type":"npc_dialogue","npc_id":"n","place_id":"pl","tier":"seen","line":"hello"}""" to NpcDialogueMessage::class.java,
            """{"type":"npc_dialogue_error","npc_id":"n","error":"not_found"}""" to NpcDialogueErrorMessage::class.java,
            """{"type":"skill_result","skill_id":"s","success":true}""" to SkillResultMessage::class.java,
            """{"type":"mod_reports_snapshot","reports":[],"has_more":false}""" to ModReportsSnapshotMessage::class.java,
            """{"type":"mod_resolve_result","success":true,"case_id":"c"}""" to ModResolveResultMessage::class.java,
            """{"type":"property_snapshot","properties":[]}""" to PropertySnapshotMessage::class.java,
            """{"type":"property_state","property":{"property_id":"pr","zone":"z","plot_id":"pl","x":1,"y":1,"width":2,"height":2,"district":null,"status":"unowned","owner_name":null,"primary_price_gold":100,"listed_price_gold":null,"sale_count":0}}""" to PropertyStateMessage::class.java,
            """{"type":"house_sold","property_id":"pr","plot_id":"pl","zone":"z","buyer_name":"b","seller_name":null,"price":100,"sale_count":1}""" to HouseSoldMessage::class.java,
            """{"type":"property_result","action":"buy_house","success":true,"property_id":"pr"}""" to PropertyResultMessage::class.java,
            """{"type":"property_ledger","property_id":"pr","owner_history":[],"sale_count":0}""" to PropertyLedgerMessage::class.java,
            """{"type":"property_auction_state","property_id":"pr","kind":"resale","current_high":600,"high_bidder_name":"Ari","min_next":650,"scheduled_close":1760000000000}""" to PropertyAuctionStateMessage::class.java,
            """{"type":"house_auction_settled","property_id":"pr","plot_id":"pl","zone":"z","winner_name":"Ari","seller_name":"Sol","price":600,"sale_count":2}""" to HouseAuctionSettledMessage::class.java,
        )

        // 43 server message types in protocol.ts ServerMessage union.
        assertEquals(43, frames.size)
        for ((frame, cls) in frames) {
            val decoded = MessageSerializer.decodeServer(frame)
            assertEquals("wrong decode for $frame", cls, decoded.javaClass)
        }
    }

    @Test
    fun welcomeDecodesVersion() {
        val decoded = MessageSerializer.decodeServer("""{"type":"welcome","version":"2.0.0"}""")
        assertTrue(decoded is WelcomeMessage)
        assertEquals("2.0.0", (decoded as WelcomeMessage).version)
    }

    @Test
    fun deathNoticeDecodesOptionalExtras() {
        val frame = """{"type":"death_notice","ok":true,"respawn_in_ms":1000,"map":"Rookguard",
            "spawn":{"x":2,"y":2},"reason":"killed","killer_name":"foe","zone":"temple",
            "lost_items":[{"kind":"gold","qty":5}]}"""
        val decoded = MessageSerializer.decodeServer(frame) as DeathNoticeMessage
        assertEquals("foe", decoded.killerName)
        assertEquals(1, decoded.lostItems?.size)
        assertEquals("gold", decoded.lostItems?.first()?.kind)
    }

    // ---- Robustness ---------------------------------------------------------

    @Test
    fun unknownTypeDecodesToUnknownMessage() {
        val decoded = MessageSerializer.decodeServer("""{"type":"some_future_msg","x":1}""")
        assertTrue(decoded is UnknownMessage)
        assertEquals("some_future_msg", (decoded as UnknownMessage).type)
    }

    @Test
    fun malformedFrameDecodesToUnknownMessageWithoutThrowing() {
        val decoded = MessageSerializer.decodeServer("not json at all")
        assertTrue(decoded is UnknownMessage)
    }

    @Test
    fun missingTypeDecodesToUnknownMessage() {
        val decoded = MessageSerializer.decodeServer("""{"version":"2.0.0"}""")
        assertTrue(decoded is UnknownMessage)
        assertNull((decoded as UnknownMessage).type)
    }
}
