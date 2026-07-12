package com.akalynth.client.network

import com.akalynth.client.actions.ActionIntent
import com.akalynth.client.actions.WorldEventSkillIds
import com.akalynth.client.ui.components.hotbar.ItemRarity
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests for WebSocket transport serialization.
 */
class WebSocketTransportTest {

    private lateinit var connection: FakeWebSocketConnection
    private lateinit var transport: WebSocketActionTransport
    private val json = Json { ignoreUnknownKeys = true }

    @Before
    fun setup() {
        connection = FakeWebSocketConnection()
        transport = WebSocketActionTransport(connection)
    }

    // =========================================================================
    // Attack serialization
    // =========================================================================

    @Test
    fun `attack serializes correctly`() = runTest {
        connection.connect()
        val intent = ActionIntent.Attack("test-action-001", targetId = "enemy_123")

        transport.send(intent)

        val sent = json.parseToJsonElement(connection.lastSent!!).jsonObject
        assertEquals("attack_intent", sent["type"]?.jsonPrimitive?.content)
        assertEquals("test-action-001", sent["action_id"]?.jsonPrimitive?.content)
        assertEquals("enemy_123", sent["target_id"]?.jsonPrimitive?.content)
    }

    @Test
    fun `attack without target serializes correctly`() = runTest {
        connection.connect()
        val intent = ActionIntent.Attack("test-action-002", targetId = null)

        transport.send(intent)

        val sent = json.parseToJsonElement(connection.lastSent!!).jsonObject
        assertEquals("attack_intent", sent["type"]?.jsonPrimitive?.content)
        assertNull(sent["target_id"])
    }

    // =========================================================================
    // Drop serialization
    // =========================================================================

    @Test
    fun `drop serializes correctly`() = runTest {
        connection.connect()
        val intent = ActionIntent.DropHotbarSlot(
            actionId = "test-action-003",
            slotIndex = 2,
            itemId = "legendary_sword",
            itemName = "Dragon Slayer",
            rarity = ItemRarity.LEGENDARY
        )

        transport.send(intent)

        val sent = json.parseToJsonElement(connection.lastSent!!).jsonObject
        assertEquals("drop_item", sent["type"]?.jsonPrimitive?.content)
        assertEquals("test-action-003", sent["action_id"]?.jsonPrimitive?.content)
        assertEquals("legendary_sword", sent["item_id"]?.jsonPrimitive?.content)
        assertNull(sent["payload"])
    }

    // =========================================================================
    // Pickup serialization
    // =========================================================================

    @Test
    fun `pickup serializes correctly`() = runTest {
        connection.connect()
        val intent = ActionIntent.PickupItem(
            actionId = "test-action-004",
            itemId = "gold_pile",
            itemName = "Gold Pile",
            x = 15,
            y = 25
        )

        transport.send(intent)

        val sent = json.parseToJsonElement(connection.lastSent!!).jsonObject
        assertEquals("pickup_item", sent["type"]?.jsonPrimitive?.content)
        assertEquals("test-action-004", sent["action_id"]?.jsonPrimitive?.content)
        assertEquals("gold_pile", sent["item_id"]?.jsonPrimitive?.content)
        assertNull(sent["payload"])
    }

    // =========================================================================
    // UseHotbarSlot serialization
    // =========================================================================

    @Test
    fun `use hotbar slot serializes correctly`() = runTest {
        connection.connect()
        val intent = ActionIntent.UseHotbarSlot(
            actionId = "test-action-005",
            slotIndex = 1,
            itemId = "health_potion"
        )

        transport.send(intent)

        val sent = json.parseToJsonElement(connection.lastSent!!).jsonObject
        assertEquals("use_skill", sent["type"]?.jsonPrimitive?.content)
        assertEquals("test-action-005", sent["action_id"]?.jsonPrimitive?.content)
        assertEquals("item:use:health_potion", sent["skill_id"]?.jsonPrimitive?.content)
        assertNull(sent["payload"])
    }

    @Test
    fun `world event contribution serializes as use skill intent`() = runTest {
        connection.connect()
        val intent = ActionIntent.WorldEventContribution(
            actionId = "test-action-007",
            eventId = WorldEventSkillIds.WITNESS_MOTH_BLOOM,
            contributionId = WorldEventSkillIds.CRAFT_LANTERN_FRAME
        )

        transport.send(intent)

        val sent = json.parseToJsonElement(connection.lastSent!!).jsonObject
        assertEquals("use_skill", sent["type"]?.jsonPrimitive?.content)
        assertEquals("test-action-007", sent["action_id"]?.jsonPrimitive?.content)
        assertEquals(
            "event:witness_moth_bloom:craft_lantern_frame",
            sent["skill_id"]?.jsonPrimitive?.content
        )
        assertNull(sent["payload"])
    }

    // =========================================================================
    // Connection state
    // =========================================================================

    @Test
    fun `send throws when not connected`() = runTest {
        val intent = ActionIntent.Attack("test", null)

        try {
            transport.send(intent)
            fail("Should throw when not connected")
        } catch (e: IllegalStateException) {
            assertEquals("Not connected", e.message)
        }
    }
}
