package com.akalynth.client.snapshot.diff

import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for DiffEntry factory methods (PR 6C-3).
 */
class DiffEntryTest {

    // =========================================================================
    // Inventory entries
    // =========================================================================

    @Test
    fun `itemAdded creates correct entry`() {
        val entry = DiffEntry.itemAdded(
            itemId = "sword_1",
            itemName = "Iron Sword",
            rarity = "common",
            quantity = 1
        )

        assertEquals("sword_1", entry.key)
        assertEquals(DiffCategory.INVENTORY, entry.category)
        assertEquals(ChangeType.ADDED, entry.changeType)
        assertNull(entry.prevValue)
        assertEquals(1, entry.currValue)
        assertEquals("Iron Sword", entry.description)
        assertEquals("common", entry.meta<String>("rarity"))
    }

    @Test
    fun `itemAdded with quantity shows count`() {
        val entry = DiffEntry.itemAdded(
            itemId = "potion",
            itemName = "Health Potion",
            quantity = 5
        )

        assertEquals("Health Potion x5", entry.description)
    }

    @Test
    fun `itemRemoved creates correct entry`() {
        val entry = DiffEntry.itemRemoved(
            itemId = "sword_1",
            itemName = "Iron Sword"
        )

        assertEquals(ChangeType.REMOVED, entry.changeType)
        assertEquals(1, entry.prevValue)
        assertNull(entry.currValue)
    }

    @Test
    fun `itemQuantityChanged creates correct entry`() {
        val entry = DiffEntry.itemQuantityChanged(
            itemId = "potion",
            itemName = "Health Potion",
            prevQuantity = 10,
            currQuantity = 7
        )

        assertEquals(ChangeType.MODIFIED, entry.changeType)
        assertEquals(10, entry.prevValue)
        assertEquals(7, entry.currValue)
        assertEquals(-3, entry.meta<Int>("delta"))
    }

    // =========================================================================
    // Currency entries
    // =========================================================================

    @Test
    fun `goldChanged positive creates ADDED entry`() {
        val entry = DiffEntry.goldChanged(100, 150)

        assertEquals(ChangeType.ADDED, entry.changeType)
        assertEquals(100L, entry.prevValue)
        assertEquals(150L, entry.currValue)
        assertEquals(50L, entry.meta<Long>("delta"))
    }

    @Test
    fun `goldChanged negative creates REMOVED entry`() {
        val entry = DiffEntry.goldChanged(100, 50)

        assertEquals(ChangeType.REMOVED, entry.changeType)
        assertEquals(-50L, entry.meta<Long>("delta"))
    }

    @Test
    fun `goldChanged zero creates UNCHANGED entry`() {
        val entry = DiffEntry.goldChanged(100, 100)

        assertEquals(ChangeType.UNCHANGED, entry.changeType)
    }

    // =========================================================================
    // Position entries
    // =========================================================================

    @Test
    fun `zoneChanged creates correct entry`() {
        val entry = DiffEntry.zoneChanged("Rookguard", "Azura")

        assertEquals(DiffCategory.POSITION, entry.category)
        assertEquals(ChangeType.MODIFIED, entry.changeType)
        assertEquals("Rookguard", entry.prevValue)
        assertEquals("Azura", entry.currValue)
    }

    @Test
    fun `zoneChanged from null creates ADDED entry`() {
        val entry = DiffEntry.zoneChanged(null, "Rookguard")

        assertEquals(ChangeType.ADDED, entry.changeType)
    }

    @Test
    fun `positionChanged creates correct entry`() {
        val entry = DiffEntry.positionChanged(10, 20, 15, 25)

        assertEquals(DiffCategory.POSITION, entry.category)
        assertEquals("10,20", entry.prevValue)
        assertEquals("15,25", entry.currValue)
        assertTrue(entry.description.contains("10,20"))
        assertTrue(entry.description.contains("15,25"))
    }

    // =========================================================================
    // Status effect entries
    // =========================================================================

    @Test
    fun `statusAdded creates correct entry`() {
        val entry = DiffEntry.statusAdded("Poison", duration = 30)

        assertEquals(DiffCategory.STATUS, entry.category)
        assertEquals(ChangeType.ADDED, entry.changeType)
        assertEquals("Poison (30s)", entry.description)
    }

    @Test
    fun `statusRemoved creates correct entry`() {
        val entry = DiffEntry.statusRemoved("Blessing")

        assertEquals(ChangeType.REMOVED, entry.changeType)
        assertEquals("Blessing", entry.description)
    }

    // =========================================================================
    // Meta entries
    // =========================================================================

    @Test
    fun `hashChanged creates correct entry`() {
        val entry = DiffEntry.hashChanged(
            "abc123def456",
            "xyz789qwe012"
        )

        assertEquals(DiffCategory.META, entry.category)
        assertEquals(ChangeType.MODIFIED, entry.changeType)
        assertTrue(entry.description.contains("hash"))
    }

    // =========================================================================
    // Text output
    // =========================================================================

    @Test
    fun `toText formats added entry`() {
        val entry = DiffEntry.itemAdded("sword", "Iron Sword")
        val text = entry.toText()

        assertTrue(text.startsWith("[+]"))
        assertTrue(text.contains("Iron Sword"))
    }

    @Test
    fun `toText formats removed entry`() {
        val entry = DiffEntry.itemRemoved("sword", "Iron Sword")
        val text = entry.toText()

        assertTrue(text.startsWith("[-]"))
    }

    @Test
    fun `toText formats modified entry with values`() {
        val entry = DiffEntry.itemQuantityChanged("potion", "Potion", 10, 5)
        val text = entry.toText()

        assertTrue(text.startsWith("[~]"))
        assertTrue(text.contains("10 → 5"))
    }
}
