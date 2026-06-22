package com.akalynth.client.proof

import com.akalynth.client.chronicle.ChronicleGlyphResolver
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Export utilities for ProofBundle.
 *
 * Provides:
 * - Canonical JSON (deterministic, machine-verifiable)
 * - Pretty JSON (human-readable)
 * - Plain text (shareable summary)
 * - Markdown (formatted for display)
 *
 * Canonical JSON rules:
 * - Keys sorted alphabetically at all levels
 * - No extra whitespace
 * - Null values included explicitly as "null"
 * - Numbers rendered without trailing zeros
 */
object ProofBundleExporter {

    private val iso8601Format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    // =========================================================================
    // JSON Export
    // =========================================================================

    /**
     * Export to canonical JSON string.
     *
     * Canonical means: sorted keys, no whitespace, deterministic.
     * This is the format used for content hash computation.
     */
    fun toCanonicalJson(bundle: ProofBundle): String {
        val json = toJsonObject(bundle)
        return sortedJsonString(json, indent = 0)
    }

    /**
     * Export to pretty-printed JSON string.
     */
    fun toPrettyJson(bundle: ProofBundle): String {
        val json = toJsonObject(bundle)
        return sortedJsonString(json, indent = 2)
    }

    /**
     * Convert bundle to JSONObject.
     */
    private fun toJsonObject(bundle: ProofBundle): JSONObject {
        val json = JSONObject()

        // Version at top level for quick schema detection
        json.put("version", bundle.version)

        // Metadata
        json.put("metadata", JSONObject().apply {
            put("version", bundle.metadata.version)
            put("createdAtMs", bundle.metadata.createdAtMs)
            put("createdAtIso", iso8601Format.format(Date(bundle.metadata.createdAtMs)))
            put("createdBy", bundle.metadata.createdBy)
            put("bundleType", bundle.metadata.bundleType.name)
            put("label", bundle.metadata.label ?: JSONObject.NULL)
        })

        // Identifiers
        json.put("identifiers", JSONObject().apply {
            put("bundleId", bundle.identifiers.bundleId)
            put("eventId", bundle.identifiers.eventId)
            put("actionId", bundle.identifiers.actionId ?: JSONObject.NULL)
            put("receiptId", bundle.identifiers.receiptId ?: JSONObject.NULL)
            put("playerId", bundle.identifiers.playerId)
            put("sessionId", bundle.identifiers.sessionId ?: JSONObject.NULL)
            put("sequence", bundle.identifiers.sequence ?: JSONObject.NULL)
        })

        // Event
        json.put("event", JSONObject().apply {
            put("eventId", bundle.event.eventId)
            put("actionId", bundle.event.actionId ?: JSONObject.NULL)
            put("kind", bundle.event.kind.name)
            put("timestampMs", bundle.event.timestampMs)
            put("timestampIso", iso8601Format.format(Date(bundle.event.timestampMs)))
            put("zone", bundle.event.zone ?: JSONObject.NULL)
            put("x", bundle.event.x ?: JSONObject.NULL)
            put("y", bundle.event.y ?: JSONObject.NULL)
            put("status", bundle.event.status.name)
            put("source", bundle.event.source.name)
            put("details", JSONObject(bundle.event.details))
        })

        // Receipt (optional)
        if (bundle.receipt != null) {
            json.put("receipt", JSONObject().apply {
                put("receiptId", bundle.receipt.receiptId)
                put("actionId", bundle.receipt.actionId ?: JSONObject.NULL)
                put("type", bundle.receipt.type)
                put("timestampMs", bundle.receipt.timestampMs)
                put("timestampIso", iso8601Format.format(Date(bundle.receipt.timestampMs)))
                put("payload", JSONObject(bundle.receipt.payload))
            })
        } else {
            json.put("receipt", JSONObject.NULL)
        }

        // Explanation
        json.put("explanation", JSONObject().apply {
            put("explanationId", bundle.explanation.explanationId)
            put("subjectId", bundle.explanation.subjectId)
            put("decision", bundle.explanation.decision.name)
            put("ruleIds", JSONArray(bundle.explanation.ruleIds))
            put("reason", bundle.explanation.reason)
            put("details", JSONObject(bundle.explanation.details))
            put("evidenceRefs", JSONArray(bundle.explanation.evidenceRefs))
            put("remediation", bundle.explanation.remediation ?: JSONObject.NULL)
            put("timestampMs", bundle.explanation.timestampMs)
        })

        // Snapshot evidence (optional)
        if (bundle.snapshotEvidence != null) {
            json.put("snapshotEvidence", JSONObject().apply {
                put("prevSequence", bundle.snapshotEvidence.prevSequence ?: JSONObject.NULL)
                put("sequence", bundle.snapshotEvidence.sequence ?: JSONObject.NULL)
                put("prevStateHash", bundle.snapshotEvidence.prevStateHash ?: JSONObject.NULL)
                put("stateHash", bundle.snapshotEvidence.stateHash ?: JSONObject.NULL)
                put("sequenceDelta", bundle.snapshotEvidence.sequenceDelta ?: JSONObject.NULL)
                put("stateTransition", bundle.snapshotEvidence.stateTransition ?: JSONObject.NULL)

                // Inventory delta
                val delta = bundle.snapshotEvidence.inventoryDelta
                if (delta != null) {
                    put("inventoryDelta", JSONObject().apply {
                        put("playerId", delta.playerId)
                        put("removedItemIds", JSONArray(delta.removedItemIds))
                        put("addedItemIds", JSONArray(delta.addedItemIds))
                    })
                } else {
                    put("inventoryDelta", JSONObject.NULL)
                }
            })
        } else {
            json.put("snapshotEvidence", JSONObject.NULL)
        }

        // Snapshot diff (optional, summary only in JSON)
        if (bundle.snapshotDiff != null && bundle.snapshotDiff.hasChanges) {
            json.put("snapshotDiff", JSONObject().apply {
                put("prevSequence", bundle.snapshotDiff.prevSequence ?: JSONObject.NULL)
                put("currSequence", bundle.snapshotDiff.currSequence ?: JSONObject.NULL)
                put("hasChanges", bundle.snapshotDiff.hasChanges)
                put("summary", JSONObject().apply {
                    put("addedCount", bundle.snapshotDiff.summary.addedCount)
                    put("removedCount", bundle.snapshotDiff.summary.removedCount)
                    put("modifiedCount", bundle.snapshotDiff.summary.modifiedCount)
                    put("totalChanges", bundle.snapshotDiff.summary.totalChanges)
                })
                // Include entries for completeness
                put("entries", JSONArray().apply {
                    bundle.snapshotDiff.entries.forEach { entry ->
                        put(JSONObject().apply {
                            put("key", entry.key)
                            put("category", entry.category.name)
                            put("changeType", entry.changeType.name)
                            put("prevValue", entry.prevValue ?: JSONObject.NULL)
                            put("currValue", entry.currValue ?: JSONObject.NULL)
                            put("description", entry.description)
                        })
                    }
                })
            })
        } else {
            json.put("snapshotDiff", JSONObject.NULL)
        }

        // Integrity
        json.put("integrity", JSONObject().apply {
            put("contentHash", bundle.integrity.contentHash)
            put("algorithm", bundle.integrity.algorithm)
            put("receiptChainHash", bundle.integrity.receiptChainHash ?: JSONObject.NULL)
            put("signature", bundle.integrity.signature ?: JSONObject.NULL)
            put("merkleRoot", bundle.integrity.merkleRoot ?: JSONObject.NULL)
        })

        return json
    }

