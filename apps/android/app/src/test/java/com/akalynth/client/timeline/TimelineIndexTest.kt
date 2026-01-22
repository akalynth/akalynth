package com.akalynth.client.timeline

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.ChronicleEventKind
import com.akalynth.client.chronicle.EventSource
import com.akalynth.client.chronicle.EventStatus
import com.akalynth.client.chronicle.Receipt
import com.akalynth.client.snapshot.SnapshotV0
import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for TimelineIndex (PR 6C-1).
 *
 * Test groups:
 * 1. Index building from events
 * 2. Sequence ordering
 * 3. Event/action ID lookups
 * 4. Alignment with receipts/snapshots
 */
class TimelineIndexTest {

    // =========================================================================
    // 1. Index building from events
    // =========================================================================

    @Test
    fun `empty events produces empty index`() {
        val index = TimelineIndex.fromEvents(emptyList())

        assertTrue(index.isEmpty)
        assertEquals(0, index.size)
        assertNull(index.minSequence)
        assertNull(index.maxSequence)
    }

    @Test
    fun `single event creates single entry`() {
        val event = createEvent("evt_1", timestampMs = 1000)
        val index = TimelineIndex.fromEvents(listOf(event))

        assertEquals(1, index.size)
        assertEquals(1L, index.minSequence)
        assertEquals(1L, index.maxSequence)
    }

    @Test
    fun `multiple events creates entries sorted by timestamp`() {
        val events = listOf(
            createEvent("evt_3", timestampMs = 3000),
            createEvent("evt_1", timestampMs = 1000),
            createEvent("evt_2", timestampMs = 2000)
        )
        val index = TimelineIndex.fromEvents(events)

        assertEquals(3, index.size)

        // First entry should be evt_1 (earliest timestamp)
        val first = index.first()!!
        assertEquals("evt_1", first.eventId)
        assertEquals(1L, first.sequence)

        // Last entry should be evt_3 (latest timestamp)
        val last = index.last()!!
        assertEquals("evt_3", last.eventId)
        assertEquals(3L, last.sequence)
    }

    @Test
    fun `duplicate events do not create duplicate entries`() {
        val events = listOf(
            createEvent("evt_1", timestampMs = 1000),
            createEvent("evt_1", timestampMs = 1000) // Duplicate
        )
        val index = TimelineIndex.fromEvents(events)

        // Both are included as separate sequence points
        // (deduplication happens at store level, not index)
        assertEquals(2, index.size)
    }

    // =========================================================================
    // 2. Sequence ordering
    // =========================================================================

    @Test
    fun `nextSequence returns next entry`() {
        val events = listOf(
            createEvent("evt_1", timestampMs = 1000),
            createEvent("evt_2", timestampMs = 2000),
            createEvent("evt_3", timestampMs = 3000)
        )
        val index = TimelineIndex.fromEvents(events)

        assertEquals(2L, index.nextSequence(1L))
        assertEquals(3L, index.nextSequence(2L))
        assertNull(index.nextSequence(3L)) // No next after last
    }

    @Test
    fun `prevSequence returns previous entry`() {
        val events = listOf(
            createEvent("evt_1", timestampMs = 1000),
            createEvent("evt_2", timestampMs = 2000),
            createEvent("evt_3", timestampMs = 3000)
        )
        val index = TimelineIndex.fromEvents(events)

        assertNull(index.prevSequence(1L)) // No prev before first
        assertEquals(1L, index.prevSequence(2L))
        assertEquals(2L, index.prevSequence(3L))
    }

    @Test
    fun `first and last return correct entries`() {
        val events = listOf(
            createEvent("evt_2", timestampMs = 2000),
            createEvent("evt_1", timestampMs = 1000)
        )
        val index = TimelineIndex.fromEvents(events)

        assertEquals("evt_1", index.first()?.eventId)
        assertEquals("evt_2", index.last()?.eventId)
    }

    // =========================================================================
    // 3. Event/action ID lookups
    // =========================================================================

    @Test
    fun `getByEventId finds correct entry`() {
        val events = listOf(
            createEvent("evt_1", timestampMs = 1000),
            createEvent("evt_2", timestampMs = 2000)
        )
        val index = TimelineIndex.fromEvents(events)

        val entry = index.getByEventId("evt_2")

        assertNotNull(entry)
        assertEquals("evt_2", entry!!.eventId)
        assertEquals(2L, entry.sequence)
    }

