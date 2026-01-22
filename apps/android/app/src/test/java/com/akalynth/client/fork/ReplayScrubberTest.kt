package com.akalynth.client.fork

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.ChronicleEventKind
import com.akalynth.client.chronicle.EventSource
import com.akalynth.client.chronicle.EventStatus
import com.akalynth.client.snapshot.SnapshotV0
import com.akalynth.client.timeline.TimelineCursor
import com.akalynth.client.timeline.TimelineEntry
import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for ReplayScrubber (PR 6C-2).
 *
 * Test groups:
 * 1. Navigation
 * 2. What-if simulation
 * 3. Fork control
 * 4. Simulation helpers
 */
class ReplayScrubberTest {

    // =========================================================================
    // Fixtures
    // =========================================================================

    private fun createTestEntry(sequence: Long) = TimelineEntry(
        sequence = sequence,
        cursor = TimelineCursor(sequence, "evt_$sequence"),
        event = ChronicleEvent(
            eventId = "evt_$sequence",
            kind = ChronicleEventKind.ZONE_ENTER,
            timestampMs = 1700000000000L + sequence,
            zone = "Rookguard",
            x = 10,
            y = 20,
            status = EventStatus.CONFIRMED,
            source = EventSource.SERVER_RECEIPT
        ),
        snapshot = SnapshotV0(sequence, "hash_$sequence")
    )

    private fun createTestFork(): ForkTimeline {
        val entry = createTestEntry(5)
        return ForkBuilder.forkFromEntry(
            entry = entry,
            label = "Test Fork",
            createdBy = "player_1",
            purpose = ForkPurpose.WHAT_IF
        )
    }

    // =========================================================================
    // 1. Navigation
    // =========================================================================

    @Test
    fun `scrubber starts at branch point`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.from(fork)

