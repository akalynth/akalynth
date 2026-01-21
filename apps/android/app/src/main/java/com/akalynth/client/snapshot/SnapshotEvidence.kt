package com.akalynth.client.snapshot

/**
 * Structured evidence derived from snapshot(s).
 *
 * This is the standardized "evidence packet" that explanations cite.
 * It does not interpret meaning - just reports facts about state transitions.
 *
 * @property prevSequence Previous snapshot sequence (null if no previous)
 * @property sequence Current snapshot sequence (null if no current)
 * @property prevStateHash Previous state hash (null if no previous)
 * @property stateHash Current state hash (null if no current)
 * @property sequenceDelta Difference in sequence numbers (null if either missing)
 * @property stateTransition Formatted transition "N → M" (null if either missing)
 * @property inventoryDelta Optional inventory changes (null if not tracking inventory)
 */
data class SnapshotEvidence(
    val prevSequence: Long? = null,
    val sequence: Long? = null,
    val prevStateHash: String? = null,
    val stateHash: String? = null,
    val sequenceDelta: Long? = null,
    val stateTransition: String? = null,
    val inventoryDelta: InventoryDelta? = null
) {
    /**
     * True if we have both prev and current snapshot.
     */
    val hasTransition: Boolean
        get() = prevSequence != null && sequence != null

    /**
     * True if we have any snapshot evidence at all.
     */
    val hasEvidence: Boolean
        get() = sequence != null || prevSequence != null

    /**
     * Convert to a map suitable for Explanation.details.
     */
    fun toDetailsMap(): Map<String, Any?> = buildMap {
        sequence?.let { put("snapshot_sequence", it) }
        stateHash?.let { put("snapshot_hash", it) }
        prevSequence?.let { put("prev_snapshot_sequence", it) }
        prevStateHash?.let { put("prev_snapshot_hash", it) }
        sequenceDelta?.let { put("sequence_delta", it) }
        stateTransition?.let { put("sequence_transition", it) }
        inventoryDelta?.let { delta ->
            if (delta.removedItemIds.isNotEmpty()) {
                put("items_removed", delta.removedItemIds)
            }
            if (delta.addedItemIds.isNotEmpty()) {
                put("items_added", delta.addedItemIds)
            }
        }
    }

    /**
     * Convert to evidence refs suitable for Explanation.evidenceRefs.
     */
    fun toEvidenceRefs(): List<String> = buildList {
        sequence?.let { add("snapshot:$it") }
        stateHash?.let { add("state:$it") }
    }

    companion object {
        /**
         * Empty evidence (no snapshots).
         */
        val EMPTY = SnapshotEvidence()
    }
}

/**
 * Inventory changes between snapshots.
 *
 * All item ID lists are sorted for deterministic comparison.
 *
 * @property playerId Player whose inventory changed
 * @property removedItemIds Items no longer in inventory (sorted)
 * @property addedItemIds Items newly in inventory (sorted)
 */
data class InventoryDelta(
    val playerId: String,
    val removedItemIds: List<String> = emptyList(),
    val addedItemIds: List<String> = emptyList()
) {
    /**
     * True if there were any inventory changes.
     */
    val hasChanges: Boolean
        get() = removedItemIds.isNotEmpty() || addedItemIds.isNotEmpty()

    /**
     * Net change in item count.
     */
    val netChange: Int
        get() = addedItemIds.size - removedItemIds.size
}
