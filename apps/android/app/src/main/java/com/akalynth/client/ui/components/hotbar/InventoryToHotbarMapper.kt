package com.akalynth.client.ui.components.hotbar

import com.akalynth.client.game.ServerInventoryItem
import com.akalynth.client.protocol.ItemInfo

/**
 * Maps server [ItemInfo] to hotbar [Item] UI models with presentation metadata.
 */
object InventoryToHotbarMapper {
    fun fromItemInfo(info: ItemInfo): ServerInventoryItem {
        val presentation = ItemPresentationCatalog.resolve(info.itemType)
        return ServerInventoryItem(
            itemId = info.itemId,
            itemType = info.itemType,
            slot = info.slot,
            displayName = presentation.name,
            rarity = presentation.rarity,
        )
    }

    fun toHotbarItem(serverItem: ServerInventoryItem): Item = Item(
        id = serverItem.itemId,
        itemType = serverItem.itemType,
        name = serverItem.displayName,
        rarity = serverItem.rarity,
        spriteId = "item_${serverItem.itemType}",
    )

    fun ItemInfo.toHotbarItem(): Item = toHotbarItem(fromItemInfo(this))
}