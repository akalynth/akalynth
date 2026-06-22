package com.akalynth.client.ui.components.hotbar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ItemPresentationCatalogTest {
    @Test
    fun `MVP item types resolve to catalog entries`() {
        assertEquals(20, ItemPresentationCatalog.MVP_ITEM_TYPES.size)

        for (itemType in ItemPresentationCatalog.MVP_ITEM_TYPES) {
            val presentation = ItemPresentationCatalog.resolve(itemType)
            assertTrue(
                "Expected catalog entry for $itemType",
                presentation.name.isNotBlank()
            )
            assertTrue(
                "Expected catalog rarity for $itemType",
                presentation.rarity != ItemRarity.LEGENDARY
            )
        }
    }

    @Test
    fun `unknown item type defaults to COMMON rarity`() {
        val presentation = ItemPresentationCatalog.resolve("mystery_widget")
        assertEquals("Mystery widget", presentation.name)
        assertEquals(ItemRarity.COMMON, presentation.rarity)
    }

    @Test
    fun `legendary_sword fixture resolves to LEGENDARY for Tier3 tests`() {
        val presentation = ItemPresentationCatalog.resolve("legendary_sword")
        assertEquals("Dragon Slayer", presentation.name)
        assertEquals(ItemRarity.LEGENDARY, presentation.rarity)
        assertTrue(presentation.rarity.requiresTier3Confirm)
    }

    @Test
    fun `torch resolves to expected presentation`() {
        val presentation = ItemPresentationCatalog.resolve("torch")
        assertEquals("Torch", presentation.name)
        assertEquals(ItemRarity.COMMON, presentation.rarity)
    }
}