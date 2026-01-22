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
 * Tests for ForkTimeline (PR 6C-2).
 *
 * Test groups:
 * 1. Fork creation
 * 2. Navigation
 * 3. Append simulated entries
 * 4. Reset/trim operations
 * 5. Isolation guarantees
 */
class ForkTimelineTest {

    // =========================================================================
    // Fixtures
    // =========================================================================

    private fun createTestEntry(
        sequence: Long,
        eventId: String = "evt_$sequence"
    ) = TimelineEntry(
        sequence = sequence,
        cursor = TimelineCursor(sequence, eventId),
        event = ChronicleEvent(
            eventId = eventId,
            kind = ChronicleEventKind.ZONE_ENTER,
            timestampMs = 1700000000000L + sequence,
            status = EventStatus.CONFIRMED,
            source = EventSource.SERVER_RECEIPT
        ),
        snapshot = SnapshotV0(sequence, "hash_$sequence")
    )

    private fun createTestFork(inheritedCount: Int = 3): ForkTimeline {
        val entries = (1..inheritedCount.toLong()).map { seq ->
            createTestEntry(seq)
        }

        val branchEntry = entries.last()
        val branchPoint = ForkPoint.from(branchEntry, 1700000000000L)

        val metadata = ForkMetadata.create(
            label = "Test Fork",
            createdBy = "player_1",
            purpose = ForkPurpose.WHAT_IF,
            createdAtMs = 1700000000000L
        )

        return ForkBuilder.forkFromEntry(
            entry = branchEntry,
            label = "Test Fork",
            createdBy = "player_1",
            purpose = ForkPurpose.WHAT_IF,
            createdAtMs = 1700000000000L
        )
    }

    // =========================================================================
    // 1. Fork creation
    // =========================================================================

    @Test
    fun `fork has correct metadata`() {
        val fork = createTestFork()

        assertEquals("Test Fork", fork.label)
        assertTrue(fork.forkId.startsWith("fork_"))
        assertEquals(ForkPurpose.WHAT_IF, fork.metadata.purpose)
    }

    @Test
    fun `fork has correct branch point`() {
        val entry = createTestEntry(5)
        val fork = ForkBuilder.forkFromEntry(
            entry = entry,
            label = "Test",
            createdBy = "player_1"
        )

        assertEquals(5L, fork.branchSequence)
        assertEquals("hash_5", fork.branchStateHash)
    }

    @Test
    fun `fork starts with inherited entries`() {
        val fork = createTestFork()

        assertEquals(1, fork.inheritedCount)
        assertEquals(0, fork.simulatedCount)
        assertFalse(fork.hasDiverged)
    }

    // =========================================================================
    // 2. Navigation
    // =========================================================================

    @Test
    fun `getAtSequence returns correct entry`() {
        val fork = createTestFork()

        val entry = fork.getAtSequence(fork.branchSequence)
        assertNotNull(entry)
        assertTrue(entry!!.isInherited)
    }

    @Test
    fun `getAtSequence returns null for missing sequence`() {
        val fork = createTestFork()

        assertNull(fork.getAtSequence(999))
    }

    @Test
    fun `first and last return correct entries`() {
        val fork = createTestFork()

        assertNotNull(fork.first())
        assertNotNull(fork.last())
        assertEquals(fork.minSequence, fork.first()?.sequence)
        assertEquals(fork.maxSequence, fork.last()?.sequence)
    }

    @Test
    fun `allEntries returns ordered list`() {
        val fork = createTestFork()

        val entries = fork.allEntries()
        assertFalse(entries.isEmpty())

        // Verify ordering
        for (i in 1 until entries.size) {
            assertTrue(entries[i].sequence > entries[i - 1].sequence)
        }
    }

    // =========================================================================
    // 3. Append simulated entries
    // =========================================================================

    @Test
    fun `appendSimulated adds entry`() {
        val fork = createTestFork()
        val initialSize = fork.size

        val simEntry = ForkEntry.simulated(
            sequence = fork.branchSequence + 1,
            event = ChronicleEvent(
                eventId = "sim_${fork.forkId}_${fork.branchSequence + 1}",
                kind = ChronicleEventKind.DEATH,
                timestampMs = System.currentTimeMillis(),
                status = EventStatus.PENDING,
                source = EventSource.CLIENT_INTENT
            )
        )

        val newFork = fork.appendSimulated(simEntry)

        assertEquals(initialSize + 1, newFork.size)
        assertEquals(1, newFork.simulatedCount)
        assertTrue(newFork.hasDiverged)
    }