    /**
     * Convert JSONObject to string with sorted keys.
     */
    private fun sortedJsonString(json: JSONObject, indent: Int): String {
        return if (indent > 0) {
            json.toString(indent)
        } else {
            json.toString()
        }
    }

    // =========================================================================
    // Text Export
    // =========================================================================

    /**
     * Export to human-readable plain text.
     */
    fun toText(bundle: ProofBundle): String {
        val sb = StringBuilder()

        // Header
        sb.appendLine("═══════════════════════════════════════════════════════════════")
        sb.appendLine("  PROOF BUNDLE: ${bundle.metadata.bundleType.name}")
        sb.appendLine("═══════════════════════════════════════════════════════════════")
        sb.appendLine()

        // Summary
        sb.appendLine("Bundle ID:    ${bundle.bundleId}")
        sb.appendLine("Event ID:     ${bundle.eventId}")
        sb.appendLine("Player:       ${bundle.identifiers.playerId}")
        sb.appendLine("Created:      ${iso8601Format.format(Date(bundle.metadata.createdAtMs))}")
        sb.appendLine("Version:      ${bundle.version}")
        sb.appendLine()

        // Event section
        sb.appendLine("─── EVENT ───────────────────────────────────────────────────────")
        sb.appendLine("Kind:         ${ChronicleGlyphResolver.exportLabel(bundle.event.kind)} ${bundle.event.kind.name}")
        sb.appendLine("Status:       ${bundle.event.status.name}")
        sb.appendLine("Timestamp:    ${iso8601Format.format(Date(bundle.event.timestampMs))}")
        if (bundle.event.zone != null) {
            sb.appendLine("Zone:         ${bundle.event.zone}")
        }
        if (bundle.event.x != null && bundle.event.y != null) {
            sb.appendLine("Position:     (${bundle.event.x}, ${bundle.event.y})")
        }
        sb.appendLine()

        // Receipt section (if present)
        if (bundle.receipt != null) {
            sb.appendLine("─── RECEIPT ─────────────────────────────────────────────────────")
            sb.appendLine("Receipt ID:   ${bundle.receipt.receiptId}")
            sb.appendLine("Type:         ${bundle.receipt.type}")
            sb.appendLine("Timestamp:    ${iso8601Format.format(Date(bundle.receipt.timestampMs))}")
            sb.appendLine()
        }

        // Explanation section
        sb.appendLine("─── EXPLANATION ─────────────────────────────────────────────────")
        sb.appendLine("Decision:     ${bundle.explanation.decision.name}")
        sb.appendLine("Reason:       ${bundle.explanation.reason}")
        sb.appendLine("Rules:        ${bundle.explanation.ruleIds.joinToString(", ")}")
        if (bundle.explanation.remediation != null) {
            sb.appendLine("Remediation:  ${bundle.explanation.remediation}")
        }
        sb.appendLine()

        // State evidence (if present)
        if (bundle.snapshotEvidence != null) {
            sb.appendLine("─── STATE EVIDENCE ──────────────────────────────────────────────")
            if (bundle.snapshotEvidence.stateTransition != null) {
                sb.appendLine("Transition:   ${bundle.snapshotEvidence.stateTransition}")
            }
            if (bundle.snapshotEvidence.sequence != null) {
                val prev = bundle.snapshotEvidence.prevSequence ?: "?"
                sb.appendLine("Sequence:     $prev → ${bundle.snapshotEvidence.sequence}")
            }
            bundle.snapshotEvidence.inventoryDelta?.let { delta ->
                if (delta.removedItemIds.isNotEmpty()) {
                    sb.appendLine("Items lost:   ${delta.removedItemIds.joinToString(", ")}")
                }
                if (delta.addedItemIds.isNotEmpty()) {
                    sb.appendLine("Items gained: ${delta.addedItemIds.joinToString(", ")}")
                }
            }
            sb.appendLine()
        }

        // Diff (if present)
        if (bundle.snapshotDiff != null && bundle.snapshotDiff.hasChanges) {
            sb.appendLine("─── STATE DIFF ──────────────────────────────────────────────────")
            sb.appendLine(bundle.snapshotDiff.toText())
            sb.appendLine()
        }

        // Integrity footer
        sb.appendLine("─── INTEGRITY ───────────────────────────────────────────────────")
        sb.appendLine("Hash:         ${bundle.integrity.contentHash.take(16)}...")
        sb.appendLine("Algorithm:    ${bundle.integrity.algorithm}")
        if (bundle.integrity.receiptChainHash != null) {
            sb.appendLine("Chain Hash:   ${bundle.integrity.receiptChainHash.take(16)}...")
        }
        sb.appendLine()
        sb.appendLine("═══════════════════════════════════════════════════════════════")

        return sb.toString()
    }

