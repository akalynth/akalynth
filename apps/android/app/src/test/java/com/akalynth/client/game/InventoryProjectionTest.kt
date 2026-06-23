package com.akalynth.client.game

import com.akalynth.client.protocol.ItemInfo
import com.akalynth.client.ui.components.hotbar.ItemRarity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InventoryProjectionTest {
    @Test
    fun `snapshot rebuilds items and preserves hotbar assignments`() {
        val previous = InventoryState(
            items = mapOf(
                "a" to serverItem("a", "torch"),
                "b" to serverItem("b", "ration"),
            ),
            hotbarSlots = listOf(
                hotbarItem("a", "torch"),
                hotbarItem("b", "ration"),
                null,
                null,
            ),
        )

        val next = InventoryProjection.fromSnapshot(
            serverItems = listOf(
                ItemInfo(itemId = "a", itemType = "torch"),
                ItemInfo(itemId = "b", itemType = "ration"),
                ItemInfo(itemId = "c", itemType = "mark_token"),
            ),
            previous = previous,
        )

        assertEquals(3, next.items.size)
        assertEquals("a", next.hotbarSlots[0]?.id)
        assertEquals("b", next.hotbarSlots[1]?.id)
        assertEquals("c", next.hotbarSlots[2]?.id)
        assertNull(next.hotbarSlots[3])
    }

    @Test
    fun `pickup success adds item and auto-assigns first empty hotbar slot`() {
        val previous = InventoryState(
            items = mapOf("a" to serverItem("a", "torch")),
            hotbarSlots = listOf(hotbarItem("a", "torch"), null, null, null),
        )

        val next = InventoryProjection.onPickupSuccess(
            itemId = "b",
            previous = previous,
            itemType = "ration",
        )

        assertEquals(2, next.items.size)
        assertEquals("ration", next.items["b"]?.itemType)
        assertEquals("Ration", next.items["b"]?.displayName)
        assertEquals(ItemRarity.COMMON, next.items["b"]?.rarity)
        assertEquals("a", next.hotbarSlots[0]?.id)
        assertEquals("b", next.hotbarSlots[1]?.id)
        assertEquals("ration", next.hotbarSlots[1]?.itemType)
    }

    @Test
    fun `pickup success is idempotent when item already exists`() {
        val previous = InventoryState(
            items = mapOf("a" to serverItem("a", "torch")),
            hotbarSlots = listOf(hotbarItem("a", "torch"), null, null, null),
        )

        val next = InventoryProjection.onPickupSuccess("a", previous, itemType = "torch")

        assertEquals(previous, next)
    }

    @Test
    fun `drop success removes item and clears hotbar slot`() {
        val previous = InventoryState(
            items = mapOf("a" to serverItem("a", "torch")),
            hotbarSlots = listOf(hotbarItem("a", "torch"), null, null, null),
        )

        val next = InventoryProjection.onDropSuccess("a", previous)

        assertTrue(next.items.isEmpty())
        assertNull(next.hotbarSlots[0])
    }

    @Test
    fun `snapshot passes icon_sprite_id to hotbar item`() {
        val next = InventoryProjection.fromSnapshot(
            serverItems = listOf(
                ItemInfo(
                    itemId = "a",
                    itemType = "torch",
                    iconSpriteId = "akalynth_item_torch_001",
                ),
            ),
        )

        assertEquals("akalynth_item_torch_001", next.items["a"]?.iconSpriteId)
        assertEquals("akalynth_item_torch_001", next.hotbarSlots[0]?.iconSpriteId)
    }

    @Test
    fun `assignHotbarSlot moves item to requested index`() {
        val previous = InventoryState(
            items = mapOf(
                "a" to serverItem("a", "torch"),
                "b" to serverItem("b", "ration"),
            ),
            hotbarSlots = listOf(hotbarItem("a", "torch"), null, null, null),
        )

        val next = InventoryProjection.assignHotbarSlot(2, "b", previous)

        assertEquals("a", next.hotbarSlots[0]?.id)
        assertEquals("b", next.hotbarSlots[2]?.id)
        assertNull(next.hotbarSlots[1])
    }

    private fun serverItem(id: String, itemType: String) = ServerInventoryItem(
        itemId = id,
        itemType = itemType,
        displayName = itemType.replaceFirstChar { it.uppercase() },
        rarity = ItemRarity.COMMON,
    )

    private fun hotbarItem(id: String, itemType: String) =
        com.akalynth.client.ui.components.hotbar.Item(
            id = id,
            itemType = itemType,
            name = itemType,
            rarity = ItemRarity.COMMON,
        )
}