package com.akalynth.client.snapshot

/**
 * Adapter that builds structured evidence from snapshots.
 *
 * Contract:
 * - No guessing: if prevSnapshot absent, emit only current metadata
 * - No mutation: pure function
 * - Deterministic ordering: item IDs sorted for stable diffs
 * - No deep domain interpretation: reports changes, rule engine decides meaning
 */
object SnapshotEvidenceAdapter {

    /**
     * Build evidence from snapshots.
     *
     * @param prev Previous snapshot (null if none)
     * @param curr Current snapshot (null if none)
     * @return Structured evidence
     */
    fun build(
        prev: SnapshotV0?,
        curr: SnapshotV0?
    ): SnapshotEvidence {
        if (prev == null && curr == null) {
            return SnapshotEvidence.EMPTY
        }

        val sequenceDelta = if (prev != null && curr != null) {
            curr.sequence - prev.sequence
        } else null

        val stateTransition = if (prev != null && curr != null) {
            "${prev.sequence} → ${curr.sequence}"
        } else null

        return SnapshotEvidence(
            prevSequence = prev?.sequence,
            sequence = curr?.sequence,
            prevStateHash = prev?.stateHash,
            stateHash = curr?.stateHash,
            sequenceDelta = sequenceDelta,
            stateTransition = stateTransition,
            inventoryDelta = null // No inventory without item IDs
        )
    }

    /**
     * Build evidence from snapshots with inventory tracking.
     *
     * @param playerId Player whose inventory to track
     * @param prev Previous snapshot (null if none)
     * @param curr Current snapshot (null if none)
     * @param prevInventoryItemIds Item IDs in inventory before (null if unknown)
     * @param currInventoryItemIds Item IDs in inventory after (null if unknown)
     * @return Structured evidence with inventory delta
     */
    fun build(
        playerId: String,
        prev: SnapshotV0?,
        curr: SnapshotV0?,
        prevInventoryItemIds: Set<String>?,
        currInventoryItemIds: Set<String>?
    ): SnapshotEvidence {
        val base = build(prev, curr)

        val inventoryDelta = computeInventoryDelta(
            playerId = playerId,
            prevItems = prevInventoryItemIds,
            currItems = currInventoryItemIds
        )

        return base.copy(inventoryDelta = inventoryDelta)
    }

    /**
     * Compute inventory delta between two item sets.
     *
     * @param playerId Player whose inventory changed
     * @param prevItems Items before (null if unknown)
     * @param currItems Items after (null if unknown)
     * @return InventoryDelta or null if neither set is known
     */
    fun computeInventoryDelta(
        playerId: String,
        prevItems: Set<String>?,
        currItems: Set<String>?
    ): InventoryDelta? {
        // Need at least one known state
        if (prevItems == null && currItems == null) {
            return null
        }

        val prev = prevItems ?: emptySet()
        val curr = currItems ?: emptySet()

        // Removed = items in prev but not in curr
        val removed = (prev - curr).sorted()

        // Added = items in curr but not in prev
        val added = (curr - prev).sorted()

        // If both empty and we had some data, return empty delta (no changes)
        // If no actual changes, still return the delta to show we checked
        return InventoryDelta(
            playerId = playerId,
            removedItemIds = removed,
            addedItemIds = added
        )
    }

    /**
     * Build evidence from ExplainContext (convenience method).
     *
     * @param ctx ExplainContext with optional snapshots
     * @return Structured evidence
     */
    fun fromContext(ctx: com.akalynth.client.explain.ExplainContext): SnapshotEvidence {
        return build(ctx.prevSnapshot, ctx.snapshot)
    }

    /**
     * Build evidence from ExplainContext with inventory tracking.
     *
     * @param ctx ExplainContext with optional snapshots
     * @param playerId Player whose inventory to track
     * @param prevInventoryItemIds Item IDs before
     * @param currInventoryItemIds Item IDs after
     * @return Structured evidence with inventory delta
     */
    fun fromContext(
        ctx: com.akalynth.client.explain.ExplainContext,
        playerId: String,
        prevInventoryItemIds: Set<String>?,
        currInventoryItemIds: Set<String>?
    ): SnapshotEvidence {
        return build(
            playerId = playerId,
            prev = ctx.prevSnapshot,
            curr = ctx.snapshot,
            prevInventoryItemIds = prevInventoryItemIds,
            currInventoryItemIds = currInventoryItemIds
        )
    }
}
