package com.akalynth.client.fork

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.ChronicleEventKind
import com.akalynth.client.chronicle.EventSource
import com.akalynth.client.chronicle.EventStatus
import com.akalynth.client.explain.ExplainDecision
import com.akalynth.client.explain.Explanation
import com.akalynth.client.timeline.TimelineCursor
import com.akalynth.client.timeline.TimelineEntry
import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for ForkIsolation (PR 6C-2).
 *
 * Tests the invariant: **Forks never contaminate authoritative timeline.**
 */
class ForkIsolationTest {

    // =========================================================================
    // Entry validation
    // =========================================================================

    @Test
    fun `inherited entry passes validation`() {
        val entry = ForkEntry.inherited(
            sequence = 1,
            cursor = TimelineCursor.atSequence(1),
            event = ChronicleEvent(
                eventId = "evt_1",
                kind = ChronicleEventKind.ZONE_ENTER,
                timestampMs = 1700000000000L,
                status = EventStatus.CONFIRMED,
                source = EventSource.SERVER_RECEIPT
            )
        )

        // Should not throw
        ForkIsolation.validateEntry(entry)
    }

    @Test
    fun `simulated entry with correct markers passes validation`() {
        val entry = ForkEntry.simulated(
            sequence = 2,
            event = ChronicleEvent(
                eventId = "sim_fork_123_2",
                kind = ChronicleEventKind.DEATH,
                timestampMs = 1700000000000L,
                status = EventStatus.PENDING,
                source = EventSource.CLIENT_INTENT
            ),
            explanation = Explanation(
                explanationId = "exp_2",
                subjectId = "sim_fork_123_2",
                decision = ExplainDecision.PENDING,
                ruleIds = listOf("TEST"),
                reason = "[SIMULATED] Test reason",
                timestampMs = 1700000000000L
            )
        )

        // Should not throw
        ForkIsolation.validateEntry(entry)
    }

    @Test(expected = ForkIsolationViolation::class)
    fun `simulated entry with CONFIRMED status fails validation`() {
        val entry = ForkEntry(
            sequence = 2,
            cursor = TimelineCursor.atSequence(2),
            event = ChronicleEvent(
                eventId = "sim_test",
                kind = ChronicleEventKind.DEATH,
                timestampMs = 1700000000000L,
                status = EventStatus.CONFIRMED, // VIOLATION
                source = EventSource.CLIENT_INTENT
            ),
            origin = ForkEntryOrigin.SIMULATED
        )

        ForkIsolation.validateEntry(entry)
    }

    @Test(expected = ForkIsolationViolation::class)
    fun `simulated entry with SERVER_RECEIPT source fails validation`() {
        val entry = ForkEntry(
            sequence = 2,
            cursor = TimelineCursor.atSequence(2),
            event = ChronicleEvent(
                eventId = "sim_test",
                kind = ChronicleEventKind.DEATH,
                timestampMs = 1700000000000L,
                status = EventStatus.PENDING,
                source = EventSource.SERVER_RECEIPT // VIOLATION
            ),
            origin = ForkEntryOrigin.SIMULATED
        )

        ForkIsolation.validateEntry(entry)
    }

    @Test(expected = ForkIsolationViolation::class)
    fun `simulated entry without sim_ prefix fails validation`() {
        val entry = ForkEntry(
            sequence = 2,
            cursor = TimelineCursor.atSequence(2),
            event = ChronicleEvent(
                eventId = "evt_2", // VIOLATION: not sim_ prefix
                kind = ChronicleEventKind.DEATH,
                timestampMs = 1700000000000L,
                status = EventStatus.PENDING,
                source = EventSource.CLIENT_INTENT
            ),
            origin = ForkEntryOrigin.SIMULATED
        )

        ForkIsolation.validateEntry(entry)
    }

    @Test(expected = ForkIsolationViolation::class)
    fun `simulated explanation with CONFIRMED decision fails validation`() {
        val entry = ForkEntry(
            sequence = 2,
            cursor = TimelineCursor.atSequence(2),
            event = ChronicleEvent(
                eventId = "sim_test",
                kind = ChronicleEventKind.DEATH,
                timestampMs = 1700000000000L,
                status = EventStatus.PENDING,
                source = EventSource.CLIENT_INTENT
            ),
            explanation = Explanation(
                explanationId = "exp_2",
                subjectId = "sim_test",
                decision = ExplainDecision.CONFIRMED, // VIOLATION
                ruleIds = listOf("TEST"),
                reason = "[SIMULATED] Test",
                timestampMs = 1700000000000L
            ),
            origin = ForkEntryOrigin.SIMULATED
        )

        ForkIsolation.validateEntry(entry)
    }

