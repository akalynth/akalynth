package com.akalynth.client.proof

import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.Receipt
import com.akalynth.client.explain.Explanation
import com.akalynth.client.snapshot.SnapshotEvidence
import com.akalynth.client.snapshot.diff.SnapshotDiff

/**
 * Portable, immutable proof bundle.
 *
 * A ProofBundle is a self-contained packet that proves what happened
 * and why. It can be exported, shared, and verified independently.
 *
 * Design principles:
 * - Immutable: Once created, never modified
 * - Self-contained: All evidence is inline, no external dependencies
 * - Verifiable: contentHash allows tamper detection
 * - Versioned: Schema version for forward compatibility
 * - Exportable: Canonical JSON and human-readable text formats
 *
 * @property metadata Bundle provenance and versioning
 * @property identifiers All IDs linking to external records
 * @property event The chronicle event being proven
 * @property receipt The server receipt (if confirmed)
 * @property explanation Why this happened (rules + reasoning)
 * @property snapshotEvidence State evidence (sequence, hash, inventory delta)
 * @property snapshotDiff Human-readable diff of what changed
 * @property integrity Cryptographic verification data
 */
data class ProofBundle(
    val metadata: BundleMetadata,
    val identifiers: BundleIdentifiers,
    val event: ChronicleEvent,
    val receipt: Receipt? = null,
    val explanation: Explanation,
    val snapshotEvidence: SnapshotEvidence? = null,
    val snapshotDiff: SnapshotDiff? = null,
    val integrity: BundleIntegrity
) {
    // =========================================================================
    // Convenience accessors
    // =========================================================================

    /** Bundle schema version */
    val version: Int get() = metadata.version

    /** Unique bundle identifier */
    val bundleId: String get() = identifiers.bundleId

    /** Event ID being proven */
    val eventId: String get() = identifiers.eventId

    /** Whether this proof is receipt-backed (authoritative) */
    val isReceipted: Boolean get() = receipt != null

    /** Whether this bundle includes state evidence */
    val hasStateEvidence: Boolean get() = snapshotEvidence != null

    /** Whether this bundle includes a diff */
    val hasDiff: Boolean get() = snapshotDiff != null && snapshotDiff.hasChanges

    /** Content hash for verification */
    val contentHash: String get() = integrity.contentHash

    // =========================================================================
    // Verification
    // =========================================================================

    /**
     * Check if bundle cites a specific rule.
     */
    fun citesRule(ruleId: String): Boolean = explanation.citesRule(ruleId)

    /**
     * Get all rule IDs cited in the explanation.
     */
    val citedRules: List<String> get() = explanation.ruleIds

    /**
     * Get all evidence references.
     */
    val evidenceRefs: List<String> get() = explanation.evidenceRefs

    // =========================================================================
    // Export helpers (delegation to formatters)
    // =========================================================================

    /**
     * Export to canonical JSON string.
     *
     * Canonical means: sorted keys, no extra whitespace, deterministic output.
     * This is the format used for content hash computation.
     */
    fun toCanonicalJson(): String = ProofBundleExporter.toCanonicalJson(this)

    /**
     * Export to pretty-printed JSON string.
     *
     * For human inspection, includes indentation.
     */
    fun toPrettyJson(): String = ProofBundleExporter.toPrettyJson(this)

    /**
     * Export to human-readable text format.
     */
    fun toText(): String = ProofBundleExporter.toText(this)

    /**
     * Export to Markdown format.
     */
    fun toMarkdown(): String = ProofBundleExporter.toMarkdown(this)

    companion object {
        /** Current bundle schema version */
        const val CURRENT_VERSION = BundleMetadata.CURRENT_VERSION
    }
}
