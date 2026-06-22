package com.akalynth.client.ui.components.hotbar

import com.akalynth.client.assets.AssetFrame
import com.akalynth.client.assets.AssetRegistryEntry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ItemIconResolverTest {
    private val torchEntry = entry("akalynth_item_torch_001", itemType = "torch")
    private val rationEntry = entry("akalynth_item_ration_001", itemType = "ration")
    private val overrideEntry = entry("akalynth_item_custom_override_001")

    @Test
    fun `icon_sprite_id wins over item_type registry`() {
        val resolved = ItemIconResolver.resolveEntry(
            iconSpriteId = overrideEntry.assetId,
            itemType = "torch",
            spriteId = ITEM_DEFAULT_SPRITE_ID,
            lookupByAssetId = { id ->
                when (id) {
                    overrideEntry.assetId -> overrideEntry
                    else -> null
                }
            },
            lookupByItemType = mapOf("torch" to torchEntry).let { map -> { type -> map[type] } },
        )

        assertEquals(overrideEntry, resolved)
    }

    @Test
    fun `item_type registry wins over spriteId`() {
        val resolved = ItemIconResolver.resolveEntry(
            iconSpriteId = null,
            itemType = "torch",
            spriteId = rationEntry.assetId,
            lookupByAssetId = { id -> if (id == rationEntry.assetId) rationEntry else null },
            lookupByItemType = { type -> if (type == "torch") torchEntry else null },
        )

        assertEquals(torchEntry, resolved)
    }

    @Test
    fun `spriteId used when icon_sprite_id and item_type miss`() {
        val resolved = ItemIconResolver.resolveEntry(
            iconSpriteId = null,
            itemType = "unknown_widget",
            spriteId = rationEntry.assetId,
            lookupByAssetId = { id -> if (id == rationEntry.assetId) rationEntry else null },
            lookupByItemType = { null },
        )

        assertEquals(rationEntry, resolved)
    }

    @Test
    fun `default spriteId skipped so placeholder can render`() {
        val resolved = ItemIconResolver.resolveEntry(
            iconSpriteId = null,
            itemType = "unknown_widget",
            spriteId = ITEM_DEFAULT_SPRITE_ID,
            lookupByAssetId = { rationEntry },
            lookupByItemType = { null },
        )

        assertNull(resolved)
    }

    @Test
    fun `blank icon_sprite_id falls through to item_type`() {
        val resolved = ItemIconResolver.resolveEntry(
            iconSpriteId = "   ",
            itemType = "ration",
            spriteId = ITEM_DEFAULT_SPRITE_ID,
            lookupByAssetId = { null },
            lookupByItemType = { type -> if (type == "ration") rationEntry else null },
        )

        assertEquals(rationEntry, resolved)
    }

    @Test
    fun `placeholder glyph maps sword items`() {
        val item = Item(
            id = "item_1",
            itemType = "legendary_sword",
            name = "Dragon Slayer Sword",
            rarity = ItemRarity.LEGENDARY,
        )

        assertEquals("\u2694", itemIconPlaceholderGlyph(item))
    }

    private fun entry(
        assetId: String,
        itemType: String? = null,
    ): AssetRegistryEntry = AssetRegistryEntry(
        assetId = assetId,
        source = "factory",
        assetType = "item",
        file = "sprites/item__placeholder.png",
        frame = AssetFrame(w = ITEM_ICON_NATIVE_PX, h = ITEM_ICON_NATIVE_PX),
        styleContract = "nostalgic_top_down_mmo_readability_original_akalynth_assets_v1",
        mechanics = null,
        itemType = itemType,
    )
}