    @Test(expected = ForkIsolationViolation::class)
    fun `simulated explanation without SIMULATED marker fails validation`() {
        val entry = ForkEntry(
            sequence = 2,
            cursor = TimelineCursor.atSequence(2),
            event = ChronicleEvent(
                eventId = "sim_test",
                kind = ChronicleEventKind.DEATH,
                timestampMs = 1700000000000L,
                status = EventStatus.PENDING,
                source = EventSource.CLIENT_INTENT
            ),
            explanation = Explanation(
                explanationId = "exp_2",
                subjectId = "sim_test",
                decision = ExplainDecision.PENDING,
                ruleIds = listOf("TEST"),
                reason = "Test reason without marker", // VIOLATION
                timestampMs = 1700000000000L
            ),
            origin = ForkEntryOrigin.SIMULATED
        )

        ForkIsolation.validateEntry(entry)
    }

    // =========================================================================
    // Fork validation
    // =========================================================================

    @Test
    fun `valid fork passes validation`() {
        val entry = TimelineEntry(
            sequence = 5,
            cursor = TimelineCursor.atSequence(5),
            event = ChronicleEvent(
                eventId = "evt_5",
                kind = ChronicleEventKind.ZONE_ENTER,
                timestampMs = 1700000000000L,
                status = EventStatus.CONFIRMED,
                source = EventSource.SERVER_RECEIPT
            )
        )

        val fork = ForkBuilder.forkFromEntry(
            entry = entry,
            label = "Test",
            createdBy = "player_1"
        )

        // Should not throw
        ForkIsolation.validateFork(fork)
    }

    @Test(expected = ForkIsolationViolation::class)
    fun `fork with invalid ID fails validation`() {
        val entry = TimelineEntry(
            sequence = 5,
            cursor = TimelineCursor.atSequence(5)
        )

        val metadata = ForkMetadata(
            forkId = "invalid_id", // VIOLATION: not fork_ prefix
            label = "Test",
            createdAtMs = 1700000000000L,
            createdBy = "player_1",
            purpose = ForkPurpose.WHAT_IF
        )

        val fork = ForkTimeline(
            metadata = metadata,
            branchPoint = ForkPoint.from(entry),
            entries = java.util.TreeMap()
        )

        ForkIsolation.validateFork(fork)
    }

    // =========================================================================
    // ID detection utilities
    // =========================================================================

    @Test
    fun `isSimulatedEventId detects sim prefix`() {
        assertTrue(ForkIsolation.isSimulatedEventId("sim_fork_123_5"))
        assertTrue(ForkIsolation.isSimulatedEventId("fork_123"))
        assertFalse(ForkIsolation.isSimulatedEventId("evt_123"))
        assertFalse(ForkIsolation.isSimulatedEventId("rcpt_123"))
    }

    @Test
    fun `isValidForkId validates format`() {
        assertTrue(ForkIsolation.isValidForkId("fork_12345"))
        assertTrue(ForkIsolation.isValidForkId("fork_1700000000000_1234"))
        assertFalse(ForkIsolation.isValidForkId("fork"))
        assertFalse(ForkIsolation.isValidForkId("invalid_123"))
        assertFalse(ForkIsolation.isValidForkId(""))
    }

    // =========================================================================
    // Integration: ReplayScrubber maintains isolation
    // =========================================================================

    @Test
    fun `ReplayScrubber simulations maintain isolation`() {
        val entry = TimelineEntry(
            sequence = 5,
            cursor = TimelineCursor.atSequence(5),
            event = ChronicleEvent(
                eventId = "evt_5",
                kind = ChronicleEventKind.ZONE_ENTER,
                timestampMs = 1700000000000L,
                status = EventStatus.CONFIRMED,
                source = EventSource.SERVER_RECEIPT
            )
        )

        val fork = ForkBuilder.forkFromEntry(
            entry = entry,
            label = "Test",
            createdBy = "player_1"
        )

        var scrubber = ReplayScrubber.from(fork)

        // Add simulations
        for (i in 1..3) {
            scrubber = scrubber.simulateEvent(
                kind = ChronicleEventKind.ZONE_ENTER,
                reason = "Sim $i",
                ruleIds = listOf("TEST")
            )
        }

        // Validate entire fork
        ForkIsolation.validateFork(scrubber.fork)
    }
}