        assertTrue(scrubber.isAtBranchPoint)
        assertEquals(fork.branchSequence, scrubber.cursor())
    }

    @Test
    fun `atEnd positions at last entry`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.atEnd(fork)

        assertEquals(fork.maxSequence, scrubber.cursor())
    }

    @Test
    fun `current returns entry at position`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.from(fork)

        val current = scrubber.current()
        assertNotNull(current)
        assertEquals(fork.branchSequence, current!!.sequence)
    }

    @Test
    fun `goToSequence navigates correctly`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.from(fork)

        val entry = scrubber.goToSequence(5)
        assertNotNull(entry)
        assertEquals(5L, scrubber.cursor())
    }

    @Test
    fun `goToSequence returns null for missing sequence`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.from(fork)

        val entry = scrubber.goToSequence(999)
        assertNull(entry)
    }

    // =========================================================================
    // 2. What-if simulation
    // =========================================================================

    @Test
    fun `simulateEvent creates new scrubber`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.from(fork)

        val newScrubber = scrubber.simulateEvent(
            kind = ChronicleEventKind.DEATH,
            details = mapOf("killer_name" to "Goblin"),
            reason = "Killed by Goblin",
            ruleIds = listOf("DEATH_DROP_POLICY")
        )

        // Original unchanged
        assertFalse(scrubber.hasDiverged)

        // New scrubber has simulated entry
        assertTrue(newScrubber.hasDiverged)
        assertTrue(newScrubber.isPastBranch)
    }

    @Test
    fun `simulated event has correct markers`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.from(fork)

        val newScrubber = scrubber.simulateEvent(
            kind = ChronicleEventKind.DEATH,
            reason = "Test",
            ruleIds = listOf("TEST_RULE")
        )

        val entry = newScrubber.current()
        assertNotNull(entry)
        assertTrue(entry!!.isSimulated)

        // Event should have simulated markers
        val event = entry.event!!
        assertTrue(event.eventId.startsWith("sim_"))
        assertEquals(EventStatus.PENDING, event.status)
        assertEquals(EventSource.CLIENT_INTENT, event.source)

        // Explanation should have marker
        val explanation = entry.explanation!!
        assertTrue(explanation.reason.contains("[SIMULATED]"))
    }

    @Test
    fun `simulateEvent increments sequence`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.from(fork)

        val initialMax = fork.maxSequence!!

        val newScrubber = scrubber.simulateEvent(
            kind = ChronicleEventKind.ZONE_ENTER,
            reason = "Test",
            ruleIds = listOf("TEST_RULE")
        )

        assertEquals(initialMax + 1, newScrubber.cursor())
    }

    @Test
    fun `multiple simulations chain correctly`() {
        val fork = createTestFork()
        var scrubber = ReplayScrubber.from(fork)

        // Chain 3 simulations
        for (i in 1..3) {
            scrubber = scrubber.simulateEvent(
                kind = ChronicleEventKind.ZONE_ENTER,
                reason = "Simulation $i",
                ruleIds = listOf("TEST_RULE")
            )
        }

        assertEquals(3, scrubber.fork.simulatedCount)
    }

    // =========================================================================
    // 3. Fork control
    // =========================================================================

    @Test
    fun `resetToBase clears simulations`() {
        val fork = createTestFork()
        var scrubber = ReplayScrubber.from(fork)

        // Add simulations
        scrubber = scrubber.simulateEvent(
            kind = ChronicleEventKind.DEATH,
            reason = "Test",
            ruleIds = listOf("TEST")
        )
        assertTrue(scrubber.hasDiverged)

        // Reset
        val resetScrubber = scrubber.resetToBase()

        assertFalse(resetScrubber.hasDiverged)
        assertTrue(resetScrubber.isAtBranchPoint)
    }

    @Test
    fun `trimToCurrent removes future entries`() {
        val fork = createTestFork()
        var scrubber = ReplayScrubber.from(fork)

        // Add multiple simulations
        for (i in 1..3) {
            scrubber = scrubber.simulateEvent(
                kind = ChronicleEventKind.ZONE_ENTER,
                reason = "Sim $i",
                ruleIds = listOf("TEST")
            )
        }

        // Go back to first simulation
        scrubber.goToSequence(fork.branchSequence + 1)

        // Trim
        val trimmed = scrubber.trimToCurrent()

        assertEquals(1, trimmed.fork.simulatedCount)
    }

    @Test
    fun `copy creates independent scrubber`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.from(fork)

        val copy = scrubber.copy()

        // Navigate original
        scrubber.goToStart()

        // Copy should be unchanged
        assertEquals(fork.branchSequence, copy.cursor())
    }

    // =========================================================================
    // 4. Simulation helpers
    // =========================================================================

    @Test
    fun `simulateDeath creates death event`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.from(fork)

        val newScrubber = scrubber.simulateDeath(
            killerName = "Goblin",
            itemsLost = listOf("sword_1", "shield_1")
        )

        val entry = newScrubber.current()
        assertNotNull(entry)
        assertEquals(ChronicleEventKind.DEATH, entry!!.event?.kind)
        assertEquals("Goblin", entry.event?.details?.get("killer_name"))
    }

    @Test
    fun `simulateItemPickup creates pickup event`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.from(fork)

        val newScrubber = scrubber.simulateItemPickup(
            itemId = "sword_1",
            itemName = "Iron Sword"
        )

        val entry = newScrubber.current()
        assertNotNull(entry)
        assertEquals(ChronicleEventKind.ITEM_PICKUP, entry!!.event?.kind)
    }

    @Test
    fun `simulateZoneTransition creates zone event`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.from(fork)

        val newScrubber = scrubber.simulateZoneTransition(
            toZone = "Azura"
        )

        val entry = newScrubber.current()
        assertNotNull(entry)
        assertEquals(ChronicleEventKind.ZONE_ENTER, entry!!.event?.kind)
        assertEquals("Azura", entry.event?.zone)
    }

    @Test
    fun `simulated event preserves position from previous`() {
        val fork = createTestFork()
        val scrubber = ReplayScrubber.from(fork)

        val current = scrubber.current()
        val originalZone = current?.event?.zone
        val originalX = current?.event?.x
        val originalY = current?.event?.y

        val newScrubber = scrubber.simulateEvent(
            kind = ChronicleEventKind.DEATH,
            reason = "Test",
            ruleIds = listOf("TEST")
        )

        val entry = newScrubber.current()
        assertEquals(originalZone, entry?.event?.zone)
        assertEquals(originalX, entry?.event?.x)
        assertEquals(originalY, entry?.event?.y)
    }
}
