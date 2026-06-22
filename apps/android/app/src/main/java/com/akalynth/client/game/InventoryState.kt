package com.akalynth.client.game

import com.akalynth.client.protocol.ItemInfo
import com.akalynth.client.ui.components.hotbar.HOTBAR_SLOT_COUNT
import com.akalynth.client.ui.components.hotbar.InventoryToHotbarMapper
import com.akalynth.client.ui.components.hotbar.Item

/**
 * Server-authoritative inventory projection with client-side hotbar slot assignment.
 *
 * Hotbar slots are display-only UI projection; the server remains authoritative for
 * item ownership via [items].
 */
data class InventoryState(
    /** Server-authoritative items keyed by item_id. */
    val items: Map<String, ServerInventoryItem> = emptyMap(),
    /** Four hotbar slots; null = empty. UI projection only. */
    val hotbarSlots: List<Item?> = List(HOTBAR_SLOT_COUNT) { null },
)

data class ServerInventoryItem(
    val itemId: String,
    val itemType: String,
    val slot: String? = null,
    val displayName: String,
    val rarity: ItemRarity,
)

/**
 * Pure inventory projection policies (PR-017).
 */
object InventoryProjection {
    fun fromSnapshot(
        serverItems: List<ItemInfo>,
        previous: InventoryState = InventoryState(),
    ): InventoryState {
        val newItems = serverItems.associate { info ->
            info.itemId to InventoryToHotbarMapper.fromItemInfo(info)
        }

        val preservedSlots = previous.hotbarSlots.map { slotItem ->
            slotItem
                ?.takeIf { newItems.containsKey(it.id) }
                ?.let { InventoryToHotbarMapper.toHotbarItem(newItems[it.id]!!) }
        }.toMutableList()

        val assignedIds = preservedSlots.mapNotNull { it?.id }.toSet()
        val unassigned = serverItems
            .filter { it.itemId !in assignedIds }
            .map { newItems[it.itemId]!! }

        var unassignedIndex = 0
        for (i in preservedSlots.indices) {
            if (preservedSlots[i] == null && unassignedIndex < unassigned.size) {
                preservedSlots[i] = InventoryToHotbarMapper.toHotbarItem(unassigned[unassignedIndex])
                unassignedIndex++
            }
        }

        return InventoryState(items = newItems, hotbarSlots = preservedSlots)
    }

    fun onPickupSuccess(
        itemId: String,
        previous: InventoryState,
        itemType: String? = null,
    ): InventoryState {
        if (previous.items.containsKey(itemId)) return previous

        val serverItem = InventoryToHotbarMapper.fromItemInfo(
            ItemInfo(itemId = itemId, itemType = itemType ?: "unknown")
        )
        return previous.copy(
            items = previous.items + (itemId to serverItem),
            hotbarSlots = autoAssignHotbar(previous.hotbarSlots, serverItem),
        )
    }

    fun onDropSuccess(itemId: String, previous: InventoryState): InventoryState {
        val newItems = previous.items - itemId
        val newSlots = previous.hotbarSlots.map { slot ->
            if (slot?.id == itemId) null else slot
        }
        return previous.copy(items = newItems, hotbarSlots = newSlots)
    }

    fun assignHotbarSlot(index: Int, itemId: String, previous: InventoryState): InventoryState {
        require(index in 0 until HOTBAR_SLOT_COUNT) {
            "Hotbar slot index must be 0..${HOTBAR_SLOT_COUNT - 1}, got $index"
        }
        val serverItem = previous.items[itemId] ?: return previous
        val hotbarItem = InventoryToHotbarMapper.toHotbarItem(serverItem)
        val newSlots = previous.hotbarSlots.toMutableList()
        for (i in newSlots.indices) {
            if (newSlots[i]?.id == itemId) newSlots[i] = null
        }
        newSlots[index] = hotbarItem
        return previous.copy(hotbarSlots = newSlots)
    }

    private fun autoAssignHotbar(slots: List<Item?>, item: ServerInventoryItem): List<Item?> {
        if (slots.any { it?.id == item.itemId }) return slots
        val hotbarItem = InventoryToHotbarMapper.toHotbarItem(item)
        val mutable = slots.toMutableList()
        val emptyIndex = mutable.indexOfFirst { it == null }
        if (emptyIndex >= 0) {
            mutable[emptyIndex] = hotbarItem
        }
        return mutable
    }
}