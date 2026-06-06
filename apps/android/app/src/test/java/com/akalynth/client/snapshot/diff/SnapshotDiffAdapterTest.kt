package com.akalynth.client.snapshot.diff

import com.akalynth.client.snapshot.SnapshotV0
import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for SnapshotDiffAdapter (PR 6C-3).
 *
 * Test groups:
 * 1. Empty/no-op diffs
 * 2. Inventory add/remove
 * 3. Multi-entity diffs
 * 4. Gold/stats/position diffs
 * 5. Text output
 */
class SnapshotDiffAdapterTest {

    // =========================================================================
    // 1. Empty/no-op diffs
    // =========================================================================

    @Test
    fun `null snapshots produce empty diff`() {
        val diff = SnapshotDiffAdapter.diff(null as SnapshotV0?, null)

        assertEquals(SnapshotDiff.EMPTY, diff)
        assertFalse(diff.hasChanges)
        assertFalse(diff.isTransition)
    }

    @Test
    fun `same snapshot produces no-op diff`() {
        val snapshot = SnapshotV0(sequence = 1, stateHash = "hash_1")
        val diff = SnapshotDiffAdapter.diff(snapshot, snapshot)

        assertFalse(diff.hasChanges)
        assertEquals(1L, diff.prevSequence)
        assertEquals(1L, diff.currSequence)
    }

    @Test
    fun `same rich state produces no-op diff`() {
        val state = SnapshotState.forTest(
            sequence = 1,
            stateHash = "hash_1",
            gold = 100,
            zone = "Rookguard"
        )

        val diff = SnapshotDiffAdapter.diff(state, state)

        assertFalse(diff.hasChanges)
        assertEquals(0, diff.summary.totalChanges)
    }

    @Test
    fun `only current snapshot has no transition`() {
        val curr = SnapshotV0(sequence = 1, stateHash = "hash_1")
        val diff = SnapshotDiffAdapter.diff(null, curr)

        assertFalse(diff.isTransition)
        assertNull(diff.prevSequence)
        assertEquals(1L, diff.currSequence)
    }

    // =========================================================================
    // 2. Inventory add/remove
    // =========================================================================

    @Test
    fun `added items detected`() {
        val prev = SnapshotState.forTest(sequence = 1, stateHash = "h1")
        val curr = SnapshotState.forTest(
            sequence = 2,
            stateHash = "h2",
            inventory = mapOf(
                "sword_1" to InventoryItem("sword_1", "Iron Sword"),
                "shield_1" to InventoryItem("shield_1", "Wooden Shield")
            )
        )

        val diff = SnapshotDiffAdapter.diff(prev, curr)

        assertEquals(2, diff.added.size)
        assertTrue(diff.added.any { it.key == "sword_1" })
        assertTrue(diff.added.any { it.key == "shield_1" })
    }

    @Test
    fun `removed items detected`() {
        val prev = SnapshotState.forTest(
            sequence = 1,
            stateHash = "h1",
            inventory = mapOf(
                "sword_1" to InventoryItem("sword_1", "Iron Sword"),
                "potion_1" to InventoryItem("potion_1", "Health Potion")
            )
        )
        val curr = SnapshotState.forTest(sequence = 2, stateHash = "h2")

        val diff = SnapshotDiffAdapter.diff(prev, curr)

        assertEquals(2, diff.removed.size)
        assertTrue(diff.removed.any { it.key == "sword_1" })
        assertTrue(diff.removed.any { it.key == "potion_1" })
    }

