package com.akalynth.client.proof

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.ChronicleEventKind
import com.akalynth.client.chronicle.EventSource
import com.akalynth.client.chronicle.EventStatus
import com.akalynth.client.chronicle.Receipt
import com.akalynth.client.explain.ExplainDecision
import com.akalynth.client.explain.Explanation
import com.akalynth.client.snapshot.InventoryDelta
import com.akalynth.client.snapshot.SnapshotEvidence
import com.akalynth.client.snapshot.SnapshotV0
import com.akalynth.client.snapshot.diff.SnapshotDiff
import com.akalynth.client.snapshot.diff.DiffSummary
import com.akalynth.client.timeline.TimelineCursor
import com.akalynth.client.timeline.TimelineEntry
import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for ProofBundleBuilder (PR 6C-4).
 *
 * Focus on:
 * 1. Builder from timeline entry
 * 2. Bundle type inference
 * 3. Identifiers generation
 * 4. Hash computation determinism
 */
class ProofBundleBuilderTest {

    // =========================================================================
    // Fixtures
    // =========================================================================

    private val testEvent = ChronicleEvent(
        eventId = "evt_death_1",
        actionId = "act_move_1",
        kind = ChronicleEventKind.DEATH,
        timestampMs = 1700000000000L,
        zone = "Azura",
        x = 32,
        y = 32,
        details = mapOf("killer_name" to "Goblin"),
        status = EventStatus.CONFIRMED,
        source = EventSource.SERVER_RECEIPT
    )

    private val testReceipt = Receipt(
        receiptId = "rcpt_death_1",
        actionId = "act_move_1",
        type = "death",
        timestampMs = 1700000000000L,
        payload = mapOf("killer_name" to "Goblin")
    )

    private val testExplanation = Explanation(
        explanationId = "exp_1",
        subjectId = "evt_death_1",
        decision = ExplainDecision.CONFIRMED,
        ruleIds = listOf("DEATH_DROP_POLICY"),
        reason = "Killed by Goblin",
        timestampMs = 1700000000000L
    )

    private val testEvidence = SnapshotEvidence(
        prevSequence = 99,
        sequence = 100,
        stateTransition = "99 → 100",
        inventoryDelta = InventoryDelta(
            playerId = "player_1",
            removedItemIds = listOf("sword_1")
        )
    )

    // =========================================================================
    // 1. Builder from timeline entry
    // =========================================================================

    @Test
    fun `fromTimelineEntry returns null without event`() {
        val entry = TimelineEntry(
            sequence = 100,
            cursor = TimelineCursor.atSequence(100),
            event = null,
            explanation = testExplanation
        )

        val bundle = ProofBundleBuilder.fromTimelineEntry(entry, playerId = "player_1")

        assertNull(bundle)
    }

    @Test
    fun `fromTimelineEntry returns null without explanation`() {
        val entry = TimelineEntry(
            sequence = 100,
            cursor = TimelineCursor.atSequence(100),
            event = testEvent,
            explanation = null
        )

        val bundle = ProofBundleBuilder.fromTimelineEntry(entry, playerId = "player_1")

        assertNull(bundle)
    }

    @Test
    fun `fromTimelineEntry builds complete bundle`() {
        val entry = TimelineEntry(
            sequence = 100,
            cursor = TimelineCursor(
                sequence = 100,
                eventId = testEvent.eventId,
                actionId = testEvent.actionId
            ),
            event = testEvent,
            receipt = testReceipt,
            prevSnapshot = SnapshotV0(99, "hash_99"),
            snapshot = SnapshotV0(100, "hash_100"),
            snapshotEvidence = testEvidence,
            explanation = testExplanation
        )

        val bundle = ProofBundleBuilder.fromTimelineEntry(
            entry = entry,
            playerId = "player_1",
            sessionId = "session_123",
            createdAtMs = 1700000000000L
        )

        assertNotNull(bundle)
        assertEquals("evt_death_1", bundle!!.eventId)
        assertEquals("rcpt_death_1", bundle.receipt?.receiptId)
        assertEquals("player_1", bundle.identifiers.playerId)
        assertEquals("session_123", bundle.identifiers.sessionId)
        assertTrue(bundle.hasStateEvidence)
    }

    @Test
    fun `fromTimelineEntry computes diff if not present`() {
        val entry = TimelineEntry(
            sequence = 100,
            cursor = TimelineCursor.atSequence(100),
            event = testEvent,
            explanation = testExplanation,
            prevSnapshot = SnapshotV0(99, "hash_99"),
            snapshot = SnapshotV0(100, "hash_100"),
            snapshotDiff = null
        )

        val bundle = ProofBundleBuilder.fromTimelineEntry(entry, playerId = "player_1")

        assertNotNull(bundle)
        // Diff should be computed from snapshots (hash change)
        assertTrue(bundle!!.hasDiff)
    }

    // =========================================================================
    // 2. Bundle type inference
    // =========================================================================

    @Test
    fun `DEATH event produces DEATH_PROOF`() {
        val bundle = ProofBundleBuilder.build(
            event = testEvent.copy(kind = ChronicleEventKind.DEATH),
            explanation = testExplanation,
            playerId = "player_1"
        )

        assertEquals(BundleType.DEATH_PROOF, bundle.metadata.bundleType)
    }

