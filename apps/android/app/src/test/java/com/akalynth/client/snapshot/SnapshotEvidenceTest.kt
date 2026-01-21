package com.akalynth.client.snapshot

import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for SnapshotEvidence and InventoryDelta data classes.
 */
class SnapshotEvidenceTest {

    // =========================================================================
    // SnapshotEvidence
    // =========================================================================

    @Test
    fun `hasTransition true when both sequences present`() {
        val evidence = SnapshotEvidence(
            prevSequence = 1,
            sequence = 2
        )

        assertTrue(evidence.hasTransition)
    }

    @Test
    fun `hasTransition false when only current present`() {
        val evidence = SnapshotEvidence(sequence = 1)

        assertFalse(evidence.hasTransition)
    }

    @Test
    fun `hasEvidence true when any sequence present`() {
        assertTrue(SnapshotEvidence(sequence = 1).hasEvidence)
        assertTrue(SnapshotEvidence(prevSequence = 1).hasEvidence)
        assertTrue(SnapshotEvidence(prevSequence = 1, sequence = 2).hasEvidence)
    }

    @Test
    fun `hasEvidence false when empty`() {
        assertFalse(SnapshotEvidence.EMPTY.hasEvidence)
    }

    @Test
    fun `toDetailsMap omits null values`() {
        val evidence = SnapshotEvidence(sequence = 100, stateHash = "hash")
        val map = evidence.toDetailsMap()

        assertTrue(map.containsKey("snapshot_sequence"))
        assertTrue(map.containsKey("snapshot_hash"))
        assertFalse(map.containsKey("prev_snapshot_sequence"))
        assertFalse(map.containsKey("sequence_delta"))
    }

    @Test
    fun `toDetailsMap omits empty inventory changes`() {
        val evidence = SnapshotEvidence(
            sequence = 100,
            inventoryDelta = InventoryDelta(
                playerId = "player",
                removedItemIds = emptyList(),
                addedItemIds = emptyList()
            )
        )
        val map = evidence.toDetailsMap()

        assertFalse(map.containsKey("items_removed"))
        assertFalse(map.containsKey("items_added"))
    }

    // =========================================================================
    // InventoryDelta
    // =========================================================================

    @Test
    fun `hasChanges true when items removed`() {
        val delta = InventoryDelta(
            playerId = "player",
            removedItemIds = listOf("sword")
        )

        assertTrue(delta.hasChanges)
    }

    @Test
    fun `hasChanges true when items added`() {
        val delta = InventoryDelta(
            playerId = "player",
            addedItemIds = listOf("helmet")
        )

        assertTrue(delta.hasChanges)
    }

    @Test
    fun `hasChanges false when no changes`() {
        val delta = InventoryDelta(playerId = "player")

        assertFalse(delta.hasChanges)
    }

    @Test
    fun `netChange computed correctly`() {
        val delta = InventoryDelta(
            playerId = "player",
            removedItemIds = listOf("a", "b", "c"), // -3
            addedItemIds = listOf("x") // +1
        )

        assertEquals(-2, delta.netChange)
    }

    @Test
    fun `netChange positive when more added`() {
        val delta = InventoryDelta(
            playerId = "player",
            removedItemIds = listOf("a"),
            addedItemIds = listOf("x", "y", "z")
        )

        assertEquals(2, delta.netChange)
    }
}