    @Test
    fun `quantity changes detected`() {
        val prev = SnapshotState.forTest(
            sequence = 1,
            stateHash = "h1",
            inventory = mapOf(
                "potion_1" to InventoryItem("potion_1", "Health Potion", quantity = 5)
            )
        )
        val curr = SnapshotState.forTest(
            sequence = 2,
            stateHash = "h2",
            inventory = mapOf(
                "potion_1" to InventoryItem("potion_1", "Health Potion", quantity = 3)
            )
        )

        val diff = SnapshotDiffAdapter.diff(prev, curr)

        val inventoryModified = diff.modified.filter { it.category == DiffCategory.INVENTORY }
        assertEquals(1, inventoryModified.size)
        val entry = inventoryModified.first()
        assertEquals("potion_1", entry.key)
        assertEquals(5, entry.prevValue)
        assertEquals(3, entry.currValue)
    }

    @Test
    fun `inventory diff items sorted alphabetically`() {
        val diff = SnapshotDiffAdapter.diffInventory(
            prev = emptyMap(),
            curr = mapOf(
                "z_item" to InventoryItem("z_item", "Z Item"),
                "a_item" to InventoryItem("a_item", "A Item"),
                "m_item" to InventoryItem("m_item", "M Item")
            )
        )

        val keys = diff.map { it.key }
        assertEquals(listOf("a_item", "m_item", "z_item"), keys)
    }

    // =========================================================================
    // 3. Multi-entity diffs
    // =========================================================================

    @Test
    fun `complex diff with multiple categories`() {
        val prev = SnapshotState(
            base = SnapshotV0(sequence = 100, stateHash = "hash_100"),
            inventory = mapOf(
                "sword_1" to InventoryItem("sword_1", "Iron Sword")
            ),
            gold = 500,
            zone = "Rookguard",
            x = 10,
            y = 20,
            health = 100,
            mana = 50
        )

        val curr = SnapshotState(
            base = SnapshotV0(sequence = 101, stateHash = "hash_101"),
            inventory = mapOf(
                "helmet_1" to InventoryItem("helmet_1", "Iron Helmet")
            ),
            gold = 450,
            zone = "Azura",
            x = 32,
            y = 32,
            health = 80,
            mana = 50
        )

        val diff = SnapshotDiffAdapter.diff(prev, curr)

        // Should have changes in multiple categories
        assertTrue(diff.hasChanges)
        assertTrue(diff.entriesByCategory(DiffCategory.INVENTORY).isNotEmpty())
        assertTrue(diff.entriesByCategory(DiffCategory.CURRENCY).isNotEmpty())
        assertTrue(diff.entriesByCategory(DiffCategory.POSITION).isNotEmpty())
        assertTrue(diff.entriesByCategory(DiffCategory.STATS).isNotEmpty())
        assertTrue(diff.entriesByCategory(DiffCategory.META).isNotEmpty())

        // Check specific changes
        assertEquals(1, diff.added.filter { it.category == DiffCategory.INVENTORY }.size) // helmet
        assertEquals(1, diff.removed.filter { it.category == DiffCategory.INVENTORY }.size) // sword
    }

    @Test
    fun `summary counts categories correctly`() {
        val prev = SnapshotState.forTest(
            sequence = 1,
            stateHash = "h1",
            inventory = mapOf("sword" to InventoryItem("sword", "Sword"))
        )
        val curr = SnapshotState.forTest(
            sequence = 2,
            stateHash = "h2",
            inventory = mapOf("helmet" to InventoryItem("helmet", "Helmet")),
            gold = 100
        )

        val diff = SnapshotDiffAdapter.diff(prev, curr)

        // 1 removed (sword), 1 added (helmet), 1 added (gold), 1 modified (hash)
        assertTrue(diff.summary.addedCount >= 1)
        assertTrue(diff.summary.removedCount >= 1)
    }

    // =========================================================================
    // 4. Gold/stats/position diffs
    // =========================================================================

    @Test
    fun `gold increase detected`() {
        val prev = SnapshotState.forTest(sequence = 1, stateHash = "h1", gold = 100)
        val curr = SnapshotState.forTest(sequence = 2, stateHash = "h2", gold = 150)

        val diff = SnapshotDiffAdapter.diff(prev, curr)
        val goldEntry = diff.entriesByCategory(DiffCategory.CURRENCY).first()

        assertEquals(ChangeType.ADDED, goldEntry.changeType) // Positive change
        assertEquals(100L, goldEntry.prevValue)
        assertEquals(150L, goldEntry.currValue)
    }

