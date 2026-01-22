package com.akalynth.client.timeline

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.ChronicleEventKind
import com.akalynth.client.chronicle.EventSource
import com.akalynth.client.chronicle.EventStatus
import com.akalynth.client.snapshot.SnapshotV0
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests for TimeTravelDebugger navigation (PR 6C-1).
 *
 * Test groups:
 * 1. Basic navigation (next/prev)
 * 2. Go to specific positions
 * 3. Boundary conditions
 * 4. Death event alignment
 */
class TimeTravelDebuggerTest {

    private lateinit var debugger: TimeTravelDebugger

    @Before
    fun setup() {
        val events = listOf(
            createEvent("evt_1", actionId = "action_1", timestampMs = 1000),
            createEvent("evt_2", actionId = "action_2", timestampMs = 2000),
            createEvent("evt_3", actionId = "action_3", timestampMs = 3000),
            createEvent("evt_4", timestampMs = 4000), // No actionId
            createEvent("evt_5", actionId = "action_5", timestampMs = 5000)
        )
        val index = TimelineIndex.fromEvents(events)
        debugger = TimelineDebuggerImpl(index)
    }

    // =========================================================================
    // 1. Basic navigation (next/prev)
    // =========================================================================

    @Test
    fun `next walks sequences forward`() {
        debugger.goToStart()
        assertEquals("evt_1", debugger.current().eventId)

        val next = debugger.next()
        assertEquals("evt_2", next?.eventId)

        val next2 = debugger.next()
        assertEquals("evt_3", next2?.eventId)
    }

    @Test
    fun `prev walks sequences backward`() {
        debugger.goToEnd()
        assertEquals("evt_5", debugger.current().eventId)

        val prev = debugger.prev()
        assertEquals("evt_4", prev?.eventId)

        val prev2 = debugger.prev()
        assertEquals("evt_3", prev2?.eventId)
    }

    @Test
    fun `hasNext returns correct state`() {
        debugger.goToStart()
        assertTrue(debugger.hasNext())

        debugger.goToEnd()
        assertFalse(debugger.hasNext())
    }

    @Test
    fun `hasPrev returns correct state`() {
        debugger.goToStart()
        assertFalse(debugger.hasPrev())

        debugger.goToEnd()
        assertTrue(debugger.hasPrev())
    }

    // =========================================================================
    // 2. Go to specific positions
    // =========================================================================

    @Test
    fun `goToSequence lands on correct entry`() {
        val entry = debugger.goToSequence(3L)

        assertNotNull(entry)
        assertEquals("evt_3", entry?.eventId)
        assertEquals(3L, debugger.cursor().sequence)
    }

    @Test
    fun `goToEvent lands on correct sequence`() {
        val entry = debugger.goToEvent("evt_4")

        assertNotNull(entry)
        assertEquals("evt_4", entry?.eventId)
        assertEquals(4L, entry?.sequence)
    }

    @Test
    fun `goToAction lands on correct sequence`() {
        val entry = debugger.goToAction("action_3")

        assertNotNull(entry)
        assertEquals("action_3", entry?.actionId)
        assertEquals("evt_3", entry?.eventId)
    }

    @Test
    fun `goToStart positions at first entry`() {
        debugger.goToSequence(4L) // Start somewhere in the middle

        val first = debugger.goToStart()

        assertEquals("evt_1", first?.eventId)
        assertEquals(1L, debugger.cursor().sequence)
    }

    @Test
    fun `goToEnd positions at last entry`() {
        debugger.goToStart()

        val last = debugger.goToEnd()

        assertEquals("evt_5", last?.eventId)
        assertEquals(5L, debugger.cursor().sequence)
    }

    // =========================================================================
    // 3. Boundary conditions
    // =========================================================================

    @Test
    fun `next at end returns null`() {
        debugger.goToEnd()
        val next = debugger.next()

        assertNull(next)
        // Position should remain at end
        assertEquals("evt_5", debugger.current().eventId)
    }

