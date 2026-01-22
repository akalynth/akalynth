package com.akalynth.client.snapshot

import com.akalynth.client.explain.ExplainContext
import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for SnapshotEvidenceAdapter (PR 6B-3a).
 *
 * Test cases:
 * 1. both snapshots → sequence transition + delta
 * 2. only current snapshot → only current fields
 * 3. inventory delta removed/add computed + sorted
 * 4. no inventory keys → inventoryDelta null
 * 5. prev == curr → zero delta, empty lists
 */
class SnapshotEvidenceAdapterTest {

    // =========================================================================
    // 1. Both snapshots → sequence transition + delta
    // =========================================================================

    @Test
    fun `both snapshots produces sequence transition`() {
        val prev = SnapshotV0(sequence = 418, stateHash = "hash_418")
        val curr = SnapshotV0(sequence = 419, stateHash = "hash_419")

        val evidence = SnapshotEvidenceAdapter.build(prev, curr)

        assertEquals(418L, evidence.prevSequence)
        assertEquals(419L, evidence.sequence)
        assertEquals("hash_418", evidence.prevStateHash)
        assertEquals("hash_419", evidence.stateHash)
        assertEquals(1L, evidence.sequenceDelta)
        assertEquals("418 → 419", evidence.stateTransition)
        assertTrue(evidence.hasTransition)
        assertTrue(evidence.hasEvidence)
    }

    @Test
    fun `sequence delta computed correctly`() {
        val prev = SnapshotV0(sequence = 100, stateHash = "h100")
        val curr = SnapshotV0(sequence = 150, stateHash = "h150")

        val evidence = SnapshotEvidenceAdapter.build(prev, curr)

        assertEquals(50L, evidence.sequenceDelta)
    }

    // =========================================================================
    // 2. Only current snapshot → only current fields
    // =========================================================================

    @Test
    fun `only current snapshot produces current fields only`() {
        val curr = SnapshotV0(sequence = 500, stateHash = "hash_500")

        val evidence = SnapshotEvidenceAdapter.build(null, curr)

        assertNull(evidence.prevSequence)
        assertEquals(500L, evidence.sequence)
        assertNull(evidence.prevStateHash)
        assertEquals("hash_500", evidence.stateHash)
        assertNull(evidence.sequenceDelta)
        assertNull(evidence.stateTransition)
        assertFalse(evidence.hasTransition)
        assertTrue(evidence.hasEvidence)
    }

    @Test
    fun `only prev snapshot produces prev fields only`() {
        val prev = SnapshotV0(sequence = 100, stateHash = "hash_100")

        val evidence = SnapshotEvidenceAdapter.build(prev, null)

        assertEquals(100L, evidence.prevSequence)
        assertNull(evidence.sequence)
        assertEquals("hash_100", evidence.prevStateHash)
        assertNull(evidence.stateHash)
        assertNull(evidence.sequenceDelta)
        assertNull(evidence.stateTransition)
        assertFalse(evidence.hasTransition)
        assertTrue(evidence.hasEvidence)
    }

    @Test
    fun `no snapshots produces empty evidence`() {
        val evidence = SnapshotEvidenceAdapter.build(null, null)

        assertEquals(SnapshotEvidence.EMPTY, evidence)
        assertFalse(evidence.hasTransition)
        assertFalse(evidence.hasEvidence)
    }

    // =========================================================================
    // 3. Inventory delta removed/add computed + sorted
    // =========================================================================

    @Test
    fun `inventory delta computed correctly`() {
        val prev = SnapshotV0(sequence = 1, stateHash = "h1")
        val curr = SnapshotV0(sequence = 2, stateHash = "h2")
        val prevItems = setOf("sword_1", "shield_2", "potion_3")
        val currItems = setOf("shield_2", "helmet_4")

        val evidence = SnapshotEvidenceAdapter.build(
            playerId = "player_1",
            prev = prev,
            curr = curr,
            prevInventoryItemIds = prevItems,
            currInventoryItemIds = currItems
        )

        assertNotNull(evidence.inventoryDelta)
        val delta = evidence.inventoryDelta!!

        assertEquals("player_1", delta.playerId)
        // Removed: sword_1, potion_3 (sorted alphabetically)
        assertEquals(listOf("potion_3", "sword_1"), delta.removedItemIds)
        // Added: helmet_4
        assertEquals(listOf("helmet_4"), delta.addedItemIds)
        assertTrue(delta.hasChanges)
        assertEquals(-1, delta.netChange) // Lost 2, gained 1
    }