    @Test
    fun `gold decrease detected`() {
        val prev = SnapshotState.forTest(sequence = 1, stateHash = "h1", gold = 100)
        val curr = SnapshotState.forTest(sequence = 2, stateHash = "h2", gold = 50)

        val diff = SnapshotDiffAdapter.diff(prev, curr)
        val goldEntry = diff.entriesByCategory(DiffCategory.CURRENCY).first()

        assertEquals(ChangeType.REMOVED, goldEntry.changeType) // Negative change
    }

    @Test
    fun `zone change detected`() {
        val prev = SnapshotState.forTest(sequence = 1, stateHash = "h1", zone = "Rookguard")
        val curr = SnapshotState.forTest(sequence = 2, stateHash = "h2", zone = "Azura")

        val diff = SnapshotDiffAdapter.diff(prev, curr)
        val zoneEntry = diff.entriesByCategory(DiffCategory.POSITION)
            .find { it.key == "zone" }

        assertNotNull(zoneEntry)
        assertEquals("Rookguard", zoneEntry!!.prevValue)
        assertEquals("Azura", zoneEntry.currValue)
    }

    @Test
    fun `health change detected`() {
        val prev = SnapshotState(
            base = SnapshotV0(1, "h1"),
            health = 100
        )
        val curr = SnapshotState(
            base = SnapshotV0(2, "h2"),
            health = 80
        )

        val diff = SnapshotDiffAdapter.diff(prev, curr)
        val healthEntry = diff.entriesByCategory(DiffCategory.STATS)
            .find { it.key == "health" }

        assertNotNull(healthEntry)
        assertEquals(100, healthEntry!!.prevValue)
        assertEquals(80, healthEntry.currValue)
    }

    // =========================================================================
    // 5. Text output
    // =========================================================================

    @Test
    fun `diff produces readable text`() {
        val prev = SnapshotState.forTest(
            sequence = 1,
            stateHash = "hash_1",
            inventory = mapOf("sword" to InventoryItem("sword", "Iron Sword"))
        )
        val curr = SnapshotState.forTest(
            sequence = 2,
            stateHash = "hash_2",
            inventory = emptyMap()
        )

        val diff = SnapshotDiffAdapter.diff(prev, curr)
        val text = diff.toText()

        assertTrue(text.contains("1 → 2"))
        assertTrue(text.contains("Inventory"))
        assertTrue(text.contains("Iron Sword"))
    }

    @Test
    fun `empty diff text says no changes`() {
        val snapshot = SnapshotV0(sequence = 1, stateHash = "hash")
        val diff = SnapshotDiffAdapter.diff(snapshot, snapshot)
        val text = diff.toText()

        assertTrue(text.contains("No changes"))
    }

    // =========================================================================
    // Item ID diff (simple version)
    // =========================================================================

    @Test
    fun `diffItemIds computes added and removed`() {
        val prev = setOf("sword", "shield")
        val curr = setOf("shield", "helmet")

        val entries = SnapshotDiffAdapter.diffItemIds(prev, curr)

        assertEquals(2, entries.size)
        assertTrue(entries.any { it.key == "sword" && it.changeType == ChangeType.REMOVED })
        assertTrue(entries.any { it.key == "helmet" && it.changeType == ChangeType.ADDED })
    }

    @Test
    fun `diffItemIds uses name resolver`() {
        val curr = setOf("item_123")
        val entries = SnapshotDiffAdapter.diffItemIds(
            prev = null,
            curr = curr,
            itemNameResolver = { "Resolved Name" }
        )

        assertEquals("Resolved Name", entries.first().description)
    }
}
