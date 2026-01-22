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
import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for ProofBundle (PR 6C-4).
 *
 * Test groups:
 * 1. Bundle construction
 * 2. Determinism (same inputs → same output)
 * 3. Integrity verification
 * 4. JSON export format
 * 5. Text/Markdown export
 * 6. Builder from timeline entry
 */
class ProofBundleTest {

    // =========================================================================
    // Test fixtures
    // =========================================================================

    private fun createTestEvent(
        eventId: String = "evt_123",
        actionId: String? = "act_456",
        kind: ChronicleEventKind = ChronicleEventKind.DEATH
    ) = ChronicleEvent(
        eventId = eventId,
        actionId = actionId,
        kind = kind,
        timestampMs = 1700000000000L,
        zone = "Azura",
        x = 32,
        y = 32,
        details = mapOf(
            "killer_name" to "Goblin",
            "items_lost" to listOf("sword_1", "shield_1")
        ),
        status = EventStatus.CONFIRMED,
        source = EventSource.SERVER_RECEIPT
    )

    private fun createTestReceipt(
        receiptId: String = "rcpt_789",
        actionId: String? = "act_456"
    ) = Receipt(
        receiptId = receiptId,
        actionId = actionId,
        type = "death",
        timestampMs = 1700000000000L,
        payload = mapOf(
            "killer_name" to "Goblin",
            "items_lost" to listOf("sword_1", "shield_1")
        )
    )

    private fun createTestExplanation(
        subjectId: String = "evt_123"
    ) = Explanation(
        explanationId = "exp_evt_123_1700000000000",
        subjectId = subjectId,
        decision = ExplainDecision.CONFIRMED,
        ruleIds = listOf("DEATH_DROP_POLICY", "PROTECTED_SLOT_POLICY"),
        reason = "Death by Goblin caused equipment drop",
        details = mapOf("killer" to "Goblin"),
        evidenceRefs = listOf("rcpt_789", "snapshot:100"),
        timestampMs = 1700000000000L
    )

    private fun createTestSnapshotEvidence() = SnapshotEvidence(
        prevSequence = 99,
        sequence = 100,
        prevStateHash = "hash_99",
        stateHash = "hash_100",
        sequenceDelta = 1,
        stateTransition = "99 → 100",
        inventoryDelta = InventoryDelta(
            playerId = "player_1",
            removedItemIds = listOf("shield_1", "sword_1"),
            addedItemIds = emptyList()
        )
    )

    // =========================================================================
    // 1. Bundle construction
    // =========================================================================

