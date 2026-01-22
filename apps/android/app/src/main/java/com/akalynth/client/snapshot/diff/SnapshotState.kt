package com.akalynth.client.snapshot.diff

import com.akalynth.client.snapshot.SnapshotV0

/**
 * Rich snapshot state for diffing.
 *
 * Extends SnapshotV0 with full state data that can be diffed.
 * This is the "expanded" form of a snapshot with all diffable fields.
 *
 * @property base The base SnapshotV0 (sequence + hash)
 * @property inventory Map of item ID → InventoryItem
 * @property gold Current gold amount
 * @property zone Current zone name
 * @property x Current X position
 * @property y Current Y position
 * @property health Current health
 * @property maxHealth Maximum health
 * @property mana Current mana
 * @property maxMana Maximum mana
 * @property statusEffects Active status effects (effect name → remaining duration or true)
 */
data class SnapshotState(
    val base: SnapshotV0,
    val inventory: Map<String, InventoryItem> = emptyMap(),
    val gold: Long = 0,
    val zone: String? = null,
    val x: Int? = null,
    val y: Int? = null,
    val health: Int? = null,
    val maxHealth: Int? = null,
    val mana: Int? = null,
    val maxMana: Int? = null,
    val statusEffects: Map<String, Any> = emptyMap()
) {
    val sequence: Long get() = base.sequence
    val stateHash: String get() = base.stateHash

    /**
     * Get inventory item IDs.
     */
    val inventoryItemIds: Set<String> get() = inventory.keys

    companion object {
        /**
         * Create from just a SnapshotV0 (minimal state).
         */
        fun fromBase(base: SnapshotV0) = SnapshotState(base = base)

        /**
         * Create for testing.
         */
        fun forTest(
            sequence: Long = 1,
            stateHash: String = "hash_test",
            inventory: Map<String, InventoryItem> = emptyMap(),
            gold: Long = 0,
            zone: String? = null,
            x: Int? = null,
            y: Int? = null
        ) = SnapshotState(
            base = SnapshotV0(sequence, stateHash),
            inventory = inventory,
            gold = gold,
            zone = zone,
            x = x,
            y = y
        )
    }
}

/**
 * Item in inventory for diffing.
 */
data class InventoryItem(
    val itemId: String,
    val itemName: String,
    val quantity: Int = 1,
    val rarity: String? = null
) {
    companion object {
        fun create(
            itemId: String,
            itemName: String,
            quantity: Int = 1,
            rarity: String? = null
        ) = InventoryItem(itemId, itemName, quantity, rarity)
    }
}