    @Test
    fun `ITEM_DROP event produces DROP_PROOF`() {
        val bundle = ProofBundleBuilder.build(
            event = testEvent.copy(kind = ChronicleEventKind.ITEM_DROP),
            explanation = testExplanation,
            playerId = "player_1"
        )

        assertEquals(BundleType.DROP_PROOF, bundle.metadata.bundleType)
    }

    @Test
    fun `ITEM_PICKUP event produces PICKUP_PROOF`() {
        val bundle = ProofBundleBuilder.build(
            event = testEvent.copy(kind = ChronicleEventKind.ITEM_PICKUP),
            explanation = testExplanation,
            playerId = "player_1"
        )

        assertEquals(BundleType.PICKUP_PROOF, bundle.metadata.bundleType)
    }

    @Test
    fun `COMBAT_KILL event produces COMBAT_PROOF`() {
        val bundle = ProofBundleBuilder.build(
            event = testEvent.copy(kind = ChronicleEventKind.COMBAT_KILL),
            explanation = testExplanation,
            playerId = "player_1"
        )

        assertEquals(BundleType.COMBAT_PROOF, bundle.metadata.bundleType)
    }

    @Test
    fun `ZONE_ENTER event produces ZONE_TRANSITION_PROOF`() {
        val bundle = ProofBundleBuilder.build(
            event = testEvent.copy(kind = ChronicleEventKind.ZONE_ENTER),
            explanation = testExplanation,
            playerId = "player_1"
        )

        assertEquals(BundleType.ZONE_TRANSITION_PROOF, bundle.metadata.bundleType)
    }

    @Test
    fun `UNKNOWN event produces EVENT_PROOF`() {
        val bundle = ProofBundleBuilder.build(
            event = testEvent.copy(kind = ChronicleEventKind.UNKNOWN),
            explanation = testExplanation,
            playerId = "player_1"
        )

        assertEquals(BundleType.EVENT_PROOF, bundle.metadata.bundleType)
    }

    // =========================================================================
    // 3. Identifiers generation
    // =========================================================================

    @Test
    fun `bundleId derived from receiptId when present`() {
        val bundle = ProofBundleBuilder.build(
            event = testEvent,
            explanation = testExplanation,
            receipt = testReceipt,
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        assertTrue(bundle.bundleId.contains("rcpt_death_1"))
    }

    @Test
    fun `bundleId derived from eventId when no receipt`() {
        val bundle = ProofBundleBuilder.build(
            event = testEvent,
            explanation = testExplanation,
            receipt = null,
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        assertTrue(bundle.bundleId.contains("evt_death_1"))
    }

    @Test
    fun `actionId propagated from event`() {
        val bundle = ProofBundleBuilder.build(
            event = testEvent,
            explanation = testExplanation,
            playerId = "player_1"
        )

        assertEquals("act_move_1", bundle.identifiers.actionId)
    }

    @Test
    fun `sequence propagated from evidence`() {
        val bundle = ProofBundleBuilder.build(
            event = testEvent,
            explanation = testExplanation,
            snapshotEvidence = testEvidence,
            playerId = "player_1"
        )

        assertEquals(100L, bundle.identifiers.sequence)
    }

    // =========================================================================
    // 4. Hash computation determinism
    // =========================================================================

    @Test
    fun `hash is stable across builds`() {
        val hashes = (1..5).map {
            ProofBundleBuilder.build(
                event = testEvent,
                explanation = testExplanation,
                receipt = testReceipt,
                snapshotEvidence = testEvidence,
                playerId = "player_1",
                createdAtMs = 1700000000000L
            ).contentHash
        }

        // All hashes should be identical
        assertTrue(hashes.all { it == hashes[0] })
    }

    @Test
    fun `hash changes with different player`() {
        val bundle1 = ProofBundleBuilder.build(
            event = testEvent,
            explanation = testExplanation,
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        val bundle2 = ProofBundleBuilder.build(
            event = testEvent,
            explanation = testExplanation,
            playerId = "player_2",
            createdAtMs = 1700000000000L
        )

        assertNotEquals(bundle1.contentHash, bundle2.contentHash)
    }

    @Test
    fun `hash changes with different receipt`() {
        val bundle1 = ProofBundleBuilder.build(
            event = testEvent,
            explanation = testExplanation,
            receipt = testReceipt,
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        val bundle2 = ProofBundleBuilder.build(
            event = testEvent,
            explanation = testExplanation,
            receipt = testReceipt.copy(receiptId = "rcpt_different"),
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        assertNotEquals(bundle1.contentHash, bundle2.contentHash)
    }

    @Test
    fun `hash changes with label`() {
        val bundle1 = ProofBundleBuilder.build(
            event = testEvent,
            explanation = testExplanation,
            playerId = "player_1",
            label = null,
            createdAtMs = 1700000000000L
        )

        val bundle2 = ProofBundleBuilder.build(
            event = testEvent,
            explanation = testExplanation,
            playerId = "player_1",
            label = "My death proof",
            createdAtMs = 1700000000000L
        )

        assertNotEquals(bundle1.contentHash, bundle2.contentHash)
    }

    // =========================================================================
    // 5. Chain hash propagation
    // =========================================================================

    @Test
    fun `receiptChainHash propagated to integrity`() {
        val bundle = ProofBundleBuilder.build(
            event = testEvent,
            explanation = testExplanation,
            playerId = "player_1",
            receiptChainHash = "chain_abc123"
        )

        assertEquals("chain_abc123", bundle.integrity.receiptChainHash)
    }
}