    // =========================================================================
    // Markdown Export
    // =========================================================================

    /**
     * Export to Markdown format.
     */
    fun toMarkdown(bundle: ProofBundle): String {
        val sb = StringBuilder()

        // Title
        sb.appendLine("# Proof Bundle: ${bundle.metadata.bundleType.name}")
        sb.appendLine()

        // Summary table
        sb.appendLine("| Field | Value |")
        sb.appendLine("|-------|-------|")
        sb.appendLine("| Bundle ID | `${bundle.bundleId}` |")
        sb.appendLine("| Event ID | `${bundle.eventId}` |")
        sb.appendLine("| Player | `${bundle.identifiers.playerId}` |")
        sb.appendLine("| Created | ${iso8601Format.format(Date(bundle.metadata.createdAtMs))} |")
        sb.appendLine("| Version | ${bundle.version} |")
        sb.appendLine()

        // Event section
        sb.appendLine("## Event")
        sb.appendLine()
        sb.appendLine("- **Kind:** ${ChronicleGlyphResolver.exportLabel(bundle.event.kind)} ${bundle.event.kind.name}")
        sb.appendLine("- **Status:** ${bundle.event.status.name}")
        sb.appendLine("- **Timestamp:** ${iso8601Format.format(Date(bundle.event.timestampMs))}")
        if (bundle.event.zone != null) {
            sb.appendLine("- **Zone:** ${bundle.event.zone}")
        }
        if (bundle.event.x != null && bundle.event.y != null) {
            sb.appendLine("- **Position:** (${bundle.event.x}, ${bundle.event.y})")
        }
        sb.appendLine()

        // Receipt section
        if (bundle.receipt != null) {
            sb.appendLine("## Receipt")
            sb.appendLine()
            sb.appendLine("- **Receipt ID:** `${bundle.receipt.receiptId}`")
            sb.appendLine("- **Type:** ${bundle.receipt.type}")
            sb.appendLine("- **Timestamp:** ${iso8601Format.format(Date(bundle.receipt.timestampMs))}")
            sb.appendLine()
        }

        // Explanation section
        sb.appendLine("## Explanation")
        sb.appendLine()
        sb.appendLine("- **Decision:** ${bundle.explanation.decision.name}")
        sb.appendLine("- **Reason:** ${bundle.explanation.reason}")
        sb.appendLine("- **Rules:** ${bundle.explanation.ruleIds.joinToString(", ") { "`$it`" }}")
        if (bundle.explanation.remediation != null) {
            sb.appendLine("- **Remediation:** ${bundle.explanation.remediation}")
        }
        sb.appendLine()

        // State evidence
        if (bundle.snapshotEvidence != null) {
            sb.appendLine("## State Evidence")
            sb.appendLine()
            if (bundle.snapshotEvidence.stateTransition != null) {
                sb.appendLine("- **Transition:** ${bundle.snapshotEvidence.stateTransition}")
            }
            if (bundle.snapshotEvidence.sequence != null) {
                val prev = bundle.snapshotEvidence.prevSequence ?: "?"
                sb.appendLine("- **Sequence:** $prev → ${bundle.snapshotEvidence.sequence}")
            }
            bundle.snapshotEvidence.inventoryDelta?.let { delta ->
                if (delta.removedItemIds.isNotEmpty()) {
                    sb.appendLine("- **Items lost:** ${delta.removedItemIds.joinToString(", ") { "`$it`" }}")
                }
                if (delta.addedItemIds.isNotEmpty()) {
                    sb.appendLine("- **Items gained:** ${delta.addedItemIds.joinToString(", ") { "`$it`" }}")
                }
            }
            sb.appendLine()
        }

        // Diff
        if (bundle.snapshotDiff != null && bundle.snapshotDiff.hasChanges) {
            sb.appendLine("## State Diff")
            sb.appendLine()
            sb.appendLine("```")
            sb.appendLine(bundle.snapshotDiff.toText())
            sb.appendLine("```")
            sb.appendLine()
        }

        // Integrity
        sb.appendLine("## Integrity")
        sb.appendLine()
        sb.appendLine("- **Hash:** `${bundle.integrity.contentHash}`")
        sb.appendLine("- **Algorithm:** ${bundle.integrity.algorithm}")
        if (bundle.integrity.receiptChainHash != null) {
            sb.appendLine("- **Chain Hash:** `${bundle.integrity.receiptChainHash}`")
        }
        sb.appendLine()

        // JSON preview
        sb.appendLine("## Raw JSON")
        sb.appendLine()
        sb.appendLine("<details>")
        sb.appendLine("<summary>Click to expand</summary>")
        sb.appendLine()
        sb.appendLine("```json")
        sb.appendLine(bundle.toPrettyJson())
        sb.appendLine("```")
        sb.appendLine()
        sb.appendLine("</details>")

        return sb.toString()
    }
}