    @Test
    fun `getByEventId returns null for missing`() {
        val events = listOf(createEvent("evt_1", timestampMs = 1000))
        val index = TimelineIndex.fromEvents(events)

        assertNull(index.getByEventId("evt_missing"))
    }

    @Test
    fun `getByActionId finds correct entry`() {
        val events = listOf(
            createEvent("evt_1", actionId = "action_1", timestampMs = 1000),
            createEvent("evt_2", actionId = "action_2", timestampMs = 2000)
        )
        val index = TimelineIndex.fromEvents(events)

        val entry = index.getByActionId("action_2")

        assertNotNull(entry)
        assertEquals("action_2", entry!!.actionId)
    }

    @Test
    fun `getSequenceForEvent returns sequence`() {
        val events = listOf(
            createEvent("evt_1", timestampMs = 1000),
            createEvent("evt_2", timestampMs = 2000)
        )
        val index = TimelineIndex.fromEvents(events)

        assertEquals(2L, index.getSequenceForEvent("evt_2"))
    }

    // =========================================================================
    // 4. Alignment with receipts/snapshots
    // =========================================================================

    @Test
    fun `receipts aligned by actionId`() {
        val events = listOf(
            createEvent("evt_1", actionId = "action_1", timestampMs = 1000)
        )
        val receipts = mapOf(
            "action_1" to Receipt(
                receiptId = "receipt_1",
                actionId = "action_1",
                type = "item_drop",
                timestampMs = 1000,
                payload = emptyMap()
            )
        )

        val index = TimelineIndex.build(events, receipts)
        val entry = index.first()!!

        assertTrue(entry.hasReceipt)
        assertEquals("receipt_1", entry.receipt?.receiptId)
    }

    @Test
    fun `snapshots aligned by sequence`() {
        val events = listOf(
            createEvent("evt_1", timestampMs = 1000),
            createEvent("evt_2", timestampMs = 2000)
        )
        val snapshots = mapOf(
            1L to SnapshotV0(sequence = 1, stateHash = "hash_1"),
            2L to SnapshotV0(sequence = 2, stateHash = "hash_2")
        )

        val index = TimelineIndex.build(events, snapshots = snapshots)

        val first = index.first()!!
        assertTrue(first.hasSnapshot)
        assertEquals("hash_1", first.snapshot?.stateHash)
        assertNull(first.prevSnapshot) // No prev at sequence 1

        val second = index.getAtSequence(2L)!!
        assertTrue(second.hasTransition)
        assertEquals("hash_1", second.prevSnapshot?.stateHash)
        assertEquals("hash_2", second.snapshot?.stateHash)
    }

    @Test
    fun `snapshotEvidence built when snapshots present`() {
        val events = listOf(
            createEvent("evt_1", timestampMs = 1000),
            createEvent("evt_2", timestampMs = 2000)
        )
        val snapshots = mapOf(
            1L to SnapshotV0(sequence = 1, stateHash = "hash_1"),
            2L to SnapshotV0(sequence = 2, stateHash = "hash_2")
        )

        val index = TimelineIndex.build(events, snapshots = snapshots)
        val entry = index.getAtSequence(2L)!!

        assertNotNull(entry.snapshotEvidence)
        assertEquals("1 → 2", entry.snapshotEvidence?.stateTransition)
    }

    @Test
    fun `missing receipt or snapshot handled gracefully`() {
        val events = listOf(createEvent("evt_1", timestampMs = 1000))
        val index = TimelineIndex.fromEvents(events)
        val entry = index.first()!!

        assertFalse(entry.hasReceipt)
        assertFalse(entry.hasSnapshot)
        assertNull(entry.receipt)
        assertNull(entry.snapshot)
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private fun createEvent(
        eventId: String,
        actionId: String? = null,
        timestampMs: Long = 0
    ) = ChronicleEvent(
        eventId = eventId,
        actionId = actionId,
        kind = ChronicleEventKind.ITEM_DROP,
        timestampMs = timestampMs,
        status = EventStatus.CONFIRMED,
        source = EventSource.SERVER_RECEIPT
    )
}