    @Test
    fun `inventory delta items are sorted for determinism`() {
        val prevItems = setOf("z_item", "a_item", "m_item")
        val currItems = setOf("b_item", "y_item")

        val delta = SnapshotEvidenceAdapter.computeInventoryDelta(
            playerId = "player",
            prevItems = prevItems,
            currItems = currItems
        )!!

        // Verify sorted order
        assertEquals(listOf("a_item", "m_item", "z_item"), delta.removedItemIds)
        assertEquals(listOf("b_item", "y_item"), delta.addedItemIds)
    }

    // =========================================================================
    // 4. No inventory keys → inventoryDelta null
    // =========================================================================

    @Test
    fun `no inventory data produces null inventoryDelta`() {
        val prev = SnapshotV0(sequence = 1, stateHash = "h1")
        val curr = SnapshotV0(sequence = 2, stateHash = "h2")

        val evidence = SnapshotEvidenceAdapter.build(prev, curr)

        assertNull(evidence.inventoryDelta)
    }

    @Test
    fun `null inventory sets produces null delta`() {
        val delta = SnapshotEvidenceAdapter.computeInventoryDelta(
            playerId = "player",
            prevItems = null,
            currItems = null
        )

        assertNull(delta)
    }

    @Test
    fun `only prev inventory produces delta with removed`() {
        val delta = SnapshotEvidenceAdapter.computeInventoryDelta(
            playerId = "player",
            prevItems = setOf("sword", "shield"),
            currItems = null
        )!!

        assertEquals(listOf("shield", "sword"), delta.removedItemIds)
        assertTrue(delta.addedItemIds.isEmpty())
    }

    @Test
    fun `only curr inventory produces delta with added`() {
        val delta = SnapshotEvidenceAdapter.computeInventoryDelta(
            playerId = "player",
            prevItems = null,
            currItems = setOf("sword", "shield")
        )!!

        assertTrue(delta.removedItemIds.isEmpty())
        assertEquals(listOf("shield", "sword"), delta.addedItemIds)
    }

    // =========================================================================
    // 5. prev == curr → zero delta, empty lists
    // =========================================================================

    @Test
    fun `same snapshots produce zero delta`() {
        val snapshot = SnapshotV0(sequence = 100, stateHash = "hash_100")

        val evidence = SnapshotEvidenceAdapter.build(snapshot, snapshot)

        assertEquals(0L, evidence.sequenceDelta)
        assertEquals("100 → 100", evidence.stateTransition)
    }

    @Test
    fun `same inventory produces empty delta lists`() {
        val items = setOf("sword", "shield", "potion")

        val delta = SnapshotEvidenceAdapter.computeInventoryDelta(
            playerId = "player",
            prevItems = items,
            currItems = items
        )!!

        assertTrue(delta.removedItemIds.isEmpty())
        assertTrue(delta.addedItemIds.isEmpty())
        assertFalse(delta.hasChanges)
        assertEquals(0, delta.netChange)
    }

    // =========================================================================
    // Convenience methods
    // =========================================================================

    @Test
    fun `fromContext builds evidence from ExplainContext`() {
        val ctx = ExplainContext.forTest(
            prevSnapshot = SnapshotV0(sequence = 10, stateHash = "h10"),
            snapshot = SnapshotV0(sequence = 11, stateHash = "h11")
        )

        val evidence = SnapshotEvidenceAdapter.fromContext(ctx)

        assertEquals(10L, evidence.prevSequence)
        assertEquals(11L, evidence.sequence)
        assertEquals("10 → 11", evidence.stateTransition)
    }

    @Test
    fun `toDetailsMap produces correct map`() {
        val evidence = SnapshotEvidence(
            prevSequence = 100,
            sequence = 101,
            prevStateHash = "hash_100",
            stateHash = "hash_101",
            sequenceDelta = 1,
            stateTransition = "100 → 101",
            inventoryDelta = InventoryDelta(
                playerId = "player",
                removedItemIds = listOf("sword"),
                addedItemIds = listOf("helmet")
            )
        )

        val map = evidence.toDetailsMap()

        assertEquals(101L, map["snapshot_sequence"])
        assertEquals("hash_101", map["snapshot_hash"])
        assertEquals(100L, map["prev_snapshot_sequence"])
        assertEquals("hash_100", map["prev_snapshot_hash"])
        assertEquals(1L, map["sequence_delta"])
        assertEquals("100 → 101", map["sequence_transition"])
        assertEquals(listOf("sword"), map["items_removed"])
        assertEquals(listOf("helmet"), map["items_added"])
    }

    @Test
    fun `toEvidenceRefs produces correct refs`() {
        val evidence = SnapshotEvidence(
            sequence = 500,
            stateHash = "hash_500"
        )

        val refs = evidence.toEvidenceRefs()

        assertTrue(refs.contains("snapshot:500"))
        assertTrue(refs.contains("state:hash_500"))
    }
}