    @Test
    fun `prev at start returns null`() {
        debugger.goToStart()
        val prev = debugger.prev()

        assertNull(prev)
        // Position should remain at start
        assertEquals("evt_1", debugger.current().eventId)
    }

    @Test
    fun `goToSequence with invalid sequence returns null`() {
        val entry = debugger.goToSequence(999L)

        assertNull(entry)
    }

    @Test
    fun `goToEvent with missing eventId returns null`() {
        val entry = debugger.goToEvent("evt_missing")

        assertNull(entry)
    }

    @Test
    fun `goToAction with missing actionId returns null`() {
        val entry = debugger.goToAction("action_missing")

        assertNull(entry)
    }

    @Test
    fun `empty debugger handles all operations`() {
        val emptyDebugger = TimelineBuilder.empty()

        assertEquals(0, emptyDebugger.size())
        assertNull(emptyDebugger.goToStart())
        assertNull(emptyDebugger.goToEnd())
        assertNull(emptyDebugger.next())
        assertNull(emptyDebugger.prev())
        assertFalse(emptyDebugger.hasNext())
        assertFalse(emptyDebugger.hasPrev())
    }

    // =========================================================================
    // 4. Death event alignment
    // =========================================================================

    @Test
    fun `death event aligns with snapshot transition`() {
        val events = listOf(
            createEvent("evt_death", kind = ChronicleEventKind.DEATH, timestampMs = 1000),
            createEvent("evt_after", timestampMs = 2000)
        )
        val snapshots = mapOf(
            1L to SnapshotV0(sequence = 1, stateHash = "hash_after_death"),
            2L to SnapshotV0(sequence = 2, stateHash = "hash_2")
        )

        val index = TimelineIndex.build(events, snapshots = snapshots)
        val ttd = TimelineDebuggerImpl(index)

        val deathEntry = ttd.goToEvent("evt_death")

        assertNotNull(deathEntry)
        assertEquals(ChronicleEventKind.DEATH, deathEntry?.event?.kind)
        assertTrue(deathEntry?.hasSnapshot == true)
        assertEquals("hash_after_death", deathEntry?.snapshot?.stateHash)
    }

    @Test
    fun `death event with snapshot transition has evidence`() {
        val events = listOf(
            createEvent("evt_before", timestampMs = 1000),
            createEvent("evt_death", kind = ChronicleEventKind.DEATH, timestampMs = 2000)
        )
        val snapshots = mapOf(
            1L to SnapshotV0(sequence = 1, stateHash = "hash_before"),
            2L to SnapshotV0(sequence = 2, stateHash = "hash_after_death")
        )

        val index = TimelineIndex.build(events, snapshots = snapshots)
        val ttd = TimelineDebuggerImpl(index)

        val deathEntry = ttd.goToEvent("evt_death")

        assertNotNull(deathEntry)
        assertTrue(deathEntry?.hasTransition == true)
        assertNotNull(deathEntry?.snapshotEvidence)
        assertEquals("1 → 2", deathEntry?.snapshotEvidence?.stateTransition)
    }

    // =========================================================================
    // Utility tests
    // =========================================================================

    @Test
    fun `allEntries returns all in order`() {
        val entries = debugger.allEntries()

        assertEquals(5, entries.size)
        assertEquals("evt_1", entries[0].eventId)
        assertEquals("evt_5", entries[4].eventId)
    }

    @Test
    fun `size returns correct count`() {
        assertEquals(5, debugger.size())
    }

    @Test
    fun `cursor reflects current position`() {
        debugger.goToSequence(3L)

        val cursor = debugger.cursor()

        assertEquals(3L, cursor.sequence)
        assertEquals("evt_3", cursor.eventId)
        assertEquals("action_3", cursor.actionId)
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private fun createEvent(
        eventId: String,
        actionId: String? = null,
        kind: ChronicleEventKind = ChronicleEventKind.ITEM_DROP,
        timestampMs: Long = 0
    ) = ChronicleEvent(
        eventId = eventId,
        actionId = actionId,
        kind = kind,
        timestampMs = timestampMs,
        status = EventStatus.CONFIRMED,
        source = EventSource.SERVER_RECEIPT
    )
}
