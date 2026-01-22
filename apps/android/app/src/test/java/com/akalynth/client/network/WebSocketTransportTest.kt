package com.akalynth.client.network

import com.akalynth.client.actions.ActionIntent
import com.akalynth.client.ui.components.character.CharacterSex
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
        assertEquals("attack", sent["type"]?.jsonPrimitive?.content)
        assertEquals("test-action-001", sent["action_id"]?.jsonPrimitive?.content)
        assertEquals("enemy_123", sent["payload"]?.jsonObject?.get("target_id")?.jsonPrimitive?.content)
    }

    @Test
    fun `attack without target serializes correctly`() = runTest {
        connection.connect()
        val intent = ActionIntent.Attack("test-action-002", targetId = null)

        transport.send(intent)

        val sent = json.parseToJsonElement(connection.lastSent!!).jsonObject
        assertEquals("attack", sent["type"]?.jsonPrimitive?.content)
        assertNull(sent["payload"]?.jsonObject?.get("target_id"))
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
        assertEquals("drop_hotbar_slot", sent["type"]?.jsonPrimitive?.content)
        assertEquals("test-action-003", sent["action_id"]?.jsonPrimitive?.content)

        val payload = sent["payload"]?.jsonObject
        assertEquals("2", payload?.get("slot_index")?.jsonPrimitive?.content)
        assertEquals("legendary_sword", payload?.get("item_id")?.jsonPrimitive?.content)
        assertEquals("Dragon Slayer", payload?.get("item_name")?.jsonPrimitive?.content)
        assertEquals("legendary", payload?.get("rarity")?.jsonPrimitive?.content)
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

        val payload = sent["payload"]?.jsonObject
        assertEquals("gold_pile", payload?.get("item_id")?.jsonPrimitive?.content)
        assertEquals("Gold Pile", payload?.get("item_name")?.jsonPrimitive?.content)
        assertEquals("15", payload?.get("x")?.jsonPrimitive?.content)
        assertEquals("25", payload?.get("y")?.jsonPrimitive?.content)
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
        assertEquals("use_hotbar_slot", sent["type"]?.jsonPrimitive?.content)
        assertEquals("test-action-005", sent["action_id"]?.jsonPrimitive?.content)

        val payload = sent["payload"]?.jsonObject
        assertEquals("1", payload?.get("slot_index")?.jsonPrimitive?.content)
        assertEquals("health_potion", payload?.get("item_id")?.jsonPrimitive?.content)
    }

    // =========================================================================
    // CreateCharacter serialization
    // =========================================================================

    @Test
    fun `create character serializes correctly`() = runTest {
        connection.connect()
        val intent = ActionIntent.CreateCharacter(
            actionId = "test-action-006",
            name = "TestHero",
            sex = CharacterSex.FEMALE
        )

        transport.send(intent)

        val sent = json.parseToJsonElement(connection.lastSent!!).jsonObject
        assertEquals("create_character", sent["type"]?.jsonPrimitive?.content)
        assertEquals("test-action-006", sent["action_id"]?.jsonPrimitive?.content)

        val payload = sent["payload"]?.jsonObject
        assertEquals("TestHero", payload?.get("name")?.jsonPrimitive?.content)
        assertEquals("female", payload?.get("sex")?.jsonPrimitive?.content)
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