    @Test
    fun `appendSimulated preserves immutability`() {
        val fork = createTestFork()
        val initialSize = fork.size

        val simEntry = ForkEntry.simulated(
            sequence = fork.branchSequence + 1,
            event = ChronicleEvent(
                eventId = "sim_test_1",
                kind = ChronicleEventKind.DEATH,
                timestampMs = System.currentTimeMillis(),
                status = EventStatus.PENDING,
                source = EventSource.CLIENT_INTENT
            )
        )

        val newFork = fork.appendSimulated(simEntry)

        // Original unchanged
        assertEquals(initialSize, fork.size)
        assertEquals(0, fork.simulatedCount)

        // New fork has entry
        assertEquals(initialSize + 1, newFork.size)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `appendSimulated rejects inherited entry`() {
        val fork = createTestFork()

        val inheritedEntry = ForkEntry.inherited(
            sequence = fork.branchSequence + 1,
            cursor = TimelineCursor.atSequence(fork.branchSequence + 1)
        )

        fork.appendSimulated(inheritedEntry)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `appendSimulated rejects out-of-order sequence`() {
        val fork = createTestFork()

        val simEntry = ForkEntry.simulated(
            sequence = 1, // Lower than existing
            event = ChronicleEvent(
                eventId = "sim_test",
                kind = ChronicleEventKind.DEATH,
                timestampMs = System.currentTimeMillis(),
                status = EventStatus.PENDING,
                source = EventSource.CLIENT_INTENT
            )
        )

        fork.appendSimulated(simEntry)
    }

    // =========================================================================
    // 4. Reset/trim operations
    // =========================================================================

    @Test
    fun `resetToBase removes simulated entries`() {
        var fork = createTestFork()

        // Add simulated entry
        val simEntry = ForkEntry.simulated(
            sequence = fork.branchSequence + 1,
            event = ChronicleEvent(
                eventId = "sim_test",
                kind = ChronicleEventKind.DEATH,
                timestampMs = System.currentTimeMillis(),
                status = EventStatus.PENDING,
                source = EventSource.CLIENT_INTENT
            )
        )
        fork = fork.appendSimulated(simEntry)
        assertTrue(fork.hasDiverged)

        // Reset
        val resetFork = fork.resetToBase()

        assertFalse(resetFork.hasDiverged)
        assertEquals(0, resetFork.simulatedCount)
    }

    @Test
    fun `trimToSequence removes entries after`() {
        var fork = createTestFork()

        // Add multiple simulated entries
        for (i in 1..3) {
            val simEntry = ForkEntry.simulated(
                sequence = fork.maxSequence!! + 1,
                event = ChronicleEvent(
                    eventId = "sim_test_$i",
                    kind = ChronicleEventKind.ZONE_ENTER,
                    timestampMs = System.currentTimeMillis(),
                    status = EventStatus.PENDING,
                    source = EventSource.CLIENT_INTENT
                )
            )
            fork = fork.appendSimulated(simEntry)
        }

        val totalBefore = fork.size

        // Trim to first simulated
        val trimmed = fork.trimToSequence(fork.branchSequence + 1)

        assertTrue(trimmed.size < totalBefore)
    }

    // =========================================================================
    // 5. Isolation guarantees
    // =========================================================================

    @Test
    fun `inherited entries maintain authoritative status`() {
        val fork = createTestFork()

        fork.inheritedEntries().forEach { entry ->
            assertTrue(entry.isInherited)
            entry.event?.let {
                assertEquals(EventStatus.CONFIRMED, it.status)
                assertEquals(EventSource.SERVER_RECEIPT, it.source)
            }
        }
    }

    @Test
    fun `simulated entries are never confirmed`() {
        var fork = createTestFork()

        val simEntry = ForkEntry.simulated(
            sequence = fork.branchSequence + 1,
            event = ChronicleEvent(
                eventId = "sim_test",
                kind = ChronicleEventKind.DEATH,
                timestampMs = System.currentTimeMillis(),
                status = EventStatus.PENDING,
                source = EventSource.CLIENT_INTENT
            )
        )
        fork = fork.appendSimulated(simEntry)

        fork.simulatedEntries().forEach { entry ->
            assertTrue(entry.isSimulated)
            entry.event?.let {
                assertNotEquals(EventStatus.CONFIRMED, it.status)
            }
        }
    }
}