    @Test
    fun `build creates valid bundle`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            receipt = createTestReceipt(),
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        assertEquals(BundleMetadata.CURRENT_VERSION, bundle.version)
        assertEquals("evt_123", bundle.eventId)
        assertEquals("player_1", bundle.identifiers.playerId)
        assertTrue(bundle.isReceipted)
    }

    @Test
    fun `build sets correct bundle type from event kind`() {
        val deathBundle = ProofBundleBuilder.build(
            event = createTestEvent(kind = ChronicleEventKind.DEATH),
            explanation = createTestExplanation(),
            playerId = "player_1"
        )
        assertEquals(BundleType.DEATH_PROOF, deathBundle.metadata.bundleType)

        val dropBundle = ProofBundleBuilder.build(
            event = createTestEvent(eventId = "evt_drop", kind = ChronicleEventKind.ITEM_DROP),
            explanation = createTestExplanation(subjectId = "evt_drop"),
            playerId = "player_1"
        )
        assertEquals(BundleType.DROP_PROOF, dropBundle.metadata.bundleType)
    }

    @Test
    fun `build without receipt sets isReceipted false`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            playerId = "player_1"
        )

        assertFalse(bundle.isReceipted)
        assertNull(bundle.receipt)
    }

    @Test
    fun `build with snapshot evidence sets hasStateEvidence true`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            snapshotEvidence = createTestSnapshotEvidence(),
            playerId = "player_1"
        )

        assertTrue(bundle.hasStateEvidence)
        assertNotNull(bundle.snapshotEvidence)
        assertEquals(100L, bundle.snapshotEvidence?.sequence)
    }

    @Test
    fun `citesRule checks explanation rules`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            playerId = "player_1"
        )

        assertTrue(bundle.citesRule("DEATH_DROP_POLICY"))
        assertTrue(bundle.citesRule("PROTECTED_SLOT_POLICY"))
        assertFalse(bundle.citesRule("NONEXISTENT_RULE"))
    }

    // =========================================================================
    // 2. Determinism
    // =========================================================================

    @Test
    fun `same inputs produce same content hash`() {
        val event = createTestEvent()
        val explanation = createTestExplanation()
        val receipt = createTestReceipt()
        val evidence = createTestSnapshotEvidence()

        val bundle1 = ProofBundleBuilder.build(
            event = event,
            explanation = explanation,
            receipt = receipt,
            snapshotEvidence = evidence,
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        val bundle2 = ProofBundleBuilder.build(
            event = event,
            explanation = explanation,
            receipt = receipt,
            snapshotEvidence = evidence,
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        assertEquals(bundle1.contentHash, bundle2.contentHash)
    }

    @Test
    fun `different timestamps produce different hashes`() {
        val event = createTestEvent()
        val explanation = createTestExplanation()

        val bundle1 = ProofBundleBuilder.build(
            event = event,
            explanation = explanation,
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        val bundle2 = ProofBundleBuilder.build(
            event = event,
            explanation = explanation,
            playerId = "player_1",
            createdAtMs = 1700000000001L
        )

        assertNotEquals(bundle1.contentHash, bundle2.contentHash)
    }

    @Test
    fun `different events produce different hashes`() {
        val explanation = createTestExplanation()

        val bundle1 = ProofBundleBuilder.build(
            event = createTestEvent(eventId = "evt_1"),
            explanation = explanation,
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        val bundle2 = ProofBundleBuilder.build(
            event = createTestEvent(eventId = "evt_2"),
            explanation = explanation,
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        assertNotEquals(bundle1.contentHash, bundle2.contentHash)
    }

    // =========================================================================
    // 3. Integrity verification
    // =========================================================================

    @Test
    fun `content hash is SHA-256 format`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            playerId = "player_1"
        )

        // SHA-256 produces 64 hex characters
        assertEquals(64, bundle.contentHash.length)
        assertTrue(bundle.contentHash.matches(Regex("[0-9a-f]+")))
    }

    @Test
    fun `integrity includes algorithm`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            playerId = "player_1"
        )

        assertEquals("SHA-256", bundle.integrity.algorithm)
    }

    @Test
    fun `integrity includes receipt chain hash when provided`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            playerId = "player_1",
            receiptChainHash = "chain_hash_abc123"
        )

        assertEquals("chain_hash_abc123", bundle.integrity.receiptChainHash)
    }

    @Test
    fun `computeHash is deterministic`() {
        val content = "test content for hashing"

        val hash1 = BundleIntegrity.computeHash(content)
        val hash2 = BundleIntegrity.computeHash(content)

        assertEquals(hash1, hash2)
    }

    // =========================================================================
    // 4. JSON export format
    // =========================================================================

    @Test
    fun `toCanonicalJson produces valid JSON`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            receipt = createTestReceipt(),
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        val json = bundle.toCanonicalJson()

        // Should be parseable
        assertFalse(json.isEmpty())
        assertTrue(json.startsWith("{"))
        assertTrue(json.endsWith("}"))
    }

    @Test
    fun `toCanonicalJson includes all sections`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            receipt = createTestReceipt(),
            snapshotEvidence = createTestSnapshotEvidence(),
            playerId = "player_1"
        )

        val json = bundle.toCanonicalJson()

        assertTrue(json.contains("\"version\""))
        assertTrue(json.contains("\"metadata\""))
        assertTrue(json.contains("\"identifiers\""))
        assertTrue(json.contains("\"event\""))
        assertTrue(json.contains("\"receipt\""))
        assertTrue(json.contains("\"explanation\""))
        assertTrue(json.contains("\"snapshotEvidence\""))
        assertTrue(json.contains("\"integrity\""))
    }

    @Test
    fun `toCanonicalJson is deterministic`() {
        val event = createTestEvent()
        val explanation = createTestExplanation()

        val bundle1 = ProofBundleBuilder.build(
            event = event,
            explanation = explanation,
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        val bundle2 = ProofBundleBuilder.build(
            event = event,
            explanation = explanation,
            playerId = "player_1",
            createdAtMs = 1700000000000L
        )

        assertEquals(bundle1.toCanonicalJson(), bundle2.toCanonicalJson())
    }

    @Test
    fun `toPrettyJson has indentation`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            playerId = "player_1"
        )

        val prettyJson = bundle.toPrettyJson()

        assertTrue(prettyJson.contains("\n"))
        assertTrue(prettyJson.contains("  ")) // indentation
    }

    @Test
    fun `JSON includes ISO timestamps`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            playerId = "player_1"
        )

        val json = bundle.toCanonicalJson()

        assertTrue(json.contains("timestampIso"))
        assertTrue(json.contains("createdAtIso"))
    }

    // =========================================================================
    // 5. Text/Markdown export
    // =========================================================================

    @Test
    fun `toText produces readable output`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            receipt = createTestReceipt(),
            playerId = "player_1"
        )

        val text = bundle.toText()

        assertTrue(text.contains("PROOF BUNDLE"))
        assertTrue(text.contains("DEATH_PROOF"))
        assertTrue(text.contains("evt_123"))
        assertTrue(text.contains("player_1"))
        assertTrue(text.contains("EVENT"))
        assertTrue(text.contains("RECEIPT"))
        assertTrue(text.contains("EXPLANATION"))
        assertTrue(text.contains("INTEGRITY"))
    }

    @Test
    fun `toText includes event icon`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(kind = ChronicleEventKind.DEATH),
            explanation = createTestExplanation(),
            playerId = "player_1"
        )

        val text = bundle.toText()

        assertTrue(text.contains("☠"))
    }

    @Test
    fun `toText shows inventory delta`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            snapshotEvidence = createTestSnapshotEvidence(),
            playerId = "player_1"
        )

        val text = bundle.toText()

        assertTrue(text.contains("STATE EVIDENCE"))
        assertTrue(text.contains("Items lost"))
    }

    @Test
    fun `toMarkdown produces valid markdown`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            receipt = createTestReceipt(),
            playerId = "player_1"
        )

        val md = bundle.toMarkdown()

        assertTrue(md.contains("# Proof Bundle"))
        assertTrue(md.contains("## Event"))
        assertTrue(md.contains("## Receipt"))
        assertTrue(md.contains("## Explanation"))
        assertTrue(md.contains("## Integrity"))
        assertTrue(md.contains("| Field | Value |"))
    }

    @Test
    fun `toMarkdown includes JSON preview`() {
        val bundle = ProofBundleBuilder.build(
            event = createTestEvent(),
            explanation = createTestExplanation(),
            playerId = "player_1"
        )

        val md = bundle.toMarkdown()

        assertTrue(md.contains("## Raw JSON"))
        assertTrue(md.contains("<details>"))
        assertTrue(md.contains("```json"))
    }

    // =========================================================================
    // 6. Supporting classes
    // =========================================================================

    @Test
    fun `BundleMetadata create uses current version`() {
        val metadata = BundleMetadata.create(
            createdBy = "player_1",
            bundleType = BundleType.DEATH_PROOF
        )

        assertEquals(BundleMetadata.CURRENT_VERSION, metadata.version)
    }

    @Test
    fun `BundleIdentifiers generateBundleId is deterministic`() {
        val id1 = BundleIdentifiers.generateBundleId("evt_1", 1700000000000L)
        val id2 = BundleIdentifiers.generateBundleId("evt_1", 1700000000000L)

        assertEquals(id1, id2)
        assertTrue(id1.startsWith("bundle_"))
    }

    @Test
    fun `BundleIntegrity fromContent computes hash`() {
        val integrity = BundleIntegrity.fromContent("test content")

        assertEquals(64, integrity.contentHash.length)
        assertEquals("SHA-256", integrity.algorithm)
    }

    @Test
    fun `BundleIntegrity isSigned checks signature`() {
        val unsigned = BundleIntegrity.withHash("hash")
        val signed = BundleIntegrity(
            contentHash = "hash",
            signature = "sig_123"
        )

        assertFalse(unsigned.isSigned)
        assertTrue(signed.isSigned)
    }
}
