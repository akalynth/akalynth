package com.akalynth.client.snapshot.diff

/**
 * Individual change entry in a snapshot diff.
 *
 * Represents a single state change with before/after values and metadata.
 *
 * @property key Unique identifier for this entry within its category (e.g., item ID)
 * @property category Category of change (inventory, stats, etc.)
 * @property changeType Type of change (added, removed, modified)
 * @property prevValue Value before the change (null if added)
 * @property currValue Value after the change (null if removed)
 * @property description Human-readable description of the change
 * @property metadata Additional context (item name, rarity, etc.)
 */
data class DiffEntry(
    val key: String,
    val category: DiffCategory,
    val changeType: ChangeType,
    val prevValue: Any? = null,
    val currValue: Any? = null,
    val description: String,
    val metadata: Map<String, Any?> = emptyMap()
) {
    /**
     * Format as human-readable text.
     */
    fun toText(): String = buildString {
        append("[${changeType.symbol}] ")
        append(description)
        if (changeType == ChangeType.MODIFIED && prevValue != null && currValue != null) {
            append(" ($prevValue → $currValue)")
        }
    }

    /**
     * Get metadata value by key.
     */
    @Suppress("UNCHECKED_CAST")
    fun <T> meta(key: String): T? = metadata[key] as? T

    companion object {
        // =====================================================================
        // Inventory entries
        // =====================================================================

        /**
         * Create an entry for an added item.
         */
        fun itemAdded(
            itemId: String,
            itemName: String,
            rarity: String? = null,
            quantity: Int = 1
        ) = DiffEntry(
            key = itemId,
            category = DiffCategory.INVENTORY,
            changeType = ChangeType.ADDED,
            prevValue = null,
            currValue = quantity,
            description = if (quantity > 1) "$itemName x$quantity" else itemName,
            metadata = buildMap {
                put("item_id", itemId)
                put("item_name", itemName)
                rarity?.let { put("rarity", it) }
                put("quantity", quantity)
            }
        )

        /**
         * Create an entry for a removed item.
         */
        fun itemRemoved(
            itemId: String,
            itemName: String,
            rarity: String? = null,
            quantity: Int = 1
        ) = DiffEntry(
            key = itemId,
            category = DiffCategory.INVENTORY,
            changeType = ChangeType.REMOVED,
            prevValue = quantity,
            currValue = null,
            description = if (quantity > 1) "$itemName x$quantity" else itemName,
            metadata = buildMap {
                put("item_id", itemId)
                put("item_name", itemName)
                rarity?.let { put("rarity", it) }
                put("quantity", quantity)
            }
        )

        /**
         * Create an entry for a quantity change.
         */
        fun itemQuantityChanged(
            itemId: String,
            itemName: String,
            prevQuantity: Int,
            currQuantity: Int,
            rarity: String? = null
        ) = DiffEntry(
            key = itemId,
            category = DiffCategory.INVENTORY,
            changeType = ChangeType.MODIFIED,
            prevValue = prevQuantity,
            currValue = currQuantity,
            description = itemName,
            metadata = buildMap {
                put("item_id", itemId)
                put("item_name", itemName)
                rarity?.let { put("rarity", it) }
                put("delta", currQuantity - prevQuantity)
            }
        )

        // =====================================================================
        // Currency entries
        // =====================================================================

        /**
         * Create an entry for gold change.
         */
        fun goldChanged(
            prevGold: Long,
            currGold: Long
        ): DiffEntry {
            val delta = currGold - prevGold
            val changeType = when {
                delta > 0 -> ChangeType.ADDED
                delta < 0 -> ChangeType.REMOVED
                else -> ChangeType.UNCHANGED
            }
            return DiffEntry(
                key = "gold",
                category = DiffCategory.CURRENCY,
                changeType = changeType,
                prevValue = prevGold,
                currValue = currGold,
                description = "Gold: ${if (delta >= 0) "+$delta" else delta}",
                metadata = mapOf("delta" to delta)
            )
        }

        // =====================================================================
        // Stats entries
        // =====================================================================

        /**
         * Create an entry for a stat change.
         */
        fun statChanged(
            statName: String,
            prevValue: Any,
            currValue: Any
        ) = DiffEntry(
            key = statName.lowercase().replace(" ", "_"),
            category = DiffCategory.STATS,
            changeType = ChangeType.MODIFIED,
            prevValue = prevValue,
            currValue = currValue,
            description = statName,
            metadata = emptyMap()
        )

        /**
         * Create an entry for health change.
         */
        fun healthChanged(prevHp: Int, currHp: Int) = statChanged("Health", prevHp, currHp)

        /**
         * Create an entry for mana change.
         */
        fun manaChanged(prevMana: Int, currMana: Int) = statChanged("Mana", prevMana, currMana)

        // =====================================================================
        // Position entries
        // =====================================================================

        /**
         * Create an entry for zone change.
         */
        fun zoneChanged(
            prevZone: String?,
            currZone: String
        ) = DiffEntry(
            key = "zone",
            category = DiffCategory.POSITION,
            changeType = if (prevZone == null) ChangeType.ADDED else ChangeType.MODIFIED,
            prevValue = prevZone,
            currValue = currZone,
            description = if (prevZone != null) "Zone: $prevZone → $currZone" else "Entered $currZone",
            metadata = mapOf(
                "prev_zone" to prevZone,
                "curr_zone" to currZone
            )
        )

        /**
         * Create an entry for position change.
         */
        fun positionChanged(
            prevX: Int, prevY: Int,
            currX: Int, currY: Int
        ) = DiffEntry(
            key = "position",
            category = DiffCategory.POSITION,
            changeType = ChangeType.MODIFIED,
            prevValue = "$prevX,$prevY",
            currValue = "$currX,$currY",
            description = "Position: ($prevX,$prevY) → ($currX,$currY)",
            metadata = mapOf(
                "prev_x" to prevX, "prev_y" to prevY,
                "curr_x" to currX, "curr_y" to currY
            )
        )

        // =====================================================================
        // Status effect entries
        // =====================================================================

        /**
         * Create an entry for status effect added.
         */
        fun statusAdded(
            effectName: String,
            duration: Int? = null
        ) = DiffEntry(
            key = effectName.lowercase().replace(" ", "_"),
            category = DiffCategory.STATUS,
            changeType = ChangeType.ADDED,
            prevValue = null,
            currValue = duration ?: true,
            description = effectName + (duration?.let { " (${it}s)" } ?: ""),
            metadata = buildMap {
                put("effect_name", effectName)
                duration?.let { put("duration", it) }
            }
        )

        /**
         * Create an entry for status effect removed.
         */
        fun statusRemoved(effectName: String) = DiffEntry(
            key = effectName.lowercase().replace(" ", "_"),
            category = DiffCategory.STATUS,
            changeType = ChangeType.REMOVED,
            prevValue = true,
            currValue = null,
            description = effectName,
            metadata = mapOf("effect_name" to effectName)
        )

        // =====================================================================
        // Meta entries
        // =====================================================================

        /**
         * Create an entry for state hash change.
         */
        fun hashChanged(
            prevHash: String,
            currHash: String
        ) = DiffEntry(
            key = "state_hash",
            category = DiffCategory.META,
            changeType = ChangeType.MODIFIED,
            prevValue = prevHash.take(8) + "...",
            currValue = currHash.take(8) + "...",
            description = "State hash changed",
            metadata = mapOf(
                "prev_hash" to prevHash,
                "curr_hash" to currHash
            )
        )
    }
}
