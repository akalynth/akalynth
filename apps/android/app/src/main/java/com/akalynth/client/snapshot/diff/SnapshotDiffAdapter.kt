package com.akalynth.client.snapshot.diff

import com.akalynth.client.snapshot.SnapshotV0

/**
 * Adapter for computing diffs between snapshots.
 *
 * Contract:
 * - No inference: reports only what changed, not why
 * - No mutation: pure function
 * - Deterministic: sorted output, stable keys
 * - Extensible: works with minimal or rich snapshots
 */
object SnapshotDiffAdapter {

    /**
     * Compute diff between two minimal snapshots.
     *
     * With only SnapshotV0, we can only diff:
     * - Sequence transition
     * - State hash change
     */
    fun diff(prev: SnapshotV0?, curr: SnapshotV0?): SnapshotDiff {
        if (prev == null && curr == null) {
            return SnapshotDiff.EMPTY
        }

        val entries = mutableListOf<DiffEntry>()

        // Hash change (if both present and different)
        if (prev != null && curr != null && prev.stateHash != curr.stateHash) {
            entries.add(DiffEntry.hashChanged(prev.stateHash, curr.stateHash))
        }

        return SnapshotDiff(
            prevSequence = prev?.sequence,
            currSequence = curr?.sequence,
            prevHash = prev?.stateHash,
            currHash = curr?.stateHash,
            entries = entries.sortedWith(compareBy({ it.category }, { it.key })),
            summary = DiffSummary.from(entries)
        )
    }

    /**
     * Compute full diff between two rich snapshot states.
     *
     * Diffs all available fields:
     * - Inventory (added/removed/quantity changed)
     * - Gold
     * - Position/Zone
     * - Stats (health, mana)
     * - Status effects
     * - State hash
     */
    fun diff(prev: SnapshotState?, curr: SnapshotState?): SnapshotDiff {
        if (prev == null && curr == null) {
            return SnapshotDiff.EMPTY
        }

        val entries = mutableListOf<DiffEntry>()

        // Inventory diff
        entries.addAll(diffInventory(prev?.inventory, curr?.inventory))

        // Gold diff
        diffGold(prev?.gold, curr?.gold)?.let { entries.add(it) }

        // Position/Zone diff
        diffPosition(prev, curr)?.let { entries.addAll(it) }

        // Stats diff
        diffStats(prev, curr).let { entries.addAll(it) }

        // Status effects diff
        entries.addAll(diffStatusEffects(prev?.statusEffects, curr?.statusEffects))

        // Hash diff (if different)
        if (prev != null && curr != null && prev.stateHash != curr.stateHash) {
            entries.add(DiffEntry.hashChanged(prev.stateHash, curr.stateHash))
        }

        val sortedEntries = entries.sortedWith(compareBy({ it.category }, { it.key }))

        return SnapshotDiff(
            prevSequence = prev?.sequence,
            currSequence = curr?.sequence,
            prevHash = prev?.stateHash,
            currHash = curr?.stateHash,
            entries = sortedEntries,
            summary = DiffSummary.from(sortedEntries)
        )
    }

    /**
     * Diff inventory items.
     */
    fun diffInventory(
        prev: Map<String, InventoryItem>?,
        curr: Map<String, InventoryItem>?
    ): List<DiffEntry> {
        val prevItems = prev ?: emptyMap()
        val currItems = curr ?: emptyMap()

        val allKeys = (prevItems.keys + currItems.keys).sorted()
        val entries = mutableListOf<DiffEntry>()

        for (key in allKeys) {
            val prevItem = prevItems[key]
            val currItem = currItems[key]

            when {
                // Added
                prevItem == null && currItem != null -> {
                    entries.add(DiffEntry.itemAdded(
                        itemId = currItem.itemId,
                        itemName = currItem.itemName,
                        rarity = currItem.rarity,
                        quantity = currItem.quantity
                    ))
                }
                // Removed
                prevItem != null && currItem == null -> {
                    entries.add(DiffEntry.itemRemoved(
                        itemId = prevItem.itemId,
                        itemName = prevItem.itemName,
                        rarity = prevItem.rarity,
                        quantity = prevItem.quantity
                    ))
                }
                // Modified (quantity changed)
                prevItem != null && currItem != null &&
                    prevItem.quantity != currItem.quantity -> {
                    entries.add(DiffEntry.itemQuantityChanged(
                        itemId = currItem.itemId,
                        itemName = currItem.itemName,
                        prevQuantity = prevItem.quantity,
                        currQuantity = currItem.quantity,
                        rarity = currItem.rarity
                    ))
                }
            }
        }

        return entries
    }

