package com.akalynth.client.proof

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.ChronicleEventKind
import com.akalynth.client.chronicle.Receipt
import com.akalynth.client.explain.Explanation
import com.akalynth.client.snapshot.SnapshotEvidence
import com.akalynth.client.snapshot.diff.SnapshotDiff
import com.akalynth.client.timeline.TimelineEntry

/**
 * Pure builder for ProofBundle instances.
 *
 * Design principles:
 * - Pure function: No I/O, no side effects
 * - Deterministic: Same inputs always produce same output
 * - No inference: Bundles what's given, doesn't fabricate
 * - Validation: Enforces required fields
 *
 * Usage:
 * ```kotlin
 * val bundle = ProofBundleBuilder.build(
 *     event = event,
 *     receipt = receipt,
 *     explanation = explanation,
 *     playerId = "player123"
 * )
 * ```
 */
object ProofBundleBuilder {

    /**
     * Build a proof bundle from components.
     *
     * @param event The chronicle event (required)
     * @param explanation The explanation (required)
     * @param receipt Server receipt if confirmed
     * @param snapshotEvidence State evidence if available
     * @param snapshotDiff Diff if computed
     * @param playerId Player this relates to (required)
     * @param sessionId Session ID if available
     * @param label Optional human label
     * @param createdAtMs Timestamp (defaults to now)
     * @param receiptChainHash Receipt chain hash at time of creation
     */
    fun build(
        event: ChronicleEvent,
        explanation: Explanation,
        receipt: Receipt? = null,
        snapshotEvidence: SnapshotEvidence? = null,
        snapshotDiff: SnapshotDiff? = null,
        playerId: String,
        sessionId: String? = null,
        label: String? = null,
        createdAtMs: Long = System.currentTimeMillis(),
        receiptChainHash: String? = null
    ): ProofBundle {
        // Determine bundle type from event kind
        val bundleType = bundleTypeFromKind(event.kind)

        // Create metadata
        val metadata = BundleMetadata.create(
            createdBy = playerId,
            bundleType = bundleType,
            label = label,
            createdAtMs = createdAtMs
        )

        // Create identifiers
        val identifiers = BundleIdentifiers(
            bundleId = BundleIdentifiers.generateBundleId(
                receipt?.receiptId ?: event.eventId,
                createdAtMs
            ),
            eventId = event.eventId,
            actionId = event.actionId,
            receiptId = receipt?.receiptId,
            playerId = playerId,
            sessionId = sessionId,
            sequence = snapshotEvidence?.sequence
        )

        // Build preliminary bundle for hash computation
        val preliminaryBundle = ProofBundle(
            metadata = metadata,
            identifiers = identifiers,
            event = event,
            receipt = receipt,
            explanation = explanation,
            snapshotEvidence = snapshotEvidence,
            snapshotDiff = snapshotDiff,
            integrity = BundleIntegrity.withHash("pending", receiptChainHash)
        )

        // Compute content hash
        val canonicalContent = computeHashableContent(preliminaryBundle)
        val contentHash = BundleIntegrity.computeHash(canonicalContent)

        // Create final integrity
        val integrity = BundleIntegrity(
            contentHash = contentHash,
            receiptChainHash = receiptChainHash
        )

        // Return final bundle with real integrity
        return preliminaryBundle.copy(integrity = integrity)
    }

    /**
     * Build from a TimelineEntry.
     *
     * Extracts all available data from the entry.
     */
    fun fromTimelineEntry(
        entry: TimelineEntry,
        playerId: String,
        sessionId: String? = null,
        label: String? = null,
        createdAtMs: Long = System.currentTimeMillis(),
        receiptChainHash: String? = null
    ): ProofBundle? {
        val event = entry.event ?: return null
        val explanation = entry.explanation ?: return null

        // Compute diff if not already present
        val diff = entry.snapshotDiff ?: entry.computeDiff().takeIf { it.hasChanges }

        return build(
            event = event,
            explanation = explanation,
            receipt = entry.receipt,
            snapshotEvidence = entry.snapshotEvidence,
            snapshotDiff = diff,
            playerId = playerId,
            sessionId = sessionId,
            label = label,
            createdAtMs = createdAtMs,
            receiptChainHash = receiptChainHash
        )
    }

    /**
     * Determine bundle type from event kind.
     */
    private fun bundleTypeFromKind(kind: ChronicleEventKind): BundleType = when (kind) {
        ChronicleEventKind.DEATH -> BundleType.DEATH_PROOF
        ChronicleEventKind.ITEM_DROP -> BundleType.DROP_PROOF
        ChronicleEventKind.ITEM_PICKUP -> BundleType.PICKUP_PROOF
        ChronicleEventKind.COMBAT_KILL -> BundleType.COMBAT_PROOF
        ChronicleEventKind.ZONE_ENTER -> BundleType.ZONE_TRANSITION_PROOF
        else -> BundleType.EVENT_PROOF
    }

    /**
     * Compute the hashable content string.
     *
     * This produces a deterministic string representation used for
     * content hash computation. The format is canonical (sorted keys).
     */
    private fun computeHashableContent(bundle: ProofBundle): String {
        // Build deterministic string representation
        // Order: metadata, identifiers, event, receipt, explanation, evidence
        val sb = StringBuilder()

        // Metadata (sorted)
        sb.append("metadata:")
        sb.append("bundleType=${bundle.metadata.bundleType},")
        sb.append("createdAtMs=${bundle.metadata.createdAtMs},")
        sb.append("createdBy=${bundle.metadata.createdBy},")
        sb.append("label=${bundle.metadata.label},")
        sb.append("version=${bundle.metadata.version};")

        // Identifiers (sorted)
        sb.append("identifiers:")
        sb.append("actionId=${bundle.identifiers.actionId},")
        sb.append("bundleId=${bundle.identifiers.bundleId},")
        sb.append("eventId=${bundle.identifiers.eventId},")
        sb.append("playerId=${bundle.identifiers.playerId},")
        sb.append("receiptId=${bundle.identifiers.receiptId},")
        sb.append("sequence=${bundle.identifiers.sequence},")
        sb.append("sessionId=${bundle.identifiers.sessionId};")

        // Event
        sb.append("event:")
        sb.append("eventId=${bundle.event.eventId},")
        sb.append("kind=${bundle.event.kind},")
        sb.append("status=${bundle.event.status},")
        sb.append("timestampMs=${bundle.event.timestampMs};")

        // Receipt (if present)
        bundle.receipt?.let { r ->
            sb.append("receipt:")
            sb.append("receiptId=${r.receiptId},")
            sb.append("type=${r.type},")
            sb.append("timestampMs=${r.timestampMs};")
        }

        // Explanation
        sb.append("explanation:")
        sb.append("decision=${bundle.explanation.decision},")
        sb.append("explanationId=${bundle.explanation.explanationId},")
        sb.append("reason=${bundle.explanation.reason},")
        sb.append("ruleIds=${bundle.explanation.ruleIds.sorted().joinToString(",")};")

        // Snapshot evidence (if present)
        bundle.snapshotEvidence?.let { se ->
            sb.append("snapshotEvidence:")
            sb.append("prevSequence=${se.prevSequence},")
            sb.append("sequence=${se.sequence},")
            sb.append("stateTransition=${se.stateTransition};")
        }

        return sb.toString()
    }
}