    /**
     * Diff gold.
     */
    private fun diffGold(prev: Long?, curr: Long?): DiffEntry? {
        val prevGold = prev ?: 0
        val currGold = curr ?: 0

        return if (prevGold != currGold) {
            DiffEntry.goldChanged(prevGold, currGold)
        } else null
    }

    /**
     * Diff position and zone.
     */
    private fun diffPosition(prev: SnapshotState?, curr: SnapshotState?): List<DiffEntry>? {
        val entries = mutableListOf<DiffEntry>()

        // Zone change
        if (prev?.zone != curr?.zone && curr?.zone != null) {
            entries.add(DiffEntry.zoneChanged(prev?.zone, curr.zone))
        }

        // Position change (only if zone same and position changed)
        if (prev?.zone == curr?.zone &&
            prev?.x != null && prev.y != null &&
            curr?.x != null && curr.y != null &&
            (prev.x != curr.x || prev.y != curr.y)) {
            entries.add(DiffEntry.positionChanged(prev.x, prev.y, curr.x, curr.y))
        }

        return entries.ifEmpty { null }
    }

    /**
     * Diff stats (health, mana).
     */
    private fun diffStats(prev: SnapshotState?, curr: SnapshotState?): List<DiffEntry> {
        val entries = mutableListOf<DiffEntry>()

        // Health
        if (prev?.health != curr?.health && prev?.health != null && curr?.health != null) {
            entries.add(DiffEntry.healthChanged(prev.health, curr.health))
        }

        // Mana
        if (prev?.mana != curr?.mana && prev?.mana != null && curr?.mana != null) {
            entries.add(DiffEntry.manaChanged(prev.mana, curr.mana))
        }

        return entries
    }

    /**
     * Diff status effects.
     */
    private fun diffStatusEffects(
        prev: Map<String, Any>?,
        curr: Map<String, Any>?
    ): List<DiffEntry> {
        val prevEffects = prev ?: emptyMap()
        val currEffects = curr ?: emptyMap()

        val allKeys = (prevEffects.keys + currEffects.keys).sorted()
        val entries = mutableListOf<DiffEntry>()

        for (key in allKeys) {
            val hadEffect = prevEffects.containsKey(key)
            val hasEffect = currEffects.containsKey(key)

            when {
                !hadEffect && hasEffect -> {
                    val duration = (currEffects[key] as? Int)
                    entries.add(DiffEntry.statusAdded(key, duration))
                }
                hadEffect && !hasEffect -> {
                    entries.add(DiffEntry.statusRemoved(key))
                }
            }
        }

        return entries
    }

    /**
     * Build diff from inventory item ID sets (simple version).
     *
     * Use when you only have item IDs, not full InventoryItem data.
     */
    fun diffItemIds(
        prev: Set<String>?,
        curr: Set<String>?,
        itemNameResolver: (String) -> String = { it }
    ): List<DiffEntry> {
        val prevIds = prev ?: emptySet()
        val currIds = curr ?: emptySet()

        val added = (currIds - prevIds).sorted()
        val removed = (prevIds - currIds).sorted()

        val entries = mutableListOf<DiffEntry>()

        for (id in added) {
            entries.add(DiffEntry.itemAdded(
                itemId = id,
                itemName = itemNameResolver(id)
            ))
        }

        for (id in removed) {
            entries.add(DiffEntry.itemRemoved(
                itemId = id,
                itemName = itemNameResolver(id)
            ))
        }

        return entries
    }
}
